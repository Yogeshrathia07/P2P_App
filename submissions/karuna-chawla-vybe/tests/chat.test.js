/* Run with:  node tests/chat.test.js
   Tests the logic in js/chat.js and js/webrtc.js (code parsing) without a browser.
   It fakes LocalStorage with a simple object. */
const assert = require('assert');

// --- fake LocalStorage ---
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};

const VybeChat = require('../js/chat.js');
const VybeRTC = require('../js/webrtc.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  PASS  ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + '\n        ' + e.message); }
}

const ME = 'me-0000-aaaa', PEER = 'peer-0000-bbbb';
function msg(over) {
  return Object.assign({ id: VybeChat.generateId(), senderId: PEER, content: 'hi', timestamp: Date.now(), seq: 1, type: 'chat' }, over || {});
}
function freshRoom(id) {
  VybeChat.upsertRoom({ id: id, name: 'Test' });
  VybeChat.openRoom(id);
}

console.log('Problem 4: validation');
test('accepts a normal message', () => assert.ok(VybeChat.validateMessage(msg()).ok));
test('rejects non-object', () => assert.ok(!VybeChat.validateMessage('x').ok));
test('rejects array', () => assert.ok(!VybeChat.validateMessage([]).ok));
test('rejects empty content', () => assert.ok(!VybeChat.validateMessage(msg({ content: '   ' })).ok));
test('rejects content that is not text', () => assert.ok(!VybeChat.validateMessage(msg({ content: 123 })).ok));
test('rejects too-long content', () => assert.ok(!VybeChat.validateMessage(msg({ content: 'a'.repeat(1001) })).ok));
test('accepts exactly 1000 chars', () => assert.ok(VybeChat.validateMessage(msg({ content: 'a'.repeat(1000) })).ok));
test('rejects bad id', () => assert.ok(!VybeChat.validateMessage(msg({ id: '<script>' })).ok));
test('rejects bad sender id', () => assert.ok(!VybeChat.validateMessage(msg({ senderId: 'x' })).ok));
test('rejects bad timestamp', () => assert.ok(!VybeChat.validateMessage(msg({ timestamp: 'now' })).ok));
test('rejects bad seq (0, negative, float)', () => {
  [0, -1, 1.5, 'a', 1e12].forEach((s) => assert.ok(!VybeChat.validateMessage(msg({ seq: s })).ok, 'seq ' + s));
});
test('wrong type rejected', () => assert.ok(!VybeChat.validateMessage(msg({ type: 'admin' })).ok));
test('extra fields are stripped', () => {
  const r = VybeChat.validateMessage(msg({ evil: '<img src=x onerror=alert(1)>', __proto__x: 1 }));
  assert.ok(r.ok);
  assert.deepStrictEqual(Object.keys(r.message).sort(), ['content', 'id', 'senderId', 'seq', 'timestamp', 'type']);
});
test('HTML is kept as plain text (escaped later by textContent)', () => {
  const r = VybeChat.validateMessage(msg({ content: '<b>x</b>' }));
  assert.strictEqual(r.message.content, '<b>x</b>');
});
test('control characters removed', () => {
  const r = VybeChat.validateMessage(msg({ content: 'a\u0000b‮c' }));
  assert.strictEqual(r.message.content, 'abc');
});
test('parsePacket: not JSON', () => assert.ok(!VybeChat.parsePacket('{oops').ok));
test('parsePacket: not text', () => assert.ok(!VybeChat.parsePacket(new ArrayBuffer(4)).ok));
test('parsePacket: huge payload', () => assert.ok(!VybeChat.parsePacket('x'.repeat(100001)).ok));
test('parsePacket: unknown type', () => assert.ok(!VybeChat.parsePacket(JSON.stringify({ type: 'exec', senderId: PEER })).ok));
test('parsePacket: null / number / array JSON', () => {
  ['null', '5', '[]', '"s"'].forEach((t) => assert.ok(!VybeChat.parsePacket(t).ok, t));
});
test('parsePacket: valid hello', () => assert.ok(VybeChat.parsePacket(JSON.stringify({ type: 'hello', senderId: PEER, name: 'Asha' })).ok));
test('parsePacket: history with too many messages', () => {
  const big = { type: 'history-response', senderId: PEER, batch: 1, totalBatches: 1, messages: new Array(21).fill({}) };
  assert.ok(!VybeChat.parsePacket(JSON.stringify(big)).ok);
});

