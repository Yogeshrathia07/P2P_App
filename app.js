/**
 * PeerDesk main browser controller.
 * Wires WebCrypto identity, IndexedDB persistence, Lamport CRDT sync,
 * chunked file vault, whiteboard canvas, synced Pomodoro timer, and WebRTC transport.
 */

import {
  computeFingerprint,
  deriveRoomAesKey,
  deriveRoomTopic,
  generateIdentity,
  sha256Hex,
  signPayload,
  verifyPayload,
} from './src/crypto.js';
import { CHUNK_SIZE, FileAssembler, MAX_FILE_SIZE, sliceBufferToChunks } from './src/chunker.js';
import { startMeshBackground } from './src/meshBg.js';
import { renderQrCode } from './src/qr.js';
import { isSafeUrl, sanitizeDisplayName, sanitizeText } from './src/sanitize.js';
import {
  deleteFileBlob,
  loadFileBlob,
  loadIdentityProfile,
  loadRoomSnapshot,
  saveFileBlob,
  saveIdentityProfile,
  saveRoomSnapshot,
} from './src/storage.js';
import { StudyRoomState } from './src/sync.js';
import { MAX_MESH_PEERS, P2PTransport } from './src/transport.js';

const $ = (id) => document.getElementById(id);

const appState = {
  identity: null,        // { displayName, publicKey, privateKey, publicKeyJwk, fingerprint }
  roomCode: '',
  roomTopic: '',
  passcode: '',
  aesKey: null,
  mode: 'nostr',
  transport: null,
  room: new StudyRoomState(),
  peers: new Map(),      // peerId -> { name, fingerprint, publicKeyJwk, verified }
  assemblers: new Map(), // fileId -> FileAssembler
  localFileUrls: new Map(), // fileId -> objectURL
  remoteCursors: new Map(), // peerId -> { x, y, name, expiresAt }
  manualSessionId: null,
  persistTimer: null,
  timer: {
    mode: 'focus',       // 'focus' | 'break'
    running: false,
    remainingSec: 25 * 60,
    updatedAt: Date.now(),
    lamport: 0,
  },
  board: {
    tool: 'pen',
    color: '#38bdf8',
    width: 3,
    drawing: false,
    currentPoints: [],
    lastCursorSent: 0,
  },
};

/* ---------------- THEME & AUDIT LOG ---------------- */

function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  localStorage.setItem('peerdesk-theme', next);
}

function logEvent(msg) {
  const list = $('auditLogList');
  if (!list) return;
  const li = document.createElement('li');
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  li.textContent = `[${time}] ${msg}`;
  list.prepend(li);
  while (list.children.length > 60) {
    list.removeChild(list.lastChild);
  }
}

/* ---------------- IDENTITY ---------------- */

async function initIdentity(forceNew = false) {
  let stored = forceNew ? null : await loadIdentityProfile();
  if (!stored || !stored.privateKey || !stored.publicKeyJwk) {
    const keys = await generateIdentity();
    stored = {
      displayName: localStorage.getItem('peerdesk-name') || '',
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      publicKeyJwk: keys.publicKeyJwk,
      fingerprint: keys.fingerprint,
    };
    await saveIdentityProfile(stored);
  } else {
    stored.fingerprint = await computeFingerprint(stored.publicKeyJwk);
  }
  appState.identity = stored;
  $('lobbyFingerprint').textContent = stored.fingerprint;
  $('selfFingerprintBadge').textContent = stored.fingerprint;
  if (stored.displayName && !$('displayNameInput').value) {
    $('displayNameInput').value = stored.displayName;
  }
}

/* ---------------- PERSISTENCE ---------------- */

function schedulePersist() {
  if (!appState.roomTopic) return;
  clearTimeout(appState.persistTimer);
  appState.persistTimer = setTimeout(async () => {
    await saveRoomSnapshot(appState.roomTopic, appState.room.toSnapshot());
  }, 250);
}

/* ---------------- SIGNING HELPERS ---------------- */

function signableFields(kind, obj) {
  if (kind === 'message') {
    return { kind, id: obj.id, senderId: obj.senderId, fingerprint: obj.fingerprint, text: obj.text, lamport: obj.lamport };
  }
  if (kind === 'note') {
    return { kind, id: obj.id, senderId: obj.senderId, fingerprint: obj.fingerprint, title: obj.title, body: obj.body, lamport: obj.lamport };
  }
  if (kind === 'file') {
    return { kind, fileId: obj.fileId, senderId: obj.senderId, fingerprint: obj.fingerprint, sha256: obj.sha256, size: obj.size, lamport: obj.lamport };
  }
  if (kind === 'tombstone') {
    return { kind, targetId: obj.targetId, targetKind: obj.targetKind, senderId: obj.senderId, fingerprint: obj.fingerprint, lamport: obj.lamport };
  }
  return obj;
}

async function signRecord(kind, obj) {
  const sig = await signPayload(appState.identity.privateKey, signableFields(kind, obj));
  return {
    ...obj,
    publicKeyJwk: appState.identity.publicKeyJwk,
    signature: sig,
    verified: true,
  };
}

async function verifyRecord(kind, obj) {
  if (!obj || !obj.publicKeyJwk || !obj.signature) return false;
  const derivedFp = await computeFingerprint(obj.publicKeyJwk);
  if (derivedFp !== obj.fingerprint) return false;
  return verifyPayload(obj.publicKeyJwk, signableFields(kind, obj), obj.signature);
}

/* ---------------- ROOM JOIN / LEAVE ---------------- */

function extractRoomInput(rawInput) {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return { roomCode: '', mode: null };
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const r = url.searchParams.get('room');
      const m = url.searchParams.get('mode');
      if (r) {
        return {
          roomCode: sanitizeText(r, 40),
          mode: ['nostr', 'mqtt', 'manual'].includes(m) ? m : null,
        };
      }
    }
  } catch {
    // treat as plain room code
  }
  return { roomCode: sanitizeText(trimmed, 40), mode: null };
}

