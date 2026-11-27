// SyncRoom room page.
// Chat, playback commands and audio all travel browser-to-browser over WebRTC.
// Nostr relays are only used by Trystero so peers can find each other.
const BUILD = "syncroom-r2-2026-11-24";   // shown in diagnostics so you can tell which file is deployed
window.__syncroomBuild = BUILD;           // the watchdog in room.html checks this
const TRYSTERO_URL = "https://esm.sh/trystero@0.27.0";

const APP_ID = "syncroom.sanchigoyal26.music-room.v1";   // identical on every device
// Optional TURN fallback for networks that block direct connections, e.g.
// [{ urls: "turn:turn.example.com:3478", username: "user", credential: "pass" }]
// Never commit long-lived private credentials to a public repo.
const TURN_SERVERS = [];

const MAX_TEXT = 1000, MAX_NAME = 20, HISTORY_LIMIT = 100, STORE_LIMIT = 200;
const TICK_MS = 5000, MAX_FILE = 150 * 1024 * 1024;
const CODE_RE = /^[A-Z0-9]{6}$/;
// Trystero action names must be 12 bytes or fewer.
const ACTIONS = { chat: "sr-chat", profile: "sr-profile", history: "sr-history", play: "sr-play", track: "sr-track", mode: "sr-mode" };

const $ = (id) => document.getElementById(id);

// ---------- Room code: the URL hash is the single source of truth ----------
let roomCode = "";
try { roomCode = decodeURIComponent(location.hash.slice(1)).toUpperCase(); } catch { /* bad escape */ }
if (!CODE_RE.test(roomCode)) {
  location.replace("./index.html");
  throw new Error("Invalid room code");
}
const isHost = sessionStorage.getItem("syncroom_is_host") === "true"
  && (sessionStorage.getItem("syncroom_room") || "").toUpperCase() === roomCode;
$("displayRoomCode").textContent = roomCode;

// ---------- State ----------
let username = cleanName(sessionStorage.getItem("syncroom_username") || localStorage.getItem("syncroom_name") || "");
let room = null, left = false, failed = false, joinRoom = null;
let act = {};                       // action objects
let unsubs = [];                    // event unsubscribe functions
let searchTimer = null, tickTimer = null;

const peers = new Map();            // userId -> Set(peerId)   (real WebRTC connections)
const profiles = new Map();         // userId -> display name
let hostUserId = null;              // userId of the peer that claimed to be host
const remoteAudio = new Map();      // userId -> <audio>

let messages = [], seen = new Set(), lamport = 0;

let playbackMode = "sync";
let objectUrl = null, localTrack = null, hostTrack = null;
let seq = Date.now(), lastSeq = 0;  // host sequence is monotonic even across host refreshes
let currentStream = null, audioCtx = null, sourceNode = null, streamDest = null, usingWebAudio = false;
let audioUnlocked = false, lastHostPlay = null;

// ---------- Small helpers ----------
function cleanName(v) { return typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_NAME) : ""; }
const idOf = (ctx) => ctx?.userId || ctx?.peerId || "unknown";
const shortId = (id) => String(id).slice(0, 5);

function diag(text) {
  console.log("[SyncRoom]", text);
  const li = document.createElement("li");
  li.textContent = `${new Date().toLocaleTimeString()} ${text}`;
  const list = $("diagLog");
  list.prepend(li);
  while (list.children.length > 40) list.lastChild.remove();
}

function setConnection(text, ok = false, bad = false) {
  $("connectionText").textContent = text;
  $("connectionStatus").classList.toggle("connected", ok);
  $("connectionStatus").classList.toggle("error", bad);
}

function setMedia(text, warn = false) {
  $("mediaStatus").textContent = text;
  $("mediaStatus").classList.toggle("warn", warn);
}

// Every send goes through here so a rejected promise never goes unnoticed.
function safeSend(action, data, target) {
  try {
    const p = target ? action.send(data, { target }) : action.send(data);
    return Promise.resolve(p).catch((e) => diag("send failed: " + (e?.message || e)));
  } catch (e) {
    diag("send failed: " + (e?.message || e));
    return Promise.resolve();
  }
}

// ---------- Chat store (local copy, merged with peers' history) ----------
const storeKey = `syncroom:chat:${roomCode}`;

function loadStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey) || "null");
    if (!saved || !Array.isArray(saved.messages)) return;
    lamport = Number.isFinite(saved.lamport) ? saved.lamport : 0;
    for (const raw of saved.messages) {
      const m = validateMessage(raw);
      if (m && !seen.has(m.id)) { m.own = raw.own === true; messages.push(m); seen.add(m.id); }
    }
    sortMessages();
  } catch (e) { diag("could not read saved chat: " + e.message); }
}

function saveStore() {
  try { localStorage.setItem(storeKey, JSON.stringify({ lamport, messages })); } catch { /* storage blocked */ }
}

// Order by Lamport clock, then by id, so every device ends up with the same order.
function sortMessages() {
  messages.sort((a, b) => a.lc - b.lc || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// Peers can send anything, so check shape and size before using it.
function validateMessage(raw) {
  if (!raw || typeof raw !== "object") return null;
  const { id, text, lc, ts } = raw;
  if (typeof id !== "string" || id.length < 8 || id.length > 64) return null;
  if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT) return null;
  return {
    id, text,
    lc: Number.isSafeInteger(lc) && lc >= 0 ? lc : 0,
    ts: Number.isFinite(ts) ? ts : Date.now(),
    name: cleanName(raw.name) || "Unknown",
    from: typeof raw.from === "string" ? raw.from.slice(0, 64) : "",
    own: false,
  };
}

function addMessage(m) {
  if (seen.has(m.id)) return false;      // duplicate (reconnect or history sync)
  seen.add(m.id);
  lamport = Math.max(lamport, m.lc) + 1;
  messages.push(m);
  sortMessages();
  if (messages.length > STORE_LIMIT) messages = messages.slice(-STORE_LIMIT);
  saveStore();
  return true;
}

const toWire = (m) => ({ id: m.id, text: m.text, lc: m.lc, ts: m.ts, name: m.name, from: m.from });

function renderChat() {
  const box = $("chatMessages");
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  box.replaceChildren();
  if (!messages.length) {
    const p = document.createElement("p");
    p.className = "welcome-message";
    p.textContent = "No messages yet. Say hi!";
    box.append(p);
    return;
  }
  for (const m of messages) {
    const item = document.createElement("div");
    item.className = "chat-message" + (m.own ? " own" : "");
    const who = document.createElement("strong");
    who.textContent = m.own ? `${m.name} (You)` : m.name;   // textContent only, never innerHTML
    const body = document.createElement("p");
    body.textContent = m.text;
    item.append(who, body);
    box.append(item);
  }
  if (nearBottom) box.scrollTop = box.scrollHeight;
}

// ---------- Members and connection status ----------
function renderMembers() {
  const list = $("membersList");
  list.replaceChildren();
  const row = (label, sub, friend) => {
    const r = document.createElement("div");
    r.className = "member";
    const av = document.createElement("div");
    av.className = "avatar" + (friend ? " friend-avatar" : "");
    av.textContent = (label.charAt(0) || "?").toUpperCase();
    const d = document.createElement("div");
    const s = document.createElement("strong");
    s.textContent = label;
    const sm = document.createElement("small");
    sm.textContent = sub;
    d.append(s, sm);
    const dot = document.createElement("span");
    dot.className = "online-dot";
    r.append(av, d, dot);
    list.append(r);
  };
  row(`${username} (You)`, isHost ? "Room host" : "You", false);
  for (const uid of peers.keys()) {
    row(profiles.get(uid) || `Peer ${shortId(uid)}`, uid === hostUserId ? "Room host" : "Connected over WebRTC", true);
  }
  if (!peers.size) {
    const e = document.createElement("div");
    e.className = "member-empty";
    e.textContent = "Waiting for friends to join…";
    list.append(e);
  }
  $("memberCount").textContent = String(peers.size + 1);
}

// "Connected" only when a real WebRTC data channel to a peer is open.
function refreshConnection() {
  if (left) return setConnection("Disconnected");
  if (failed) return;
  if (peers.size) setConnection(`Connected to ${peers.size} peer${peers.size > 1 ? "s" : ""} (WebRTC)`, true);
  else setConnection("Searching for peers…");
}

// ---------- Room setup ----------
async function start() {
  if (room) return;   // never join the same room twice
  $("welcomeText").textContent = `Welcome, ${username}${isHost ? " · Room host" : ""}`;
  loadStore();
  renderChat();
  renderMembers();
  applyMode("sync");
  setConnection("Initialising…");
  diag(`build ${BUILD}, room ${roomCode}, loading Trystero…`);

  try {
    // Loaded here (not a top-level import) so a blocked CDN shows a real error on the page.
    if (!joinRoom) ({ joinRoom } = await import(TRYSTERO_URL));
  } catch (e) {
    failed = true;
    setConnection("Couldn't load the P2P library (check internet / blocked cdn)", false, true);
    diag("import failed: " + (e?.message || e));
    return;
  }

  try {
    const config = { appId: APP_ID };
    if (TURN_SERVERS.length) config.turnConfig = TURN_SERVERS;
    room = joinRoom(config, roomCode);
  } catch (e) {
    failed = true;
    setConnection("Connection failed", false, true);
    diag("joinRoom failed: " + e.message);
    return;
  }
  diag(`joined room ${roomCode} via relays; waiting for peers`);
  refreshConnection();

  act.chat = room.makeAction(ACTIONS.chat);
  act.profile = room.makeAction(ACTIONS.profile);
  act.history = room.makeAction(ACTIONS.history);
  act.play = room.makeAction(ACTIONS.play);
  act.track = room.makeAction(ACTIONS.track);
  act.mode = room.makeAction(ACTIONS.mode);

  unsubs.push(
    act.chat.onMessage(onChat),
    act.history.onMessage(onHistory),
    act.profile.onMessage(onProfile),
    act.mode.onMessage(onMode),
    act.track.onMessage(onTrack),
    act.play.onMessage(onPlay),
    room.onPeerJoin(onPeerJoined),
    room.onPeerLeave(onPeerLeft),
    room.onPeerStream(onStream),
  );
  if (typeof room.onError === "function") {
    unsubs.push(room.onError((err) => {
      diag(`error ${err?.code || ""}: ${err?.message || err}`);
      if (err?.code === "peer-connect-failed" && !peers.size) {
        setConnection("Peer found, but WebRTC failed (network may block it)", false, true);
      }
    }));
  }

  // If nobody shows up, say something useful instead of spinning forever.
  searchTimer = setTimeout(() => {
    if (!peers.size && !failed) {
      setConnection("Still searching… same room code? Network may block WebRTC");
      diag("no peers after 20s. Check both devices use the same code; try the same Wi-Fi or configure TURN.");
    }
  }, 20000);

  if (isHost) tickTimer = setInterval(() => {
    if (playbackMode === "sync" && !$("audioPlayer").paused) broadcastPlay("tick");
  }, TICK_MS);
}

function onPeerJoined(ctx) {
  const uid = idOf(ctx), target = ctx.peerId || uid;
  if (!peers.has(uid)) peers.set(uid, new Set());
  peers.get(uid).add(ctx.peerId || uid);
  diag(`peer connected: ${shortId(uid)}`);
  refreshConnection();
  renderMembers();

  safeSend(act.profile, { name: username, host: isHost }, target);
  const recent = messages.slice(-HISTORY_LIMIT).map(toWire);   // late-join history, sent P2P
  if (recent.length) safeSend(act.history, recent, target);

  if (isHost) {   // bring the newcomer up to date
    safeSend(act.mode, { mode: playbackMode }, target);
    if (localTrack) safeSend(act.track, trackWire(), target);
    broadcastPlay("state", target);
    if (playbackMode === "stream" && currentStream) addStreamTo(target);
  }
}

function onPeerLeft(ctx) {
  const uid = idOf(ctx), set = peers.get(uid);
  if (set) { set.delete(ctx.peerId || uid); if (!set.size) peers.delete(uid); }
  if (!peers.has(uid)) {
    const name = profiles.get(uid);
    profiles.delete(uid);
    removeRemoteAudio(uid);
    if (uid === hostUserId) { hostUserId = null; setMedia("The host left the room.", true); }
    diag(`peer left: ${name || shortId(uid)}`);
  }
  refreshConnection();
  renderMembers();
}

function onProfile(data, ctx) {
  const name = cleanName(data?.name);
  if (!name) return;
  const uid = idOf(ctx);
  profiles.set(uid, name);
  if (data.host === true && !isHost && !hostUserId) hostUserId = uid;   // first claimant wins
  renderMembers();
}

// ---------- Chat ----------
function onChat(data, ctx) {
  const m = validateMessage(data);
  if (!m) return diag("dropped invalid chat payload");
  m.from = idOf(ctx);   // trust the connection, not what the message claims
  if (addMessage(m)) renderChat();
}

function onHistory(list) {
  if (!Array.isArray(list)) return;
  let added = false;
  for (const raw of list.slice(-HISTORY_LIMIT)) {
    const m = validateMessage(raw);
    if (m && addMessage(m)) added = true;
  }
  if (added) renderChat();
}

$("chatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("chatInput").value.trim().slice(0, MAX_TEXT);
  if (!text || !room) return;
  lamport += 1;
  const m = { id: crypto.randomUUID(), text, lc: lamport, ts: Date.now(), name: username, from: "me", own: true };
  addMessage(m);
  m.own = true;
  saveStore();
  renderChat();
  $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
  safeSend(act.chat, toWire(m));
  $("chatInput").value = "";
});

