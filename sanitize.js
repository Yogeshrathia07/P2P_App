/**
 * Input validation, sanitization, and per-peer rate limiting.
 * Solves:
 * - Problem 9 (Malicious input): rejects malformed schemas, oversized payloads, unsafe URLs, and peer flood attacks.
 */

export const LIMITS = {
  MAX_NAME_LEN: 28,
  MAX_CHAT_LEN: 2000,
  MAX_NOTE_TITLE_LEN: 120,
  MAX_NOTE_BODY_LEN: 15000,
  MAX_PACKET_BYTES: 96 * 1024,
  MAX_STROKE_POINTS: 800,
  MAX_SYNC_BATCH: 250,
};

const ALLOWED_PACKET_TYPES = new Set([
  'HELLO',
  'CHAT',
  'NOTE_OP',
  'STROKE',
  'STROKE_CLEAR',
  'TOMBSTONE',
  'SYNC_DIGEST',
  'SYNC_REQUEST',
  'SYNC_BATCH',
  'FILE_META',
  'FILE_CHUNK',
  'FILE_REQUEST',
  'CURSOR',
  'TIMER',
]);

/** Strip dangerous ASCII control chars while preserving newlines and tabs. */
export function sanitizeText(value, maxLen = LIMITS.MAX_CHAT_LEN) {
  if (typeof value !== 'string') return '';
  // Remove C0 control chars except \t (0x09), \n (0x0A), \r (0x0D) and DEL (0x7F)
  const cleaned = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  return cleaned.slice(0, maxLen);
}

/** Sanitize peer display name. */
export function sanitizeDisplayName(name) {
  const cleaned = sanitizeText(String(name ?? ''), LIMITS.MAX_NAME_LEN).replace(/\s+/g, ' ');
  return cleaned || 'Student';
}

/** Escape HTML entities (used only for safe SVG/export contexts; DOM always uses textContent). */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Allow only http: and https: URLs. */
export function isSafeUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Validate basic shape and size of an incoming decrypted packet. */
export function validatePacket(packet) {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    return { ok: false, reason: 'Packet is not an object' };
  }
  if (typeof packet.type !== 'string' || !ALLOWED_PACKET_TYPES.has(packet.type)) {
    return { ok: false, reason: `Unknown packet type: ${String(packet.type)}` };
  }
  try {
    const approxSize = JSON.stringify(packet).length;
    if (approxSize > LIMITS.MAX_PACKET_BYTES) {
      return { ok: false, reason: `Packet exceeds ${LIMITS.MAX_PACKET_BYTES} bytes` };
    }
  } catch {
    return { ok: false, reason: 'Packet not serializable' };
  }

  if (packet.type === 'STROKE') {
    const pts = packet.stroke?.points;
    if (!Array.isArray(pts) || pts.length === 0 || pts.length > LIMITS.MAX_STROKE_POINTS) {
      return { ok: false, reason: 'Invalid stroke points' };
    }
  }

  if (packet.type === 'SYNC_BATCH') {
    if (Array.isArray(packet.items) && packet.items.length > LIMITS.MAX_SYNC_BATCH) {
      return { ok: false, reason: 'Sync batch exceeds maximum allowed items' };
    }
  }

  return { ok: true };
}

/**
 * Per-peer Token Bucket rate limiter to protect the UI and memory from peer flooding.
 */
export function createRateLimiter({ maxTokens = 80, refillPerSec = 40 } = {}) {
  const buckets = new Map();

  function allow(peerId, cost = 1, now = Date.now()) {
    const key = String(peerId || 'unknown');
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: maxTokens, last: now };
      buckets.set(key, bucket);
    }
    const elapsedSec = Math.max(0, (now - bucket.last) / 1000);
    bucket.tokens = Math.min(maxTokens, bucket.tokens + elapsedSec * refillPerSec);
    bucket.last = now;

    if (bucket.tokens < cost) {
      return false;
    }
    bucket.tokens -= cost;
    return true;
  }

  function reset(peerId) {
    buckets.delete(String(peerId));
  }

  return { allow, reset };
}