function setLobbyMode(action) {
  const isCreate = action === 'create';
  $('modeJoinTab').classList.toggle('active', !isCreate);
  $('modeCreateTab').classList.toggle('active', isCreate);
  $('modeJoinTab').setAttribute('aria-selected', String(!isCreate));
  $('modeCreateTab').setAttribute('aria-selected', String(isCreate));
  $('randomRoomBtn').classList.toggle('hidden', !isCreate);
  $('joinRoomBtn').textContent = isCreate ? 'Create & Enter Room' : 'Join Study Room';
  $('roomCodeHint').textContent = isCreate
    ? 'Share this room code or invite link with your classmates once inside.'
    : 'Ask your classmate for their room code or paste their invite link.';
  if (isCreate && !$('roomCodeInput').value.trim()) {
    const num = Math.floor(100 + Math.random() * 900);
    $('roomCodeInput').value = `STUDY-${num}`;
  }
}

async function joinStudyRoom(ev) {
  ev.preventDefault();
  const displayName = sanitizeDisplayName($('displayNameInput').value);
  const extracted = extractRoomInput($('roomCodeInput').value);
  const roomCode = extracted.roomCode;
  const passcode = $('passcodeInput').value || '';
  const mode = extracted.mode || $('signalingModeSelect').value;

  if (!roomCode) return;
  $('roomCodeInput').value = roomCode;

  localStorage.setItem('peerdesk-name', displayName);
  appState.identity.displayName = displayName;
  await saveIdentityProfile(appState.identity);

  const turnConfig = {
    url: $('turnUrlInput').value,
    username: $('turnUserInput').value,
    credential: $('turnPassInput').value,
  };
  localStorage.setItem('peerdesk-turn', JSON.stringify(turnConfig));

  appState.roomCode = roomCode;
  appState.passcode = passcode;
  appState.mode = mode;
  appState.roomTopic = await deriveRoomTopic(roomCode, passcode);
  appState.aesKey = await deriveRoomAesKey(roomCode, passcode);

  // Load persisted IndexedDB room snapshot before connecting (Problem 2)
  const snapshot = await loadRoomSnapshot(appState.roomTopic);
  appState.room = new StudyRoomState(snapshot);

  $('lobbyView').classList.add('hidden');
  $('studioView').classList.remove('hidden');

  $('roomCodeDisplay').textContent = roomCode;
  $('modeBadge').textContent = mode === 'nostr' ? 'AUTO' : mode.toUpperCase();
  $('e2eeBadge').textContent = appState.aesKey ? 'Password Locked' : 'Open Room';
  $('e2eeBadge').className = appState.aesKey ? 'badge badge-ok' : 'badge badge-muted';
  $('manualPairingBox').classList.toggle('hidden', mode !== 'manual');

  renderAll();
  resizeCanvas();

  if (snapshot) {
    logEvent(`Restored saved study history (${appState.room.messages.size} msgs, ${appState.room.noteBlocks.size} notes).`);
  }

  const startTransport = async (selectedMode) => {
    appState.transport = new P2PTransport({
      mode: selectedMode,
      roomTopic: appState.roomTopic,
      aesKey: appState.aesKey,
      turnConfig,
      localPeerId: appState.identity.fingerprint,
      maxPeers: MAX_MESH_PEERS,
      onPeerJoin: (peerId) => handlePeerJoin(peerId),
      onPeerLeave: (peerId) => handlePeerLeave(peerId),
      onPacket: (packet, peerId) => handleIncomingPacket(packet, peerId),
      onStatus: (status) => {
        const friendly =
          status.state === 'listening'
            ? 'Ready — share room code or invite link'
            : status.detail;
        $('connectionStatusText').textContent = friendly;
        logEvent(status.detail);
      },
      onError: (errMsg) => logEvent(`Guard: ${errMsg}`),
    });
    await appState.transport.start();
  };

  try {
    await startTransport(mode);
  } catch (err) {
    if (mode === 'nostr') {
      logEvent(`Primary relay failed (${err?.message || err}); trying backup MQTT relay...`);
      try {
        await appState.transport?.destroy();
        appState.mode = 'mqtt';
        $('modeBadge').textContent = 'MQTT';
        await startTransport('mqtt');
        return;
      } catch (mqttErr) {
        logEvent(`Backup MQTT failed: ${mqttErr?.message || mqttErr}`);
      }
    }
    $('connectionStatusText').textContent = 'Relay offline — use Manual Pairing on the left';
    $('manualPairingBox').classList.remove('hidden');
  }
}

async function leaveStudyRoom() {
  if (appState.transport) {
    await appState.transport.destroy();
    appState.transport = null;
  }
  appState.peers.clear();
  appState.remoteCursors.clear();
  for (const url of appState.localFileUrls.values()) {
    URL.revokeObjectURL(url);
  }
  appState.localFileUrls.clear();
  $('studioView').classList.add('hidden');
  $('lobbyView').classList.remove('hidden');
}

/* ---------------- PEER LIFECYCLE & SYNC ---------------- */

async function handlePeerJoin(peerId) {
  if (!appState.peers.has(peerId)) {
    appState.peers.set(peerId, {
      name: `Peer ${String(peerId).slice(0, 6)}`,
      fingerprint: 'Pending...',
      verified: false,
    });
  }
  renderPeers();
  logEvent(`Peer connected (${String(peerId).slice(0, 8)}). Sending signed HELLO & sync digest.`);

  // Send HELLO with public key + Lamport clock + timer state
  const helloPayload = {
    type: 'HELLO',
    name: appState.identity.displayName,
    fingerprint: appState.identity.fingerprint,
    publicKeyJwk: appState.identity.publicKeyJwk,
    lamport: appState.room.lamport,
    timer: appState.timer,
  };
  await appState.transport.sendControl(helloPayload, peerId);
  await appState.transport.sendControl(
    { type: 'SYNC_DIGEST', digest: appState.room.createSyncDigest() },
    peerId
  );
}

