import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decryptEnvelope,
  deriveRoomAesKey,
  deriveRoomTopic,
  encryptEnvelope,
  generateIdentity,
  sha256Hex,
  signPayload,
  verifyPayload,
} from '../src/crypto.js';
import { FileAssembler, sliceBufferToChunks } from '../src/chunker.js';
import { createRateLimiter, isSafeUrl, sanitizeDisplayName, sanitizeText, validatePacket } from '../src/sanitize.js';
import { StudyRoomState } from '../src/sync.js';

test('ECDSA identity generation, signing, verification, and tamper rejection', async () => {
  const alice = await generateIdentity();
  assert.match(alice.fingerprint, /^[0-9A-F]{4}-[0-9A-F]{4}$/);

  const payload = { kind: 'message', id: 'm1', text: 'Study OS notes at 7pm', lamport: 1 };
  const sig = await signPayload(alice.privateKey, payload);

  const valid = await verifyPayload(alice.publicKeyJwk, payload, sig);
  assert.equal(valid, true);

  const tampered = await verifyPayload(alice.publicKeyJwk, { ...payload, text: 'Tampered' }, sig);
  assert.equal(tampered, false);
});

test('Room passcode derives AES-256-GCM key and rejects wrong passcodes', async () => {
  const topicA = await deriveRoomTopic('OS-404', 'secret123');
  const topicB = await deriveRoomTopic('OS-404', 'wrongpass');
  assert.notEqual(topicA, topicB);

  const keyRight = await deriveRoomAesKey('OS-404', 'secret123');
  const keyWrong = await deriveRoomAesKey('OS-404', 'wrongpass');

  const encrypted = await encryptEnvelope(keyRight, { type: 'CHAT', text: 'Private note' });
  assert.equal(encrypted.enc, true);

  const decrypted = await decryptEnvelope(keyRight, encrypted);
  assert.equal(decrypted.text, 'Private note');

  await assert.rejects(() => decryptEnvelope(keyWrong, encrypted));
});

test('Lamport ordering, deduplication, and late-joiner delta sync', () => {
  const peerA = new StudyRoomState();
  const peerB = new StudyRoomState();

  const m1 = {
    kind: 'message',
    id: 'a:1:x',
    senderId: 'AAAA-1111',
    senderName: 'Alice',
    fingerprint: 'AAAA-1111',
    text: 'First message',
    lamport: 1,
  };
  const m2 = {
    kind: 'message',
    id: 'b:1:y',
    senderId: 'BBBB-2222',
    senderName: 'Bob',
    fingerprint: 'BBBB-2222',
    text: 'Concurrent message',
    lamport: 1,
  };
  const m3 = {
    kind: 'message',
    id: 'a:2:z',
    senderId: 'AAAA-1111',
    senderName: 'Alice',
    fingerprint: 'AAAA-1111',
    text: 'Later message',
    lamport: 2,
  };

  assert.equal(peerA.applyMessage(m3).applied, true);
  assert.equal(peerA.applyMessage(m2).applied, true);
  assert.equal(peerA.applyMessage(m1).applied, true);
  // Duplicate delivery must be ignored
  assert.equal(peerA.applyMessage(m1).applied, false);

  const ordered = peerA.getOrderedMessages();
  assert.deepEqual(
    ordered.map((m) => m.id),
    ['a:1:x', 'b:1:y', 'a:2:z']
  );

  // Late joiner peerB syncs via digest
  const missing = peerA.getItemsMissingFrom(peerB.createSyncDigest());
  assert.equal(missing.length, 3);
  for (const item of missing) {
    peerB.applyItem(item);
  }
  assert.deepEqual(
    peerB.getOrderedMessages().map((m) => m.id),
    ['a:1:x', 'b:1:y', 'a:2:z']
  );
});

