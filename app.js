// P2P Class Chat
//
// There is no backend. When you join a room, the page posts a note on
// public Nostr relays so browsers in the same room can find each other
// and swap connection details. After that, every message goes straight
// from browser to browser over WebRTC. Trystero does the WebRTC work.

// Only browsers using the same APP_ID can ever see each other.
const APP_ID = 'p2p-class-chat-yrathia-v2';

// Trystero is loaded with import() rather than <script type="module">
// so the page still works when index.html is opened straight from disk
// (Chrome refuses to load module files over file://).
const TRYSTERO_URL = 'https://cdn.jsdelivr.net/npm/trystero@0.26.0/+esm';

// Two people on different networks (mobile data, college Wi-Fi, ...)
// often can't connect directly. A TURN server relays traffic for just
// those pairs, still end-to-end encrypted. Cloudflare and Metered both
// have free tiers. Add yours here, for example:
//   { urls: 'turn:turn.example.com:3478', username: 'user', credential: 'pass' }
const TURN_SERVERS = [];

const HISTORY_LIMIT = 100;            // recent messages handed to people who join late
const MAX_ITEMS = 500;                // how many rows we keep on screen
const GROUP_WINDOW = 5 * 60 * 1000;   // stack messages from one person within 5 minutes

const AVATAR_COLORS = ['#b5523b', '#3b7ea1', '#5a8f3d', '#8a5aa8', '#a8741a', '#2f8f83', '#a34d73', '#4f63b8'];
const timeFormat = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' });


// ---------- Page elements ----------

const $ = id => document.getElementById(id);
const joinView = $('joinView'), chatView = $('chatView');
const joinForm = $('joinForm'), joinBtn = $('joinBtn'), joinError = $('joinError');
const nameInput = $('nameInput'), roomInput = $('roomInput'), passInput = $('passInput');
const messagesBox = $('messages'), peopleList = $('peopleList'), peopleCount = $('peopleCount');
const statusText = $('status'), sendForm = $('sendForm'), msgInput = $('msgInput');


// ---------- State ----------

let trystero = null;       // the library, once loaded
let room = null;
let roomName = '';
let myName = '';
let joinedAt = 0;
let usingPassword = false;
let helloAction, chatAction, backlogAction;

const peers = {};          // peerId -> name (null until they tell us)
const items = [];          // messages and notices, in display order
const seenIds = new Set(); // so the same message never shows up twice
const reportedErrors = new Set();
let sentCount = 0;
let warnedAlone = false;


// ---------- Load the library ----------

const trysteroReady = import(TRYSTERO_URL)
  .then(lib => { trystero = lib; })
  .catch(err => {
    console.error(err);
    joinError.textContent = "Couldn't load the chat library. Check your internet connection and reload the page.";
    joinBtn.disabled = true;
  });


// ---------- Join screen ----------

// Invite links look like ?room=frontend
roomInput.value = new URLSearchParams(location.search).get('room') || '';
nameInput.value = load('chat-name');
if (!nameInput.value) nameInput.focus();
else if (!roomInput.value) roomInput.focus();

joinForm.addEventListener('submit', async event => {
  event.preventDefault();
  myName = nameInput.value.trim();
  roomName = roomInput.value.trim();
  if (!myName) return showJoinError('Enter your name.', nameInput);
  if (!roomName) return showJoinError('Enter a room name.', roomInput);

  joinBtn.disabled = true;
  joinBtn.textContent = 'Joining…';
  await trysteroReady;
  if (!trystero) return;   // the load error is already on screen

  const config = { appId: APP_ID };
  if (passInput.value) config.password = passInput.value;
  if (TURN_SERVERS.length) config.turnConfig = TURN_SERVERS;

  try {
    room = trystero.joinRoom(config, roomName, { onJoinError: handleJoinError });
  } catch (err) {
    console.error(err);
    joinBtn.disabled = false;
    joinBtn.textContent = 'Join room';
    return showJoinError("Couldn't join that room: " + err.message);
  }

  save('chat-name', myName);
  joinedAt = Date.now();
  usingPassword = Boolean(config.password);
  setUpActions();
  setUpPeerEvents();
  showChat();
});

function showJoinError(text, field) {
  joinError.textContent = text;
  if (field) field.focus();
}

function showChat() {
  joinView.hidden = true;
  chatView.hidden = false;
  $('roomTitle').textContent = roomName;
  document.title = roomName + ' · P2P Class Chat';
  history.replaceState(null, '', '?room=' + encodeURIComponent(roomName));

  addNotice(`You joined ${roomName}. Send the invite link to anyone you want in here.`);
  renderPeople();
  updateStatus();
  setInterval(updateStatus, 2000);
  msgInput.focus();
}