function handlePeerLeave(peerId) {
  const peer = appState.peers.get(peerId);
  appState.peers.delete(peerId);
  appState.remoteCursors.delete(peerId);
  renderPeers();
  renderRemoteCursors();
  logEvent(`Peer disconnected: ${peer ? peer.name : String(peerId).slice(0, 8)}`);
}

async function handleIncomingPacket(packet, peerId) {
  switch (packet.type) {
    case 'HELLO': {
      const fp = await computeFingerprint(packet.publicKeyJwk || {});
      const validFp = packet.publicKeyJwk && fp === packet.fingerprint;
      appState.peers.set(peerId, {
        name: sanitizeDisplayName(packet.name),
        fingerprint: validFp ? fp : 'UNVERIFIED',
        publicKeyJwk: packet.publicKeyJwk || null,
        verified: Boolean(validFp),
      });
      if (packet.timer && packet.timer.lamport > appState.timer.lamport) {
        applyRemoteTimer(packet.timer);
      }
      renderPeers();
      break;
    }

    case 'SYNC_DIGEST': {
      const missing = appState.room.getItemsMissingFrom(packet.digest);
      if (missing.length > 0) {
        // Send in batches of 150 items so packets stay under LIMITS.MAX_PACKET_BYTES
        for (let i = 0; i < missing.length; i += 150) {
          await appState.transport.sendControl(
            { type: 'SYNC_BATCH', items: missing.slice(i, i + 150) },
            peerId
          );
        }
        logEvent(`Synced ${missing.length} missing history item(s) to ${String(peerId).slice(0, 8)}.`);
      }
      break;
    }

    case 'SYNC_BATCH': {
      let appliedCount = 0;
      for (const item of packet.items || []) {
        const res = await applyVerifiedItem(item);
        if (res.applied) appliedCount++;
      }
      if (appliedCount > 0) {
        logEvent(`Merged ${appliedCount} history item(s) from peer.`);
        schedulePersist();
        renderAll();
      }
      break;
    }

    case 'CHAT': {
      const res = await applyVerifiedItem(packet.item);
      if (res.applied) {
        schedulePersist();
        renderChat();
        updateLamportBadge();
      }
      break;
    }

    case 'NOTE_OP': {
      const res = await applyVerifiedItem(packet.item);
      if (res.applied) {
        schedulePersist();
        renderNotes();
        updateLamportBadge();
      }
      break;
    }

    case 'STROKE': {
      const res = appState.room.applyStroke(packet.stroke);
      if (res.applied) {
        schedulePersist();
        redrawBoard();
        updateLamportBadge();
      }
      break;
    }

    case 'STROKE_CLEAR': {
      const res = appState.room.applyClearMarker(packet.marker);
      if (res.applied) {
        schedulePersist();
        redrawBoard();
        updateLamportBadge();
      }
      break;
    }

    case 'TOMBSTONE': {
      const res = await applyVerifiedItem(packet.item);
      if (res.applied) {
        if (packet.item.targetKind === 'file') {
          await deleteFileBlob(appState.roomTopic, packet.item.targetId);
          appState.localFileUrls.delete(packet.item.targetId);
        }
        schedulePersist();
        renderAll();
        logEvent(`Applied signed delete tombstone for ${packet.item.targetKind}.`);
      }
      break;
    }

    case 'FILE_META': {
      const res = await applyVerifiedItem(packet.item);
      if (res.applied) {
        schedulePersist();
        renderFiles();
        updateLamportBadge();
        // Automatically request file chunks if we don't have it cached locally
        const cached = await loadFileBlob(appState.roomTopic, packet.item.fileId);
        if (!cached) {
          appState.assemblers.set(packet.item.fileId, new FileAssembler(packet.item));
          await appState.transport.sendControl({ type: 'FILE_REQUEST', fileId: packet.item.fileId }, peerId);
        }
      }
      break;
    }

    case 'FILE_REQUEST': {
      const record = await loadFileBlob(appState.roomTopic, packet.fileId);
      if (record && record.bytes) {
        const chunks = sliceBufferToChunks(record.bytes, packet.fileId, CHUNK_SIZE);
        for (const chunk of chunks) {
          await appState.transport.sendFilePacket({ type: 'FILE_CHUNK', chunk }, peerId);
        }
      }
      break;
    }

    case 'FILE_CHUNK': {
      const chunk = packet.chunk;
      if (!chunk) break;
      const meta = appState.room.files.get(chunk.fileId);
      if (!meta) break;

      let assembler = appState.assemblers.get(chunk.fileId);
      if (!assembler) {
        assembler = new FileAssembler(meta);
        appState.assemblers.set(chunk.fileId, assembler);
      }
      const res = await assembler.addChunk(chunk);
      if (res.error) {
        logEvent(`File ${meta.name} integrity error: ${res.error}`);
      } else if (res.done && res.bytes) {
        await saveFileBlob(appState.roomTopic, meta.fileId, {
          name: meta.name,
          mime: meta.mime,
          size: meta.size,
          bytes: res.bytes,
        });
        logEvent(`Received & SHA-256 verified file: ${meta.name}`);
      }
      renderFiles();
      break;
    }

    case 'CURSOR': {
      const peer = appState.peers.get(peerId);
      appState.remoteCursors.set(peerId, {
        x: Math.max(0, Math.min(1, Number(packet.x) || 0)),
        y: Math.max(0, Math.min(1, Number(packet.y) || 0)),
        name: peer ? peer.name : String(peerId).slice(0, 6),
        expiresAt: Date.now() + 2500,
      });
      renderRemoteCursors();
      break;
    }

    case 'TIMER': {
      if (packet.timer && packet.timer.lamport >= appState.timer.lamport) {
        applyRemoteTimer(packet.timer);
      }
      break;
    }
  }
}

