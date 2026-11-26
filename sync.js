/**
 * Decentralised state synchronization engine.
 * Solves:
 * - Problem 1 (Late joiners see no history): digest + delta sync protocol.
 * - Problem 3 (Messages in the wrong order): Lamport logical clocks + deterministic tie-breakers.
 * - Problem 4 (Duplicate messages): globally unique IDs + idempotent seen-set deduplication.
 * - Problem 12 (Deleting data everywhere): signed tombstones (delete-wins) synced across peers.
 */

import { LIMITS, sanitizeDisplayName, sanitizeText } from './sanitize.js';

/** Deterministic comparator for Lamport-ordered records. */
export function compareLamportRecords(a, b) {
  if (a.lamport !== b.lamport) return a.lamport - b.lamport;
  const senderCmp = String(a.senderId).localeCompare(String(b.senderId));
  if (senderCmp !== 0) return senderCmp;
  return String(a.id).localeCompare(String(b.id));
}

/** True if candidate (lamport, senderId, id) is strictly newer than current. */
export function isNewerVersion(candidate, current) {
  if (!current) return true;
  return compareLamportRecords(candidate, current) > 0;
}

export class StudyRoomState {
  constructor(snapshot = null) {
    this.lamport = 0;
    this.seenIds = new Set();
    this.messages = new Map();     // id -> ChatMessage
    this.noteBlocks = new Map();   // id -> NoteBlock (LWW per block)
    this.strokes = new Map();      // id -> Stroke
    this.files = new Map();        // fileId -> FileMeta
    this.tombstones = new Map();   // targetId -> Tombstone
    this.clearMarker = null;       // { id, lamport, senderId } for latest whiteboard clear

    if (snapshot) {
      this.loadSnapshot(snapshot);
    }
  }

  /** Advance local Lamport clock before emitting an event. */
  tick() {
    this.lamport += 1;
    return this.lamport;
  }

  /** Merge remote Lamport clock on receipt. */
  observe(remoteLamport) {
    const val = Number.isFinite(remoteLamport) && remoteLamport >= 0 ? Math.floor(remoteLamport) : 0;
    this.lamport = Math.max(this.lamport, val) + 1;
    return this.lamport;
  }

  /** Check whether a target ID has been deleted via tombstone. */
  isDeleted(targetId) {
    return this.tombstones.has(targetId);
  }

  /** Apply a chat message idempotently. */
  applyMessage(msg) {
    if (!msg || typeof msg.id !== 'string' || typeof msg.senderId !== 'string') {
      return { applied: false, reason: 'invalid_message' };
    }
    this.observe(msg.lamport);
    if (this.seenIds.has(msg.id) || this.tombstones.has(msg.id)) {
      return { applied: false, reason: 'duplicate_or_tombstoned' };
    }
    const clean = {
      kind: 'message',
      id: msg.id,
      senderId: msg.senderId,
      senderName: sanitizeDisplayName(msg.senderName),
      fingerprint: String(msg.fingerprint || 'UNVERIFIED'),
      publicKeyJwk: msg.publicKeyJwk || null,
      signature: msg.signature || null,
      verified: Boolean(msg.verified),
      text: sanitizeText(msg.text, LIMITS.MAX_CHAT_LEN),
      lamport: Math.max(1, Math.floor(Number(msg.lamport) || 1)),
      createdAt: Number(msg.createdAt) || Date.now(),
    };
    if (!clean.text) return { applied: false, reason: 'empty_text' };

    this.seenIds.add(clean.id);
    this.messages.set(clean.id, clean);
    return { applied: true, kind: 'message', item: clean };
  }