// ---------- Mode, track, playback ----------
function trackWire() { return { name: localTrack.name, size: localTrack.size, fp: localTrack.fp || "" }; }

function applyMode(mode) {
  playbackMode = mode;
  $("playbackMode").value = mode;
  $("playbackMode").disabled = !isHost;
  const stream = mode === "stream";
  $("uploadButton").disabled = stream && !isHost;
  $("audioPlayer").hidden = stream && !isHost;
  $("enableAudio").hidden = isHost;
  if (!stream) { for (const uid of [...remoteAudio.keys()]) removeRemoteAudio(uid); }
  $("playerNote").textContent = stream
    ? (isHost ? "Pick a track and press play. Your audio is streamed live to everyone over WebRTC." : "The host streams audio to you. Press Enable audio if nothing plays.")
    : (isHost ? "Everyone picks the same file on their own device. Your play, pause and seek are mirrored to them." : "Pick the same file the host chose. The host controls playback.");
}

$("playbackMode").addEventListener("change", (e) => {
  if (!isHost) return;
  applyMode(e.target.value);
  safeSend(act.mode, { mode: playbackMode });
  if (playbackMode === "sync") { teardownStream(); ensureFingerprint().then(() => localTrack && safeSend(act.track, trackWire())); }
  else if (!$("audioPlayer").paused) ensureStream();
});