async function applyVerifiedItem(item) {
  if (!item || typeof item !== 'object') return { applied: false };
  if (item.kind === 'message' || item.kind === 'note' || item.kind === 'file' || item.kind === 'tombstone') {
    const ok = await verifyRecord(item.kind, item);
    if (!ok) {
      logEvent(`Rejected spoofed/tampered ${item.kind} from ${item.senderName || 'peer'}!`);
      return { applied: false, reason: 'bad_signature' };
    }
    item = { ...item, verified: true };
  }
  return appState.room.applyItem(item);
}

/* ---------------- CHAT ---------------- */

async function sendChatMessage(ev) {
  ev.preventDefault();
  const input = $('chatInput');
  const text = sanitizeText(input.value);
  if (!text) return;
  input.value = '';

  const lamport = appState.room.tick();
  const msg = await signRecord('message', {
    kind: 'message',
    id: `${appState.identity.fingerprint}:${lamport}:${crypto.randomUUID().slice(0, 8)}`,
    senderId: appState.identity.fingerprint,
    senderName: appState.identity.displayName,
    fingerprint: appState.identity.fingerprint,
    text,
    lamport,
    createdAt: Date.now(),
  });

  appState.room.applyMessage(msg);
  schedulePersist();
  renderChat();
  updateLamportBadge();

  if (appState.transport) {
    await appState.transport.sendControl({ type: 'CHAT', item: msg });
  }
}

async function issueTombstone(targetId, targetKind) {
  const lamport = appState.room.tick();
  const tombstone = await signRecord('tombstone', {
    kind: 'tombstone',
    id: `tomb:${targetId}:${lamport}`,
    targetId,
    targetKind,
    senderId: appState.identity.fingerprint,
    fingerprint: appState.identity.fingerprint,
    lamport,
  });

  const res = appState.room.applyTombstone(tombstone);
  if (!res.applied) return;
  if (targetKind === 'file') {
    await deleteFileBlob(appState.roomTopic, targetId);
    appState.localFileUrls.delete(targetId);
  }
  schedulePersist();
  renderAll();
  if (appState.transport) {
    await appState.transport.sendControl({ type: 'TOMBSTONE', item: tombstone });
  }
}

function appendSafeTextWithLinks(container, text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  for (const part of parts) {
    if (isSafeUrl(part)) {
      const a = document.createElement('a');
      a.href = part;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = part;
      container.appendChild(a);
    } else {
      container.appendChild(document.createTextNode(part));
    }
  }
}

