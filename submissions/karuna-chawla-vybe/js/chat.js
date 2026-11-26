/* ==========================================================================
   chat.js  -  VYBE chat data management
   --------------------------------------------------------------------------
   This file knows NOTHING about WebRTC or the page (DOM). It only handles:

     1. LocalStorage        -> Problem: "Data lost on refresh"
     2. Unique message IDs  -> Problem: "Duplicate messages"
     3. Ordering            -> Problem: "Messages in the wrong order"
     4. Validation          -> Problem: "Malicious input"
     5. History batches     -> Bonus:   "Late joiners see no history"

   Every message looks like this:
     {
       id:        "3f2b...",   unique ID (for duplicate detection)
       senderId:  "a91c...",   who wrote it
       content:   "Hello!",    the text
       timestamp: 1732450000000,  device clock (milliseconds)
       seq:       12,          logical sequence number (see "Ordering" below)
       type:      "chat"
     }

   NOTE: LocalStorage only holds THIS user's own copy of the chat.
   It is not a shared database and it is never sent to any server.
   ========================================================================== */

const VybeChat = (function () {
  'use strict';

  /* ---------------------------------------------------------------------
     Limits (used for validation)
     --------------------------------------------------------------------- */
  const LIMITS = {
    MAX_MESSAGE_LENGTH: 1000,   // characters per chat message
    MAX_ROOM_NAME_LENGTH: 40,
    MAX_NAME_LENGTH: 24,
    MAX_PAYLOAD_CHARS: 100000,  // biggest raw text we accept from the DataChannel
    MAX_STORED_MESSAGES: 1000,  // per room, oldest are dropped after this
    HISTORY_BATCH_SIZE: 20,     // messages per history packet
    MAX_HISTORY_ACCEPTED: 1000, // messages accepted from one sync request
    MAX_BATCHES: 60
  };

  const MIN_TIMESTAMP = Date.UTC(2020, 0, 1);
  const MAX_TIMESTAMP = Date.UTC(2100, 0, 1);
  const MAX_SEQ = 1000000000;

  // Keys used in LocalStorage
  const KEYS = {
    USER: 'vybe.user',
    ROOMS: 'vybe.rooms',
    LAST_ROOM: 'vybe.lastRoom',
    CHAT_PREFIX: 'vybe.chat.'
  };

  // The kinds of packets that may travel over the DataChannel
  const PACKET_TYPES = ['chat', 'hello', 'history-request', 'history-response', 'bye'];

  /* ---------------------------------------------------------------------
     Small helpers
     --------------------------------------------------------------------- */
  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  // IDs may only contain letters, numbers, "-" and "_" (a UUID fits this).
  function isValidId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value);
  }

  // Create a random unique ID (UUID when the browser supports it).
  function generateId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    let id = '';
    for (let i = 0; i < 4; i++) {
      id += Math.random().toString(36).slice(2, 10);
    }
    return id.slice(0, 32);
  }

  // Remove invisible/control characters. Keeps normal text, new lines and tabs.
  // Also removes "right-to-left override" characters that can be used to make
  // text look different from what it really is.
  const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;

  function cleanContent(text) {
    return String(text).replace(/\r\n?/g, '\n').replace(CONTROL_CHARS, '').trim();
  }

  // Names are single-line text.
  function cleanSingleLine(text, maxLength) {
    return String(text == null ? '' : text)
      .replace(CONTROL_CHARS, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  function cleanName(text) { return cleanSingleLine(text, LIMITS.MAX_NAME_LENGTH); }
  function cleanRoomName(text) { return cleanSingleLine(text, LIMITS.MAX_ROOM_NAME_LENGTH); }

  // Check room info that arrives inside a connection code.
  // Returns a clean { id, name } object or null if it is not valid.
  function sanitizeRoomMeta(room) {
    if (!isPlainObject(room) || !isValidId(room.id)) return null;
    const name = cleanRoomName(room.name) || 'Study Room';
    return { id: room.id, name: name };
  }

  function fail(error) { return { ok: false, error: error }; }

  /* ---------------------------------------------------------------------
     LocalStorage wrappers (never crash the app if storage is unavailable)
     --------------------------------------------------------------------- */
  let storageProblem = false;

  function readJSON(key, fallback) {
    try {
      const text = localStorage.getItem(key);
      return text === null ? fallback : JSON.parse(text);
    } catch (err) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      storageProblem = true;
      return false;
    }
  }

  // Can this browser save data? (False in some private modes.)
  function storageWorks() {
    try {
      const testKey = 'vybe.test';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (err) {
      return false;
    }
  }

  /* ---------------------------------------------------------------------
     User identity (random ID + editable display name, kept in LocalStorage)
     --------------------------------------------------------------------- */
  function loadUser() {
    let user = readJSON(KEYS.USER, null);
    if (!isPlainObject(user) || !isValidId(user.id)) {
      user = { id: generateId(), name: '' };
    }
    user.name = cleanName(user.name) || 'Student-' + (1000 + Math.floor(Math.random() * 9000));
    writeJSON(KEYS.USER, user);
    return user;
  }

  function saveUserName(user, newName) {
    const name = cleanName(newName);
    if (!name) return user;
    user.name = name;
    writeJSON(KEYS.USER, user);
    return user;
  }

  /* ---------------------------------------------------------------------
     Rooms index (a small list of the rooms used on this device)
     --------------------------------------------------------------------- */
  function readRooms() {
    const rooms = readJSON(KEYS.ROOMS, {});
    return isPlainObject(rooms) ? rooms : {};
  }

  function upsertRoom(room) {
    const rooms = readRooms();
    const old = isPlainObject(rooms[room.id]) ? rooms[room.id] : {};
    rooms[room.id] = {
      id: room.id,
      name: room.name,
      createdAt: old.createdAt || Date.now(),
      lastActivity: old.lastActivity || Date.now(),
      messageCount: old.messageCount || 0,
      clock: old.clock || 0
    };
    writeJSON(KEYS.ROOMS, rooms);
  }

  function getRoom(roomId) {
    const record = readRooms()[roomId];
    if (!isPlainObject(record) || !isValidId(record.id)) return null;
    return {
      id: record.id,
      name: cleanRoomName(record.name) || 'Study Room',
      lastActivity: Number(record.lastActivity) || 0,
      messageCount: Number(record.messageCount) || 0,
      clock: Number(record.clock) || 0
    };
  }

  // Rooms on this device, most recently used first.
  function listRooms() {
    return Object.keys(readRooms())
      .map(getRoom)
      .filter(Boolean)
      .sort(function (a, b) { return b.lastActivity - a.lastActivity; });
  }

  function getLastRoomId() {
    try { return localStorage.getItem(KEYS.LAST_ROOM); } catch (err) { return null; }
  }

  /* ---------------------------------------------------------------------
     PROBLEM 4: MALICIOUS INPUT  ->  validation
     --------------------------------------------------------------------- */

  // Validate ONE chat message. Never trusts the input.
  // Returns { ok: true, message: <clean copy> } or { ok: false, error }.
  // The clean copy only contains the six fields we expect, so any extra
  // fields a malicious peer adds are thrown away.
  function validateMessage(raw) {
    if (!isPlainObject(raw)) return fail('Message is not an object.');
    if (raw.type !== 'chat') return fail('Wrong message type.');
    if (!isValidId(raw.id)) return fail('Invalid message ID.');
    if (!isValidId(raw.senderId)) return fail('Invalid sender ID.');
    if (typeof raw.content !== 'string') return fail('Message content must be text.');
    if (raw.content.length > LIMITS.MAX_MESSAGE_LENGTH * 2) return fail('Message is far too long.');

    const content = cleanContent(raw.content);
    if (content.length === 0) return fail('Message is empty.');
    if (content.length > LIMITS.MAX_MESSAGE_LENGTH) return fail('Message is too long.');

    if (typeof raw.timestamp !== 'number' || !Number.isFinite(raw.timestamp) ||
        raw.timestamp < MIN_TIMESTAMP || raw.timestamp > MAX_TIMESTAMP) {
      return fail('Invalid timestamp.');
    }
    if (!Number.isInteger(raw.seq) || raw.seq < 1 || raw.seq > MAX_SEQ) {
      return fail('Invalid sequence number.');
    }

    return {
      ok: true,
      message: {
        id: raw.id,
        senderId: raw.senderId,
        content: content,
        timestamp: Math.floor(raw.timestamp),
        seq: raw.seq,
        type: 'chat'
      }
    };
  }

  // Check ANY text that arrives through the DataChannel.
  // Returns { ok: true, packet } or { ok: false, error }.
  function parsePacket(raw) {
    if (typeof raw !== 'string') return fail('Data was not text.');
    if (raw.length > LIMITS.MAX_PAYLOAD_CHARS) return fail('Payload too large.');

    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return fail('Data was not valid JSON.');
    }
    if (!isPlainObject(data)) return fail('Data was not an object.');
    if (PACKET_TYPES.indexOf(data.type) === -1) return fail('Unknown packet type.');

    if (data.type === 'chat') {
      const checked = validateMessage(data);
      return checked.ok ? { ok: true, packet: checked.message } : checked;
    }

    // All the other packet types must say who sent them.
    if (!isValidId(data.senderId)) return fail('Invalid sender ID.');

    if (data.type === 'hello') {
      const name = cleanName(data.name);
      if (!name) return fail('Missing display name.');
      return { ok: true, packet: { type: 'hello', senderId: data.senderId, name: name } };
    }

    if (data.type === 'history-response') {
      if (!Array.isArray(data.messages) || data.messages.length > LIMITS.HISTORY_BATCH_SIZE) {
        return fail('Bad history batch.');
      }
      if (!Number.isInteger(data.batch) || !Number.isInteger(data.totalBatches) ||
          data.batch < 1 || data.totalBatches < 1 ||
          data.totalBatches > LIMITS.MAX_BATCHES || data.batch > data.totalBatches) {
        return fail('Bad history batch numbers.');
      }
      return {
        ok: true,
        packet: {
          type: 'history-response',
          senderId: data.senderId,
          batch: data.batch,
          totalBatches: data.totalBatches,
          messages: data.messages // each message is validated one by one when merging
        }
      };
    }

    // 'history-request' and 'bye' carry no extra data
    return { ok: true, packet: { type: data.type, senderId: data.senderId } };
  }

  /* ---------------------------------------------------------------------
     PROBLEM 3: ORDERING  ->  sequence numbers (Lamport logical clock)
     ---------------------------------------------------------------------
     Device clocks can be wrong, so we do not sort by timestamp alone.
     Each room keeps a counter called "clock":
       - When I SEND a message:   seq = clock + 1
       - When I RECEIVE a message: clock = max(clock, message.seq)
     So a new message always gets a higher seq than every message the sender
     has already seen, even if their phone clock is 10 minutes wrong.

     If two people send at the same moment they can get the SAME seq, so the
     tie-breakers are: timestamp -> senderId -> id. Every device uses the same
     rules, so every device ends up with the SAME order.
     --------------------------------------------------------------------- */
  function compareMessages(a, b) {
    if (a.seq !== b.seq) return a.seq - b.seq;
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    if (a.senderId !== b.senderId) return a.senderId < b.senderId ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  }

  /* ---------------------------------------------------------------------
     The chat that is currently open
     --------------------------------------------------------------------- */
  let current = null; // { roomId, messages: [], ids: Set, clock: number }

  // PROBLEM 1: DATA LOST ON REFRESH  ->  load saved messages from LocalStorage
  function openRoom(roomId) {
    const stored = readJSON(KEYS.CHAT_PREFIX + roomId, []);
    const record = getRoom(roomId);
    const messages = [];
    const ids = new Set();
    let highestSeq = 0;

    // Stored data could have been edited by hand, so validate it again.
    if (Array.isArray(stored)) {
      stored.forEach(function (raw) {
        const checked = validateMessage(raw);
        if (checked.ok && !ids.has(checked.message.id)) {
          ids.add(checked.message.id);
          messages.push(checked.message);
          highestSeq = Math.max(highestSeq, checked.message.seq);
        }
      });
    }
    messages.sort(compareMessages);

    current = {
      roomId: roomId,
      messages: messages,
      ids: ids,
      clock: Math.max(highestSeq, record ? record.clock : 0)
    };
    try { localStorage.setItem(KEYS.LAST_ROOM, roomId); } catch (err) { /* ignore */ }
    return messages.slice();
  }

  function closeRoom() { current = null; }

  // Save the current chat to LocalStorage and update the rooms list.
  function saveCurrent() {
    if (!current) return;
    writeJSON(KEYS.CHAT_PREFIX + current.roomId, current.messages);
    const rooms = readRooms();
    if (isPlainObject(rooms[current.roomId])) {
      rooms[current.roomId].messageCount = current.messages.length;
      rooms[current.roomId].lastActivity = Date.now();
      rooms[current.roomId].clock = current.clock;
      writeJSON(KEYS.ROOMS, rooms);
    }
  }

  // Sort, trim old messages if there are too many, then save.
  function finalize() {
    current.messages.sort(compareMessages);
    while (current.messages.length > LIMITS.MAX_STORED_MESSAGES) {
      const removed = current.messages.shift();
      current.ids.delete(removed.id);
    }
    saveCurrent();
  }

  // PROBLEM 2: DUPLICATE MESSAGES  ->  check the unique ID before adding.
  // Returns { status: 'added' | 'duplicate' | 'invalid', ... }
  function insert(raw) {
    if (!current) return { status: 'invalid', reason: 'No room is open.' };
    const checked = validateMessage(raw);
    if (!checked.ok) return { status: 'invalid', reason: checked.error };

    const message = checked.message;
    if (current.ids.has(message.id)) return { status: 'duplicate' };

    current.ids.add(message.id);
    current.messages.push(message);
    if (message.seq > current.clock) current.clock = message.seq; // clock = max(clock, seq)
    return { status: 'added', message: message };
  }

  // Add one message (used for live messages and for my own messages).
  function addMessage(raw) {
    const result = insert(raw);
    if (result.status === 'added') finalize();
    return result;
  }

  // Add many messages at once (used for history sync).
  function mergeMessages(rawList) {
    const summary = { added: 0, duplicates: 0, invalid: 0 };
    if (!Array.isArray(rawList)) return summary;
    rawList.forEach(function (raw) {
      const result = insert(raw);
      if (result.status === 'added') summary.added++;
      else if (result.status === 'duplicate') summary.duplicates++;
      else summary.invalid++;
    });
    if (summary.added > 0) finalize();
    return summary;
  }

  // Build a new message written by ME. It is not stored until it was sent.
  function createLocalMessage(text, senderId) {
    if (!current) return { ok: false, error: 'Open a room first.' };
    if (typeof text !== 'string') return { ok: false, error: 'Message must be text.' };
    const content = cleanContent(text);
    if (content.length === 0) return { ok: false, error: 'Type a message first.' };
    if (content.length > LIMITS.MAX_MESSAGE_LENGTH) {
      return { ok: false, error: 'Message is too long (maximum ' + LIMITS.MAX_MESSAGE_LENGTH + ' characters).' };
    }
    return {
      ok: true,
      message: {
        id: generateId(),
        senderId: senderId,
        content: content,
        timestamp: Date.now(),
        seq: current.clock + 1,
        type: 'chat'
      }
    };
  }

  function getMessages() { return current ? current.messages.slice() : []; }
  function getMessageCount() { return current ? current.messages.length : 0; }

  // Remove the chat on THIS device only. The clock is kept so new messages
  // still sort after the messages other people already have.
  function clearMessages() {
    if (!current) return;
    current.messages = [];
    current.ids.clear();
    saveCurrent();
  }

  // BONUS: split my saved messages into small batches for history sync.
  // Always returns at least one batch (an empty one) so the receiver knows
  // the sync has finished.
  function getHistoryBatches() {
    const all = getMessages();
    const batches = [];
    for (let i = 0; i < all.length; i += LIMITS.HISTORY_BATCH_SIZE) {
      batches.push(all.slice(i, i + LIMITS.HISTORY_BATCH_SIZE));
    }
    if (batches.length === 0) batches.push([]);
    return batches;
  }

  /* ---------------------------------------------------------------------
     Public API
     --------------------------------------------------------------------- */
  const api = {
    LIMITS: LIMITS,
    generateId: generateId,
    isValidId: isValidId,
    cleanName: cleanName,
    cleanRoomName: cleanRoomName,
    sanitizeRoomMeta: sanitizeRoomMeta,
    storageWorks: storageWorks,
    hadStorageProblem: function () { return storageProblem; },
    loadUser: loadUser,
    saveUserName: saveUserName,
    upsertRoom: upsertRoom,
    getRoom: getRoom,
    listRooms: listRooms,
    getLastRoomId: getLastRoomId,
    validateMessage: validateMessage,
    parsePacket: parsePacket,
    compareMessages: compareMessages,
    openRoom: openRoom,
    closeRoom: closeRoom,
    addMessage: addMessage,
    mergeMessages: mergeMessages,
    createLocalMessage: createLocalMessage,
    getMessages: getMessages,
    getMessageCount: getMessageCount,
    clearMessages: clearMessages,
    getHistoryBatches: getHistoryBatches
  };

  return api;
})();

// Lets the Node.js test file load this module. Browsers ignore this line.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VybeChat;
}