function onMode(data, ctx) {
  if (isHost || (hostUserId && idOf(ctx) !== hostUserId)) return;
  if (data?.mode === "sync" || data?.mode === "stream") { applyMode(data.mode); lastSeq = 0; }
}

async function fingerprint(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function ensureFingerprint() {
  if (!localTrack || localTrack.fp || !localTrack.file) return;
  try {
    setMedia("Checking file fingerprint…");
    localTrack.fp = await fingerprint(localTrack.file);
    setMedia("");
  } catch (e) { diag("fingerprint failed: " + e.message); }
}

$("uploadButton").addEventListener("click", () => $("audioUpload").click());

$("audioUpload").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  if (!(file.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(file.name))) return setMedia("Please choose an audio file.", true);
  if (file.size > MAX_FILE) return setMedia("File is too large (limit 150 MB).", true);
  if (playbackMode === "stream" && !isHost) return setMedia("Only the host can pick a track in streaming mode.", true);

  const player = $("audioPlayer");
  player.pause();
  teardownStream();                                  // new track: drop the old capture
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  player.src = objectUrl;
  localTrack = { name: file.name, size: file.size, file, fp: "" };
  $("songTitle").textContent = file.name.replace(/\.[^.]+$/, "");
  $("songArtist").textContent = `${(file.size / 1048576).toFixed(1)} MB · Local file`;

  if (playbackMode === "sync") await ensureFingerprint();
  if (isHost) {
    safeSend(act.track, trackWire());
    setMedia(playbackMode === "sync" ? "Track loaded. Ask everyone to pick the same file." : "Track loaded. Press play to stream it.");
  } else checkMatch();
});

function onTrack(data, ctx) {
  if (isHost || (hostUserId && idOf(ctx) !== hostUserId)) return;
  if (!data || typeof data.name !== "string" || (data.fp !== "" && !/^[0-9a-f]{64}$/.test(data.fp))) return;
  hostTrack = { name: data.name.slice(0, 120), fp: data.fp };
  checkMatch();
}