function renderChat() {
  const container = $('chatMessages');
  const messages = appState.room.getOrderedMessages();
  const shouldStickBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 40;
  container.replaceChildren();

  if (messages.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'No messages yet. Messages are ECDSA-signed and ordered by Lamport clock.';
    container.appendChild(empty);
    return;
  }

  for (const m of messages) {
    const isSelf = m.fingerprint === appState.identity?.fingerprint;
    const card = document.createElement('div');
    card.className = isSelf ? 'chat-msg self' : 'chat-msg';

    const head = document.createElement('div');
    head.className = 'chat-msg-head';

    const author = document.createElement('span');
    author.className = 'chat-msg-author';
    author.textContent = `${m.senderName} (${m.fingerprint})`;

    const meta = document.createElement('span');
    meta.className = 'chat-msg-meta';
    meta.textContent = `L:${m.lamport} ${m.verified ? '✓' : '!'}`;

    if (isSelf) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-ghost btn-xs';
      delBtn.textContent = '×';
      delBtn.title = 'Delete everywhere (signed tombstone)';
      delBtn.addEventListener('click', () => issueTombstone(m.id, 'message'));
      meta.appendChild(delBtn);
    }

    head.append(author, meta);

    const body = document.createElement('div');
    body.className = 'chat-msg-body';
    appendSafeTextWithLinks(body, m.text);

    card.append(head, body);
    container.appendChild(card);
  }

  if (shouldStickBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

/* ---------------- SHARED NOTES (BLOCK CRDT) ---------------- */

async function createNoteBlock() {
  const lamport = appState.room.tick();
  const block = await signRecord('note', {
    kind: 'note',
    id: `note-${crypto.randomUUID().slice(0, 8)}`,
    title: 'Study Note',
    body: '',
    orderKey: Date.now(),
    lamport,
    senderId: appState.identity.fingerprint,
    senderName: appState.identity.displayName,
    fingerprint: appState.identity.fingerprint,
    updatedAt: Date.now(),
  });
  appState.room.applyNoteBlock(block);
  schedulePersist();
  renderNotes();
  updateLamportBadge();
  if (appState.transport) {
    await appState.transport.sendControl({ type: 'NOTE_OP', item: block });
  }
}

let noteEditTimers = new Map();
function scheduleNoteUpdate(blockId, title, body, orderKey) {
  clearTimeout(noteEditTimers.get(blockId));
  noteEditTimers.set(
    blockId,
    setTimeout(async () => {
      const lamport = appState.room.tick();
      const updated = await signRecord('note', {
        kind: 'note',
        id: blockId,
        title: sanitizeText(title, 120) || 'Untitled Note',
        body: sanitizeText(body, 15000),
        orderKey,
        lamport,
        senderId: appState.identity.fingerprint,
        senderName: appState.identity.displayName,
        fingerprint: appState.identity.fingerprint,
        updatedAt: Date.now(),
      });
      appState.room.applyNoteBlock(updated);
      schedulePersist();
      updateLamportBadge();
      if (appState.transport) {
        await appState.transport.sendControl({ type: 'NOTE_OP', item: updated });
      }
    }, 220)
  );
}

function renderNotes() {
  const container = $('notesContainer');
  const activeEl = document.activeElement;
  const activeBlockId = activeEl?.dataset?.blockId;
  const activeField = activeEl?.dataset?.field;
  const selStart = activeEl?.selectionStart;
  const selEnd = activeEl?.selectionEnd;

  const blocks = appState.room.getOrderedNotes();
  container.replaceChildren();

  if (blocks.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'No study notes yet. Click "+ New Study Block" to start collaborating.';
    container.appendChild(empty);
    return;
  }

  for (const block of blocks) {
    const card = document.createElement('article');
    card.className = 'note-card';

    const head = document.createElement('div');
    head.className = 'note-card-head';

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'note-title-input';
    titleInput.value = block.title;
    titleInput.dataset.blockId = block.id;
    titleInput.dataset.field = 'title';

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-ghost btn-xs';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => issueTombstone(block.id, 'note'));

    head.append(titleInput, delBtn);

    const bodyInput = document.createElement('textarea');
    bodyInput.className = 'note-body-input';
    bodyInput.placeholder = 'Write formulas, summaries, or exam prep notes...';
    bodyInput.value = block.body;
    bodyInput.dataset.blockId = block.id;
    bodyInput.dataset.field = 'body';

    const onEdit = () => scheduleNoteUpdate(block.id, titleInput.value, bodyInput.value, block.orderKey);
    titleInput.addEventListener('input', onEdit);
    bodyInput.addEventListener('input', onEdit);

    const foot = document.createElement('div');
    foot.className = 'note-card-foot';
    foot.textContent = `Edited by ${block.senderName} (${block.fingerprint}) · L:${block.lamport}`;

    card.append(head, bodyInput, foot);
    container.appendChild(card);

    if (activeBlockId === block.id) {
      const target = activeField === 'title' ? titleInput : bodyInput;
      target.focus();
      if (typeof selStart === 'number' && typeof selEnd === 'number') {
        target.setSelectionRange(selStart, selEnd);
      }
    }
  }
}

function exportNotesMarkdown() {
  const blocks = appState.room.getOrderedNotes();
  const lines = [`# ${appState.roomCode} — Study Notes\n`];
  for (const b of blocks) {
    lines.push(`## ${b.title}\n\n${b.body}\n\n*Last edited by ${b.senderName} (${b.fingerprint})*\n`);
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${appState.roomCode || 'study'}-notes.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------- WHITEBOARD ---------------- */

function resizeCanvas() {
  const canvas = $('whiteboardCanvas');
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  redrawBoard();
}

function drawStroke(ctx, width, height, stroke) {
  if (!stroke.points || stroke.points.length === 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke.width;
  ctx.strokeStyle = stroke.tool === 'eraser' ? '#090d16' : stroke.color;

  ctx.beginPath();
  const first = stroke.points[0];
  ctx.moveTo(first.x * width, first.y * height);
  if (stroke.points.length === 1) {
    ctx.lineTo(first.x * width + 0.1, first.y * height + 0.1);
  } else {
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x * width, stroke.points[i].y * height);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function redrawBoard() {
  const canvas = $('whiteboardCanvas');
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, rect.width, rect.height);
  for (const stroke of appState.room.getVisibleStrokes()) {
    drawStroke(ctx, rect.width, rect.height, stroke);
  }
}

function setupWhiteboard() {
  const canvas = $('whiteboardCanvas');
  const getNormPoint = (ev) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height)),
    };
  };

  canvas.addEventListener('pointerdown', (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    appState.board.drawing = true;
    appState.board.currentPoints = [getNormPoint(ev)];
  });

  canvas.addEventListener('pointermove', (ev) => {
    const pt = getNormPoint(ev);
    const now = Date.now();
    if (appState.transport && now - appState.board.lastCursorSent > 65) {
      appState.board.lastCursorSent = now;
      appState.transport.sendControl({ type: 'CURSOR', x: pt.x, y: pt.y });
    }
    if (!appState.board.drawing) return;
    const pts = appState.board.currentPoints;
    const prev = pts[pts.length - 1];
    pts.push(pt);
    const rect = canvas.getBoundingClientRect();
    drawStroke(canvas.getContext('2d'), rect.width, rect.height, {
      color: appState.board.color,
      width: appState.board.width,
      tool: appState.board.tool,
      points: [prev, pt],
    });
  });

  const finishStroke = async () => {
    if (!appState.board.drawing) return;
    appState.board.drawing = false;
    const points = appState.board.currentPoints;
    appState.board.currentPoints = [];
    if (points.length === 0) return;

    const lamport = appState.room.tick();
    const stroke = {
      kind: 'stroke',
      id: `st-${appState.identity.fingerprint}-${lamport}-${crypto.randomUUID().slice(0, 6)}`,
      senderId: appState.identity.fingerprint,
      color: appState.board.color,
      width: appState.board.width,
      tool: appState.board.tool,
      points: points.slice(0, 750),
      lamport,
    };
    appState.room.applyStroke(stroke);
    schedulePersist();
    updateLamportBadge();
    if (appState.transport) {
      await appState.transport.sendControl({ type: 'STROKE', stroke });
    }
  };

  canvas.addEventListener('pointerup', finishStroke);
  canvas.addEventListener('pointercancel', finishStroke);
}

function renderRemoteCursors() {
  const layer = $('remoteCursorsLayer');
  const now = Date.now();
  layer.replaceChildren();
  for (const [peerId, c] of appState.remoteCursors) {
    if (c.expiresAt < now) {
      appState.remoteCursors.delete(peerId);
      continue;
    }
    const el = document.createElement('div');
    el.className = 'peer-cursor';
    el.style.left = `${c.x * 100}%`;
    el.style.top = `${c.y * 100}%`;
    el.textContent = c.name;
    layer.appendChild(el);
  }
}

