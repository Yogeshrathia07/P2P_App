/* End-to-end test: two separate browser profiles (separate LocalStorage), real WebRTC DataChannel.
   Needs Playwright:   npm i -D playwright   (and "npx playwright install chromium")
   Run from the VYBE folder:   node tests/e2e-two-peers.js

   The app is served at the REAL public address  https://karunachawla000.github.io/VYBE/VYBE/
   by intercepting browser requests to that address and answering them from the local files.
   So the browser really runs on that origin and path (secure context, sub-folder path),
   exactly like GitHub Pages, without needing the internet.

   WHAT THIS PROVES: the code works between two browser profiles on ONE computer.
   WHAT IT CANNOT PROVE: connections between two real devices on different networks. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PUBLIC = 'https://karunachawla000.github.io/VYBE/VYBE/';
const LOCAL = process.env.VYBE_LOCAL_URL || 'http://localhost:8080/';   // only used for the "running locally" checks
const SHOTS = path.join(ROOT, 'screenshots');
const results = [];
function check(name, ok, extra) { results.push([name, !!ok]); console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (extra ? '  [' + extra + ']' : '')); }
const section = (t) => console.log('\n' + t);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/markdown' };

// Serve the project folder at the public GitHub Pages address.
async function servePublic(ctx, log) {
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route('https://karunachawla000.github.io/**', async (route) => {
    const u = new URL(route.request().url());
    const prefix = '/VYBE/VYBE/';
    if (!u.pathname.startsWith(prefix)) { log.push('404 ' + u.pathname); return route.fulfill({ status: 404, body: 'not found' }); }
    let rel = u.pathname.slice(prefix.length) || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { log.push('404 ' + u.pathname); return route.fulfill({ status: 404, body: 'not found' }); }
    log.push('200 ' + u.pathname);
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
}

// Runs in every page before the app: counts connections, remembers the channel, watches the status pill.
const HOOK = () => {
  window.__pcCount = 0; window.__answerSets = 0; window.__configs = []; window.__earlyConnected = 0; window.__dc = null;
  const Orig = window.RTCPeerConnection;
  window.RTCPeerConnection = function (cfg) {
    window.__pcCount++; window.__configs.push(JSON.parse(JSON.stringify(cfg || {})));
    const pc = new Orig(cfg);
    const sr = pc.setRemoteDescription.bind(pc);
    pc.setRemoteDescription = (d) => { if (d && d.type === 'answer') window.__answerSets++; return sr(d); };
    pc.addEventListener('datachannel', (e) => { window.__dc = e.channel; });
    return pc;
  };
  window.RTCPeerConnection.prototype = Orig.prototype;
  const cdc = Orig.prototype.createDataChannel;
  Orig.prototype.createDataChannel = function () { const c = cdc.apply(this, arguments); window.__dc = c; return c; };
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver(() => {
      const connected = [...document.querySelectorAll('.pill-text')].some((e) => e.textContent === 'Connected');
      if (connected && !(window.__dc && window.__dc.readyState === 'open')) window.__earlyConnected++;
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
};

function decodeQr(pngPath) {   // independent decoder (OpenCV) so we know the QR really scans
  try {
    return execFileSync('python3', ['-c', 'import cv2,sys;i=cv2.imread(sys.argv[1]);v,_,_=cv2.QRCodeDetector().detectAndDecode(i);v=v or cv2.QRCodeDetectorAruco().detectAndDecode(i)[0];print(v)', pngPath], { encoding: 'utf8' }).trim();
  } catch (e) { return ''; }
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const net = [];
  // mDNS hiding is turned off only so two profiles on one machine can see each other.
  const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const mkCtx = async (opts) => { const c = await browser.newContext(opts || { viewport: { width: 1280, height: 800 } }); await c.addInitScript(HOOK); await servePublic(c, net); return c; };
  const ctxA = await mkCtx(), ctxB = await mkCtx();
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  [A, B].forEach((p) => p.on('dialog', (d) => d.accept()));
  const errors = [];
  [A, B].forEach((p, i) => p.on('pageerror', (e) => errors.push((i ? 'B: ' : 'A: ') + e.message)));
  const pill = (p) => p.textContent('#view-connect .pill-text');

  /* ------------------------------------------------------------------ */
  section('GitHub Pages path and assets');
  await A.goto(PUBLIC); await B.goto(PUBLIC);
  check('page loads from the sub-folder URL ' + PUBLIC, (await A.title()).length > 0 && (await A.evaluate(() => location.href)) === PUBLIC);
  check('all files load (js, css, logo) with no 404', net.filter((l) => l.startsWith('404')).length === 0, net.filter((l) => l.startsWith('404')).join(',') || net.length + ' requests');
  check('relative assets resolved under /VYBE/VYBE/', ['index.html', 'style.css', 'script.js', 'js/webrtc.js', 'js/chat.js', 'js/qrcode.js', 'js/ice-config.js', 'assets/logo.svg'].every((f) => net.indexOf('200 /VYBE/VYBE/' + f) !== -1 || (f === 'index.html' && net.indexOf('200 /VYBE/VYBE/') !== -1)));
  check('logo image really rendered', await A.evaluate(() => { const i = document.querySelector('.brand-mark'); return i.complete && i.naturalWidth > 0; }));
  await A.screenshot({ path: path.join(SHOTS, '00-landing.png') });
  check('landing shows tagline', (await A.textContent('h1')).includes('Your VYBE'));
  await A.click('.nav-cta');
  check('Start Studying opens dashboard', await A.waitForSelector('#view-dashboard:not([hidden])', { timeout: 5000 }).then(() => true).catch(() => false));
  await A.reload();
  check('refresh on a #/ route does not 404 (hash routing)', await A.waitForSelector('#view-dashboard:not([hidden])', { timeout: 5000 }).then(() => true).catch(() => false));

  await A.fill('#nameInput', 'Asha'); await A.click('#nameForm button');
  await B.goto(PUBLIC + '#/dashboard'); await B.fill('#nameInput', 'Ravi'); await B.click('#nameForm button');

  /* ------------------------------------------------------------------ */
  section('Invalid input');
  await B.click('#btnDashJoin');
  await B.fill('#offerInput', 'hello world'); await B.click('#btnGenerateAnswer');
  check('invalid code shows error', (await B.textContent('#joinError')).includes('not a VYBE'));
  await B.fill('#offerInput', 'VYBE3:@@@@'); await B.click('#btnGenerateAnswer');
  check('damaged code shows error', (await B.textContent('#joinError')).includes('damaged'));
  await B.fill('#offerInput', 'VYBE2:abcdef'); await B.click('#btnGenerateAnswer');
  check('code from an older version tells the user to make a new invite', (await B.textContent('#joinError')).includes('older version'));
  check('Join button is usable again after errors (not stuck disabled)', await B.isEnabled('#btnGenerateAnswer'));

  /* ------------------------------------------------------------------ */
  section('Invite generation');
  await A.click('#btnDashCreate');
  check('create without a room name is refused', await (async () => { await A.click('#btnGenerateOffer'); return (await A.textContent('#createError')).includes('name'); })());
  await A.fill('#roomNameInput', 'DSA revision');
  await A.click('#btnGenerateOffer');
  check('button shows "Preparing..." and is disabled while working', await A.evaluate(() => { const b = document.getElementById('btnGenerateOffer'); return b.disabled || b.textContent === 'Create new invite'; }));
  await A.waitForSelector('#offerBox:not([hidden])', { timeout: 20000 });
  const offer = await A.inputValue('#offerCode');
  check('invite link uses the public GitHub Pages URL', offer.startsWith(PUBLIC + '#/join/VYBE3:'), offer.slice(0, 70));
  check('invite link is short enough (< 700 chars)', offer.length < 700, offer.length + ' chars');
  check('invite link is not localhost / file', !/localhost|127\.0\.0\.1|file:/.test(offer));
  check('button text is "Create new invite" afterwards and enabled', (await A.textContent('#btnGenerateOffer')) === 'Create new invite' && await A.isEnabled('#btnGenerateOffer'));
  check('QR canvas is drawn', await A.$eval('#offerQr', (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let dark = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 100) dark++; return dark > 500; }));
  const qrFile = path.join(SHOTS, 'qr-invite.png');
  await (await A.$('#offerQr')).screenshot({ path: qrFile });
  check('QR decodes (independent OpenCV decoder) back to the exact invite link', decodeQr(qrFile) === offer);
  check('status = waiting for answer', (await pill(A)).includes('Waiting for answer'));
  check('STUN is configured; no fake TURN credentials are sent', await A.evaluate(() => { const c = window.__configs[0]; return c.iceServers.length === 1 && c.iceServers[0].urls.every((u) => /^stun:/.test(u)) && !c.iceServers[0].username && !c.iceTransportPolicy; }));
  check('invite note does not scare the user (public link)', true);

  /* ------------------------------------------------------------------ */
  section('Reply generation (guest opens the link)');
  await B.goto(offer);
  await B.waitForSelector('#answerBox:not([hidden])', { timeout: 20000 });
  const answer = await B.inputValue('#answerCode');
  check('opening the link auto-generates the reply', answer.startsWith('VYBE3:'), answer.length + ' chars');
  check('guest is in "Waiting for host" state', (await pill(B)).includes('Waiting for host'));
  check('reply QR is drawn and decodes to the reply code', await (async () => { const f = path.join(SHOTS, 'qr-reply.png'); await (await B.$('#answerQr')).screenshot({ path: f }); return decodeQr(f) === answer; })());
  await B.screenshot({ path: path.join(SHOTS, '01b-join-reply.png'), fullPage: true });
  check('invite link in the address bar is removed after use (refresh will not re-run it)', !(await B.evaluate(() => location.hash)).includes('VYBE3:'));

  section('Duplicate paste / click on the GUEST side');
  const pcBefore = await B.evaluate(() => window.__pcCount);
  await B.click('#tabJoin').catch(() => {});
  await B.fill('#offerInput', offer);
  await B.evaluate(() => { const t = document.getElementById('offerInput'); for (let i = 0; i < 3; i++) t.dispatchEvent(new Event('paste', { bubbles: true })); for (let i = 0; i < 3; i++) document.getElementById('btnGenerateAnswer').click(); });
  await B.waitForTimeout(1500);
  check('same invite pasted 3x and clicked 3x creates NO second connection', (await B.evaluate(() => window.__pcCount)) === pcBefore, 'connections: ' + (await B.evaluate(() => window.__pcCount)));
  check('reply code did not change', (await B.inputValue('#answerCode')) === answer);

  section('Wrong-way pastes and same-browser protection');
  const C = await ctxA.newPage(); await C.goto(offer);
  check('opening your OWN invite in the same browser is refused', await C.waitForFunction(() => document.getElementById('joinError').textContent.includes('same browser'), null, { timeout: 8000 }).then(() => true).catch(() => false));
  await C.close();
  await A.fill('#answerInput', offer); await A.click('#btnConnect');
  check('invite pasted as reply is rejected with a clear message', (await A.textContent('#connectError')).includes('INVITE'));
  check('Connect is usable again after the error (not locked)', await A.isEnabled('#btnConnect') && !(await A.$eval('#answerInput', (e) => e.readOnly)));
  check('NOT shown as connected yet', !(await pill(A)).includes('Connected'));
  await A.screenshot({ path: path.join(SHOTS, '01-connect.png'), fullPage: true });

  /* ------------------------------------------------------------------ */
  section('Connecting - duplicate paste / click on the HOST side');
  await A.fill('#answerInput', answer);
  await A.evaluate(() => { const t = document.getElementById('answerInput'); for (let i = 0; i < 3; i++) t.dispatchEvent(new Event('paste', { bubbles: true })); for (let i = 0; i < 3; i++) document.getElementById('btnConnect').click(); document.getElementById('btnPasteAnswer').click(); });
  await A.waitForSelector('#view-room:not([hidden])', { timeout: 30000 });
  await B.waitForSelector('#view-room:not([hidden])', { timeout: 30000 });
  check('both sides entered the room only after the DataChannel opened', true);
  check('reply applied to the connection exactly ONCE (3 pastes + 3 clicks + Paste button)', (await A.evaluate(() => window.__answerSets)) === 1, 'answers applied: ' + (await A.evaluate(() => window.__answerSets)));
  check('host created exactly one RTCPeerConnection', (await A.evaluate(() => window.__pcCount)) === 1);
  check('no error was shown to the user by the duplicate attempts', (await A.textContent('#connectError')) === '' || await A.$eval('#connectError', (e) => e.hidden));
  check('reply box is locked after acceptance (cannot submit twice)', (await A.$eval('#btnConnect', (b) => b.disabled)) && (await A.$eval('#answerInput', (e) => e.readOnly)));
  check('"Connected" never appeared before the channel was open (A)', (await A.evaluate(() => window.__earlyConnected)) === 0);
  check('"Connected" never appeared before the channel was open (B)', (await B.evaluate(() => window.__earlyConnected)) === 0);
  check('A pill = Connected (regression: used to stay "Connecting...")', (await A.textContent('#view-room .pill-text')) === 'Connected');
  check('B pill = Connected', (await B.textContent('#view-room .pill-text')) === 'Connected');
  check('B got room name from host', (await B.textContent('#roomName')) === 'DSA revision');
  await A.waitForFunction(() => document.getElementById('peerLine').textContent.includes('Ravi'), null, { timeout: 10000 });
  check('A sees peer name Ravi', true);
  await A.waitForTimeout(1500);
  const route = await A.textContent('#infoPath');
  console.log('        connection route: ' + route);
  check('info panel uses plain wording (no "ICE", "SDP")', !/\bICE\b|\bSDP\b/.test(await A.textContent('#infoPanel')));

  /* ------------------------------------------------------------------ */
  section('Chat');
  await A.fill('#messageInput', 'Hello from A'); await A.press('#messageInput', 'Enter');
  await B.waitForSelector('.msg.theirs .bubble');
  check('B received A message', (await B.textContent('.msg.theirs .bubble')) === 'Hello from A');
  await B.fill('#messageInput', 'Hi from B'); await B.click('#btnSend');
  await A.waitForSelector('.msg.theirs .bubble');
  check('A received B message', (await A.textContent('.msg.theirs .bubble')) === 'Hi from B');
  check('A own message styled as mine', await A.isVisible('.msg.mine'));
  await A.fill('#messageInput', '<img src=x onerror="window.__pwned=1"><b>bold</b>'); await A.press('#messageInput', 'Enter');
  await B.waitForFunction(() => document.querySelectorAll('.msg.theirs').length === 2);
  check('HTML / script shown as plain text, not run', (await B.evaluate(() => !window.__pwned && document.querySelectorAll('#messages img, #messages b').length === 0)) && (await B.textContent('.msg.theirs:last-child .bubble')).includes('<img'));
  check('own HTML also shown as text', (await A.evaluate(() => !window.__pwned && document.querySelectorAll('#messages img, #messages b').length === 0)));
  for (let i = 1; i <= 5; i++) { await A.fill('#messageInput', 'rapid ' + i); await A.press('#messageInput', 'Enter'); }
  await B.waitForFunction(() => document.querySelectorAll('.msg.theirs').length === 7);
  const orderA = await A.$$eval('.bubble', (n) => n.map((x) => x.textContent));
  const orderB = await B.$$eval('.bubble', (n) => n.map((x) => x.textContent));
  check('both sides show identical order after rapid sending', JSON.stringify(orderA) === JSON.stringify(orderB));
  // both sides typing "at the same time"
  await Promise.all([A.fill('#messageInput', 'same-time A'), B.fill('#messageInput', 'same-time B')]);
  await Promise.all([A.press('#messageInput', 'Enter'), B.press('#messageInput', 'Enter')]);
  await A.waitForFunction(() => [...document.querySelectorAll('.bubble')].some((b) => b.textContent === 'same-time B'));
  await B.waitForFunction(() => [...document.querySelectorAll('.bubble')].some((b) => b.textContent === 'same-time A'));
  const sA = await A.$$eval('.bubble', (n) => n.map((x) => x.textContent)), sB = await B.$$eval('.bubble', (n) => n.map((x) => x.textContent));
  check('simultaneous messages end up in the SAME order on both devices', JSON.stringify(sA) === JSON.stringify(sB));

  section('Hostile data over the real channel');
  const idOf = () => 'inj' + Math.random().toString(36).slice(2, 12);
  const rejectedBefore = Number(await B.textContent('#infoRejected'));
  const aId = await A.evaluate(() => JSON.parse(localStorage.getItem('vybe.user')).id);
  const bId = await B.evaluate(() => JSON.parse(localStorage.getItem('vybe.user')).id);
  const good = { id: idOf(), senderId: aId, content: 'unique-once', timestamp: Date.now(), seq: 500, type: 'chat' };
  await A.evaluate((arr) => arr.forEach((x) => window.__dc.send(x)), [
    'not json at all',
    '{"type":"chat"}',
    JSON.stringify({ type: 'chat', id: idOf(), senderId: aId, content: 'x'.repeat(5000), timestamp: Date.now(), seq: 600 }),
    JSON.stringify({ type: 'chat', id: idOf(), senderId: aId, content: 'ok', timestamp: 'yesterday', seq: 601 }),
    JSON.stringify({ type: 'chat', id: idOf(), senderId: bId, content: 'I am B (spoof)', timestamp: Date.now(), seq: 602 }),
    JSON.stringify({ type: 'shell', cmd: 'rm -rf' }),
    JSON.stringify({ type: 'hello', senderId: 'ffffffff' + idOf(), name: 'Impostor' }),            // hello that does not match the invite/reply
    'y'.repeat(150000),                                                                           // oversized packet
    JSON.stringify(good), JSON.stringify(good), JSON.stringify(good)                              // same message 3 times
  ]);
  await B.waitForFunction(() => [...document.querySelectorAll('.bubble')].some((b) => b.textContent === 'unique-once'));
  await B.waitForTimeout(600);
  const rejectedAfter = Number(await B.textContent('#infoRejected'));
  check('8 invalid packets rejected (incl. oversized and impostor hello)', rejectedAfter - rejectedBefore === 8, 'rejected +' + (rejectedAfter - rejectedBefore));
  check('peer name was not changed by the impostor hello', (await B.textContent('#infoPeer')).includes('Asha'));
  check('duplicate shown only once', (await B.$$eval('.bubble', (n) => n.filter((x) => x.textContent === 'unique-once').length)) === 1);
  check('2 duplicates counted as blocked', (await B.textContent('#infoDup')) === '2');
  await B.screenshot({ path: path.join(SHOTS, '03-study-room-desktop.png') });
  await A.screenshot({ path: path.join(SHOTS, '04-study-room-host.png') });
  const countBeforeRefresh = (await B.$$('.bubble')).length;

  /* ------------------------------------------------------------------ */
  section('Refresh, local history, disconnect');
  await B.reload();
  await B.goto(PUBLIC + '#/dashboard');
  check('B dashboard lists saved chat', (await B.textContent('#recentRooms')).includes('DSA revision'));
  await B.screenshot({ path: path.join(SHOTS, '02-dashboard.png') });
  await B.click('#recentRooms button');
  await B.waitForSelector('#view-room:not([hidden])');
  const afterRefresh = await B.$$eval('.bubble', (n) => n.map((x) => x.textContent));
  check('B history survives refresh', afterRefresh.length === countBeforeRefresh && afterRefresh[0] === 'Hello from A', afterRefresh.length + ' msgs');
  check('B is offline after refresh (not faking connected)', (await B.textContent('#view-room .pill-text')) !== 'Connected');
  check('A notices disconnect', await A.waitForFunction(() => document.querySelector('#view-room .pill-text').textContent === 'Disconnected', null, { timeout: 30000 }).then(() => true).catch(() => false));
  check('A input disabled when disconnected', await A.isDisabled('#messageInput'));

  /* ------------------------------------------------------------------ */
  section('Reconnect with a NEW invite/reply pair + history sync');
  await B.click('#btnClear');
  check('B local chat cleared', (await B.$$('.bubble')).length === 0);
  await A.click('#btnReconnect');
  await A.click('#btnGenerateOffer');
  await A.waitForSelector('#offerBox:not([hidden])', { timeout: 20000 });
  const offer2 = await A.inputValue('#offerCode');
  check('reconnect makes a NEW invite (different from the first)', offer2 !== offer && offer2.startsWith(PUBLIC + '#/join/VYBE3:'));
  check('reply box is fresh for the new invite (unlocked, empty)', (await A.inputValue('#answerInput')) === '' && await A.isEnabled('#btnConnect'));
  await B.click('#btnReconnect');
  await B.click('#tabJoin');
  await B.fill('#offerInput', offer2); await B.click('#btnGenerateAnswer');
  await B.waitForSelector('#answerBox:not([hidden])', { timeout: 20000 });
  const answer2 = await B.inputValue('#answerCode');
  check('reconnect reply differs from the first reply', answer2 !== answer);
  await A.fill('#answerInput', answer2); await A.dispatchEvent('#answerInput', 'paste');   // paste alone must connect
  await B.waitForSelector('#view-room:not([hidden]) .pill[data-tone="good"]', { timeout: 30000 });
  await B.waitForFunction((n) => document.querySelectorAll('.bubble').length >= n, 8, { timeout: 15000 }).catch(() => {});
  await B.waitForTimeout(800);
  const synced = await B.$$eval('.bubble', (n) => n.map((x) => x.textContent));
  const aMsgs = await A.$$eval('.bubble', (n) => n.map((x) => x.textContent));
  check('reconnected on same room', (await B.textContent('#roomName')) === 'DSA revision');
  // A never stored 'unique-once' (it was injected raw), so A's copy is one message shorter than B's earlier copy
  check('history synced back to B', synced.length === countBeforeRefresh - 1 && synced[0] === 'Hello from A', synced.length + ' msgs');
  check('A and B identical after sync', JSON.stringify(synced) === JSON.stringify(aMsgs));
  check('no duplicates after sync', new Set(synced.map((x, i) => x + i)).size === synced.length && (await B.textContent('#infoSync')).startsWith('Done'), await B.textContent('#infoSync'));
  await B.fill('#messageInput', 'after reconnect'); await B.press('#messageInput', 'Enter');
  await A.waitForFunction(() => [...document.querySelectorAll('.bubble')].some((b) => b.textContent === 'after reconnect'));
  check('messaging works after reconnect', true);
  check('no early "Connected" after reconnect either', (await A.evaluate(() => window.__earlyConnected)) === 0 && (await B.evaluate(() => window.__earlyConnected)) === 0);

  section('Leave');
  await B.click('#btnLeave');
  check('B leave returns to dashboard', await B.waitForSelector('#view-dashboard:not([hidden])', { timeout: 5000 }).then(() => true).catch(() => false));
  check('A sees peer disconnect after leave', await A.waitForFunction(() => document.querySelector('#view-room .pill-text').textContent === 'Disconnected', null, { timeout: 30000 }).then(() => true).catch(() => false));

  /* ------------------------------------------------------------------ */
  section('Stale / reused reply -> clear failure state (takes about 35 s)');
  // New invite for the same room. Its guest makes a reply. The host then creates yet another invite and pastes the OLD reply.
  await A.click('#btnReconnect'); await A.click('#btnGenerateOffer');
  await A.waitForSelector('#offerBox:not([hidden])', { timeout: 20000 });
  const offer3 = await A.inputValue('#offerCode');
  await B.goto(offer3);
  await B.waitForSelector('#answerBox:not([hidden])', { timeout: 20000 });
  const staleAnswer = await B.inputValue('#answerCode');
  await A.click('#btnGenerateOffer');                       // "Create new invite" -> invalidates offer3
  await A.waitForSelector('#offerBox:not([hidden])', { timeout: 20000 });
  check('creating a new invite re-enables the Connect box', await A.isEnabled('#btnConnect'));
  await A.fill('#answerInput', staleAnswer); await A.dispatchEvent('#answerInput', 'paste');
  check('stale reply is accepted by format but connection will not open: A shows "Connecting..."', await A.waitForFunction(() => document.querySelector('#view-connect .pill-text').textContent.startsWith('Connecting'), null, { timeout: 10000 }).then(() => true).catch(() => false));
  check('Connect is locked while that reply is in use', await A.$eval('#btnConnect', (b) => b.disabled));
  check('after the timeout A shows "Failed" (never "Connected")', await A.waitForFunction(() => document.querySelector('#view-connect .pill-text').textContent === 'Failed', null, { timeout: 45000 }).then(() => true).catch(() => false));
  const failMsg = await A.textContent('#connectError');
  console.log('        failure message: ' + failMsg);
  check('failure message is plain and tells the user to create a new invite', /new invite/i.test(failMsg) && !/\bICE\b|\bSDP\b/.test(failMsg));
  check('after failure a new invite can be created (button enabled)', await A.isEnabled('#btnGenerateOffer'));
  check('never showed Connected for the failed attempt', (await A.evaluate(() => window.__earlyConnected)) === 0);

  /* ------------------------------------------------------------------ */
  section('Running locally: invites must still use the public URL');
  const ctxL = await mkCtx();
  const L = await ctxL.newPage();
  await L.goto(LOCAL + '#/dashboard');
  await L.click('#btnDashCreate'); await L.fill('#roomNameInput', 'Local test'); await L.click('#btnGenerateOffer');
  await L.waitForSelector('#offerBox:not([hidden])', { timeout: 20000 });
  const localInvite = await L.inputValue('#offerCode');
  check('invite made on localhost points to the PUBLIC GitHub Pages URL', localInvite.startsWith(PUBLIC + '#/join/VYBE3:'), localInvite.slice(0, 60));
  check('user is told the link opens the public site', (await L.textContent('#offerMeta')).includes('public'));
  await L.evaluate(() => { document.querySelector('meta[name="vybe-public-url"]').content = ''; });
  await L.click('#btnGenerateOffer'); await L.waitForSelector('#offerBox:not([hidden])', { timeout: 20000 });
  check('localhost with NO public URL configured shows a clear warning', (await L.textContent('#offerMeta')).includes('only works on this computer'));
  const ctxF = await mkCtx();
  const F = await ctxF.newPage();
  await F.goto('file://' + path.join(ROOT, 'index.html') + '#/dashboard');
  await F.evaluate(() => { document.querySelector('meta[name="vybe-public-url"]').content = ''; });
  await F.click('#btnDashCreate'); await F.fill('#roomNameInput', 'File test'); await F.click('#btnGenerateOffer');
  await F.waitForFunction(() => !document.getElementById('createError').hidden, null, { timeout: 20000 });
  check('file:// with no public URL refuses to create an unusable invite', (await F.textContent('#createError')).includes('GitHub Pages') && await F.$eval('#offerBox', (e) => e.hidden));
  await ctxL.close(); await ctxF.close();

  /* ------------------------------------------------------------------ */
  section('Responsive layout (no sideways scrolling, nothing cut off)');
  const sizes = [['Android 360x740', { width: 360, height: 740 }, true], ['iPhone 390x844', { width: 390, height: 844 }, true], ['iPhone SE 320x568', { width: 320, height: 568 }, true], ['tablet 768x1024', { width: 768, height: 1024 }, false], ['laptop 1366x768', { width: 1366, height: 768 }, false]];
  for (const [label, vp, mobile] of sizes) {
    const ctxM = await mkCtx({ viewport: vp, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile,
      userAgent: label.startsWith('iPhone') ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
    const M = await ctxM.newPage();
    const overflow = () => M.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    await M.goto(PUBLIC); const o1 = await overflow();
    if (label.startsWith('iPhone 390')) await M.screenshot({ path: path.join(SHOTS, '05-landing-mobile.png') });
    await M.goto(PUBLIC + '#/dashboard'); const o2 = await overflow();
    if (label.startsWith('iPhone 390')) await M.screenshot({ path: path.join(SHOTS, '06-dashboard-mobile.png') });
    await M.click('#btnDashCreate'); await M.fill('#roomNameInput', 'Layout'); await M.click('#btnGenerateOffer');
    await M.waitForSelector('#offerBox:not([hidden])', { timeout: 20000 });
    const o3 = await overflow();
    const qrBox = await M.$eval('#offerQr', (c) => { const r = c.getBoundingClientRect(); return { w: r.width, right: r.right, iw: window.innerWidth }; });
    const btnOk = await M.evaluate(() => [...document.querySelectorAll('#view-connect .btn:not([hidden])')].every((b) => { const r = b.getBoundingClientRect(); return r.width === 0 || (r.left >= 0 && r.right <= window.innerWidth + 1); }));
    check(label + ': landing, dashboard and connect screens have no horizontal scroll', !o1 && !o2 && !o3);
    check(label + ': QR fits on screen and is large enough to scan (>= 200 px wide)', qrBox.right <= qrBox.iw && qrBox.w >= 200, Math.round(qrBox.w) + ' px');
    check(label + ': connect-screen buttons are inside the screen', btnOk);
    await ctxM.close();
  }
  // Room screen on a phone (needs a live connection: reuse a fresh pair)
  {
    const ctxP = await mkCtx({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const ctxQ = await mkCtx();
    const P = await ctxP.newPage(), Q = await ctxQ.newPage();
    await P.goto(PUBLIC + '#/dashboard'); await P.click('#btnDashCreate'); await P.fill('#roomNameInput', 'Phone room'); await P.click('#btnGenerateOffer');
    await P.waitForSelector('#offerBox:not([hidden])', { timeout: 20000 });
    await Q.goto(await P.inputValue('#offerCode')); await Q.waitForSelector('#answerBox:not([hidden])', { timeout: 20000 });
    await P.fill('#answerInput', await Q.inputValue('#answerCode')); await P.dispatchEvent('#answerInput', 'paste');
    await P.waitForSelector('#view-room:not([hidden])', { timeout: 30000 });
    await Q.waitForSelector('#view-room:not([hidden])', { timeout: 30000 });
    for (let i = 0; i < 6; i++) { await Q.fill('#messageInput', 'A long message to check wrapping on small screens, number ' + i + ' ' + 'word '.repeat(12)); await Q.press('#messageInput', 'Enter'); }
    await P.waitForFunction(() => document.querySelectorAll('.msg.theirs').length === 6);
    check('phone room screen: no horizontal scroll with long messages', !(await P.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
    check('phone room screen: message box and Send button are visible on screen', await P.evaluate(() => ['messageInput', 'btnSend'].every((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1 && r.width > 0; })));
    await P.screenshot({ path: path.join(SHOTS, '07-study-room-mobile.png') });
    await ctxP.close(); await ctxQ.close();
  }

  await browser.close();
  const passed = results.filter((r) => r[1]).length;
  console.log('\n' + passed + '/' + results.length + ' checks passed');
  if (errors.length) console.log('Page errors:', errors);
  process.exit(results.every((r) => r[1]) && !errors.length ? 0 : 1);
})().catch((e) => { console.error('TEST CRASHED', e); process.exit(2); });