console.log('Problem 2: duplicates');
test('same id twice is added once', () => {
  freshRoom('room-dup-0001');
  const m = msg();
  assert.strictEqual(VybeChat.addMessage(m).status, 'added');
  assert.strictEqual(VybeChat.addMessage(m).status, 'duplicate');
  assert.strictEqual(VybeChat.getMessageCount(), 1);
});
test('history merge skips known ids', () => {
  freshRoom('room-dup-0002');
  const a = msg({ seq: 1 }), b = msg({ seq: 2 });
  VybeChat.addMessage(a);
  const s = VybeChat.mergeMessages([a, b, a]);
  assert.deepStrictEqual(s, { added: 1, duplicates: 2, invalid: 0 });
  assert.strictEqual(VybeChat.getMessageCount(), 2);
});
test('history merge counts invalid ones', () => {
  freshRoom('room-dup-0003');
  const s = VybeChat.mergeMessages([msg(), { junk: true }, 'x']);
  assert.strictEqual(s.added, 1);
  assert.strictEqual(s.invalid, 2);
});

console.log('Problem 3: ordering');
test('sorted by seq even when timestamps disagree', () => {
  freshRoom('room-ord-0001');
  const now = Date.now();
  VybeChat.addMessage(msg({ seq: 3, timestamp: now - 5000, content: 'third' }));   // clock far in the past
  VybeChat.addMessage(msg({ seq: 1, timestamp: now + 99999, content: 'first' }));  // clock far in the future
  VybeChat.addMessage(msg({ seq: 2, timestamp: now, content: 'second' }));
  assert.deepStrictEqual(VybeChat.getMessages().map((m) => m.content), ['first', 'second', 'third']);
});
test('next local seq is above everything received (logical clock)', () => {
  freshRoom('room-ord-0002');
  VybeChat.addMessage(msg({ seq: 41 }));
  const made = VybeChat.createLocalMessage('hello', ME);
  assert.strictEqual(made.message.seq, 42);
});
test('tie on seq: every device gets the same order', () => {
  const t = Date.now();
  const x = msg({ seq: 5, timestamp: t, senderId: 'aaaaaaaa1', id: 'id-x-000001' });
  const y = msg({ seq: 5, timestamp: t, senderId: 'bbbbbbbb1', id: 'id-y-000001' });
  freshRoom('room-ord-0003'); VybeChat.addMessage(x); VybeChat.addMessage(y);
  const order1 = VybeChat.getMessages().map((m) => m.id);
  freshRoom('room-ord-0004'); VybeChat.addMessage(y); VybeChat.addMessage(x);
  const order2 = VybeChat.getMessages().map((m) => m.id);
  assert.deepStrictEqual(order1, order2);
});

console.log('Problem 1: persistence');
test('messages survive a "refresh" (re-open from storage)', () => {
  freshRoom('room-per-0001');
  VybeChat.addMessage(msg({ seq: 1, content: 'keep me' }));
  VybeChat.closeRoom();
  const restored = VybeChat.openRoom('room-per-0001');
  assert.strictEqual(restored.length, 1);
  assert.strictEqual(restored[0].content, 'keep me');
});
test('tampered storage is re-validated', () => {
  store['vybe.chat.room-per-0002'] = JSON.stringify([msg({ content: 'ok' }), { id: 1, content: '<script>' }, 'junk']);
  assert.strictEqual(VybeChat.openRoom('room-per-0002').length, 1);
});
test('corrupt storage does not crash', () => {
  store['vybe.chat.room-per-0003'] = '{not json';
  assert.strictEqual(VybeChat.openRoom('room-per-0003').length, 0);
});
test('clear removes messages and keeps the clock', () => {
  freshRoom('room-per-0004');
  VybeChat.addMessage(msg({ seq: 9 }));
  VybeChat.clearMessages();
  assert.strictEqual(VybeChat.getMessageCount(), 0);
  assert.strictEqual(VybeChat.createLocalMessage('x', ME).message.seq, 10);
});
test('user id + name are saved', () => {
  const u1 = VybeChat.loadUser(); const u2 = VybeChat.loadUser();
  assert.strictEqual(u1.id, u2.id);
});

