/**
 * Room utilities for code-based matchmaking and direct link generation.
 * Ensures consistent room identifiers between production domains and local development.
 */

/**
 * Generates an instantaneous clean, memorable 6-character room code (e.g. PF-7K2M9X).
 * Uses non-ambiguous uppercase characters (avoids 0, O, 1, I).
 */
export function generateRandomRoomCode() {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `PF-${suffix}`;
}

/**
 * Normalizes user-entered room codes or URLs into a clean, canonical uppercase Room Code.
 * Handles full URLs (http://.../room/PF-8921), case insensitivity (pf-8921),
 * bare alphanumeric codes (8921 -> PF-8921), and query params.
 */
export function normalizeRoomCode(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return '';

  let code = rawInput;
  try {
    code = decodeURIComponent(code);
  } catch (e) {
    // ignore
  }

  code = code.trim();

  // If user pasted a full URL or path (e.g. https://domain.com/room/PF-8921)
  const roomUrlMatch = code.match(/\/room\/([^\s?#]+)/i);
  if (roomUrlMatch && roomUrlMatch[1]) {
    code = roomUrlMatch[1];
  }

  // Strip query parameters, hashes, trailing slashes, and quotes
  code = code
    .split('?')[0]
    .split('#')[0]
    .replace(/[/'"]/g, '')
    .replace(/\s+/g, '') // Remove all whitespace
    .trim()
    .toUpperCase();

  // If user entered 4 to 8 alphanumeric characters without a prefix, prefix with PF-
  if (/^[A-Z0-9]{4,8}$/.test(code) && !code.startsWith('PF-')) {
    return `PF-${code}`;
  }

  return code;
}

/**
 * Validates if the given code is a plausibly valid room code string.
 */
export function isValidRoomCode(code) {
  if (!code || typeof code !== 'string') return false;
  const normalized = normalizeRoomCode(code);
  return normalized.length >= 4 && normalized.length <= 64;
}

/**
 * Generates a full shareable room link for the current environment.
 */
export function generateRoomLink(roomCode) {
  if (!roomCode) return '';
  const cleanCode = normalizeRoomCode(roomCode);
  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  return `${origin}/room/${encodeURIComponent(cleanCode)}`;
}

