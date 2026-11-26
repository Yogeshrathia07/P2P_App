/* TURN relay test (OPTIONAL). Proves that VYBE really connects THROUGH a TURN relay and that
   relay candidates survive the compact invite code.

   It starts a small TURN server on this computer (npm package "node-turn", test-only),
   gives VYBE test credentials for it, and forces "relay only" so a direct connection is impossible.

   Needs:   npm i -D playwright node-turn      (and "npx playwright install chromium")
   Run:     node tests/e2e-turn-relay.js

   IMPORTANT: this uses a LOCAL test relay. It is NOT a test of your real TURN provider and NOT a test
   across the internet. After you add your real credentials, repeat the check on two real devices. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PUBLIC = 'https://karunachawla000.github.io/VYBE/VYBE/';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const results = [];
function check(name, ok, extra) { results.push([name, !!ok]); console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (extra ? '  [' + extra + ']' : '')); }

function localIp() {
  const nets = os.networkInterfaces();
  for (const k of Object.keys(nets)) for (const n of nets[k]) if (n.family === 'IPv4' && !n.internal) return n.address;
  return '127.0.0.1';
}

async function serve(ctx, iceConfigJs) {
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route('https://karunachawla000.github.io/**', async (route) => {
    const u = new URL(route.request().url());
    const prefix = '/VYBE/VYBE/';
    let rel = u.pathname.slice(prefix.length) || 'index.html';
    if (rel === 'js/ice-config.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: iceConfigJs });
    const file = path.join(ROOT, rel);
    if (!u.pathname.startsWith(prefix) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'no' });
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
}

const cfgJs = (ip, user, pass) => 'var VYBE_ICE_CONFIG = ' + JSON.stringify({
  stun: [], turn: [{ urls: ['turn:' + ip + ':3478?transport=udp'], username: user, credential: pass }], forceRelay: true
}) + ';';

(async () => {
  const ip = localIp();
  const Turn = require('node-turn');
  const server = new Turn({ authMech: 'long-term', credentials: { vybeuser: 'vybepass' }, listeningIps: [ip], listeningPort: 3478, debugLevel: 'OFF' });
  server.start();
  console.log('local test TURN server on ' + ip + ':3478');

  const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const mk = async (js) => { const c = await browser.newContext(); await serve(c, js); return c; };

  /* ---------- 1. correct credentials, relay only ---------- */
  console.log('\nRelay-only connection with valid TURN credentials');
  const good = cfgJs(ip, 'vybeuser', 'vybepass');
  const A = await (await mk(good)).newPage(), B = await (await mk(good)).newPage();
  const errors = []; [A, B].forEach((p) => p.on('pageerror', (e) => errors.push(e.message)));
  await A.goto(PUBLIC + '#/dashboard'); await B.goto(PUBLIC + '#/dashboard');
  check('app reports a relay is configured', await A.evaluate(() => VybeRTC.hasTurn() === true && VybeRTC.isRelayOnly() === true));
  check('browser is given the TURN server and relay-only policy', await A.evaluate(() => { const c = VybeRTC.RTC_CONFIG; return c.iceTransportPolicy === 'relay' && c.iceServers.some((s) => s.username === 'vybeuser'); }));
  await A.click('#btnDashCreate'); await A.fill('#roomNameInput', 'Relay room'); await A.click('#btnGenerateOffer');
  await A.waitForSelector('#offerBox:not([hidden])', { timeout: 30000 });
  const offer = await A.inputValue('#offerCode');
  const decoded = await A.evaluate((o) => { const r = VybeRTC.decodeCode(o, 'offer'); return { ok: r.ok, sdp: r.sdp }; }, offer);
  const relayInCode = (decoded.sdp.match(/typ relay/g) || []).length;
  check('invite code CONTAINS relay candidates (not dropped by the compact format)', decoded.ok && relayInCode >= 1, relayInCode + ' relay candidate(s) in code');
  check('invite with relay candidates is still a practical size', offer.length < 700, offer.length + ' chars');
  check('no relay problem is shown to the user', !(await A.textContent('#offerMeta')).includes('relay server'));
  await B.goto(offer);
  await B.waitForSelector('#answerBox:not([hidden])', { timeout: 30000 });
  const answer = await B.inputValue('#answerCode');
  const decodedAns = await B.evaluate((o) => VybeRTC.decodeCode(o, 'answer').sdp, answer);
  check('reply code CONTAINS relay candidates too', /typ relay/.test(decodedAns));
  await A.fill('#answerInput', answer); await A.dispatchEvent('#answerInput', 'paste');
  await A.waitForSelector('#view-room:not([hidden])', { timeout: 40000 });
  await B.waitForSelector('#view-room:not([hidden])', { timeout: 40000 });
  check('both devices connected THROUGH the relay (only path allowed)', (await A.textContent('#view-room .pill-text')) === 'Connected');
  await A.waitForTimeout(1500);
  const routeA = await A.textContent('#infoPath'), routeB = await B.textContent('#infoPath');
  console.log('        route A: ' + routeA + '\n        route B: ' + routeB);
  check('info panel says the connection is relayed (TURN)', /relay/i.test(routeA) && /relay/i.test(routeB));
  await A.fill('#messageInput', 'hello over relay'); await A.press('#messageInput', 'Enter');
  await B.waitForFunction(() => [...document.querySelectorAll('.bubble')].some((b) => b.textContent === 'hello over relay'));
  await B.fill('#messageInput', 'reply over relay'); await B.press('#messageInput', 'Enter');
  await A.waitForFunction(() => [...document.querySelectorAll('.bubble')].some((b) => b.textContent === 'reply over relay'));
  check('chat works in both directions over the relay', true);

  /* ---------- 2. wrong credentials ---------- */
  console.log('\nWrong TURN credentials give a clear message');
  const bad = cfgJs(ip, 'vybeuser', 'WRONG-PASSWORD');
  const C = await (await mk(bad)).newPage();
  C.on('pageerror', (e) => errors.push(e.message));
  await C.goto(PUBLIC + '#/dashboard'); await C.click('#btnDashCreate'); await C.fill('#roomNameInput', 'Bad creds'); await C.click('#btnGenerateOffer');
  await C.waitForFunction(() => !document.getElementById('createError').hidden, null, { timeout: 30000 });
  const msg = await C.textContent('#createError');
  console.log('        message: ' + msg);
  check('refused login is explained (TURN username/credential)', /relay server refused the login|credential/i.test(msg));
  check('no invite was created from a relay that cannot work', await C.$eval('#offerBox', (e) => e.hidden));
  check('"Create invite" button is usable again', await C.isEnabled('#btnGenerateOffer'));

  await browser.close();
  server.stop && server.stop();
  const passed = results.filter((r) => r[1]).length;
  console.log('\n' + passed + '/' + results.length + ' checks passed');
  if (errors.length) console.log('Page errors:', errors);
  process.exit(results.every((r) => r[1]) && !errors.length ? 0 : 1);
})().catch((e) => { console.error('TEST CRASHED', e); process.exit(2); });