console.log('Bonus: history batches');
test('batches of 20, at least one batch', () => {
  freshRoom('room-his-0001');
  assert.strictEqual(VybeChat.getHistoryBatches().length, 1);
  for (let i = 1; i <= 45; i++) VybeChat.addMessage(msg({ seq: i }));
  const b = VybeChat.getHistoryBatches();
  assert.deepStrictEqual(b.map((x) => x.length), [20, 20, 5]);
});
test('two peers converge after a sync', () => {
  freshRoom('room-his-0002');
  for (let i = 1; i <= 3; i++) VybeChat.addMessage(msg({ seq: i, content: 'A' + i }));
  const fromA = VybeChat.getHistoryBatches()[0];
  freshRoom('room-his-0003');
  VybeChat.addMessage(msg({ seq: 2, content: 'B-only' }));
  VybeChat.mergeMessages(fromA);
  assert.strictEqual(VybeChat.getMessageCount(), 4);
  const seqs = VybeChat.getMessages().map((m) => m.seq);
  assert.deepStrictEqual(seqs, seqs.slice().sort((a, b) => a - b));
});

console.log('Connection codes (compact VYBE3 format)');
// A realistic SDP, like the one Chrome makes for a data-channel-only connection.
const REAL_SDP = [
  'v=0', 'o=- 4611731400430051336 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0',
  'a=extmap-allow-mixed', 'a=msid-semantic: WMS', 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=candidate:1 1 udp 2113937151 3f2b9a10-1c2d-4e5f-8a9b-0c1d2e3f4a5b.local 54321 typ host generation 0 network-cost 999',
  'a=candidate:2 1 udp 1677729535 203.0.113.7 54321 typ srflx raddr 0.0.0.0 rport 0 generation 0 network-cost 999',
  'a=candidate:3 1 tcp 1518280447 192.168.1.5 9 typ host tcptype active generation 0 network-cost 999',
  'a=candidate:4 1 udp 2113939711 fe80::1 5555 typ host generation 0',
  'a=ice-ufrag:AbCd', 'a=ice-pwd:0123456789abcdefghijKLMN', 'a=ice-options:trickle',
  'a=fingerprint:sha-256 ' + Array.from({ length: 32 }, (_, i) => ('0' + (i * 7 % 256).toString(16)).slice(-2).toUpperCase()).join(':'),
  'a=setup:actpass', 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144', ''
].join('\r\n');
const ROOM = { id: 'abc123def456', name: 'DSA revision' };
const SENDER = { id: '11111111-2222-3333-4444-555555555555', name: 'Asha' };

