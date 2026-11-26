/* ==========================================================================
   script.js  -  VYBE user interface
   --------------------------------------------------------------------------
   This file connects the three parts of the app:

     js/webrtc.js  (VybeRTC)   -> makes the real peer-to-peer connection
     js/chat.js    (VybeChat)  -> stores / validates / orders messages
     index.html + style.css    -> what the user sees

   Rules this file follows:
     * "Connected" is shown ONLY after the DataChannel is really open.
     * Text from the other student is ONLY ever put on the page with
       textContent (never innerHTML), so it can never run as HTML or JS.
   ========================================================================== */

(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const MAX_LEN = VybeChat.LIMITS.MAX_MESSAGE_LENGTH;
  const NAMES_KEY = 'vybe.names';

  /* ---------------------------------------------------------------------
     App state (one object so it is easy to see what the app remembers)
     --------------------------------------------------------------------- */
  const state = {
    user: null,              // { id, name }  me
    room: null,              // { id, name }  the room that is open
    conn: null,              // VybeRTC.Connection or null
    role: null,              // 'host' | 'guest' | null
    peer: null,              // { id, name } the other student
    status: 'idle',          // see STATUS_INFO
    statusDetail: '',
    iceState: '-',
    path: null,              // text describing the network route
    connectMode: 'create',   // which tab is open on the Connect screen
    pendingRoom: null,       // room of the connection being set up
    pendingPeer: null,       // peer hint from the pasted code
    reconnectRoom: null,     // set when reconnecting to a saved room
    answerState: 'idle',     // host's reply box: 'idle' | 'checking' | 'used'  (a reply is used only once)
    joinState: 'idle',       // guest's invite box: 'idle' | 'busy' | 'ready'
    joinedOffer: null,       // the invite code the guest already turned into a reply
    creatingOffer: false,    // host is busy creating an invite
    duplicatesBlocked: 0,
    rejectedPackets: 0,
    syncText: '-',
    syncAdded: 0,
    names: {}                // senderId -> display name (for old messages)
  };

  /* ---------------------------------------------------------------------
     Small helpers
     --------------------------------------------------------------------- */
  function toast(text, kind) {
    const box = document.createElement('div');
    box.className = 'toast' + (kind === 'bad' ? ' bad' : '');
    box.textContent = text;
    $('toasts').appendChild(box);
    setTimeout(function () { box.remove(); }, 4500);
  }

  function showError(elementId, text) {
    const el = $(elementId);
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
  }

  function shortId(id) { return id ? id.slice(0, 6) : '-'; }

  function formatTime(ms) {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDay(ms) {
    return new Date(ms).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function sameDay(a, b) {
    return new Date(a).toDateString() === new Date(b).toDateString();
  }

  // Copy text to the clipboard (with an old-browser fallback).
  async function copyText(text, sourceElement, button) {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (err) {
      try {
        sourceElement.focus();
        sourceElement.select();
        ok = document.execCommand('copy');
      } catch (err2) { ok = false; }
    }
    if (ok) {
      const old = button.textContent;
      button.textContent = 'Copied';
      setTimeout(function () { button.textContent = old; }, 1600);
    } else {
      toast('Could not copy automatically. Select the code and copy it by hand.', 'bad');
    }
  }

  // Paste from the clipboard into a textarea.
  async function pasteInto(textarea) {
    try {
      const text = await navigator.clipboard.readText();
      textarea.value = text;
      textarea.focus();
    } catch (err) {
      toast('Your browser blocked automatic paste. Click the box and press Ctrl+V (or long-press on a phone).', 'bad');
      textarea.focus();
    }
  }

  /* ---------------------------------------------------------------------
     Remembering display names of people (so old messages show a name)
     --------------------------------------------------------------------- */
  function loadNames() {
    try {
      const data = JSON.parse(localStorage.getItem(NAMES_KEY) || '{}');
      const clean = {};
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        Object.keys(data).slice(0, 200).forEach(function (id) {
          if (VybeChat.isValidId(id)) clean[id] = VybeChat.cleanName(data[id]) || 'Student';
        });
      }
      state.names = clean;
    } catch (err) { state.names = {}; }
  }

  function rememberName(id, name) {
    state.names[id] = name;
    try { localStorage.setItem(NAMES_KEY, JSON.stringify(state.names)); } catch (err) { /* ignore */ }
  }

  function nameOf(senderId) {
    if (state.user && senderId === state.user.id) return state.user.name;
    return state.names[senderId] || 'Student';
  }

  /* ---------------------------------------------------------------------
     Connection status (updates every status pill on every page)
     --------------------------------------------------------------------- */
  const STATUS_INFO = {
    'idle': ['Not connected', 'neutral'],
    'gathering': ['Preparing...', 'busy'],
    'waiting-for-answer': ['Waiting for answer', 'busy'],
    'waiting-for-host': ['Waiting for host', 'busy'],
    'connecting': ['Connecting...', 'busy'],
    'connected': ['Connected', 'good'],
    'disconnected': ['Disconnected', 'warn'],
    'failed': ['Failed', 'bad']
  };

  const STATUS_DEFAULT_TEXT = {
    'idle': '',
    'gathering': 'Getting ready. Finding the best way to reach your friend. This can take a few seconds...',
    'waiting-for-answer': 'Invite ready. Share the QR or link, then scan or paste your friend\'s reply below.',
    'waiting-for-host': 'Reply ready. Send it back to your friend. This page opens the room by itself.',
    'connecting': 'Reply accepted. Opening a secure channel to your friend. This can take up to 30 seconds...',
    'connected': 'Connected. Messages go straight to your friend\'s device.',
    'disconnected': 'The connection is closed.',
    'failed': 'The connection failed.'
  };

  function setStatus(status, detail) {
    state.status = status;
    state.statusDetail = detail || STATUS_DEFAULT_TEXT[status] || '';
    const info = STATUS_INFO[status] || STATUS_INFO.idle;

    document.querySelectorAll('[data-status-pill]').forEach(function (pill) {
      pill.dataset.tone = info[1];
      pill.querySelector('.pill-text').textContent = info[0];
    });
    document.querySelectorAll('[data-status-detail]').forEach(function (el) {
      el.textContent = state.statusDetail;
    });
    updateRoomUI();
    updateDashboardLive();
  }

  /* ---------------------------------------------------------------------
     Navigation (very small hash router)
     --------------------------------------------------------------------- */
  const VIEWS = ['landing', 'dashboard', 'connect', 'room', 'about'];

  function showView(name) {
    VIEWS.forEach(function (v) {
      $('view-' + v).hidden = (v !== name);
    });
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      if (a.dataset.nav === name || (name === 'connect' && a.dataset.nav === 'dashboard') ||
          (name === 'room' && a.dataset.nav === 'dashboard')) {
        a.setAttribute('aria-current', 'page');
      } else {
        a.removeAttribute('aria-current');
      }
    });
    window.scrollTo(0, 0);
  }

  function goTo(name) {
    const hash = { landing: '#/', dashboard: '#/dashboard', connect: '#/connect', room: '#/room', about: '#/about' }[name];
    if (location.hash === hash) route(); else location.hash = hash;
  }

  function route() {
    // An invite link looks like  #/join/VYBE2:....  Open the Join screen with it.
    const joinAt = location.hash.indexOf('#/join/');
    if (joinAt === 0) {
      const code = location.hash.slice('#/join/'.length);
      history.replaceState(null, '', location.pathname + location.search + '#/connect');   // do not re-run on refresh
      startJoinFromInvite(code);
      return;
    }
    const name = (location.hash.replace('#/', '') || 'landing');
    if (name === 'dashboard') { renderDashboard(); showView('dashboard'); }
    else if (name === 'about') showView('about');
    else if (name === 'connect') {
      if (!state.conn && !state.pendingRoom && !state.reconnectRoom) { resetConnectForm(); }
      showView('connect');
    }
    else if (name === 'room') {
      if (!state.room) { location.hash = '#/dashboard'; return; }
      renderRoom(); showView('room');
    }
    else if (name === 'how') { showView('landing'); }
    else showView('landing');
  }

  /* ---------------------------------------------------------------------
     DASHBOARD
     --------------------------------------------------------------------- */
  function renderDashboard() {
    $('welcomeName').textContent = state.user.name;
    $('nameInput').value = state.user.name;
    $('storageWarning').hidden = VybeChat.storageWorks();
    updateDashboardLive();

    const list = $('recentRooms');
    list.textContent = '';
    VybeChat.listRooms().slice(0, 6).forEach(function (room) {
      const li = document.createElement('li');
      const info = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'r-name';
      name.textContent = room.name;
      const meta = document.createElement('div');
      meta.className = 'r-meta';
      meta.textContent = room.messageCount + ' saved message' + (room.messageCount === 1 ? '' : 's') +
        (room.lastActivity ? ' - last active ' + formatDay(room.lastActivity) + ', ' + formatTime(room.lastActivity) : '');
      info.appendChild(name);
      info.appendChild(meta);
      const open = document.createElement('button');
      open.className = 'btn btn-ghost btn-sm';
      open.type = 'button';
      open.textContent = 'Open';
      open.addEventListener('click', function () { openSavedRoom(room.id); });
      li.appendChild(info);
      li.appendChild(open);
      list.appendChild(li);
    });
  }

  function updateDashboardLive() {
    const live = state.status === 'connected' && state.room;
    $('dashLive').hidden = !live;
    if (live) $('dashLiveRoom').textContent = state.room.name;
  }

  // Open a saved chat from LocalStorage without any connection (offline view).
  function openSavedRoom(roomId) {
    if (state.status === 'connected' && state.room && state.room.id !== roomId &&
        !confirm('You are connected in another room. Leave it and open this one?')) return;
    if (!(state.room && state.room.id === roomId && state.conn)) {
      leaveCurrentConnection(false);
      const room = VybeChat.getRoom(roomId);
      if (!room) { toast('That saved chat could not be found.', 'bad'); return; }
      state.room = { id: room.id, name: room.name };
      VybeChat.openRoom(room.id);
      state.peer = null;
      state.role = null;
      state.syncText = '-';
      state.duplicatesBlocked = 0;
      state.rejectedPackets = 0;
      setStatus('idle', 'Offline. You are reading the copy saved on this device.');
    }
    goTo('room');
  }

  /* ---------------------------------------------------------------------
     CONNECT SCREEN
     --------------------------------------------------------------------- */
  function setConnectMode(mode) {
    state.connectMode = mode;
    const create = mode === 'create';
    $('tabCreate').setAttribute('aria-selected', String(create));
    $('tabJoin').setAttribute('aria-selected', String(!create));
    $('panelCreate').hidden = !create;
    $('panelJoin').hidden = create;
  }

  function resetConnectForm() {
    ['createError', 'connectError', 'joinError'].forEach(function (id) { showError(id, ''); });
    $('offerBox').hidden = true;
    $('answerPasteBox').hidden = true;
    $('answerBox').hidden = true;
    $('offerCode').value = '';
    $('answerInput').value = '';
    $('offerInput').value = '';
    $('answerCode').value = '';
    state.answerState = 'idle';
    state.joinState = 'idle';
    state.joinedOffer = null;
    state.creatingOffer = false;
    setAnswerFormLocked(false);
    setButtonBusy($('btnGenerateOffer'), false, 'Create invite');
    setButtonBusy($('btnGenerateAnswer'), false, 'Join');
    const rr = state.reconnectRoom;
    $('roomNameInput').value = rr ? rr.name : '';
    $('roomNameInput').disabled = !!rr;
  }

  function beginConnect(mode, reconnectRoom) {
    if (state.status === 'connected' &&
        !confirm('You are already connected. Starting a new connection will disconnect you. Continue?')) return;
    leaveCurrentConnection(false);
    state.reconnectRoom = reconnectRoom || null;
    resetConnectForm();
    setConnectMode(mode);
    setStatus('idle');
    goTo('connect');
  }

  // Close the current connection and forget the pending one.
  function leaveCurrentConnection(sendBye) {
    if (state.conn) {
      if (sendBye && state.conn.isOpen()) state.conn.send(JSON.stringify({ type: 'bye', senderId: state.user.id }));
      state.conn.close();
      state.conn = null;
    }
    state.pendingRoom = null;
    state.pendingPeer = null;
    state.role = null;
    state.iceState = '-';
    state.path = null;
  }

  // A code only carries the first 8 characters of the sender's ID and their name.
  // The full ID arrives later inside the channel (the "hello" packet).
  function sanitizePeer(raw) {
    if (!raw || typeof raw !== 'object' || typeof raw.i !== 'string' || !/^[A-Za-z0-9_-]{8}$/.test(raw.i)) return null;
    return { id: null, short: raw.i, name: VybeChat.cleanName(raw.n) || 'Student' };
  }

  function isMyself(peer) { return peer.short === state.user.id.slice(0, 8); }

  // Is this host name only reachable from this computer / this network?
  function isLocalHostName(host) {
    return /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/i.test(host) ||
      /\.(local|localhost|lan|internal)$/i.test(host);
  }

  // Normalise an app URL: https URL, no search, no hash, ends with "/" (never "index.html").
  function normaliseAppUrl(url) {
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/[^\/]*\.[A-Za-z0-9]+$/, '/');   // drop index.html etc.
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url;
  }

  // Build the invite link that carries the offer code.
  //   * On the public site (GitHub Pages) the link points at the page you are on.
  //   * On localhost / a LAN address / file:// the link would be useless to a friend on
  //     another network, so it points at the public URL from <meta name="vybe-public-url">.
  // Returns { link, usesPublicSite, localOnly }.
  function makeInviteLink(code) {
    const configured = document.querySelector('meta[name="vybe-public-url"]');
    const configuredUrl = configured && configured.content.trim();
    const isFile = location.protocol === 'file:' || location.origin === 'null';
    const localPage = isFile || isLocalHostName(location.hostname);

    let url = null, usesPublicSite = false, localOnly = false;
    if (!localPage) {
      url = new URL(location.href);                       // we ARE on the public site
    } else if (configuredUrl) {
      try { url = new URL(configuredUrl); }
      catch (err) { throw new Error('The public VYBE address in index.html (vybe-public-url) is not a valid link.'); }
      usesPublicSite = true;
    } else if (!isFile) {
      url = new URL(location.href);                       // local dev, nothing configured: warn the user
      localOnly = true;
    } else {
      throw new Error('This page was opened from a file on your computer. Open VYBE from its GitHub Pages address, then create the invite.');
    }
    if (!/^https?:$/.test(url.protocol)) {
      throw new Error('The invite needs a web address (https://). Open VYBE from its GitHub Pages address, then create the invite.');
    }
    normaliseAppUrl(url);
    url.hash = '/join/' + code;
    return { link: url.toString(), usesPublicSite: usesPublicSite, localOnly: localOnly };
  }

  // Disable a button and show a "working" label; restore it afterwards.
  function setButtonBusy(button, busy, label) {
    button.disabled = !!busy;
    button.textContent = label;
    button.setAttribute('aria-busy', String(!!busy));
  }

  // Lock / unlock the host's "paste the reply" controls.
  function setAnswerFormLocked(locked, label) {
    $('answerInput').readOnly = !!locked;
    $('btnPasteAnswer').disabled = !!locked;
    $('btnScanAnswer').disabled = !!locked;
    setButtonBusy($('btnConnect'), locked, label || 'Connect');
  }

  // Draw the QR at a size that fits the screen and is shown at its real pixel size
  // (a stretched QR gets blurry edges, which makes scanning harder).
  function drawQr(canvasId, text) {
    const size = Math.max(200, Math.min(340, window.innerWidth - 100));
    try { VybeQR.draw($(canvasId), text, size); }
    catch (err) { console.warn('[VYBE] QR failed:', err.message); }
  }

  // Share sheet (phones). The button stays hidden where it is not supported.
  function setupShare(buttonId, getText, title) {
    const btn = $(buttonId);
    btn.hidden = !navigator.share;
    btn.onclick = function () {
      navigator.share({ title: title, text: getText() }).catch(function () { /* cancelled */ });
    };
  }

  function newConnection() {
    leaveCurrentConnection(false);
    state.conn = new VybeRTC.Connection({
      onState: onConnState,
      onOpen: onChannelOpen,
      onMessage: onChannelMessage,
      onClose: function () { /* handled by onState('disconnected') */ },
      onIceState: function (s) { state.iceState = s; updateInfoPanel(); }
    });
    return state.conn;
  }

  /* ---- CREATE: step 1, generate the offer ---- */
  async function onGenerateOffer(event) {
    event.preventDefault();
    if (state.creatingOffer) return;                       // ignore double clicks / double Enter
    showError('createError', '');
    const name = state.reconnectRoom ? state.reconnectRoom.name : VybeChat.cleanRoomName($('roomNameInput').value);
    if (!name) { showError('createError', 'Please give your room a name first.'); $('roomNameInput').focus(); return; }

    const room = state.reconnectRoom || { id: VybeChat.generateId().replace(/-/g, '').slice(0, 12), name: name };
    state.creatingOffer = true;
    let hasInvite = !$('offerBox').hidden;
    setButtonBusy($('btnGenerateOffer'), true, 'Preparing...');

    const conn = newConnection();                          // closes any older invite first
    state.pendingRoom = room;
    $('offerBox').hidden = true;
    $('answerPasteBox').hidden = true;
    // A new invite starts a fresh invite/reply pair: forget the old reply.
    showError('connectError', '');
    $('answerInput').value = '';
    state.answerState = 'idle';
    setAnswerFormLocked(false);

    try {
      const result = await conn.createOffer();
      if (state.conn !== conn) return;                     // user left / started over meanwhile
      const code = VybeRTC.encodeCode('offer', result.sdp, room, { id: state.user.id, name: state.user.name });
      const invite = makeInviteLink(code);
      $('offerCode').value = invite.link;
      drawQr('offerQr', invite.link);
      setupShare('btnShareOffer', function () { return 'Join my VYBE study room "' + room.name + '": ' + invite.link; }, 'VYBE study room');
      $('offerMeta').textContent = inviteNote(result, invite);
      $('offerBox').hidden = false;
      $('answerPasteBox').hidden = false;
      hasInvite = true;
    } catch (err) {
      conn.close();
      if (state.conn === conn) state.conn = null;
      showError('createError', err.message || 'Could not create the invite.');
      setStatus('failed', err.message || 'Could not create the invite.');
    } finally {
      state.creatingOffer = false;
      setButtonBusy($('btnGenerateOffer'), false, hasInvite ? 'Create new invite' : 'Create invite');
    }
  }

  // One short, plain-language note under the invite.
  function inviteNote(result, invite) {
    const notes = [];
    if (invite.localOnly) notes.push('Warning: VYBE is running locally, so this link only works on this computer or network. Open the GitHub Pages address to invite someone on another network.');
    else if (invite.usesPublicSite) notes.push('This link opens the public VYBE site, so your friend can use it from any network.');
    if (result.turnProblem) notes.push(result.turnProblem);
    else if (result.turnConfigured && result.relayCount === 0) notes.push('The relay server could not be reached. The connection may fail on strict networks.');
    else if (!result.iceComplete) notes.push('Some network details were still being collected. If the connection fails, create a new invite.');
    return notes.join(' ');
  }

  /* ---- CREATE: step 3, paste the reply and connect ---- */
  async function onConnectClick() {
    // A reply can be used ONCE. Paste, Paste button, Connect button and QR scan can all
    // arrive within milliseconds of each other; only the first one gets through.
    if (state.answerState !== 'idle') return;
    showError('connectError', '');
    if (!state.conn || state.conn.role !== 'host') {
      showError('connectError', 'Create an invite first.');
      return;
    }
    state.answerState = 'checking';
    setAnswerFormLocked(true, 'Connecting...');
    const release = function (message) {
      state.answerState = 'idle';
      setAnswerFormLocked(false);
      if (message) showError('connectError', message);
    };

    const decoded = VybeRTC.decodeCode($('answerInput').value, 'answer');
    if (!decoded.ok) { release(decoded.error); return; }

    const roomInAnswer = VybeChat.sanitizeRoomMeta(decoded.room);
    if (!roomInAnswer || roomInAnswer.id !== state.pendingRoom.id) {
      release('This reply belongs to a different invite. Ask your friend to open your latest invite.');
      return;
    }
    const peer = sanitizePeer(decoded.from);
    if (!peer) { release('The reply has no valid sender information.'); return; }
    if (isMyself(peer)) { release('This reply was created in this same browser. Use a different device or browser.'); return; }

    const conn = state.conn;
    try {
      state.pendingPeer = peer;
      await conn.acceptAnswer(decoded.sdp);
      if (state.conn !== conn) return;
      state.answerState = 'used';
      setAnswerFormLocked(true, 'Reply accepted');
    } catch (err) {
      if (state.conn !== conn) return;
      if (err.code === 'DUPLICATE') {                       // the same reply arrived twice: keep the first
        state.answerState = 'used';
        setAnswerFormLocked(true, 'Reply accepted');
        return;
      }
      release(err.message || 'Could not use this reply.');
    }
  }

  // Someone opened an invite link (or scanned its QR): join without extra clicks.
  function startJoinFromInvite(code) {
    leaveCurrentConnection(false);
    state.reconnectRoom = null;
    resetConnectForm();
    setConnectMode('join');
    setStatus('idle');
    $('offerInput').value = code;
    showView('connect');
    onGenerateAnswer();
  }

  /* ---- JOIN: step 1, read the invite and make the reply ---- */
  async function onGenerateAnswer() {
    if (state.joinState === 'busy') return;                // already working on it
    showError('joinError', '');
    const raw = $('offerInput').value;
    const decoded = VybeRTC.decodeCode(raw, 'offer');
    if (!decoded.ok) { showError('joinError', decoded.error); return; }

    // The very same invite was already turned into a reply: do nothing twice.
    const codeKey = (raw.replace(/\s+/g, '').match(/VYBE3:[A-Za-z0-9_-]+/) || [''])[0];
    if (state.joinState === 'ready' && state.joinedOffer === codeKey &&
        state.conn && state.conn.state !== 'failed' && state.conn.state !== 'disconnected') {
      toast('Your reply for this invite is already ready below.');
      $('answerBox').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    const roomInOffer = VybeChat.sanitizeRoomMeta(decoded.room);
    if (!roomInOffer) { showError('joinError', 'The invite has no valid room information.'); return; }
    const peer = sanitizePeer(decoded.from);
    if (!peer) { showError('joinError', 'The invite has no valid sender information.'); return; }
    if (isMyself(peer)) {
      showError('joinError', 'This invite was created in this same browser. Open it on a different device (or a private window) to join.');
      return;
    }

    // If I already have this room saved, keep my saved name for it.
    const saved = VybeChat.getRoom(roomInOffer.id);
    const room = saved ? { id: saved.id, name: saved.name } : roomInOffer;

    state.joinState = 'busy';
    setButtonBusy($('btnGenerateAnswer'), true, 'Preparing...');
    $('answerBox').hidden = true;
    const conn = newConnection();
    state.pendingRoom = room;
    state.pendingPeer = peer;

    try {
      const result = await conn.acceptOffer(decoded.sdp);
      if (state.conn !== conn) return;
      const replyCode = VybeRTC.encodeCode('answer', result.sdp, room, { id: state.user.id, name: state.user.name });
      $('answerCode').value = replyCode;
      drawQr('answerQr', replyCode);
      setupShare('btnShareAnswer', function () { return replyCode; }, 'VYBE reply');
      $('answerBox').hidden = false;
      $('answerBox').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      state.joinState = 'ready';
      state.joinedOffer = codeKey;
    } catch (err) {
      conn.close();
      if (state.conn === conn) state.conn = null;
      state.joinState = 'idle';
      showError('joinError', err.message || 'Could not create the reply.');
      setStatus('failed', err.message || 'Could not create the reply.');
    } finally {
      if (state.joinState === 'busy') state.joinState = 'idle';
      setButtonBusy($('btnGenerateAnswer'), false, 'Join');
    }
  }

  /* ---------------------------------------------------------------------
     CONNECTION EVENTS (from webrtc.js)
     --------------------------------------------------------------------- */
  function onConnState(status, detail) {
    setStatus(status, detail);
    if (status === 'failed' || status === 'disconnected') {
      const hostSide = !!(state.conn && state.conn.role === 'host');
      // An invite/reply pair works only once, so the next try needs a new pair.
      const next = hostSide ? ' Press "Create new invite" to try again.'
                            : ' Ask your friend to create a new invite and open it again.';
      if (!$('view-connect').hidden) showError(hostSide ? 'connectError' : 'joinError', (detail || 'The connection failed.') + next);
      if (hostSide && state.answerState === 'used') setAnswerFormLocked(true, 'Reply used');
    }
  }

  // The DataChannel is REALLY open now. Only here do we enter the room.
  function onChannelOpen() {
    state.role = state.conn.role;
    state.room = state.pendingRoom;
    state.peer = state.pendingPeer;
    state.duplicatesBlocked = 0;
    state.rejectedPackets = 0;
    state.syncText = 'Asking your peer for history...';
    state.syncAdded = 0;

    VybeChat.upsertRoom(state.room);
    VybeChat.openRoom(state.room.id);
    // Tell the peer who we are, then ask for their saved history.
    state.conn.send(JSON.stringify({ type: 'hello', senderId: state.user.id, name: state.user.name }));
    state.conn.send(JSON.stringify({ type: 'history-request', senderId: state.user.id }));

    toast('Connected directly to ' + (state.peer ? state.peer.name : 'your peer') + '.');
    goTo('room');
    renderRoom();
    setTimeout(refreshPath, 800);
  }

  async function refreshPath() {
    if (!state.conn || !state.conn.isOpen()) return;
    const path = await state.conn.getConnectionPath();
    if (!path) { state.path = 'Direct (details unavailable)'; }
    else if (path.local === 'relay' || path.remote === 'relay') state.path = 'Through a relay server (TURN), still encrypted';
    else if (path.local === 'host' && path.remote === 'host') state.path = 'Direct, same network';
    else state.path = 'Direct over the internet';
    updateInfoPanel();
  }

  // Everything that arrives from the peer goes through here. NEVER trusted.
  function onChannelMessage(raw) {
    const parsed = VybeChat.parsePacket(raw);
    if (!parsed.ok) { rejectPacket(parsed.error); return; }
    const packet = parsed.packet;

    // Nobody may pretend to be me.
    if (packet.senderId === state.user.id) { rejectPacket('Packet claims to be from you.'); return; }

    switch (packet.type) {
      case 'hello':
        // The invite/reply carried the first 8 characters of the peer's ID. The ID in "hello"
        // must match it, and must not change afterwards.
        if (state.peer && ((state.peer.short && packet.senderId.slice(0, 8) !== state.peer.short) ||
                           (state.peer.id && state.peer.id !== packet.senderId))) {
          rejectPacket('Peer identity does not match the invite or reply.');
          return;
        }
        state.peer = { id: packet.senderId, short: packet.senderId.slice(0, 8), name: packet.name };
        rememberName(packet.senderId, packet.name);
        renderRoom();
        break;

      case 'chat': {
        if (state.peer && state.peer.id && packet.senderId !== state.peer.id) { rejectPacket('Chat from an unexpected sender.'); return; }
        const result = VybeChat.addMessage(packet);
        if (result.status === 'added') renderMessages(true);
        else if (result.status === 'duplicate') { state.duplicatesBlocked++; updateInfoPanel(); }
        else rejectPacket(result.reason);
        break;
      }

      case 'history-request':
        sendHistory();
        break;

      case 'history-response': {
        if (!state.peer || !state.peer.id || packet.senderId !== state.peer.id) { rejectPacket('History from an unexpected sender.'); return; }
        const summary = VybeChat.mergeMessages(packet.messages);
        state.syncAdded += summary.added;
        state.duplicatesBlocked += summary.duplicates;
        state.rejectedPackets += summary.invalid;
        if (summary.added > 0) renderMessages(false);
        if (packet.batch === packet.totalBatches) {
          state.syncText = state.syncAdded > 0
            ? 'Done. ' + state.syncAdded + ' new message' + (state.syncAdded === 1 ? '' : 's') + ' received'
            : 'Done. Nothing new to receive';
          if (state.syncAdded > 0) toast('History synced: ' + state.syncAdded + ' message' + (state.syncAdded === 1 ? '' : 's') + ' added.');
        } else {
          state.syncText = 'Receiving... batch ' + packet.batch + ' of ' + packet.totalBatches;
        }
        updateInfoPanel();
        break;
      }

      case 'bye':
        toast((state.peer ? state.peer.name : 'Your peer') + ' left the room.');
        break;
    }
  }

  function rejectPacket(reason) {
    state.rejectedPackets++;
    console.warn('[VYBE] Rejected data from peer:', reason);
    if (state.rejectedPackets === 1) toast('Ignored invalid data from your peer.', 'bad');
    updateInfoPanel();
  }

  // Send my saved messages to the peer in small batches.
  function sendHistory() {
    const batches = VybeChat.getHistoryBatches();
    let index = 0;
    (function next() {
      if (!state.conn || !state.conn.isOpen() || index >= batches.length) return;
      const ok = state.conn.send(JSON.stringify({
        type: 'history-response',
        senderId: state.user.id,
        batch: index + 1,
        totalBatches: batches.length,
        messages: batches[index]
      }));
      if (ok) index++;
      setTimeout(next, ok ? 0 : 100);   // if the channel is busy, try again shortly
    })();
  }

  /* ---------------------------------------------------------------------
     STUDY ROOM
     --------------------------------------------------------------------- */
  function renderRoom() {
    if (!state.room) return;
    $('roomName').textContent = state.room.name;
    renderMessages(true);
    updateRoomUI();
  }

  // Draw every message. Uses textContent only, so peer text is never run as HTML.
  function renderMessages(scrollToEnd) {
    const box = $('messages');
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    const messages = VybeChat.getMessages();
    box.textContent = '';
    let lastTime = null;

    messages.forEach(function (m) {
      if (lastTime === null || !sameDay(lastTime, m.timestamp)) {
        const day = document.createElement('div');
        day.className = 'day-divider';
        day.textContent = formatDay(m.timestamp);
        box.appendChild(day);
      }
      lastTime = m.timestamp;

      const mine = m.senderId === state.user.id;
      const wrap = document.createElement('div');
      wrap.className = 'msg ' + (mine ? 'mine' : 'theirs');
      const meta = document.createElement('div');
      meta.className = 'msg-meta';
      meta.textContent = (mine ? 'You' : nameOf(m.senderId)) + ' - ' + formatTime(m.timestamp);
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.textContent = m.content;            // <-- safe: plain text only
      wrap.appendChild(meta);
      wrap.appendChild(bubble);
      box.appendChild(wrap);
    });

    $('emptyChat').hidden = messages.length > 0;
    if (scrollToEnd && (nearBottom || messages.length < 2 || messages[messages.length - 1].senderId === state.user.id)) {
      box.scrollTop = box.scrollHeight;
    }
    updateInfoPanel();
  }

  function updateRoomUI() {
    if (!state.room) return;
    const connected = state.status === 'connected' && state.conn && state.conn.isOpen();
    $('messageInput').disabled = !connected;
    $('btnSend').disabled = !connected;
    $('messageInput').placeholder = connected
      ? 'Type a message. Enter to send, Shift+Enter for a new line.'
      : 'Not connected. Reconnect to send messages.';
    $('reconnectBar').hidden = connected;
    $('peerLine').textContent = connected
      ? 'Connected to ' + (state.peer ? state.peer.name : 'your peer') + ' (direct, peer-to-peer)'
      : (state.status === 'idle' ? 'Offline view of your saved chat' : 'Not connected');
    updateInfoPanel();
  }

  // Friendly names for the browser's internal network-check states.
  const NETWORK_CHECK_TEXT = {
    'new': 'Starting', 'checking': 'Checking routes', 'connected': 'Route found',
    'completed': 'Route confirmed', 'failed': 'No route found', 'disconnected': 'Interrupted', 'closed': 'Closed'
  };

  function updateInfoPanel() {
    if (!state.room || !state.user) return;
    const info = STATUS_INFO[state.status] || STATUS_INFO.idle;
    $('infoStatus').textContent = info[0];
    $('infoRole').textContent = state.role === 'host' ? 'Host (created the room)' : state.role === 'guest' ? 'Guest (joined)' : '-';
    $('infoYou').textContent = state.user.name + ' (' + shortId(state.user.id) + ')';
    $('infoPeer').textContent = state.peer ? state.peer.name + ' (' + shortId(state.peer.id || state.peer.short) + ')' : '-';
    $('infoPath').textContent = state.status === 'connected' ? (state.path || 'Checking...') : '-';
    $('infoIce').textContent = state.conn ? (NETWORK_CHECK_TEXT[state.iceState] || state.iceState) : '-';
    const n = VybeChat.getMessageCount();
    $('infoStored').textContent = n + ' message' + (n === 1 ? '' : 's') + ' (this browser only)';
    $('infoSync').textContent = state.syncText;
    $('infoDup').textContent = String(state.duplicatesBlocked);
    $('infoRejected').textContent = String(state.rejectedPackets);
  }

  /* ---- sending a message ---- */
  function sendMessage() {
    const input = $('messageInput');
    const hint = $('inputHint');
    hint.hidden = true;

    if (!state.conn || !state.conn.isOpen()) {
      hint.textContent = 'You are not connected, so nothing was sent.';
      hint.hidden = false;
      return;
    }
    const made = VybeChat.createLocalMessage(input.value, state.user.id);
    if (!made.ok) { hint.textContent = made.error; hint.hidden = false; return; }

    // Send FIRST. Only a message that really went to the open channel is saved.
    const sent = state.conn.send(JSON.stringify(made.message));
    if (!sent) {
      hint.textContent = 'Could not send right now. Please try again.';
      hint.hidden = false;
      return;
    }
    VybeChat.addMessage(made.message);
    input.value = '';
    autoGrow();
    updateCharCount();
    renderMessages(true);
  }

  function updateCharCount() {
    const len = $('messageInput').value.length;
    $('charCount').textContent = len + ' / ' + MAX_LEN;
  }

  function autoGrow() {
    const el = $('messageInput');
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  function onClearChat() {
    if (!confirm('Delete the chat saved on this device? Your peer keeps their own copy.')) return;
    VybeChat.clearMessages();
    renderMessages(false);
    toast('Your local copy of this chat was cleared.');
  }

  function onLeaveRoom() {
    leaveCurrentConnection(true);
    VybeChat.closeRoom();
    state.room = null;
    state.peer = null;
    state.reconnectRoom = null;
    state.syncText = '-';
    setStatus('idle');
    toast('You left the room. Your saved chat stays on this device.');
    goTo('dashboard');
  }

  function onReconnect() {
    if (!state.room) return;
    const room = { id: state.room.id, name: state.room.name };
    leaveCurrentConnection(false);
    state.reconnectRoom = room;
    resetConnectForm();
    setConnectMode('create');
    setStatus('idle', 'Reconnect: one of you creates a new offer, the other joins with it.');
    goTo('connect');
  }

  /* ---------------------------------------------------------------------
     QR scanner (only where the browser has BarcodeDetector + a camera)
     --------------------------------------------------------------------- */
  let scannerStream = null;
  let scannerRunning = false;

  function scannerSupported() {
    return 'BarcodeDetector' in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function closeScanner() {
    scannerRunning = false;
    if (scannerStream) { scannerStream.getTracks().forEach(function (t) { t.stop(); }); scannerStream = null; }
    $('scannerVideo').srcObject = null;
    $('scanner').hidden = true;
  }

  async function openScanner(onText) {
    try {
      const formats = await BarcodeDetector.getSupportedFormats();
      if (formats.indexOf('qr_code') === -1) throw new Error('This browser cannot read QR codes.');
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = $('scannerVideo');
      video.srcObject = scannerStream;
      await video.play();
      $('scanner').hidden = false;
      scannerRunning = true;
      (async function loop() {
        while (scannerRunning) {
          try {
            const codes = await detector.detect(video);
            const hit = codes.find(function (c) { return c.rawValue && c.rawValue.indexOf(VybeRTC.CODE_PREFIX) !== -1; });
            if (hit) { closeScanner(); onText(hit.rawValue); return; }
          } catch (err) { /* keep trying */ }
          await new Promise(function (r) { setTimeout(r, 250); });
        }
      })();
    } catch (err) {
      closeScanner();
      toast('Could not open the camera: ' + (err.message || 'permission denied') + '. You can paste the code instead.', 'bad');
    }
  }

  /* ---------------------------------------------------------------------
     Wiring buttons and keyboard
     --------------------------------------------------------------------- */
  function bindEvents() {
    $('btnDashCreate').addEventListener('click', function () { beginConnect('create'); });
    $('btnDashJoin').addEventListener('click', function () { beginConnect('join'); });
    $('btnDashGoRoom').addEventListener('click', function () { goTo('room'); });

    $('nameForm').addEventListener('submit', function (e) {
      e.preventDefault();
      const before = state.user.name;
      state.user = VybeChat.saveUserName(state.user, $('nameInput').value);
      $('welcomeName').textContent = state.user.name;
      $('nameInput').value = state.user.name;
      toast(state.user.name === before ? 'Name unchanged.' : 'Name saved.');
    });

    $('tabCreate').addEventListener('click', function () { setConnectMode('create'); });
    $('tabJoin').addEventListener('click', function () { setConnectMode('join'); });
    $('createForm').addEventListener('submit', onGenerateOffer);
    $('btnConnect').addEventListener('click', onConnectClick);
    $('btnGenerateAnswer').addEventListener('click', onGenerateAnswer);
    $('btnCopyOffer').addEventListener('click', function () { copyText($('offerCode').value, $('offerCode'), $('btnCopyOffer')); });
    $('btnCopyAnswer').addEventListener('click', function () { copyText($('answerCode').value, $('answerCode'), $('btnCopyAnswer')); });
    // Paste button, pasting into the box, Connect and Scan can all fire for the same code.
    // onConnectClick / onGenerateAnswer ignore every call after the first one (see their guards).
    const looksLikeCode = function (text) { return /VYBE\d:/.test(text); };
    $('btnPasteAnswer').addEventListener('click', async function () {
      if (state.answerState !== 'idle') return;
      await pasteInto($('answerInput'));
      if (looksLikeCode($('answerInput').value)) onConnectClick();
    });
    $('btnPasteOffer').addEventListener('click', async function () {
      if (state.joinState === 'busy') return;
      await pasteInto($('offerInput'));
      if (looksLikeCode($('offerInput').value)) onGenerateAnswer();
    });

    // Pasting straight into the box also continues automatically.
    $('answerInput').addEventListener('paste', function () { setTimeout(function () { if (looksLikeCode($('answerInput').value)) onConnectClick(); }, 50); });
    $('offerInput').addEventListener('paste', function () { setTimeout(function () { if (looksLikeCode($('offerInput').value)) onGenerateAnswer(); }, 50); });

    // Scan buttons exist only where the browser can read QR codes.
    const canScan = scannerSupported();
    $('btnScanAnswer').hidden = !canScan;
    $('btnScanOffer').hidden = !canScan;
    $('btnScanAnswer').addEventListener('click', function () { if (state.answerState !== 'idle') return; openScanner(function (text) { $('answerInput').value = text; onConnectClick(); }); });
    $('btnScanOffer').addEventListener('click', function () { if (state.joinState === 'busy') return; openScanner(function (text) { $('offerInput').value = text; onGenerateAnswer(); }); });
    $('btnScannerClose').addEventListener('click', closeScanner);

    $('btnStartOver').addEventListener('click', function () {
      leaveCurrentConnection(false);
      resetConnectForm();
      setStatus('idle');
    });
    $('btnBackFromConnect').addEventListener('click', function () {
      const wasConnected = state.status === 'connected';
      if (!wasConnected) { leaveCurrentConnection(false); setStatus('idle'); }
      state.reconnectRoom = null;
      goTo(state.room ? 'room' : 'dashboard');
    });

    $('chatForm').addEventListener('submit', function (e) { e.preventDefault(); sendMessage(); });
    $('messageInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMessage(); }
    });
    $('messageInput').addEventListener('input', function () { autoGrow(); updateCharCount(); $('inputHint').hidden = true; });

    $('btnClear').addEventListener('click', onClearChat);
    $('btnLeave').addEventListener('click', onLeaveRoom);
    $('btnReconnect').addEventListener('click', onReconnect);
    $('btnPanel').addEventListener('click', function () {
      const open = $('roomGrid').classList.toggle('panel-open');
      $('btnPanel').setAttribute('aria-expanded', String(open));
    });

    $('linkHow').addEventListener('click', function (e) {
      e.preventDefault();
      $('how').scrollIntoView({ behavior: 'smooth' });
    });

    window.addEventListener('hashchange', route);
    // Tell the peer when this tab closes, so they see it at once.
    // (Not when the browser only keeps the page in its back/forward cache: persisted === true.)
    window.addEventListener('pagehide', function (e) { if (!e.persisted) leaveCurrentConnection(true); });
  }

  // Honest note about networks: depends on whether a TURN relay is configured.
  function setNetworkNotice() {
    const el = $('networkNotice');
    if (!el) return;
    el.textContent = VybeRTC.hasTurn()
      ? 'VYBE first tries a direct connection and falls back to a relay server on strict networks. Messages stay encrypted on the relay. '
      : 'VYBE tries a direct connection. On strict networks (some campus or office Wi-Fi, some mobile data) it can fail, and no relay server is set up in this copy of VYBE. If that happens, try the same Wi-Fi or a phone hotspot. ';
  }

  /* ---------------------------------------------------------------------
     Start
     --------------------------------------------------------------------- */
  function init() {
    state.user = VybeChat.loadUser();
    loadNames();
    bindEvents();
    updateCharCount();
    setNetworkNotice();
    setStatus('idle');
    // A refresh always starts offline. Saved chats are listed on the dashboard.
    if (location.hash === '#/room' || location.hash === '#/connect') location.hash = '#/dashboard';
    route();
  }

  init();
})();
