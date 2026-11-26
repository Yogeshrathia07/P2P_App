/**
 * Chunked P2P file transfer with SHA-256 verification and backpressure pacing.
 * Solves:
 * - Problem 6 (Large files crash the tab): slices files into 24 KB chunks, paces sending, and verifies integrity.
 */

import { base64ToBytes, bytesToBase64, sha256Hex } from './crypto.js';

export const CHUNK_SIZE = 24 * 1024; // 24 KB (stays safely under WebRTC SCTP limits)
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB safety cap

/** Slice a Uint8Array/ArrayBuffer into indexed base64 chunks. */
export function sliceBufferToChunks(buffer, fileId, chunkSize = CHUNK_SIZE) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const totalChunks = Math.max(1, Math.ceil(bytes.length / chunkSize));
  const chunks = [];
  for (let index = 0; index < totalChunks; index++) {
    const start = index * chunkSize;
    const end = Math.min(bytes.length, start + chunkSize);
    chunks.push({
      fileId,
      index,
      total: totalChunks,
      dataB64: bytesToBase64(bytes.subarray(start, end)),
    });
  }
  return chunks;
}

/**
 * Assemble incoming file chunks out-of-order, track progress, and verify SHA-256.
 */
export class FileAssembler {
  constructor(meta) {
    this.fileId = meta.fileId;
    this.name = meta.name;
    this.mime = meta.mime || 'application/octet-stream';
    this.size = Number(meta.size) || 0;
    this.totalChunks = Math.max(1, Number(meta.totalChunks) || 1);
    this.expectedSha256 = meta.sha256 || '';
    this.parts = new Array(this.totalChunks);
    this.receivedCount = 0;
    this.completed = false;
    this.failedReason = null;
  }

  /** Add one incoming chunk. Returns { duplicate, progress, done, bytes?, error? }. */
  async addChunk(chunk) {
    if (this.completed) return { duplicate: true, progress: 1, done: true };
    if (!chunk || chunk.fileId !== this.fileId) {
      return { duplicate: false, progress: this.getProgress(), done: false, error: 'mismatched_file_id' };
    }
    const idx = Number(chunk.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.totalChunks) {
      return { duplicate: false, progress: this.getProgress(), done: false, error: 'invalid_chunk_index' };
    }
    if (this.parts[idx] !== undefined) {
      return { duplicate: true, progress: this.getProgress(), done: false };
    }

    const decoded = base64ToBytes(chunk.dataB64);
    this.parts[idx] = decoded;
    this.receivedCount += 1;

    const progress = this.getProgress();
    if (this.receivedCount < this.totalChunks) {
      return { duplicate: false, progress, done: false };
    }

    // All chunks received: assemble and verify SHA-256
    const totalLength = this.parts.reduce((acc, part) => acc + part.length, 0);
    if (this.size > 0 && totalLength !== this.size) {
      this.failedReason = `Size mismatch (${totalLength} vs ${this.size})`;
      return { duplicate: false, progress: 1, done: false, error: this.failedReason };
    }

    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of this.parts) {
      merged.set(part, offset);
      offset += part.length;
    }

    if (this.expectedSha256) {
      const actualHash = await sha256Hex(merged);
      if (actualHash !== this.expectedSha256) {
        this.failedReason = 'SHA-256 checksum mismatch';
        return { duplicate: false, progress: 1, done: false, error: this.failedReason };
      }
    }

    this.completed = true;
    this.parts = []; // Release chunk array references promptly
    return { duplicate: false, progress: 1, done: true, bytes: merged };
  }

  getProgress() {
    return this.receivedCount / this.totalChunks;
  }
}