test('code is much shorter than the raw SDP', () => {
  const code = VybeRTC.encodeCode('offer', REAL_SDP, ROOM, SENDER);
  console.log('        raw SDP ' + REAL_SDP.length + ' chars  ->  code ' + code.length + ' chars');
  assert.ok(code.startsWith('VYBE3:'));
  assert.ok(code.length < 600, 'length ' + code.length);
});
test('round trip keeps ICE login, fingerprint, room and sender', () => {
  const code = VybeRTC.encodeCode('offer', REAL_SDP, ROOM, SENDER);
  const r = VybeRTC.decodeCode(code, 'offer');
  assert.ok(r.ok, r.error);
  assert.match(r.sdp, /a=ice-ufrag:AbCd/);
  assert.match(r.sdp, /a=ice-pwd:0123456789abcdefghijKLMN/);
  assert.match(r.sdp, /webrtc-datachannel/);
  assert.match(r.sdp, /a=setup:actpass/);
  const fp = (REAL_SDP.match(/a=fingerprint:sha-256 (\S+)/) || [])[1];
  assert.ok(r.sdp.indexOf(fp) !== -1, 'fingerprint preserved');
  assert.deepStrictEqual(r.room, ROOM);
  assert.deepStrictEqual(r.from, { i: '11111111', n: 'Asha' });
});
test('link-local IPv6 is dropped; UDP and TCP candidates are kept', () => {
  const r = VybeRTC.decodeCode(VybeRTC.encodeCode('offer', REAL_SDP, ROOM, SENDER), 'offer');
  assert.strictEqual((r.sdp.match(/a=candidate:/g) || []).length, 3);   // host udp, srflx udp, host tcp
  assert.ok(!/fe80/.test(r.sdp));
  assert.match(r.sdp, / tcp 1518280447 192\.168\.1\.5 9 typ host tcptype active/);
  assert.match(r.sdp, / typ srflx raddr 0\.0\.0\.0 rport 0/);
});
test('answer is rebuilt with setup:active', () => {
  const r = VybeRTC.decodeCode(VybeRTC.encodeCode('answer', REAL_SDP, ROOM, SENDER), 'answer');
  assert.match(r.sdp, /a=setup:active/);
});
test('a full invite LINK works as well as the bare code', () => {
  const code = VybeRTC.encodeCode('offer', REAL_SDP, ROOM, SENDER);
  assert.ok(VybeRTC.decodeCode('https://me.github.io/P2P_App/submissions/g/#/join/' + code, 'offer').ok);
});
test('invalid codes give clear errors', () => {
  ['', '   ', 'hello', 'VYBE3:', 'VYBE3:!!!', 'VYBE3:' + Buffer.from('{"v":1').toString('base64'),
   'VYBE3:' + Buffer.from('[3,"o","a"]').toString('base64'), 'VYBE1:abc', 'VYBE2:abc'].forEach((c) => {
    const r = VybeRTC.decodeCode(c, 'offer');
    assert.ok(!r.ok && r.error, 'code: ' + c);
  });
});
test('hostile fields inside a code are rejected (SDP injection)', () => {
  const bad = (arr) => 'VYBE3:' + Buffer.from(JSON.stringify(arr)).toString('base64url');
  const fp = VybeRTC.compactSdp(REAL_SDP).fp;
  const base = [3, 'o', 'AbCd', '0123456789abcdefghijKLMN', fp, ['h|10.0.0.1|5000|zz'], ROOM.id, ROOM.name, '11111111', 'x'];
  assert.ok(VybeRTC.decodeCode(bad(base), 'offer').ok);
  const withCand = (c) => { const a = base.slice(); a[5] = [c]; return bad(a); };
  assert.ok(!VybeRTC.decodeCode(withCand('h|10.0.0.1 5000\r\na=evil|5000|zz'), 'offer').ok);
  assert.ok(!VybeRTC.decodeCode(withCand('x|10.0.0.1|5000|zz'), 'offer').ok);
  const a2 = base.slice(); a2[2] = 'ab\r\nm=video'; assert.ok(!VybeRTC.decodeCode(bad(a2), 'offer').ok);
  const a3 = base.slice(); a3[5] = []; assert.ok(!VybeRTC.decodeCode(bad(a3), 'offer').ok);
});
test('offer/reply mix-up is detected', () => {
  const code = VybeRTC.encodeCode('answer', REAL_SDP, ROOM, SENDER);
  const r = VybeRTC.decodeCode(code, 'offer');
  assert.ok(!r.ok && /REPLY/.test(r.error));
  assert.ok(VybeRTC.decodeCode(code, 'answer').ok);
});
test('code survives line breaks added by chat apps', () => {
  const code = VybeRTC.encodeCode('offer', REAL_SDP, ROOM, SENDER);
  const broken = code.replace(/(.{40})/g, '$1\n  ');
  assert.ok(VybeRTC.decodeCode(broken, 'offer').ok);
});
test('oversized code rejected', () => assert.ok(!VybeRTC.decodeCode('VYBE3:' + 'A'.repeat(9000), 'offer').ok));

test('an old VYBE2 code gets a "create a new invite" message', () => {
  const r = VybeRTC.decodeCode('VYBE2:WzIsIm8iXQ', 'offer');
  assert.ok(!r.ok && /older version/.test(r.error));
});

console.log('\nRelay (TURN), TCP and candidate selection');
const sdpWith = (candLines) => [
  'v=0', 'o=- 1 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0'].concat(candLines).concat([
  'a=ice-ufrag:AbCd', 'a=ice-pwd:0123456789abcdefghijKLMN',
  'a=fingerprint:sha-256 ' + Array.from({ length: 32 }, (_, i) => ('0' + (i * 5 % 256).toString(16)).slice(-2).toUpperCase()).join(':'),
  'a=setup:actpass', 'a=mid:0', 'a=sctp-port:5000', '']).join('\r\n');