/* ---------------- FILE VAULT ---------------- */

async function shareFiles(fileList) {
  for (const file of fileList) {
    if (file.size > MAX_FILE_SIZE) {
      logEvent(`Skipped ${file.name}: exceeds 50 MB tab safety limit.`);
      continue;
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    const sha256 = await sha256Hex(buf);
    const fileId = `file-${sha256.slice(0, 12)}-${crypto.randomUUID().slice(0, 6)}`;
    const totalChunks = Math.max(1, Math.ceil(buf.length / CHUNK_SIZE));
    const lamport = appState.room.tick();

    const meta = await signRecord('file', {
      kind: 'file',
      id: fileId,
      fileId,
      name: file.name,
      mime: file.type || 'application/octet-stream',
      size: buf.length,
      totalChunks,
      sha256,
      senderId: appState.identity.fingerprint,
      senderName: appState.identity.displayName,
      fingerprint: appState.identity.fingerprint,
      lamport,
      createdAt: Date.now(),
      holders: [appState.identity.fingerprint],
    });

    await saveFileBlob(appState.roomTopic, fileId, {
      name: meta.name,
      mime: meta.mime,
      size: meta.size,
      bytes: buf,
    });

    appState.room.applyFileMeta(meta);
    schedulePersist();
    renderFiles();
    updateLamportBadge();

    if (appState.transport) {
      await appState.transport.sendControl({ type: 'FILE_META', item: meta });
      const chunks = sliceBufferToChunks(buf, fileId, CHUNK_SIZE);
      for (const chunk of chunks) {
        await appState.transport.sendFilePacket({ type: 'FILE_CHUNK', chunk });
      }
      logEvent(`Streamed ${meta.name} (${totalChunks} chunks) peer-to-peer.`);
    }
  }
}

async function renderFiles() {
  const list = $('filesList');
  const files = appState.room.getOrderedFiles();
  $('fileCountBadge').textContent = String(files.length);
  list.replaceChildren();

  if (files.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'No shared files yet. Files stream directly between peers in 24 KB verified chunks.';
    list.appendChild(empty);
    return;
  }

  for (const f of files) {
    const row = document.createElement('div');
    row.className = 'file-row';

    const top = document.createElement('div');
    top.className = 'file-row-top';

    const info = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = f.name;
    const sub = document.createElement('div');
    sub.className = 'hint';
    const kb = Math.max(1, Math.round(f.size / 1024));
    sub.textContent = `${kb} KB · By ${f.senderName} (${f.fingerprint}) · SHA256: ${f.sha256.slice(0, 10)}…`;
    info.append(title, sub);

    const actions = document.createElement('div');
    actions.className = 'btn-row';

    const cached = await loadFileBlob(appState.roomTopic, f.fileId);
    const assembler = appState.assemblers.get(f.fileId);

    if (cached && cached.bytes) {
      const dlBtn = document.createElement('button');
      dlBtn.type = 'button';
      dlBtn.className = 'btn btn-primary btn-xs';
      dlBtn.textContent = 'Download';
      dlBtn.addEventListener('click', () => {
        let url = appState.localFileUrls.get(f.fileId);
        if (!url) {
          url = URL.createObjectURL(new Blob([cached.bytes], { type: f.mime }));
          appState.localFileUrls.set(f.fileId, url);
        }
        const a = document.createElement('a');
        a.href = url;
        a.download = f.name;
        a.click();
      });
      actions.appendChild(dlBtn);
    } else {
      const reqBtn = document.createElement('button');
      reqBtn.type = 'button';
      reqBtn.className = 'btn btn-secondary btn-xs';
      reqBtn.textContent = assembler ? `${Math.round(assembler.getProgress() * 100)}%` : 'Fetch from Peers';
      reqBtn.addEventListener('click', () => {
        if (appState.transport) {
          appState.transport.sendControl({ type: 'FILE_REQUEST', fileId: f.fileId });
        }
      });
      actions.appendChild(reqBtn);
    }

    if (f.fingerprint === appState.identity?.fingerprint) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-danger btn-xs';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => issueTombstone(f.fileId, 'file'));
      actions.appendChild(delBtn);
    }

    top.append(info, actions);
    row.appendChild(top);

    const progressVal = cached ? 1 : assembler ? assembler.getProgress() : 0;
    const track = document.createElement('div');
    track.className = 'file-progress-track';
    const fill = document.createElement('div');
    fill.className = 'file-progress-fill';
    fill.style.width = `${Math.round(progressVal * 100)}%`;
    track.appendChild(fill);
    row.appendChild(track);

    list.appendChild(row);
  }
}

/* ---------------- POMODORO SYNC TIMER ---------------- */

function applyRemoteTimer(remote) {
  appState.timer = { ...remote };
  renderTimer();
}

function broadcastTimer() {
  appState.timer.lamport = appState.room.tick();
  appState.timer.updatedAt = Date.now();
  if (appState.transport) {
    appState.transport.sendControl({ type: 'TIMER', timer: appState.timer });
  }
  renderTimer();
}

function renderTimer() {
  let rem = appState.timer.remainingSec;
  if (appState.timer.running) {
    const elapsed = Math.floor((Date.now() - appState.timer.updatedAt) / 1000);
    rem = Math.max(0, rem - elapsed);
  }
  const mm = String(Math.floor(rem / 60)).padStart(2, '0');
  const ss = String(rem % 60).padStart(2, '0');
  $('timerClock').textContent = `${mm}:${ss}`;
  $('timerPhaseLabel').textContent = appState.timer.mode === 'focus' ? 'FOCUS' : 'BREAK';
  $('timerToggleBtn').textContent = appState.timer.running ? 'Pause' : 'Start';
  $('timerModeBtn').textContent = appState.timer.mode === 'focus' ? 'Break' : 'Focus';
}

