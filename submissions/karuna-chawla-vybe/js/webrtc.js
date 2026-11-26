/* ==========================================================================
   webrtc.js  -  VYBE peer-to-peer connection (WebRTC + RTCDataChannel)
   --------------------------------------------------------------------------
   This file knows NOTHING about the page (DOM) or about chat messages.
   It only creates a direct connection between two browsers and lets you
   send / receive text through it.

   HOW THE CONNECTION IS MADE (manual signalling, no server):

     Student A ("host")                          Student B ("guest")
     ------------------                          -------------------
     createOffer()  ---- offer code (copy/paste) ---->  acceptOffer()
                    <--- answer code (copy/paste) ----
     acceptAnswer()
                  ===== DataChannel opens: direct P2P =====

   The "offer" and "answer" are SDP descriptions: text that tells the other
   browser how it can be reached (IP addresses / ports found with ICE + STUN).
   Normally a signalling SERVER carries them. Here the two students carry
   them by hand, so no server is needed at all.

   IMPORTANT: "connected" is only reported when the DataChannel is really
   open. We never fake a connection.
   ========================================================================== */

const VybeRTC = (function () {
  'use strict';

  /* ---------------------------------------------------------------------
     Settings
     --------------------------------------------------------------------- */
  const CHANNEL_NAME = 'vybe-chat';
  const ICE_GATHER_TIMEOUT_MS = 6000;       // stop waiting for candidates after this
  const ICE_GATHER_TIMEOUT_TURN_MS = 9000;  // a little longer when a TURN relay must answer
  const CONNECT_TIMEOUT_MS = 30000;         // give up if the channel never opens
  const MAX_CODE_LENGTH = 8000;             // reject absurdly long pasted codes
  const CODE_PREFIX = 'VYBE3:';             // every connection code starts with this
  const MAX_BUFFERED_BYTES = 1000000;       // do not send if the channel is backed up

  /* ---------------------------------------------------------------------
     ICE servers (STUN + optional TURN)
     ---------------------------------------------------------------------
     The settings live in js/ice-config.js (VYBE_ICE_CONFIG). This function
     turns them into the list the browser wants and silently ignores anything
     that is incomplete or still contains a placeholder such as YOUR_TURN_HOST,
     so a half-edited file can never produce a broken or fake relay.
     Returns { config, turnCount, ignored: [reasons], forceRelay }.
     --------------------------------------------------------------------- */
  const DEFAULT_STUN = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'];
  const URL_OK = /^(stun|stuns|turn|turns):[A-Za-z0-9.\-_\[\]:%]+(\?transport=(udp|tcp))?$/;

  function buildIceConfig(cfg) {
    const ignored = [];
    const iceServers = [];
    const source = cfg && typeof cfg === 'object' ? cfg : {};

    const stunUrls = (Array.isArray(source.stun) ? source.stun : DEFAULT_STUN)
      .filter(function (u) { return typeof u === 'string' && /^stuns?:/.test(u) && URL_OK.test(u); });
    if (stunUrls.length) iceServers.push({ urls: stunUrls });

    let turnCount = 0;
    (Array.isArray(source.turn) ? source.turn : []).forEach(function (entry, i) {
      const label = 'TURN entry ' + (i + 1);
      if (!entry || typeof entry !== 'object') { ignored.push(label + ': not an object'); return; }
      const urls = (Array.isArray(entry.urls) ? entry.urls : [entry.urls]).filter(function (u) { return typeof u === 'string'; });
      const good = urls.filter(function (u) { return /^turns?:/.test(u) && URL_OK.test(u); });
      if (!good.length) { ignored.push(label + ': no valid turn:/turns: URL'); return; }
      if (typeof entry.username !== 'string' || !entry.username ||
          typeof entry.credential !== 'string' || !entry.credential) {
        ignored.push(label + ': username or credential is missing');
        return;
      }
      const all = good.join(' ') + ' ' + entry.username + ' ' + entry.credential;
      if (/YOUR_|REPLACE_ME|CHANGEME/i.test(all)) {
        ignored.push(label + ': still contains a placeholder');
        return;
      }
      iceServers.push({ urls: good, username: entry.username, credential: entry.credential });
      turnCount++;
    });

    const config = { iceServers: iceServers };
    let forceRelay = false;
    if (source.forceRelay === true) {
      if (turnCount > 0) { config.iceTransportPolicy = 'relay'; forceRelay = true; }
      else ignored.push('forceRelay ignored: no valid TURN server is configured');
    }
    return { config: config, turnCount: turnCount, ignored: ignored, forceRelay: forceRelay };
  }

  const ICE_SETUP = buildIceConfig(typeof VYBE_ICE_CONFIG !== 'undefined' ? VYBE_ICE_CONFIG : null);
  const RTC_CONFIG = ICE_SETUP.config;
  if (ICE_SETUP.ignored.length && typeof console !== 'undefined') {
    console.warn('[VYBE] ICE settings ignored:', ICE_SETUP.ignored.join('; '));
  }

  /* ---------------------------------------------------------------------
     Connection codes (short!)
     ---------------------------------------------------------------------
     A full WebRTC description (SDP) is about 1000 characters, mostly
     boilerplate that is the same every time. A data-channel connection only
     really needs:
        - ICE username + password   (to prove who we are to the other side)
        - certificate fingerprint   (so the connection can be encrypted)
        - a few network candidates  (where to reach us)
     So the code holds only those, and the receiving browser REBUILDS the full
     SDP from a fixed template. Result: roughly 300-600 characters.

     A code looks like:  VYBE3:WzMsIm8i...   (Base64 of a small JSON array)
     It can also sit at the end of a link:  https://site/#/join/VYBE3:WzMs...
     --------------------------------------------------------------------- */
  // Which network addresses ("candidates") go into the code. We keep a few of
  // EACH kind instead of "the 5 best", because relay (TURN) addresses always have
  // the LOWEST priority: a plain "top 5" cut would silently throw them away.
  const MAX_CANDIDATES = 8;
  const KEEP_PER_KIND = { relay: 2, srflx: 2, host: 3, tcp: 2 };   // tcp = any non-relay TCP candidate
  const TYPE_LETTER = { host: 'h', srflx: 's', relay: 'r' };
  const LETTER_TYPE = { h: 'host', s: 'srflx', r: 'relay' };
  const TCP_LETTER = { active: 'a', passive: 'p', so: 'o' };
  const LETTER_TCP = { a: 'active', p: 'passive', o: 'so' };

  // Text <-> Base64 (works with any language/emoji, not only English letters).
  function toBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach(function (b) { binary += String.fromCharCode(b); });
    return btoa(binary);
  }
  function fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  // Base64 that is safe inside a link (uses - and _ instead of + and /).
  function toBase64Url(text) {
    return toBase64(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromBase64Url(text) {
    let b64 = text.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return fromBase64(b64);
  }
  function hexToBase64Url(hexWithColons) {
    const bytes = hexWithColons.split(':').map(function (h) { return parseInt(h, 16); });
    let binary = '';
    bytes.forEach(function (b) { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function base64UrlToHex(b64url) {
    let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const binary = atob(b64);
    const parts = [];
    for (let i = 0; i < binary.length; i++) {
      parts.push(('0' + binary.charCodeAt(i).toString(16)).slice(-2).toUpperCase());
    }
    return parts.join(':');
  }

  // Read every usable candidate line of a full SDP.
  // Skipped on purpose: other components than 1, prflx, link-local IPv6 (fe80:),
  // and anything that does not look like a normal candidate line.
  function parseCandidates(sdp) {
    const found = [];
    const seen = {};
    const re = /^a=candidate:(\S+) (\d+) (udp|tcp) (\d+) (\S+) (\d+) typ (host|srflx|relay)\b(.*)$/gim;
    let m;
    while ((m = re.exec(sdp)) !== null) {
      if (m[2] !== '1') continue;
      const proto = m[3].toLowerCase();
      const ip = m[5];
      if (/^fe80:/i.test(ip)) continue;
      const tcpType = proto === 'tcp' ? ((m[8].match(/\btcptype (active|passive|so)\b/) || [])[1] || null) : null;
      if (proto === 'tcp' && !tcpType) continue;
      const key = proto + '|' + ip + '|' + m[6];
      if (seen[key]) continue;
      seen[key] = true;
      found.push({ proto: proto, prio: Number(m[4]), ip: ip, port: m[6], type: m[7].toLowerCase(), tcpType: tcpType });
    }
    return found;
  }

  // Choose which candidates go into the code (see KEEP_PER_KIND above).
  function selectCandidates(found) {
    const byPrio = function (a, b) { return b.prio - a.prio; };
    const udp = found.filter(function (c) { return c.proto === 'udp'; }).sort(byPrio);
    const tcp = found.filter(function (c) { return c.proto === 'tcp'; }).sort(byPrio);
    const chosen = [];
    ['relay', 'srflx', 'host'].forEach(function (type) {
      udp.filter(function (c) { return c.type === type; })
        .slice(0, KEEP_PER_KIND[type])
        .forEach(function (c) { chosen.push(c); });
    });
    tcp.slice(0, KEEP_PER_KIND.tcp).forEach(function (c) { chosen.push(c); });
    return chosen.slice(0, MAX_CANDIDATES);
  }

  // Squeeze a full SDP into the few fields we need. Returns an object or null.
  function compactSdp(sdp) {
    const ufrag = (sdp.match(/^a=ice-ufrag:(\S+)/m) || [])[1];
    const pwd = (sdp.match(/^a=ice-pwd:(\S+)/m) || [])[1];
    const fp = (sdp.match(/^a=fingerprint:sha-256 ([0-9A-Fa-f:]+)/m) || [])[1];
    if (!ufrag || !pwd || !fp) return null;

    const candidates = selectCandidates(parseCandidates(sdp)).map(function (c) {
      const base = TYPE_LETTER[c.type] + '|' + c.ip + '|' + c.port + '|' + c.prio.toString(36);
      return c.proto === 'tcp' ? base + '|' + TCP_LETTER[c.tcpType] : base;
    });
    return { ufrag: ufrag, pwd: pwd, fp: hexToBase64Url(fp), candidates: candidates };
  }

  // Rebuild a full SDP from the small fields. role: 'offer' or 'answer'.
  // Everything that is not a fixed template line has been validated by
  // decodeCode() first, so no pasted text can add or change SDP lines.
  function expandSdp(parts, type) {
    const lines = [
      'v=0',
      'o=- ' + Math.floor(Math.random() * 1e15) + ' 2 IN IP4 127.0.0.1',
      's=-',
      't=0 0',
      'a=group:BUNDLE 0',
      'a=msid-semantic: WMS',
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
      'c=IN IP4 0.0.0.0',
      'a=ice-ufrag:' + parts.ufrag,
      'a=ice-pwd:' + parts.pwd,
      'a=fingerprint:sha-256 ' + base64UrlToHex(parts.fp),
      'a=setup:' + (type === 'offer' ? 'actpass' : 'active'),
      'a=mid:0',
      'a=sctp-port:5000',
      'a=max-message-size:262144'
    ];
    parts.candidates.forEach(function (c, i) {
      const f = c.split('|');
      const isTcp = f.length === 5;
      const typeName = LETTER_TYPE[f[0]];
      let line = 'a=candidate:' + (i + 1) + ' 1 ' + (isTcp ? 'tcp' : 'udp') + ' ' + parseInt(f[3], 36) +
        ' ' + f[1] + ' ' + f[2] + ' typ ' + typeName;
      // srflx / relay lines should name a related address. We do not know (or
      // want to share) the real one, so use the standard "hidden" value.
      if (typeName !== 'host') line += ' raddr ' + (f[1].indexOf(':') !== -1 ? '::' : '0.0.0.0') + ' rport 0';
      if (isTcp) line += ' tcptype ' + LETTER_TCP[f[4]];
      lines.push(line);
    });
    lines.push('a=end-of-candidates');
    return lines.join('\r\n') + '\r\n';
  }

  // Build a code from an SDP description.
  // room = { id, name }, sender = { id, name }. Only the first 8 characters of
  // the sender ID are included (the full ID is sent later, inside the channel).
  function encodeCode(type, sdp, room, sender) {
    const parts = compactSdp(sdp);
    if (!parts) throw new Error('This browser produced connection details VYBE cannot use.');
    const payload = [
      3, type === 'offer' ? 'o' : 'a',
      parts.ufrag, parts.pwd, parts.fp, parts.candidates,
      room.id, room.name,
      sender.id.slice(0, 8), sender.name
    ];
    return CODE_PREFIX + toBase64Url(JSON.stringify(payload));
  }

  /* ---------------------------------------------------------------------
     Strict checks for every field that will be put into an SDP.
     Only the characters each field legitimately needs are allowed, so a
     hostile code can never smuggle a line break or an extra SDP line in.
     --------------------------------------------------------------------- */
  function isIPv4(text) {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
    return !!m && m.slice(1).every(function (o) { return Number(o) <= 255; });
  }
  function isIPv6(text) {
    return /^[0-9A-Fa-f:.]{2,45}$/.test(text) && (text.match(/:/g) || []).length >= 2 &&
      text.indexOf(':::') === -1 && (text.match(/::/g) || []).length <= 1;
  }
  function isMdnsName(text) {                    // e.g. 3f2a9c1e-....local (browsers hide local IPs like this)
    return /^[A-Za-z0-9-]{1,63}\.local$/.test(text);
  }
  function isValidHost(text) {
    return typeof text === 'string' && (isIPv4(text) || isIPv6(text) || isMdnsName(text));
  }
  function isValidPort(text) {
    return /^\d{1,5}$/.test(text) && Number(text) >= 1 && Number(text) <= 65535;
  }
  function isValidPriority(text) {
    return /^[0-9a-z]{1,7}$/.test(text) && parseInt(text, 36) >= 1 && parseInt(text, 36) <= 4294967295;
  }
  // One compact candidate:  h|192.168.1.5|50000|abc12   or  h|ip|port|prio|p  (TCP)
  function isValidCandidate(text) {
    if (typeof text !== 'string' || text.length > 120) return false;
    const f = text.split('|');
    if (f.length !== 4 && f.length !== 5) return false;
    if (!LETTER_TYPE[f[0]] || !isValidHost(f[1]) || !isValidPort(f[2]) || !isValidPriority(f[3])) return false;
    if (f.length === 5 && !LETTER_TCP[f[4]]) return false;
    return true;
  }

  // Check a pasted code OR link. NEVER trusts what the user pasted.
  // expectedType is 'offer' or 'answer'.
  // Returns { ok: true, sdp, room, from } or { ok: false, error }.
  function decodeCode(rawText, expectedType) {
    if (typeof rawText !== 'string' || rawText.trim() === '') {
      return { ok: false, error: 'Please paste an invite link or code first.' };
    }
    // Chat apps add spaces and line breaks. Remove them.
    const text = rawText.replace(/\s+/g, '');
    if (text.length > MAX_CODE_LENGTH) {
      return { ok: false, error: 'That text is too long to be a VYBE code.' };
    }
    if (text.indexOf('VYBE1:') !== -1 || text.indexOf('VYBE2:') !== -1) {
      return { ok: false, error: 'This code was made by an older version of VYBE. Ask your friend to refresh the page and create a new invite.' };
    }
    const at = text.indexOf(CODE_PREFIX);
    if (at === -1) {
      return { ok: false, error: 'This is not a VYBE code. A valid code or link contains "' + CODE_PREFIX + '". Copy the whole thing again.' };
    }
    const match = text.slice(at).match(/^VYBE3:([A-Za-z0-9_-]+)/);
    if (!match) {
      return { ok: false, error: 'The code looks damaged or incomplete. Make sure you copied all of it.' };
    }

    let data;
    try {
      data = JSON.parse(fromBase64Url(match[1]));
    } catch (err) {
      return { ok: false, error: 'The code looks damaged or incomplete. Make sure you copied all of it.' };
    }

    if (!Array.isArray(data) || data.length !== 10 || data[0] !== 3) {
      return { ok: false, error: 'This code is not in the right format.' };
    }
    const t = data[1] === 'o' ? 'offer' : data[1] === 'a' ? 'answer' : null;
    if (!t) return { ok: false, error: 'This code has an unknown type.' };
    if (t !== expectedType) {
      return {
        ok: false,
        error: expectedType === 'offer'
          ? 'This is a REPLY code. Here you need the INVITE from the student who created the room.'
          : 'This is an INVITE. Here you need the REPLY code from the student who joined.'
      };
    }

    const ufrag = data[2], pwd = data[3], fp = data[4], cands = data[5];
    const okText = function (v, min, max) { return typeof v === 'string' && v.length >= min && v.length <= max; };
    if (!okText(ufrag, 4, 256) || !/^[A-Za-z0-9+\/]+$/.test(ufrag) ||
        !okText(pwd, 22, 256) || !/^[A-Za-z0-9+\/]+$/.test(pwd) ||
        !okText(fp, 43, 43) || !/^[A-Za-z0-9_-]+$/.test(fp)) {
      return { ok: false, error: 'The connection details inside the code are invalid.' };
    }
    if (!Array.isArray(cands) || cands.length === 0 || cands.length > MAX_CANDIDATES) {
      return { ok: false, error: 'The code has no usable network addresses.' };
    }
    for (let i = 0; i < cands.length; i++) {
      if (!isValidCandidate(cands[i])) {
        return { ok: false, error: 'The network addresses inside the code are invalid.' };
      }
    }
    // Room and sender fields: plain strings of sane length (the app cleans them again).
    if (!okText(data[6], 8, 64) || !okText(data[7], 0, 200) || !okText(data[8], 8, 8) || !okText(data[9], 0, 200)) {
      return { ok: false, error: 'The room or sender details inside the code are invalid.' };
    }

    let sdp;
    try {
      sdp = expandSdp({ ufrag: ufrag, pwd: pwd, fp: fp, candidates: cands }, expectedType);
    } catch (err) {
      return { ok: false, error: 'The connection details inside the code are invalid.' };
    }
    // Room + sender details are checked again by the app (VybeChat) before use.
    return { ok: true, sdp: sdp, room: { id: data[6], name: data[7] }, from: { i: data[8], n: data[9] } };
  }

  /* ---------------------------------------------------------------------
     Wait until the browser has finished collecting ICE candidates.
     We must do this BEFORE showing the code, because we have no server to
     send candidates later ("non-trickle ICE"). If the code was created too
     early it would not contain our network addresses and could not connect.
     --------------------------------------------------------------------- */
  function waitForIceGathering(pc, timeoutMs) {
    return new Promise(function (resolve) {
      if (pc.iceGatheringState === 'complete') {
        resolve({ complete: true });
        return;
      }
      let finished = false;
      function done(result) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', onChange);
        resolve(result);
      }
      function onChange() {
        if (pc.iceGatheringState === 'complete') done({ complete: true });
      }
      const timer = setTimeout(function () { done({ complete: false }); }, timeoutMs);
      pc.addEventListener('icegatheringstatechange', onChange);
    });
  }

  function countCandidates(sdp) {
    const matches = sdp.match(/^a=candidate:/gm);
    return matches ? matches.length : 0;
  }

  function countRelayCandidates(sdp) {
    const matches = sdp.match(/^a=candidate:.* typ relay\b/gm);
    return matches ? matches.length : 0;
  }

  // Plain-language advice for a connection that could not be opened.
  function failureHelp(wasOpen) {
    if (wasOpen) return 'The connection to your friend was lost.';
    if (ICE_SETUP.turnCount > 0) {
      return 'Could not open the connection, even through the relay server. Check that both devices are online, ' +
        'then create a new invite and reply. If it keeps failing, the relay settings may be wrong or expired.';
    }
    return 'Could not open a direct connection. The two devices are probably on networks that block direct connections ' +
      '(some campus or office Wi-Fi, some mobile data). Try the same Wi-Fi or a phone hotspot, then create a new invite and reply. ' +
      'This app only has a relay fallback when the developer has added a TURN server.';
  }

  /* ---------------------------------------------------------------------
     The Connection class: one RTCPeerConnection + one RTCDataChannel.
     Create a NEW Connection object for every connection attempt.

     handlers = {
       onState(state, detail)  - connection state changed
       onOpen()                - DataChannel is open (really connected)
       onMessage(text)         - text received from the peer
       onClose()               - DataChannel closed after being open
       onIceState(text)        - ICE state text (for the info panel)
     }

     States:  idle -> gathering -> waiting-for-answer (host)
                              \-> waiting-for-host   (guest)
              -> connecting -> connected -> disconnected
              or -> failed
     --------------------------------------------------------------------- */
  class Connection {
    constructor(handlers) {
      this.handlers = handlers || {};
      this.pc = null;
      this.channel = null;
      this.state = 'idle';
      this.role = null;            // 'host' or 'guest'
      this.closed = false;
      this.wasOpen = false;
      this.connectTimer = null;
      this.iceGatheringComplete = null;
      this.offerAccepted = false;   // guest: an invite was already used on this connection
      this.answerAccepted = false;  // host: a reply was already used on this connection
      this.turnProblem = null;      // set when the relay server rejected our login
    }

    /* ---- state handling ---- */
    _setState(state, detail) {
      if (this.closed && state !== 'closed') return;
      // Once failed, a later "disconnected" must not hide the failure.
      if (this.state === 'failed' && state === 'disconnected') return;
      // Once the channel has really opened, the setup states must never come back
      // (a late event could otherwise turn "Connected" back into "Connecting").
      if (this.wasOpen && (state === 'gathering' || state === 'waiting-for-answer' ||
          state === 'waiting-for-host' || state === 'connecting')) return;
      if (this.state === state && !detail) return;
      this.state = state;
      if (this.handlers.onState) this.handlers.onState(state, detail || '');
    }

    _startConnectTimer() {
      if (this.connectTimer || this.closed) return;
      const self = this;
      this.connectTimer = setTimeout(function () {
        self.connectTimer = null;
        if (!self.wasOpen && !self.closed) {
          self._setState('failed', failureHelp(false));
        }
      }, CONNECT_TIMEOUT_MS);
    }

    _clearConnectTimer() {
      if (this.connectTimer) {
        clearTimeout(this.connectTimer);
        this.connectTimer = null;
      }
    }

    /* ---- creating the RTCPeerConnection ---- */
    _createPeerConnection() {
      if (typeof RTCPeerConnection === 'undefined') {
        throw new Error('This browser does not support WebRTC. Please use a recent version of Chrome, Edge, Firefox or Safari.');
      }
      const self = this;
      const pc = new RTCPeerConnection(RTC_CONFIG);
      this.pc = pc;

      pc.onconnectionstatechange = function () {
        if (self.closed || self.pc !== pc) return;
        const s = pc.connectionState;
        if (s === 'connecting') {
          self._startConnectTimer();
          if (!self.wasOpen) self._setState('connecting');
        } else if (s === 'failed') {
          self._clearConnectTimer();
          self._setState('failed', failureHelp(self.wasOpen));
        } else if (s === 'disconnected' && self.wasOpen) {
          // Often temporary (e.g. Wi-Fi blip). We still show it honestly.
          self._setState('disconnected', 'The connection was interrupted. It may recover by itself; if not, press Reconnect.');
        } else if (s === 'closed' && self.wasOpen) {
          self._setState('disconnected', 'The connection was closed.');
        }
      };

      pc.oniceconnectionstatechange = function () {
        if (self.pc !== pc) return;
        if (self.handlers.onIceState) self.handlers.onIceState(pc.iceConnectionState);
      };

      // A TURN server that refuses our login (wrong / expired username or credential).
      pc.onicecandidateerror = function (event) {
        if (self.pc !== pc) return;
        const url = event && typeof event.url === 'string' ? event.url : '';
        if (/^turns?:/.test(url) && (event.errorCode === 401 || event.errorCode === 403)) {
          self.turnProblem = 'The relay server refused the login. The TURN username or credential in js/ice-config.js is probably wrong or has expired.';
        }
      };

      return pc;
    }

    /* ---- wiring the DataChannel ---- */
    _wireChannel(channel) {
      const self = this;
      this.channel = channel;

      // "connected" ONLY when the channel is really open.
      channel.onopen = function () {
        if (self.closed || self.channel !== channel) return;
        self.wasOpen = true;
        self._clearConnectTimer();
        self._setState('connected');
        if (self.handlers.onOpen) self.handlers.onOpen();
      };

      channel.onclose = function () {
        if (self.closed || self.channel !== channel) return;
        if (self.wasOpen) {
          self._setState('disconnected', 'Your peer closed the connection or it was lost.');
          if (self.handlers.onClose) self.handlers.onClose();
        }
      };

      channel.onerror = function () {
        // Details are not exposed by browsers; the close/failed events follow.
      };

      channel.onmessage = function (event) {
        if (self.closed || self.channel !== channel) return;
        if (self.handlers.onMessage) self.handlers.onMessage(event.data);
      };
    }

    /* ---- shared: wait for candidates, make sure we have usable ones ---- */
    async _finishGathering() {
      const timeout = ICE_SETUP.turnCount > 0 ? ICE_GATHER_TIMEOUT_TURN_MS : ICE_GATHER_TIMEOUT_MS;
      const gathering = await waitForIceGathering(this.pc, timeout);
      if (this.closed) throw new Error('Cancelled.');
      const sdp = this.pc.localDescription.sdp;
      if (countCandidates(sdp) === 0) {
        throw new Error(this.turnProblem || 'No network connection was found. Check that you are online and try again.');
      }
      const relayCount = countRelayCandidates(sdp);
      if (ICE_SETUP.forceRelay && relayCount === 0) {
        throw new Error(this.turnProblem || 'Relay-only test mode is on, but the relay server could not be reached. Check js/ice-config.js.');
      }
      this.iceGatheringComplete = gathering.complete;
      return {
        sdp: sdp,
        iceComplete: gathering.complete,
        relayCount: relayCount,
        turnConfigured: ICE_SETUP.turnCount > 0,
        turnProblem: this.turnProblem
      };
    }

    /* ---- HOST: step 1 - create the offer ---- */
    async createOffer() {
      this.role = 'host';
      this._setState('gathering');
      const pc = this._createPeerConnection();

      // The host creates the DataChannel. The guest receives it in ondatachannel.
      const channel = pc.createDataChannel(CHANNEL_NAME, { ordered: true });
      this._wireChannel(channel);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for all ICE candidates before the code is shown.
      const result = await this._finishGathering();
      this._setState('waiting-for-answer');
      return result;
    }

    /* ---- GUEST: step 1 - accept the offer and create the answer ---- */
    async acceptOffer(offerSdp) {
      // An invite can be used only once per connection (paste + click + scan must not race).
      if (this.offerAccepted) {
        const dup = new Error('This invite was already used. Your reply is ready below.');
        dup.code = 'DUPLICATE';
        throw dup;
      }
      this.offerAccepted = true;
      this.role = 'guest';
      this._setState('gathering');
      const pc = this._createPeerConnection();
      const self = this;

      pc.ondatachannel = function (event) {
        if (self.closed || self.pc !== pc) return;
        if (event.channel.label !== CHANNEL_NAME) return; // ignore unknown channels
        if (self.channel) return;                          // only one channel is ever accepted
        self._wireChannel(event.channel);
      };

      try {
        await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
      } catch (err) {
        throw new Error('The invite could not be used. Ask your friend to create a new one.');
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const result = await this._finishGathering();
      this._setState('waiting-for-host');
      return result;
    }

    /* ---- HOST: step 2 - accept the answer ---- */
    async acceptAnswer(answerSdp) {
      if (this.role !== 'host' || !this.pc) {
        throw new Error('Create an invite first.');
      }
      // The flag is set BEFORE the first await, so two quick calls (paste + click)
      // can never both get through.
      if (this.answerAccepted) {
        const dup = new Error('This reply was already used. Create a new invite if you want to try again.');
        dup.code = 'DUPLICATE';
        throw dup;
      }
      if (this.pc.signalingState !== 'have-local-offer') {
        throw new Error('This invite was already used. Create a new invite for a new connection.');
      }
      this.answerAccepted = true;
      try {
        await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      } catch (err) {
        // The invite is still unused: allow a corrected reply.
        if (this.pc && this.pc.signalingState === 'have-local-offer') this.answerAccepted = false;
        throw new Error('The reply does not match your invite. Make sure it came from the student who opened YOUR latest invite.');
      }
      if (!this.wasOpen) {
        this._setState('connecting');
        this._startConnectTimer();
      }
    }

    /* ---- sending ---- */
    isOpen() {
      return !this.closed && this.channel !== null && this.channel.readyState === 'open';
    }

    // Returns true only if the text was handed to an open DataChannel.
    send(text) {
      if (!this.isOpen()) return false;
      if (this.channel.bufferedAmount > MAX_BUFFERED_BYTES) return false;
      try {
        this.channel.send(text);
        return true;
      } catch (err) {
        return false;
      }
    }

    /* ---- information for the "Connection info" panel ---- */
    async getConnectionPath() {
      if (!this.pc || !this.isOpen()) return null;
      try {
        const stats = await this.pc.getStats();
        let pairId = null;
        stats.forEach(function (report) {
          if (report.type === 'transport' && report.selectedCandidatePairId) pairId = report.selectedCandidatePairId;
        });
        let pair = null;
        stats.forEach(function (report) {
          if (report.type === 'candidate-pair' && (report.id === pairId || (!pairId && report.nominated && report.state === 'succeeded'))) pair = report;
        });
        if (!pair) return null;
        const local = stats.get(pair.localCandidateId);
        const remote = stats.get(pair.remoteCandidateId);
        return {
          local: local ? local.candidateType : 'unknown',
          remote: remote ? remote.candidateType : 'unknown'
        };
      } catch (err) {
        return null;
      }
    }

    /* ---- cleaning up ---- */
    // Closes everything. Safe to call more than once.
    close() {
      if (this.closed) return;
      this.closed = true;
      this._clearConnectTimer();
      try { if (this.channel) { this.channel.onopen = this.channel.onclose = this.channel.onmessage = this.channel.onerror = null; this.channel.close(); } } catch (err) { /* ignore */ }
      try {
        if (this.pc) {
          this.pc.onconnectionstatechange = null;
          this.pc.oniceconnectionstatechange = null;
          this.pc.ondatachannel = null;
          this.pc.close();
        }
      } catch (err) { /* ignore */ }
      this.channel = null;
      this.pc = null;
    }
  }

  return {
    RTC_CONFIG: RTC_CONFIG,
    ICE_SETUP: ICE_SETUP,
    buildIceConfig: buildIceConfig,
    hasTurn: function () { return ICE_SETUP.turnCount > 0; },
    isRelayOnly: function () { return ICE_SETUP.forceRelay; },
    CODE_PREFIX: CODE_PREFIX,
    parseCandidates: parseCandidates,
    selectCandidates: selectCandidates,
    compactSdp: compactSdp,
    expandSdp: expandSdp,
    encodeCode: encodeCode,
    decodeCode: decodeCode,
    Connection: Connection
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VybeRTC;
}