test('RELAY candidates are NOT dropped even when many better-priority candidates exist (old "top 5" bug)', () => {
  const lines = [];
  for (let i = 0; i < 6; i++) lines.push('a=candidate:h' + i + ' 1 udp ' + (2113937151 - i) + ' 10.0.0.' + (i + 1) + ' ' + (50000 + i) + ' typ host generation 0');
  for (let i = 0; i < 4; i++) lines.push('a=candidate:s' + i + ' 1 udp ' + (1677729535 - i) + ' 203.0.113.' + (i + 1) + ' ' + (40000 + i) + ' typ srflx raddr 10.0.0.1 rport 50000 generation 0');
  lines.push('a=candidate:r1 1 udp 41885439 198.51.100.9 61000 typ relay raddr 203.0.113.1 rport 40000 generation 0');
  lines.push('a=candidate:r2 1 udp 41885438 198.51.100.9 61001 typ relay raddr 203.0.113.1 rport 40000 generation 0');
  const sdp = sdpWith(lines);
  const code = VybeRTC.encodeCode('offer', sdp, ROOM, SENDER);
  const r = VybeRTC.decodeCode(code, 'offer');
  assert.ok(r.ok, r.error);
  const relays = r.sdp.match(/typ relay/g) || [];
  assert.strictEqual(relays.length, 2, 'relay candidates must survive');
  assert.match(r.sdp, / 198\.51\.100\.9 61000 typ relay raddr 0\.0\.0\.0 rport 0/);
  assert.ok((r.sdp.match(/a=candidate:/g) || []).length <= 8);
  console.log('        12 candidates in -> ' + (r.sdp.match(/a=candidate:/g) || []).length + ' kept, code ' + code.length + ' chars');
  assert.ok(code.length < 700, 'code length ' + code.length);
});
test('selection keeps relay first, then srflx, host, tcp (priority order inside each kind)', () => {
  const c = VybeRTC.selectCandidates(VybeRTC.parseCandidates(sdpWith([
    'a=candidate:1 1 udp 100 10.0.0.1 5000 typ host', 'a=candidate:2 1 udp 900 10.0.0.2 5001 typ host',
    'a=candidate:3 1 udp 50 198.51.100.9 6000 typ relay raddr 1.1.1.1 rport 1',
    'a=candidate:4 1 tcp 70 10.0.0.2 9 typ host tcptype passive', 'a=candidate:5 1 udp 500 203.0.113.1 7000 typ srflx raddr 1.1.1.1 rport 1'])));
  assert.deepStrictEqual(c.map((x) => x.type + '/' + x.proto), ['relay/udp', 'srflx/udp', 'host/udp', 'host/udp', 'host/tcp']);
  assert.strictEqual(c[2].port, '5001');
});
test('TCP candidates round-trip with their tcptype', () => {
  const r = VybeRTC.decodeCode(VybeRTC.encodeCode('offer', sdpWith([
    'a=candidate:1 1 udp 2113937151 10.0.0.1 5000 typ host', 'a=candidate:2 1 tcp 1518280447 10.0.0.1 7777 typ host tcptype passive generation 0'
  ]), ROOM, SENDER), 'offer');
  assert.ok(r.ok, r.error);
  assert.match(r.sdp, /a=candidate:\d 1 tcp 1518280447 10\.0\.0\.1 7777 typ host tcptype passive/);
});
test('TCP candidate without a tcptype, component 2, prflx and duplicates are skipped', () => {
  const found = VybeRTC.parseCandidates(sdpWith([
    'a=candidate:1 1 tcp 1 10.0.0.1 9 typ host', 'a=candidate:2 2 udp 1 10.0.0.1 5000 typ host',
    'a=candidate:3 1 udp 1 10.0.0.1 5001 typ prflx raddr 1.1.1.1 rport 1',
    'a=candidate:4 1 udp 9 10.0.0.1 5002 typ host', 'a=candidate:5 1 udp 9 10.0.0.1 5002 typ host']));
  assert.strictEqual(found.length, 1);
});
test('IPv6 global address works; mDNS .local works', () => {
  const r = VybeRTC.decodeCode(VybeRTC.encodeCode('offer', sdpWith([
    'a=candidate:1 1 udp 2113937151 2001:db8::1 5000 typ host', 'a=candidate:2 1 udp 2113937150 3f2b9a10-1c2d-4e5f-8a9b-0c1d2e3f4a5b.local 5001 typ host'
  ]), ROOM, SENDER), 'offer');
  assert.ok(r.ok, r.error);
  assert.match(r.sdp, / 2001:db8::1 5000 typ host/);
  assert.match(r.sdp, /\.local 5001 typ host/);
});
test('rebuilt SDP contains only template lines and well-formed candidate lines', () => {
  const sdp = sdpWith(['a=candidate:1 1 udp 2113937151 10.0.0.1 5000 typ host', 'a=candidate:2 1 udp 1 198.51.100.9 6000 typ relay raddr 1.1.1.1 rport 1',
    'a=candidate:3 1 tcp 5 10.0.0.1 9 typ host tcptype active']);
  const r = VybeRTC.decodeCode(VybeRTC.encodeCode('answer', sdp, ROOM, SENDER), 'answer');
  const allowed = [/^v=0$/, /^o=- \d+ 2 IN IP4 127\.0\.0\.1$/, /^s=-$/, /^t=0 0$/, /^a=group:BUNDLE 0$/, /^a=msid-semantic: WMS$/,
    /^m=application 9 UDP\/DTLS\/SCTP webrtc-datachannel$/, /^c=IN IP4 0\.0\.0\.0$/, /^a=ice-ufrag:[A-Za-z0-9+\/]+$/, /^a=ice-pwd:[A-Za-z0-9+\/]+$/,
    /^a=fingerprint:sha-256 ([0-9A-F]{2}:){31}[0-9A-F]{2}$/, /^a=setup:(active|actpass)$/, /^a=mid:0$/, /^a=sctp-port:5000$/, /^a=max-message-size:262144$/,
    /^a=end-of-candidates$/, /^a=candidate:\d+ 1 (udp|tcp) \d+ [0-9A-Za-z:.\-]+ \d+ typ (host|srflx|relay)( raddr [0-9.:]+ rport 0)?( tcptype (active|passive|so))?$/];
  const lines = r.sdp.split('\r\n').filter((l) => l !== '');
  lines.forEach((l) => assert.ok(allowed.some((re) => re.test(l)), 'unexpected SDP line: ' + l));
  assert.ok(r.sdp.endsWith('\r\n'));
});