// ---------- Talking to other browsers ----------

// An action is a named channel. Whatever one browser sends on "chat"
// arrives in chatAction.onMessage on everyone else's.
function setUpActions() {
  helloAction = room.makeAction('hello');      // "my name is ..."
  chatAction = room.makeAction('chat');        // one new message
  backlogAction = room.makeAction('backlog');  // recent messages, for people who join late

  helloAction.onMessage = (data, { peerId }) => {
    const name = cleanName(data && data.name);
    if (!name) return;
    const isNew = !peers[peerId];
    peers[peerId] = name;
    if (isNew) addNotice(`${name} joined`);
    renderPeople();
    updateStatus();
  };

  chatAction.onMessage = (data, { peerId }) => {
    const msg = cleanMessage(data);
    if (!msg) return;
    msg.from = peerId;   // trust the connection over what the message claims
    if (insertItem(msg)) render();
  };

  backlogAction.onMessage = list => {
    if (!Array.isArray(list)) return;
    let added = false;
    for (const raw of list.slice(-HISTORY_LIMIT)) {
      const msg = cleanMessage(raw);
      if (msg && insertItem(msg, true)) added = true;
    }
    if (added) render();
  };
}

// onPeerJoin fires once the direct connection is open, so from here on
// nothing goes through the relays.
function setUpPeerEvents() {
  room.onPeerJoin = peerId => {
    if (!(peerId in peers)) peers[peerId] = null;
    helloAction.send({ name: myName }, { target: peerId }).catch(console.warn);

    const recent = items.filter(item => item.type === 'chat').slice(-HISTORY_LIMIT);
    if (recent.length) backlogAction.send(recent, { target: peerId }).catch(console.warn);
    updateStatus();
  };

  room.onPeerLeave = peerId => {
    const name = peers[peerId];
    delete peers[peerId];
    if (name) addNotice(`${name} left`);
    renderPeople();
    updateStatus();
  };
}

// Without this, a wrong password or a blocked network looks exactly
// like an empty room.
function handleJoinError({ error }) {
  const kind = /password/i.test(error) ? 'password' : 'network';
  if (reportedErrors.has(kind)) return;   // Trystero retries, so this fires a lot
  reportedErrors.add(kind);
  console.warn('Trystero:', error);

  addNotice(kind === 'password'
    ? "Someone tried to connect, but their password doesn't match yours. Everyone in the room needs the same password."
    : "Couldn't connect to someone in this room. One of your networks is probably blocking direct connections (common on mobile data and college or office Wi-Fi). Try being on the same Wi-Fi.",
    'error');
}

sendForm.addEventListener('submit', event => {
  event.preventDefault();
  const text = msgInput.value.trim();
  if (!text) return;

  const msg = {
    type: 'chat',
    id: `${trystero.selfId}-${Date.now()}-${sentCount++}`,
    from: trystero.selfId,
    name: myName,
    text,
    time: Date.now(),
  };
  insertItem(msg);
  render(true);
  chatAction.send(msg).catch(console.warn);
  msgInput.value = '';

  if (peerCount() === 0 && !warnedAlone) {
    warnedAlone = true;
    addNotice("No one else is here yet. Anyone who joins while you're still in the room will get your messages.");
  }
});

$('copyLinkBtn').addEventListener('click', async event => {
  const button = event.currentTarget;
  const link = inviteLink();
  try {
    await navigator.clipboard.writeText(link);
    button.textContent = 'Link copied';
    setTimeout(() => { button.textContent = 'Invite link'; }, 1500);
  } catch {
    prompt('Copy this invite link:', link);
  }
});

$('leaveBtn').addEventListener('click', async () => {
  await leaveRoom();
  location.href = inviteLink();   // back to the join screen, room name kept
});

// Let the others know right away when the tab closes.
window.addEventListener('pagehide', leaveRoom);

async function leaveRoom() {
  if (!room) return;
  const leaving = room;
  room = null;
  try { await leaving.leave(); } catch (err) { console.warn(err); }
}


// ---------- Drawing the screen ----------

// Live messages go at the bottom. Backlog from other people can be older
// than what's already on screen, so it gets slotted in by time.
function insertItem(item, byTime = false) {
  if (item.type === 'chat') {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
  }
  let i = items.length;
  if (byTime) while (i > 0 && items[i - 1].time > item.time) i--;
  items.splice(i, 0, item);
  if (items.length > MAX_ITEMS) items.splice(0, items.length - MAX_ITEMS);
  return true;
}