test('Note block LWW CRDT and signed tombstones', () => {
  const room = new StudyRoomState();

  // Older edit arrives AFTER newer edit -> stale edit rejected
  assert.equal(
    room.applyNoteBlock({
      kind: 'note',
      id: 'n1',
      title: 'Chapter 3',
      body: 'Newer text',
      lamport: 5,
      senderId: 'BBBB-2222',
      senderName: 'Bob',
      fingerprint: 'BBBB-2222',
    }).applied,
    true
  );

  assert.equal(
    room.applyNoteBlock({
      kind: 'note',
      id: 'n1',
      title: 'Chapter 3',
      body: 'Stale text',
      lamport: 4,
      senderId: 'AAAA-1111',
      senderName: 'Alice',
      fingerprint: 'AAAA-1111',
    }).applied,
    false
  );
  assert.equal(room.getOrderedNotes()[0].body, 'Newer text');

  // Unauthorized message delete by different fingerprint is rejected
  room.applyMessage({
    kind: 'message',
    id: 'msg-alice',
    senderId: 'AAAA-1111',
    senderName: 'Alice',
    fingerprint: 'AAAA-1111',
    text: 'Keep me',
    lamport: 6,
  });
  const forgedDelete = room.applyTombstone({
    kind: 'tombstone',
    targetId: 'msg-alice',
    targetKind: 'message',
    senderId: 'BBBB-2222',
    fingerprint: 'BBBB-2222',
    lamport: 7,
  });
  assert.equal(forgedDelete.applied, false);
  assert.equal(room.messages.has('msg-alice'), true);

  // Author delete succeeds and propagates
  const validDelete = room.applyTombstone({
    kind: 'tombstone',
    targetId: 'msg-alice',
    targetKind: 'message',
    senderId: 'AAAA-1111',
    fingerprint: 'AAAA-1111',
    lamport: 8,
  });
  assert.equal(validDelete.applied, true);
  assert.equal(room.messages.has('msg-alice'), false);
});

test('Whiteboard LWW clear marker hides older strokes and keeps newer strokes', () => {
  const room = new StudyRoomState();
  room.applyStroke({
    kind: 'stroke',
    id: 's1',
    senderId: 'A',
    color: '#38bdf8',
    width: 3,
    tool: 'pen',
    points: [{ x: 0.1, y: 0.1 }],
    lamport: 2,
  });
  room.applyClearMarker({
    kind: 'clear',
    id: 'c1',
    senderId: 'A',
    senderName: 'Alice',
    lamport: 5,
  });
  room.applyStroke({
    kind: 'stroke',
    id: 's2',
    senderId: 'B',
    color: '#4ade80',
    width: 4,
    tool: 'pen',
    points: [{ x: 0.5, y: 0.5 }],
    lamport: 6,
  });

  const visible = room.getVisibleStrokes();
  assert.deepEqual(visible.map((s) => s.id), ['s2']);
});

test('Chunked file transfer handles out-of-order chunks and SHA-256 verification', async () => {
  const original = new Uint8Array(70 * 1024);
  for (let i = 0; i < original.length; i++) original[i] = (i * 31) & 0xff;
  const sha256 = await sha256Hex(original);
  const chunks = sliceBufferToChunks(original, 'f-1', 24 * 1024);
  assert.equal(chunks.length, 3);

  const assembler = new FileAssembler({
    fileId: 'f-1',
    name: 'lecture.bin',
    mime: 'application/octet-stream',
    size: original.length,
    totalChunks: chunks.length,
    sha256,
  });

  // Deliver out of order: 2, 0, duplicate 0, then 1
  const r2 = await assembler.addChunk(chunks[2]);
  assert.equal(r2.done, false);
  const r0 = await assembler.addChunk(chunks[0]);
  assert.equal(r0.done, false);
  const r0Dup = await assembler.addChunk(chunks[0]);
  assert.equal(r0Dup.duplicate, true);
  const r1 = await assembler.addChunk(chunks[1]);
  assert.equal(r1.done, true);
  assert.deepEqual(r1.bytes, original);

  // Corrupted chunk detection
  const badAssembler = new FileAssembler({
    fileId: 'f-2',
    name: 'bad.bin',
    size: original.length,
    totalChunks: chunks.length,
    sha256: '0000'.repeat(16),
  });
  await badAssembler.addChunk({ ...chunks[0], fileId: 'f-2' });
  await badAssembler.addChunk({ ...chunks[1], fileId: 'f-2' });
  const badRes = await badAssembler.addChunk({ ...chunks[2], fileId: 'f-2' });
  assert.match(badRes.error, /checksum mismatch/i);
});

test('Sanitization, URL allowlisting, schema validation, and rate limiter', () => {
  assert.equal(sanitizeDisplayName('  Alice\x00\n  '), 'Alice');
  assert.equal(sanitizeText('hi\x00there\nok'), 'hithere\nok');
  assert.equal(isSafeUrl('https://upes.ac.in'), true);
  assert.equal(isSafeUrl('javascript:alert(1)'), false);
  assert.equal(validatePacket({ type: 'UNKNOWN' }).ok, false);
  assert.equal(validatePacket({ type: 'CHAT', item: {} }).ok, true);

  const limiter = createRateLimiter({ maxTokens: 2, refillPerSec: 0 });
  assert.equal(limiter.allow('peer1', 1, 1000), true);
  assert.equal(limiter.allow('peer1', 1, 1000), true);
  assert.equal(limiter.allow('peer1', 1, 1000), false);
});