  /** Apply a collaborative note block LWW update idempotently. */
  applyNoteBlock(block) {
    if (!block || typeof block.id !== 'string' || typeof block.senderId !== 'string') {
      return { applied: false, reason: 'invalid_block' };
    }
    this.observe(block.lamport);
    if (this.tombstones.has(block.id)) {
      return { applied: false, reason: 'tombstoned' };
    }

    const candidate = {
      kind: 'note',
      id: block.id,
      opId: String(block.opId || `${block.id}:${block.lamport}:${block.senderId}`),
      title: sanitizeText(block.title || 'Untitled Note', LIMITS.MAX_NOTE_TITLE_LEN) || 'Untitled Note',
      body: sanitizeText(block.body || '', LIMITS.MAX_NOTE_BODY_LEN),
      orderKey: Number.isFinite(block.orderKey) ? block.orderKey : (Number(block.createdAt) || Date.now()),
      lamport: Math.max(1, Math.floor(Number(block.lamport) || 1)),
      senderId: block.senderId,
      senderName: sanitizeDisplayName(block.senderName),
      fingerprint: String(block.fingerprint || 'UNVERIFIED'),
      publicKeyJwk: block.publicKeyJwk || null,
      signature: block.signature || null,
      verified: Boolean(block.verified),
      updatedAt: Number(block.updatedAt) || Date.now(),
    };

    const existing = this.noteBlocks.get(candidate.id);
    if (!isNewerVersion(candidate, existing)) {
      return { applied: false, reason: 'stale_version' };
    }

    this.noteBlocks.set(candidate.id, candidate);
    return { applied: true, kind: 'note', item: candidate };
  }

  /** Apply a whiteboard stroke idempotently. */
  applyStroke(stroke) {
    if (!stroke || typeof stroke.id !== 'string' || !Array.isArray(stroke.points)) {
      return { applied: false, reason: 'invalid_stroke' };
    }
    this.observe(stroke.lamport);
    if (this.seenIds.has(stroke.id) || this.tombstones.has(stroke.id)) {
      return { applied: false, reason: 'duplicate_or_tombstoned' };
    }

    const cleanPoints = stroke.points
      .slice(0, LIMITS.MAX_STROKE_POINTS)
      .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
      .map((p) => ({
        x: Math.max(0, Math.min(1, Number(p.x))),
        y: Math.max(0, Math.min(1, Number(p.y))),
      }));

    if (cleanPoints.length === 0) return { applied: false, reason: 'empty_points' };

    const clean = {
      kind: 'stroke',
      id: stroke.id,
      senderId: String(stroke.senderId || 'peer'),
      color: /^#[0-9a-fA-F]{6}$/.test(stroke.color) ? stroke.color : '#38bdf8',
      width: Math.max(1, Math.min(24, Number(stroke.width) || 3)),
      tool: stroke.tool === 'eraser' ? 'eraser' : 'pen',
      points: cleanPoints,
      lamport: Math.max(1, Math.floor(Number(stroke.lamport) || 1)),
    };

    this.seenIds.add(clean.id);
    this.strokes.set(clean.id, clean);
    return { applied: true, kind: 'stroke', item: clean };
  }

  /** Apply a whiteboard clear marker (LWW). */
  applyClearMarker(marker) {
    if (!marker || typeof marker.id !== 'string' || typeof marker.senderId !== 'string') {
      return { applied: false, reason: 'invalid_clear_marker' };
    }
    this.observe(marker.lamport);
    const candidate = {
      kind: 'clear',
      id: marker.id,
      lamport: Math.max(1, Math.floor(Number(marker.lamport) || 1)),
      senderId: marker.senderId,
      senderName: sanitizeDisplayName(marker.senderName),
    };
    if (!isNewerVersion(candidate, this.clearMarker)) {
      return { applied: false, reason: 'stale_clear' };
    }
    this.clearMarker = candidate;
    return { applied: true, kind: 'clear', item: candidate };
  }