/* ---------------- RENDER HELPERS ---------------- */

function renderPeers() {
  const list = $('peerList');
  list.replaceChildren();
  $('peerCountBadge').textContent = `${appState.peers.size} Peer${appState.peers.size === 1 ? '' : 's'}`;

  const selfLi = document.createElement('li');
  selfLi.className = 'peer-item';
  const selfName = document.createElement('span');
  selfName.className = 'peer-name';
  selfName.textContent = `${appState.identity.displayName} (You)`;
  const selfBadge = document.createElement('span');
  selfBadge.className = 'badge badge-info';
  selfBadge.textContent = appState.identity.fingerprint;
  selfLi.append(selfName, selfBadge);
  list.appendChild(selfLi);

  for (const [, p] of appState.peers) {
    const li = document.createElement('li');
    li.className = 'peer-item';
    const name = document.createElement('span');
    name.className = 'peer-name';
    name.textContent = p.name;
    const badge = document.createElement('span');
    badge.className = p.verified ? 'badge badge-ok' : 'badge badge-warn';
    badge.textContent = p.verified ? `${p.fingerprint} ✓` : 'Pending';
    li.append(name, badge);
    list.appendChild(li);
  }
}

function updateLamportBadge() {
  $('lamportBadge').textContent = `L: ${appState.room.lamport}`;
}

function renderAll() {
  renderPeers();
  renderChat();
  renderNotes();
  redrawBoard();
  renderFiles();
  renderTimer();
  updateLamportBadge();
}

/* ---------------- DIAGNOSTICS & INVITE ---------------- */

async function openInviteDialog() {
  const url = new URL(window.location.href);
  url.searchParams.set('room', appState.roomCode);
  url.searchParams.set('mode', appState.mode);
  const inviteUrl = url.toString();
  $('inviteCodeInput').value = appState.roomCode;
  $('inviteLinkInput').value = inviteUrl;
  $('inviteDialog').showModal();
  await renderQrCode($('inviteQrBox'), inviteUrl);
}

async function refreshDiagnostics() {
  const wrap = $('diagTableWrap');
  wrap.replaceChildren();
  if (!appState.transport) return;
  const rows = await appState.transport.getDiagnostics();
  if (rows.length === 0) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'No active WebRTC peer connections yet.';
    wrap.appendChild(p);
    return;
  }
  const table = document.createElement('table');
  table.className = 'diag-table';
  const thead = document.createElement('thead');
  const htr = document.createElement('tr');
  for (const h of ['Peer ID', 'ICE State', 'Connection', 'Candidate Type', 'RTT']) {
    const th = document.createElement('th');
    th.textContent = h;
    htr.appendChild(th);
  }
  thead.appendChild(htr);
  const tbody = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    for (const val of [
      String(r.peerId).slice(0, 12),
      r.iceState,
      r.connState,
      r.candidateType,
      r.rttMs !== null ? `${r.rttMs} ms` : '—',
    ]) {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.append(thead, tbody);
  wrap.appendChild(table);
}

/* ---------------- BOOTSTRAP ---------------- */