function checkMatch() {
  if (playbackMode !== "sync" || !hostTrack) return;
  if (!localTrack || !localTrack.fp) return setMedia(`Host chose “${hostTrack.name}”. Pick the same file on your device.`, true);
  if (!hostTrack.fp) return setMedia("Waiting for the host's file fingerprint…");
  if (localTrack.fp === hostTrack.fp) setMedia("Your file matches the host's track. Ready to sync.");
  else setMedia(`Different file from the host's “${hostTrack.name}”. Playback sync is paused until it matches.`, true);
}
const trackMatches = () => !!(localTrack?.fp && hostTrack?.fp && localTrack.fp === hostTrack.fp);

// Host: broadcast authoritative state. Guests never send playback messages.
function broadcastPlay(kind, target) {
  if (!isHost || !room || playbackMode !== "sync") return;
  const p = $("audioPlayer");
  safeSend(act.play, { seq: ++seq, kind, fp: localTrack?.fp || "", pos: p.currentTime || 0, playing: !p.paused }, target);
}
$("audioPlayer").addEventListener("play", () => { if (isHost) { broadcastPlay("play"); ensureStream(); } });
$("audioPlayer").addEventListener("pause", () => { if (isHost) broadcastPlay("pause"); });
$("audioPlayer").addEventListener("seeked", () => { if (isHost) broadcastPlay("seek"); });

function onPlay(data, ctx) {
  if (isHost || playbackMode !== "sync") return;
  if (hostUserId && idOf(ctx) !== hostUserId) return;
  if (!data || !["play", "pause", "seek", "tick", "state"].includes(data.kind)) return;
  if (!Number.isFinite(data.seq) || !Number.isFinite(data.pos) || data.seq <= lastSeq) return;   // stale or out of order
  lastSeq = data.seq;
  if (typeof data.fp === "string" && data.fp && hostTrack && hostTrack.fp !== data.fp) hostTrack.fp = data.fp;
  lastHostPlay = { playing: data.playing === true, pos: data.pos };
  applyHostState(data.kind);
}

function applyHostState(kind) {
  const p = $("audioPlayer");
  if (!lastHostPlay || !localTrack) return;
  if (!trackMatches()) return checkMatch();           // never play the wrong track
  const diff = lastHostPlay.pos - p.currentTime;
  if (!lastHostPlay.playing) {
    p.pause();
    p.playbackRate = 1;
    if (Math.abs(diff) > 0.3) p.currentTime = lastHostPlay.pos;
    return;
  }
  if (kind !== "tick" && Math.abs(diff) > 0.5) p.currentTime = lastHostPlay.pos;
  if (p.paused && kind !== "tick") {
    p.play().catch(() => { setMedia("Your browser blocked autoplay. Press Enable audio.", true); $("enableAudio").hidden = false; });
  }
  if (kind === "tick" && !p.paused) {
    // Gentle drift correction: hard seek only when far off, otherwise nudge the speed.
    if (Math.abs(diff) > 1.2) p.currentTime = lastHostPlay.pos;
    else if (Math.abs(diff) > 0.15) p.playbackRate = 1 + Math.max(-0.05, Math.min(0.05, diff * 0.5));
    else p.playbackRate = 1;
  }
}

// ---------- Host-to-peer audio streaming ----------
function captureFromElement(audio) {
  const cap = audio.captureStream || audio.mozCaptureStream;
  if (cap) {
    const s = cap.call(audio);
    if (s.getAudioTracks().length) { usingWebAudio = false; return s; }
  }
  // Fallback: route through Web Audio. Connecting to both outputs keeps local sound.
  usingWebAudio = true;
  audioCtx = audioCtx || new AudioContext();
  if (!sourceNode) {
    sourceNode = audioCtx.createMediaElementSource(audio);
    streamDest = audioCtx.createMediaStreamDestination();
    sourceNode.connect(audioCtx.destination);
    sourceNode.connect(streamDest);
  }
  audioCtx.resume().catch(() => {});
  return streamDest.stream;
}

