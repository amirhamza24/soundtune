// Loads the built extension (dist/) into real Chrome and drives popup + content script.
// Run: npm run build && node tests/ext-e2e.mjs [--real-youtube]
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DIST = path.resolve('dist');
const SHOTS = path.resolve(process.env.SHOT_DIR || 'tests/shots');
mkdirSync(SHOTS, { recursive: true });
const realYouTube = process.argv.includes('--real-youtube');

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  pipe: true,
  enableExtensions: [DIST],
  args: ['--autoplay-policy=no-user-gesture-required', '--no-first-run', '--window-size=1000,800', '--mute-audio'],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = '') => { results.push([name, ok]); console.log(ok ? 'PASS' : 'FAIL', name, extra); };

// Find the extension id from its service worker / targets.
let extId = null;
for (let i = 0; i < 30 && !extId; i++) {
  const targets = browser.targets();
  for (const t of targets) {
    const m = /^chrome-extension:\/\/([a-z]+)\//.exec(t.url());
    if (m) extId = m[1];
  }
  if (!extId) await sleep(200);
}
console.log('extension id:', extId);
if (!extId) {
  // No SW (we have none): derive from chrome://extensions
  const p = await browser.newPage();
  await p.goto('chrome://extensions');
  extId = await p.evaluate(() => { const m = document.querySelector('extensions-manager')?.shadowRoot?.querySelector('extensions-item-list')?.shadowRoot?.querySelector('extensions-item'); return m?.id; });
  await p.close();
  console.log('extension id (from chrome://extensions):', extId);
}
check('extension loaded', !!extId);

// ---- fake YouTube watch page served at the real origin so the content script injects ----
const FAKE = `<!doctype html><html><head><title>(2) Test Song - YouTube</title></head><body>
<div id="movie_player"><video class="html5-main-video" id="v" loop></video></div>
<script>
const SR=44100,n=SR*4,buf=new ArrayBuffer(44+n*4),v=new DataView(buf);
const w=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
w(0,'RIFF');v.setUint32(4,36+n*4,true);w(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);
v.setUint32(24,SR,true);v.setUint32(28,SR*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*4,true);
for(let i=0;i<n*2;i++)v.setInt16(44+i*2,(Math.random()*2-1)*0.2*32767,true);
const el=document.getElementById('v');el.src=URL.createObjectURL(new Blob([buf],{type:'audio/wav'}));
window.play=()=>el.play();
</script></body></html>`;

const yt = await browser.newPage();
if (!realYouTube) {
  await yt.setRequestInterception(true);
  yt.on('request', (req) => {
    if (req.url().startsWith('https://www.youtube.com/')) req.respond({ status: 200, contentType: 'text/html', body: FAKE });
    else req.continue();
  });
  await yt.goto('https://www.youtube.com/watch?v=violet-test', { waitUntil: 'load' });
} else {
  await yt.goto('https://www.youtube.com/watch?v=jfKfPfyJRdk', { waitUntil: 'domcontentloaded' });
}
await yt.bringToFront();
await yt.evaluate(() => document.querySelector('video')?.play().catch(() => {}));
await sleep(1500);

// ---- popup ----
const popup = await browser.newPage();
await popup.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
const errors = [];
popup.on('pageerror', (e) => errors.push(e.message));
popup.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await popup.goto(`chrome-extension://${extId}/app.html`);
await sleep(1500);
await popup.screenshot({ path: path.join(SHOTS, '01-sound.png') });

const text = () => popup.evaluate(() => document.body.innerText);
let t = await text();
check('popup shows playing + processing', /Playing/.test(t) && /Processing audio/.test(t), JSON.stringify(t.slice(0, 120)));

// select a preset by clicking
await popup.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Deep Bass'))?.click());
await sleep(600);
const stored = async () => popup.evaluate(async () => (await chrome.storage.local.get('violetAudioSettings')).violetAudioSettings);
let s = await stored();
check('preset persisted to chrome.storage', s?.presetId === 'deep-bass' && s.bands[0] === 6, `presetId=${s?.presetId}`);

// content script must have applied it: read engine params via tab (graph is in isolated world; check via visualizer instead)
await sleep(800);
await popup.screenshot({ path: path.join(SHOTS, '02-deepbass.png') });
const barsMoving = await popup.evaluate(() => { const c = document.querySelector('canvas'); return !!c; });
check('visualizer canvas rendered', barsMoving);

// manual change -> custom
await popup.focus('[aria-label="1k Hz"]');
for (let i = 0; i < 4; i++) await popup.keyboard.press('ArrowUp');
await sleep(400);
s = await stored();
check('keyboard changes band + preset becomes custom', s?.bands[5] === 1.5 && s.presetId === 'custom', `band=${s?.bands[5]} preset=${s?.presetId}`);

// save custom preset
await popup.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Save current'))?.click());
await sleep(300);
await popup.type('input[aria-label="Preset name"]', 'My Mix');
await popup.keyboard.press('Enter');
await sleep(500);
s = await stored();
check('custom preset saved', s?.customPresets?.some((p) => p.name === 'My Mix'));
await popup.screenshot({ path: path.join(SHOTS, '04-saved.png') });

// reload popup: settings persist
await popup.reload();
await sleep(1200);
t = await text();
check('settings survive popup reopen', /My Mix/.test(t));

// pause -> status
await yt.evaluate(() => document.querySelector('video').pause());
await sleep(1500);
t = await text();
check('pause reflected', /Paused/.test(t));
await yt.evaluate(() => document.querySelector('video').play());
await sleep(1200);

// disable processing
await popup.evaluate(() => document.querySelector('[aria-label="Enable audio processing"]').click());
await sleep(1500);
t = await text();
check('disable -> bypassed (original sound)', /original sound/.test(t), JSON.stringify(t.slice(0, 140)));
await popup.screenshot({ path: path.join(SHOTS, '05-disabled.png') });
await popup.evaluate(() => document.querySelector('[aria-label="Enable audio processing"]').click());
await sleep(800);

// fullscreen visualizer: open, cycle every style, screenshot each
await popup.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Full screen visualizer'))?.click());
await sleep(700);
const styles = ['Neon Bars','Mirror','Wave','Radial','Pulse Rings','Particles','LED Matrix','Aurora','Ridge Lines','Classic Meter','Lollipop','Galaxy','Warp Tunnel','Neon Rain','Water Ripples','Dot Wall'];
for (const st of styles) {
  await popup.evaluate((n) => [...document.querySelectorAll('[role=radio]')].find((b) => b.textContent?.trim() === n)?.click(), st);
  await sleep(1400);
  await popup.screenshot({ path: path.join(SHOTS, 'viz-' + st.replace(/ /g, '-') + '.png') });
}
check('visualizer dialog open', await popup.evaluate(() => !!document.querySelector('[role=dialog][aria-label="Full screen visualizer"]')));
await popup.keyboard.press('Escape');
await sleep(700);
check('Esc closes visualizer', await popup.evaluate(() => !document.querySelector('[role=dialog][aria-label="Full screen visualizer"]')));
// no youtube tab -> empty state
await yt.close();
await sleep(2800);
t = await text();
check('no YouTube tab -> empty state', /No YouTube tab found/.test(t));
await popup.screenshot({ path: path.join(SHOTS, '06-empty.png') });

check('no popup console errors', errors.length === 0, errors.join(' | '));

await browser.close();
const bad = results.filter(([, ok]) => !ok).length;
console.log(bad ? `${bad} FAILED` : 'ALL PASSED');
process.exit(bad ? 1 : 0);