async function bootstrap() {
  startMeshBackground($('meshBgCanvas'), $('lobbyView'));
  const savedTheme = localStorage.getItem('peerdesk-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  try {
    const savedTurn = JSON.parse(localStorage.getItem('peerdesk-turn') || '{}');
    if (savedTurn.url) $('turnUrlInput').value = savedTurn.url;
    if (savedTurn.username) $('turnUserInput').value = savedTurn.username;
    if (savedTurn.credential) $('turnPassInput').value = savedTurn.credential;
  } catch {
    // ignore invalid localStorage
  }

  const params = new URLSearchParams(window.location.search);
  const invitedRoom = params.get('room');
  if (invitedRoom) {
    $('roomCodeInput').value = invitedRoom;
    $('inviteNotice').textContent = `You're invited to room "${invitedRoom}". Enter your name and click Join Study Room.`;
    $('inviteNotice').classList.remove('hidden');
    setLobbyMode('join');
  } else {
    setLobbyMode('join');
  }
  if (params.get('mode') && ['nostr', 'mqtt', 'manual'].includes(params.get('mode'))) {
    $('signalingModeSelect').value = params.get('mode');
  }

  await initIdentity(false);

  if (invitedRoom) {
    $('displayNameInput').focus();
  }

  $('modeJoinTab').addEventListener('click', () => setLobbyMode('join'));
  $('modeCreateTab').addEventListener('click', () => setLobbyMode('create'));
  $('roomCodeInput').addEventListener('paste', (e) => {
    const pasted = e.clipboardData?.getData('text') || '';
    const extracted = extractRoomInput(pasted);
    if (extracted.roomCode && pasted.includes('room=')) {
      e.preventDefault();
      $('roomCodeInput').value = extracted.roomCode;
      if (extracted.mode) $('signalingModeSelect').value = extracted.mode;
    }
  });

  $('lobbyThemeBtn').addEventListener('click', toggleTheme);
  $('studioThemeBtn').addEventListener('click', toggleTheme);
  $('rotateIdentityBtn').addEventListener('click', () => initIdentity(true));
  $('randomRoomBtn').addEventListener('click', () => {
    const num = Math.floor(100 + Math.random() * 900);
    $('roomCodeInput').value = `STUDY-${num}`;
  });
  $('joinForm').addEventListener('submit', joinStudyRoom);
  $('leaveRoomBtn').addEventListener('click', leaveStudyRoom);

  $('chatForm').addEventListener('submit', sendChatMessage);
  $('addNoteBtn').addEventListener('click', createNoteBlock);
  $('exportNotesBtn').addEventListener('click', exportNotesMarkdown);
  $('clearLogBtn').addEventListener('click', () => $('auditLogList').replaceChildren());

  // Tabs
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $(`tab-${btn.dataset.tab}`).classList.add('active');
      if (btn.dataset.tab === 'board') resizeCanvas();
    });
  });

  // Whiteboard controls
  setupWhiteboard();
  window.addEventListener('resize', resizeCanvas);
  document.querySelectorAll('.tool-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      appState.board.tool = btn.dataset.tool;
    });
  });
  document.querySelectorAll('.swatch').forEach((sw) => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('.swatch').forEach((s) => s.classList.remove('active'));
      sw.classList.add('active');
      appState.board.color = sw.dataset.color;
    });
  });
  $('strokeWidthInput').addEventListener('input', (e) => {
    appState.board.width = Number(e.target.value) || 3;
  });
  $('clearBoardBtn').addEventListener('click', async () => {
    const lamport = appState.room.tick();
    const marker = {
      kind: 'clear',
      id: `clr-${appState.identity.fingerprint}-${lamport}`,
      lamport,
      senderId: appState.identity.fingerprint,
      senderName: appState.identity.displayName,
    };
    appState.room.applyClearMarker(marker);
    schedulePersist();
    redrawBoard();
    updateLamportBadge();
    if (appState.transport) {
      await appState.transport.sendControl({ type: 'STROKE_CLEAR', marker });
    }
  });
  $('exportBoardBtn').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = $('whiteboardCanvas').toDataURL('image/png');
    a.download = `${appState.roomCode || 'board'}-whiteboard.png`;
    a.click();
  });

  // File vault
  $('browseFileBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (e) => {
    if (e.target.files?.length) shareFiles(e.target.files);
    e.target.value = '';
  });
  const dropZone = $('fileDropZone');
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer?.files?.length) shareFiles(e.dataTransfer.files);
  });

  // Manual SDP pairing buttons
  $('createOfferBtn').addEventListener('click', async () => {
    if (!appState.transport) return;
    const { sessionId, token } = await appState.transport.createManualOffer();
    appState.manualSessionId = sessionId;
    $('manualOutputBox').value = token;
    logEvent('Created Manual SDP Offer token. Send it to your peer.');
  });
  $('acceptOfferBtn').addEventListener('click', async () => {
    if (!appState.transport) return;
    const raw = $('manualInputBox').value.trim();
    if (!raw) return;
    const answerToken = await appState.transport.acceptManualOffer(raw);
    $('manualOutputBox').value = answerToken;
    logEvent('Accepted Offer & generated Answer token. Send Answer back to Offerer.');
  });
  $('applyAnswerBtn').addEventListener('click', async () => {
    if (!appState.transport) return;
    const raw = $('manualInputBox').value.trim();
    if (!raw) return;
    await appState.transport.acceptManualAnswer(appState.manualSessionId, raw);
    $('manualInputBox').value = '';
    logEvent('Applied Answer token — establishing direct WebRTC DataChannel.');
  });
  $('copyManualTokenBtn').addEventListener('click', async () => {
    if ($('manualOutputBox').value) {
      await navigator.clipboard.writeText($('manualOutputBox').value);
      logEvent('Copied SDP token to clipboard.');
    }
  });

  // Invite & Diagnostics modals
  $('inviteBtn').addEventListener('click', openInviteDialog);
  $('closeInviteBtn').addEventListener('click', () => $('inviteDialog').close());
  $('copyInviteCodeBtn').addEventListener('click', async () => {
    await navigator.clipboard.writeText($('inviteCodeInput').value);
    logEvent('Copied room code.');
  });
  $('copyInviteBtn').addEventListener('click', async () => {
    await navigator.clipboard.writeText($('inviteLinkInput').value);
    logEvent('Copied room invite URL.');
  });

  $('diagnosticsBtn').addEventListener('click', async () => {
    $('diagnosticsDialog').showModal();
    await refreshDiagnostics();
  });
  $('closeDiagBtn').addEventListener('click', () => $('diagnosticsDialog').close());
  $('refreshDiagBtn').addEventListener('click', refreshDiagnostics);
  $('restartIceBtn').addEventListener('click', async () => {
    if (!appState.transport) return;
    const n = await appState.transport.restartIce();
    logEvent(`Triggered ICE restart on ${n} connection(s).`);
    await refreshDiagnostics();
  });
  $('forceSyncBtn').addEventListener('click', async () => {
    if (!appState.transport) return;
    await appState.transport.sendControl({ type: 'SYNC_DIGEST', digest: appState.room.createSyncDigest() });
    logEvent('Broadcasted sync digest to all peers.');
  });

  // Pomodoro timer controls
  $('timerToggleBtn').addEventListener('click', () => {
    if (appState.timer.running) {
      const elapsed = Math.floor((Date.now() - appState.timer.updatedAt) / 1000);
      appState.timer.remainingSec = Math.max(0, appState.timer.remainingSec - elapsed);
      appState.timer.running = false;
    } else {
      appState.timer.running = true;
    }
    broadcastTimer();
  });
  $('timerResetBtn').addEventListener('click', () => {
    appState.timer.running = false;
    appState.timer.remainingSec = appState.timer.mode === 'focus' ? 25 * 60 : 5 * 60;
    broadcastTimer();
  });
  $('timerModeBtn').addEventListener('click', () => {
    appState.timer.running = false;
    appState.timer.mode = appState.timer.mode === 'focus' ? 'break' : 'focus';
    appState.timer.remainingSec = appState.timer.mode === 'focus' ? 25 * 60 : 5 * 60;
    broadcastTimer();
  });

  setInterval(() => {
    if (appState.timer.running) renderTimer();
    if (appState.remoteCursors.size > 0) renderRemoteCursors();
  }, 1000);
}

bootstrap();