console.log('\nHostile / malformed codes');
const mk = (mut) => {
  const fp = VybeRTC.compactSdp(REAL_SDP).fp;
  const a = [3, 'o', 'AbCd', '0123456789abcdefghijKLMN', fp, ['h|10.0.0.1|5000|zz'], ROOM.id, ROOM.name, '11111111', 'x'];
  mut(a);
  return 'VYBE3:' + Buffer.from(JSON.stringify(a)).toString('base64url');
};
test('valid baseline passes', () => assert.ok(VybeRTC.decodeCode(mk(() => {}), 'offer').ok));
[
  ['port 0', (a) => { a[5] = ['h|10.0.0.1|0|zz']; }],
  ['port 70000', (a) => { a[5] = ['h|10.0.0.1|70000|zz']; }],
  ['IPv4 octet 999', (a) => { a[5] = ['h|999.1.1.1|5000|zz']; }],
  ['hostname that is not .local', (a) => { a[5] = ['h|evil.example.com|5000|zz']; }],
  ['IPv6 with spaces', (a) => { a[5] = ['h|2001:db8::1 x|5000|zz']; }],
  ['priority 0', (a) => { a[5] = ['h|10.0.0.1|5000|0']; }],
  ['priority too large', (a) => { a[5] = ['h|10.0.0.1|5000|zzzzzzz']; }],
  ['bad tcp type letter', (a) => { a[5] = ['h|10.0.0.1|5000|zz|x']; }],
  ['6 fields', (a) => { a[5] = ['h|10.0.0.1|5000|zz|a|b']; }],
  ['candidate is not a string', (a) => { a[5] = [{ x: 1 }]; }],
  ['9 candidates (too many)', (a) => { a[5] = Array(9).fill('h|10.0.0.1|5000|zz'); }],
  ['candidates not an array', (a) => { a[5] = 'h|10.0.0.1|5000|zz'; }],
  ['CRLF in ufrag', (a) => { a[2] = 'ab\r\nm=video'; }],
  ['CRLF in password', (a) => { a[3] = '0123456789abcdefghijk\r\nx'; }],
  ['short password', (a) => { a[3] = 'short'; }],
  ['fingerprint too short', (a) => { a[4] = a[4].slice(0, 20); }],
  ['fingerprint with colon injection', (a) => { a[4] = a[4].slice(0, 40) + '\r\na=x'; }],
  ['room id is not a string', (a) => { a[6] = { x: 1 }; }],
  ['room name too long', (a) => { a[7] = 'x'.repeat(500); }],
  ['sender short id wrong length', (a) => { a[8] = '123'; }],
  ['extra array item', (a) => { a.push('extra'); }],
  ['wrong version number', (a) => { a[0] = 2; }]
].forEach(([name, mut]) => test('rejected: ' + name, () => assert.ok(!VybeRTC.decodeCode(mk(mut), 'offer').ok)));
test('JSON that is not an array is rejected', () => assert.ok(!VybeRTC.decodeCode('VYBE3:' + Buffer.from('{"a":1}').toString('base64url'), 'offer').ok));
test('prototype-pollution style JSON is harmless', () => {
  const r = VybeRTC.decodeCode('VYBE3:' + Buffer.from('[3,"o",{"__proto__":{"x":1}},"p","f",[],"r","n","s","t"]').toString('base64url'), 'offer');
  assert.ok(!r.ok); assert.strictEqual({}.x, undefined);
});