  /** Apply shared file metadata announcement. */
  applyFileMeta(meta) {
    if (!meta || typeof meta.fileId !== 'string' || typeof meta.senderId !== 'string') {
      return { applied: false, reason: 'invalid_file_meta' };
    }
    this.observe(meta.lamport);
    if (this.tombstones.has(meta.fileId)) {
      return { applied: false, reason: 'tombstoned' };
    }
    const existing = this.files.get(meta.fileId);
    if (existing) {
      // Merge peer availability info
      const holders = new Set([...(existing.holders || []), ...(meta.holders || [meta.senderId])]);
      existing.holders = Array.from(holders);
      return { applied: false, reason: 'duplicate_file_meta' };
    }
    const clean = {
      kind: 'file',
      id: meta.fileId,
      fileId: meta.fileId,
      name: sanitizeText(meta.name || 'shared-file', 160) || 'shared-file',
      mime: sanitizeText(meta.mime || 'application/octet-stream', 100),
      size: Math.max(0, Number(meta.size) || 0),
      totalChunks: Math.max(1, Number(meta.totalChunks) || 1),
      sha256: String(meta.sha256 || ''),
      senderId: meta.senderId,
      senderName: sanitizeDisplayName(meta.senderName),
      fingerprint: String(meta.fingerprint || 'UNVERIFIED'),
      publicKeyJwk: meta.publicKeyJwk || null,
      signature: meta.signature || null,
      verified: Boolean(meta.verified),
      lamport: Math.max(1, Math.floor(Number(meta.lamport) || 1)),
      createdAt: Number(meta.createdAt) || Date.now(),
      holders: Array.from(new Set(meta.holders || [meta.senderId])),
    };
    this.files.set(clean.fileId, clean);
    return { applied: true, kind: 'file', item: clean };
  }

  /**
   * Apply a signed tombstone (delete-wins) across messages, note blocks, or files.
   * Rejects forged deletes where the tombstone fingerprint doesn't match the target author's fingerprint
   * (unless the target is not yet present locally, in which case we still store the verified tombstone).
   */
  applyTombstone(tombstone) {
    if (!tombstone || typeof tombstone.targetId !== 'string' || typeof tombstone.targetKind !== 'string') {
      return { applied: false, reason: 'invalid_tombstone' };
    }
    this.observe(tombstone.lamport);
    if (this.tombstones.has(tombstone.targetId)) {
      return { applied: false, reason: 'duplicate_tombstone' };
    }

    // Author check: if we already hold the target item, ensure same fingerprint authored the delete
    const targetFp = tombstone.fingerprint || '';
    if (tombstone.targetKind === 'message') {
      const existing = this.messages.get(tombstone.targetId);
      if (existing && existing.fingerprint !== targetFp) {
        return { applied: false, reason: 'unauthorized_tombstone' };
      }
      this.messages.delete(tombstone.targetId);
    } else if (tombstone.targetKind === 'note') {
      this.noteBlocks.delete(tombstone.targetId);
    } else if (tombstone.targetKind === 'file') {
      const existing = this.files.get(tombstone.targetId);
      if (existing && existing.fingerprint !== targetFp) {
        return { applied: false, reason: 'unauthorized_tombstone' };
      }
      this.files.delete(tombstone.targetId);
    }

    const clean = {
      kind: 'tombstone',
      id: tombstone.id || `tomb:${tombstone.targetId}`,
      targetId: tombstone.targetId,
      targetKind: tombstone.targetKind,
      senderId: String(tombstone.senderId || ''),
      fingerprint: String(targetFp),
      publicKeyJwk: tombstone.publicKeyJwk || null,
      signature: tombstone.signature || null,
      verified: Boolean(tombstone.verified),
      lamport: Math.max(1, Math.floor(Number(tombstone.lamport) || 1)),
    };

    this.tombstones.set(clean.targetId, clean);
    return { applied: true, kind: 'tombstone', item: clean };
  }

  /** Unified dispatcher for applying any sync item. */
  applyItem(item) {
    if (!item || typeof item !== 'object') return { applied: false, reason: 'empty' };
    switch (item.kind) {
      case 'message':
        return this.applyMessage(item);
      case 'note':
        return this.applyNoteBlock(item);
      case 'stroke':
        return this.applyStroke(item);
      case 'clear':
        return this.applyClearMarker(item);
      case 'file':
        return this.applyFileMeta(item);
      case 'tombstone':
        return this.applyTombstone(item);
      default:
        return { applied: false, reason: 'unknown_kind' };
    }
  }

  getOrderedMessages() {
    return Array.from(this.messages.values()).sort(compareLamportRecords);
  }

  getOrderedNotes() {
    return Array.from(this.noteBlocks.values()).sort((a, b) => {
      if (a.orderKey !== b.orderKey) return a.orderKey - b.orderKey;
      return compareLamportRecords(a, b);
    });
  }