async function addStreamTo(target) {
  try {
    await room.addStream(currentStream, { ...(target ? { target } : {}), metadata: { kind: "syncroom-music", roomCode } });
    setMedia("Streaming your audio directly to peers.");
  } catch (e) {
    diag("addStream failed: " + e.message);
    setMedia("Audio streaming failed: " + e.message, true);
  }
}

function ensureStream() {
  if (!isHost || playbackMode !== "stream" || currentStream || !room) return;
  try {
    currentStream = captureFromElement($("audioPlayer"));
  } catch (e) {
    diag("capture failed: " + e.message);
    return setMedia("This browser can't capture audio from the player. Use Chrome/Firefox, or Synchronized mode.", true);
  }
  addStreamTo();   // everyone connected now; late joiners are handled in onPeerJoined
}

function teardownStream() {
  if (!currentStream) return;
  try { room?.removeStream?.(currentStream); } catch { /* already gone */ }
  if (!usingWebAudio) currentStream.getTracks().forEach((t) => t.stop());
  currentStream = null;
}

function onStream(stream, ctx) {
  if (isHost || ctx?.metadata?.kind !== "syncroom-music") return;
  const uid = idOf(ctx);
  let audio = remoteAudio.get(uid);
  if (!audio) {                                   // one element per peer, never duplicated
    audio = document.createElement("audio");
    audio.controls = true; audio.autoplay = true; audio.playsInline = true;
    audio.className = "remote-audio";
    $("remoteAudioList").append(audio);
    remoteAudio.set(uid, audio);
  }
  audio.srcObject = stream;
  $("remoteAudioWrap").hidden = false;
  setMedia("Receiving the host's audio over WebRTC.");
  audio.play().catch(() => { setMedia("Audio arrived but autoplay is blocked. Press Enable audio.", true); $("enableAudio").hidden = false; });
}

function removeRemoteAudio(uid) {
  const a = remoteAudio.get(uid);
  if (a) { a.pause(); a.srcObject = null; a.remove(); remoteAudio.delete(uid); }
  if (!remoteAudio.size) $("remoteAudioWrap").hidden = true;
}

$("enableAudio").addEventListener("click", () => {
  audioUnlocked = true;
  for (const a of remoteAudio.values()) a.play().catch((e) => diag("play blocked: " + e.message));
  if (playbackMode === "sync" && lastHostPlay) applyHostState("play");
  setMedia(remoteAudio.size || lastHostPlay ? "Audio enabled." : "Audio enabled. Waiting for the host to play.");
});

// ---------- Invite, leave, name prompt ----------
$("copyRoomCode").addEventListener("click", async () => {
  const link = `${location.origin}${location.pathname}#${roomCode}`;
  const btn = $("copyRoomCode");
  try { await navigator.clipboard.writeText(`Join my SyncRoom: ${link} (code ${roomCode})`); btn.textContent = "Copied!"; }
  catch { btn.textContent = `Code: ${roomCode}`; }
  setTimeout(() => { btn.textContent = "Copy invite"; }, 1800);
});

async function leaveRoom() {
  if (left) return;
  left = true;
  clearTimeout(searchTimer); clearInterval(tickTimer);
  for (const off of unsubs) { try { off?.(); } catch { /* ignore */ } }
  unsubs = [];
  teardownStream();
  for (const uid of [...remoteAudio.keys()]) removeRemoteAudio(uid);
  $("audioPlayer").pause();
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
  const r = room; room = null;
  try { await r?.leave(); } catch (e) { console.warn(e); }
  setConnection("Disconnected");
}

$("leaveRoom").addEventListener("click", async () => {
  await leaveRoom();
  sessionStorage.removeItem("syncroom_room");
  sessionStorage.removeItem("syncroom_is_host");
  location.href = "./index.html";
});
window.addEventListener("pagehide", () => { leaveRoom(); });

if (username) start().catch((e) => { setConnection("Startup error: " + e.message, false, true); diag("startup error: " + e.stack); });
else {
  $("namePrompt").hidden = false;
  $("nameInput").focus();
  $("nameForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const n = cleanName($("nameInput").value);
    if (!n) return;
    username = n;
    try { localStorage.setItem("syncroom_name", n); } catch { /* ignore */ }
    $("namePrompt").hidden = true;
    start().catch((e) => { setConnection("Startup error: " + e.message, false, true); diag("startup error: " + e.stack); });
  });
}