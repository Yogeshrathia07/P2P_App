/**
 * Client-side persistence using IndexedDB (with graceful in-memory fallback).
 * Solves:
 * - Problem 2 (Data lost on refresh): persists identity, chat, notes, whiteboard strokes, tombstones, and file blobs.
 */

const DB_NAME = 'PeerDeskDB_v1';
const DB_VERSION = 1;

const memoryFallback = {
  identity: new Map(),
  rooms: new Map(),
  fileBlobs: new Map(),
};

function openDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('identity')) db.createObjectStore('identity');
        if (!db.objectStoreNames.contains('rooms')) db.createObjectStore('rooms');
        if (!db.objectStoreNames.contains('fileBlobs')) db.createObjectStore('fileBlobs');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(storeName, key) {
  const db = await openDb();
  if (!db) return memoryFallback[storeName].get(key) ?? null;
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

async function idbPut(storeName, key, value) {
  const db = await openDb();
  if (!db) {
    memoryFallback[storeName].set(key, value);
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function idbDelete(storeName, key) {
  const db = await openDb();
  if (!db) {
    memoryFallback[storeName].delete(key);
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function loadIdentityProfile() {
  return idbGet('identity', 'profile');
}

export async function saveIdentityProfile(profile) {
  return idbPut('identity', 'profile', profile);
}

export async function loadRoomSnapshot(roomTopic) {
  return idbGet('rooms', roomTopic);
}

export async function saveRoomSnapshot(roomTopic, snapshot) {
  return idbPut('rooms', roomTopic, snapshot);
}

export async function saveFileBlob(roomTopic, fileId, record) {
  // record: { name, mime, size, bytes: Uint8Array }
  return idbPut('fileBlobs', `${roomTopic}::${fileId}`, record);
}

export async function loadFileBlob(roomTopic, fileId) {
  return idbGet('fileBlobs', `${roomTopic}::${fileId}`);
}

export async function deleteFileBlob(roomTopic, fileId) {
  return idbDelete('fileBlobs', `${roomTopic}::${fileId}`);
}