function addNotice(text, tone) {
  insertItem({ type: 'notice', text, tone, time: Date.now() });
  render();
}

function render(scrollToEnd = false) {
  const nearBottom = messagesBox.scrollHeight - messagesBox.scrollTop - messagesBox.clientHeight < 80;
  const oldScroll = messagesBox.scrollTop;

  const rows = document.createDocumentFragment();
  let prev = null;
  for (const item of items) {
    rows.appendChild(item.type === 'chat' ? messageRow(item, prev) : noticeRow(item));
    prev = item;
  }
  messagesBox.replaceChildren(rows);

  // Don't yank the view down if someone is scrolled up reading.
  messagesBox.scrollTop = scrollToEnd || nearBottom ? messagesBox.scrollHeight : oldScroll;
}

function messageRow(msg, prev) {
  const sameSender = prev && prev.type === 'chat' && prev.from === msg.from
    && msg.time - prev.time < GROUP_WINDOW;
  const time = new Date(msg.time);
  const row = el('div', sameSender ? 'msg cont' : 'msg');

  if (sameSender) {
    row.appendChild(el('span', 'stamp', timeFormat.format(time)));
    row.appendChild(el('div', 'text', msg.text));
    return row;
  }

  const avatar = el('div', 'avatar', initials(msg.name));
  avatar.style.background = colorFor(msg.name);

  const stamp = el('time', null, timeFormat.format(time));
  stamp.dateTime = time.toISOString();
  stamp.title = time.toLocaleString();

  const meta = el('div', 'meta');
  meta.append(el('span', 'name', msg.name), stamp);

  const body = el('div');
  body.append(meta, el('div', 'text', msg.text));

  row.append(avatar, body);
  return row;
}

function noticeRow(item) {
  return el('div', item.tone === 'error' ? 'notice error' : 'notice', item.text);
}

function renderPeople() {
  const me = el('li', null, myName + ' ');
  me.appendChild(el('span', 'you', '(you)'));

  const others = onlineNames().map(name => el('li', null, name));
  peopleList.replaceChildren(me, ...others);
  peopleCount.textContent = others.length + 1;
}

function updateStatus() {
  if (!room) return;
  const names = onlineNames();
  const waiting = peerCount() - names.length;   // connected but haven't said their name yet
  let text, warn = false;

  if (names.length === 1) text = `You and ${names[0]}`;
  else if (names.length > 1 && names.length <= 3) text = `You, ${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  else if (names.length > 3) text = `You and ${names.length} others`;
  else if (waiting > 0) text = 'Someone is connecting…';
  // A password mismatch is often only reported on the other person's side.
  else if (openRelayCount() > 0 && usingPassword && Date.now() - joinedAt > 10000) {
    text = "Waiting for others. If they're already here, check you all typed the same password.";
  }
  else if (openRelayCount() > 0) text = 'Waiting for others to join';
  else if (Date.now() - joinedAt < 15000) text = 'Connecting…';
  else {
    text = "Can't reach the relay servers. Your network may be blocking them.";
    warn = true;
  }

  statusText.textContent = text;
  statusText.title = text;
  statusText.classList.toggle('warn', warn);
}


// ---------- Small helpers ----------

function peerCount() {
  return Object.keys(peers).length;
}

function onlineNames() {
  return Object.values(peers).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function openRelayCount() {
  try {
    return Object.values(trystero.getRelaySockets()).filter(ws => ws && ws.readyState === 1).length;
  } catch {
    return 1;   // can't tell, so don't show a scary warning
  }
}

function inviteLink() {
  return location.href.split(/[?#]/)[0] + '?room=' + encodeURIComponent(roomName);
}

// Data from other browsers can be anything, so check it before using it.
function cleanName(value) {
  return typeof value === 'string' ? value.trim().slice(0, 30) : '';
}

function cleanMessage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = typeof raw.text === 'string' ? raw.text.slice(0, 2000) : '';
  const id = typeof raw.id === 'string' ? raw.id.slice(0, 120) : '';
  if (!text.trim() || !id) return null;
  return {
    type: 'chat',
    id,
    text,
    from: typeof raw.from === 'string' ? raw.from : '',
    name: cleanName(raw.name) || 'Unknown',
    time: Number.isFinite(raw.time) ? raw.time : Date.now(),
  };
}

function initials(name) {
  const words = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map(word => [...word][0]).join('').toUpperCase() || '?';
}

function colorFor(name) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// localStorage can throw in private windows or with storage blocked.
function load(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

function save(key, value) {
  try { localStorage.setItem(key, value); } catch { /* not important */ }
}