console.log('\nICE configuration (STUN / TURN)');
test('default config has STUN only and no TURN', () => {
  const r = VybeRTC.buildIceConfig(null);
  assert.strictEqual(r.turnCount, 0);
  assert.ok(r.config.iceServers[0].urls.every((u) => /^stun:/.test(u)));
  assert.strictEqual(r.config.iceTransportPolicy, undefined);
});
test('the shipped js/ice-config.js has NO active TURN entry and no fake credentials', () => {
  const cfg = require('../js/ice-config.js');
  assert.deepStrictEqual(cfg.turn, []);
  assert.strictEqual(cfg.forceRelay, false);
  assert.strictEqual(VybeRTC.hasTurn(), false);
});
test('placeholder TURN entries are ignored', () => {
  const r = VybeRTC.buildIceConfig({ turn: [{ urls: ['turn:YOUR_TURN_HOST:3478?transport=udp'], username: 'YOUR_TURN_USERNAME', credential: 'YOUR_TURN_CREDENTIAL' }] });
  assert.strictEqual(r.turnCount, 0);
  assert.ok(r.ignored.some((m) => /placeholder/.test(m)));
});
test('TURN entry without username/credential or with a bad URL is ignored', () => {
  const r = VybeRTC.buildIceConfig({ turn: [
    { urls: ['turn:relay.example.net:3478'], username: 'u' },
    { urls: ['turn:relay.example.net:3478'], credential: 'c' },
    { urls: ['javascript:alert(1)'], username: 'u', credential: 'c' },
    { urls: ['http://relay.example.net'], username: 'u', credential: 'c' },
    null, 'text'] });
  assert.strictEqual(r.turnCount, 0);
  assert.strictEqual(r.ignored.length, 6);
});
test('a complete TURN entry is accepted and passed to the browser', () => {
  const r = VybeRTC.buildIceConfig({ turn: [{ urls: ['turn:relay.example.net:3478?transport=udp', 'turns:relay.example.net:443?transport=tcp'], username: 'user1', credential: 'secret1' }] });
  assert.strictEqual(r.turnCount, 1);
  const t = r.config.iceServers.find((s) => s.username);
  assert.deepStrictEqual(t.urls, ['turn:relay.example.net:3478?transport=udp', 'turns:relay.example.net:443?transport=tcp']);
  assert.strictEqual(t.credential, 'secret1');
});
test('forceRelay works only when a valid TURN server exists', () => {
  assert.strictEqual(VybeRTC.buildIceConfig({ forceRelay: true }).config.iceTransportPolicy, undefined);
  const ok = VybeRTC.buildIceConfig({ forceRelay: true, turn: [{ urls: 'turn:relay.example.net:3478', username: 'u', credential: 'c' }] });
  assert.strictEqual(ok.config.iceTransportPolicy, 'relay');
});
test('STUN URLs that are not stun: are dropped', () => {
  const r = VybeRTC.buildIceConfig({ stun: ['stun:ok.example.net:3478', 'turn:x', 'javascript:1', 5] });
  assert.deepStrictEqual(r.config.iceServers[0].urls, ['stun:ok.example.net:3478']);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