  getVisibleStrokes() {
    return Array.from(this.strokes.values())
      .filter((s) => !this.clearMarker || compareLamportRecords(s, this.clearMarker) > 0)
      .sort(compareLamportRecords);
  }

  getOrderedFiles() {
    return Array.from(this.files.values()).sort(compareLamportRecords);
  }

  /** Compact digest sent to peers on connect for delta history synchronization. */
  createSyncDigest() {
    const notes = {};
    for (const [id, b] of this.noteBlocks) {
      notes[id] = { lamport: b.lamport, senderId: b.senderId };
    }
    return {
      lamport: this.lamport,
      messageIds: Array.from(this.messages.keys()),
      notes,
      strokeIds: Array.from(this.strokes.keys()),
      fileIds: Array.from(this.files.keys()),
      tombstoneTargetIds: Array.from(this.tombstones.keys()),
      clearMarker: this.clearMarker ? { lamport: this.clearMarker.lamport, senderId: this.clearMarker.senderId } : null,
    };
  }

  /** Given a remote peer's digest, return all items they are missing or have older versions of. */
  getItemsMissingFrom(remoteDigest) {
    const missing = [];
    const rMsgs = new Set(remoteDigest?.messageIds || []);
    const rNotes = remoteDigest?.notes || {};
    const rStrokes = new Set(remoteDigest?.strokeIds || []);
    const rFiles = new Set(remoteDigest?.fileIds || []);
    const rTombs = new Set(remoteDigest?.tombstoneTargetIds || []);

    for (const tomb of this.tombstones.values()) {
      if (!rTombs.has(tomb.targetId)) missing.push(tomb);
    }
    for (const msg of this.messages.values()) {
      if (!rMsgs.has(msg.id) && !rTombs.has(msg.id)) missing.push(msg);
    }
    for (const block of this.noteBlocks.values()) {
      const rVer = rNotes[block.id];
      if (!rTombs.has(block.id) && (!rVer || isNewerVersion(block, { ...rVer, id: block.id }))) {
        missing.push(block);
      }
    }
    if (this.clearMarker) {
      const rClear = remoteDigest?.clearMarker;
      if (!rClear || isNewerVersion(this.clearMarker, { ...rClear, id: this.clearMarker.id })) {
        missing.push(this.clearMarker);
      }
    }
    for (const stroke of this.strokes.values()) {
      if (!rStrokes.has(stroke.id)) {
        if (!this.clearMarker || compareLamportRecords(stroke, this.clearMarker) > 0) {
          missing.push(stroke);
        }
      }
    }
    for (const file of this.files.values()) {
      if (!rFiles.has(file.fileId) && !rTombs.has(file.fileId)) missing.push(file);
    }
    return missing;
  }

  /** Serialize full room state for IndexedDB persistence. */
  toSnapshot() {
    return {
      lamport: this.lamport,
      messages: Array.from(this.messages.values()),
      noteBlocks: Array.from(this.noteBlocks.values()),
      strokes: Array.from(this.strokes.values()),
      files: Array.from(this.files.values()),
      tombstones: Array.from(this.tombstones.values()),
      clearMarker: this.clearMarker,
    };
  }

  loadSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;
    this.lamport = Number(snapshot.lamport) || 0;
    for (const tomb of snapshot.tombstones || []) {
      this.tombstones.set(tomb.targetId, tomb);
    }
    for (const msg of snapshot.messages || []) {
      if (!this.tombstones.has(msg.id)) {
        this.seenIds.add(msg.id);
        this.messages.set(msg.id, msg);
      }
    }
    for (const block of snapshot.noteBlocks || []) {
      if (!this.tombstones.has(block.id)) {
        this.noteBlocks.set(block.id, block);
      }
    }
    for (const stroke of snapshot.strokes || []) {
      this.seenIds.add(stroke.id);
      this.strokes.set(stroke.id, stroke);
    }
    for (const file of snapshot.files || []) {
      if (!this.tombstones.has(file.fileId)) {
        this.files.set(file.fileId, file);
      }
    }
    if (snapshot.clearMarker) {
      this.clearMarker = snapshot.clearMarker;
    }
  }
}
