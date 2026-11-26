/**
 * Cryptographic primitives for PeerDesk using the browser Web Crypto API.
 * Solves:
 * - Problem 8 (Fake identities): ECDSA P-256 keypairs, fingerprints, and message signing.
 * - Problem 11 (Strangers in your room): SHA-256 room topic derivation and PBKDF2 + AES-256-GCM E2EE.
 * - Problem 6 (File integrity): SHA-256 digest verification for chunked transfers.
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** Convert an ArrayBuffer or Uint8Array to base64. */
export function bytesToBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < arr.length; i += chunkSize) {
    binary += String.fromCharCode(...arr.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Convert a base64 string to Uint8Array. */
export function base64ToBytes(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/** Convert bytes to lowercase hex string. */
export function bytesToHex(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compute SHA-256 hex digest of a string or Uint8Array. */
export async function sha256Hex(input) {
  const data = typeof input === 'string' ? textEncoder.encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Deterministic JSON serialization with sorted object keys so signatures
 * verify consistently regardless of key insertion order.
 */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((v) => canonicalJson(v)).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  return (
    '{' +
    keys
      .filter((k) => value[k] !== undefined)
      .map((k) => JSON.stringify(k) + ':' + canonicalJson(value[k]))
      .join(',') +
    '}'
  );
}

/** Compute short human-readable identity fingerprint (e.g. A4F9-21C8) from public JWK. */
export async function computeFingerprint(publicKeyJwk) {
  const canonical = canonicalJson({
    crv: publicKeyJwk.crv,
    kty: publicKeyJwk.kty,
    x: publicKeyJwk.x,
    y: publicKeyJwk.y,
  });
  const hex = await sha256Hex(canonical);
  const upper = hex.slice(0, 8).toUpperCase();
  return `${upper.slice(0, 4)}-${upper.slice(4, 8)}`;
}

/** Generate a fresh ECDSA P-256 identity keypair. */
export async function generateIdentity() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign', 'verify']
  );
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const fingerprint = await computeFingerprint(publicKeyJwk);
  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyJwk,
    fingerprint,
  };
}

/** Sign an arbitrary JSON-serializable payload with ECDSA P-256 / SHA-256. */
export async function signPayload(privateKey, payload) {
  const bytes = textEncoder.encode(canonicalJson(payload));
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    bytes
  );
  return bytesToBase64(new Uint8Array(sig));
}

/** Verify a payload signature against a sender's exported public JWK. */
export async function verifyPayload(publicKeyJwk, payload, signatureB64) {
  if (!publicKeyJwk || !signatureB64 || typeof signatureB64 !== 'string') {
    return false;
  }
  try {
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      {
        kty: publicKeyJwk.kty,
        crv: publicKeyJwk.crv,
        x: publicKeyJwk.x,
        y: publicKeyJwk.y,
        ext: true,
      },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
    const bytes = textEncoder.encode(canonicalJson(payload));
    const sigBytes = base64ToBytes(signatureB64);
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      sigBytes,
      bytes
    );
  } catch {
    return false;
  }
}

/**
 * Derive an opaque room topic ID from roomCode + optional passcode so public
 * signaling relays never see human-readable room names.
 */
export async function deriveRoomTopic(roomCode, passcode = '') {
  const normalized = `${roomCode.trim().toLowerCase()}::${passcode}`;
  const hash = await sha256Hex(`peerdesk-topic-v1:${normalized}`);
  return `pd-${hash.slice(0, 24)}`;
}

/**
 * Derive an AES-256-GCM key from roomCode + passcode using PBKDF2-SHA256.
 * Returns null if passcode is empty (open room mode).
 */
export async function deriveRoomAesKey(roomCode, passcode) {
  if (!passcode || !passcode.trim()) return null;
  const baseKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(passcode),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const salt = textEncoder.encode(`peerdesk-salt-v1:${roomCode.trim().toLowerCase()}`);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt a JSON payload with AES-256-GCM. */
export async function encryptEnvelope(aesKey, payload) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = textEncoder.encode(JSON.stringify(payload));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plain);
  return {
    enc: true,
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(cipher)),
  };
}

/** Decrypt an AES-256-GCM envelope back to its JSON payload. */
export async function decryptEnvelope(aesKey, envelope) {
  if (!envelope || !envelope.enc || typeof envelope.iv !== 'string' || typeof envelope.ct !== 'string') {
    throw new Error('Invalid encrypted envelope');
  }
  const iv = base64ToBytes(envelope.iv);
  const ct = base64ToBytes(envelope.ct);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
  return JSON.parse(textDecoder.decode(plain));
}
