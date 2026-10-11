// Smoke test against the real youtube.com (needs network). Reports what the popup shows.
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const DIST = path.resolve('dist');
const url = process.argv[2] || 'https://www.youtube.com/watch?v=jfKfPfyJRdk';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false, pipe: true, enableExtensions: [DIST],
  args: ['--autoplay-policy=no-user-gesture-required', '--no-first-run', '--window-size=1100,800', '--mute-audio'],
});
const probe = await browser.newPage();
await probe.goto('chrome://extensions');
const extId = await probe.evaluate(() => document.querySelector('extensions-manager')?.shadowRoot?.querySelector('extensions-item-list')?.shadowRoot?.querySelector('extensions-item')?.id);
await probe.close();

const yt = await browser.newPage();
const logs = [];
yt.on('console', (m) => { if (/Violet/.test(m.text())) logs.push(m.text()); });
await yt.goto(url, { waitUntil: 'domcontentloaded' });
await sleep(6000);
console.log('page title:', await yt.title());
await yt.evaluate(() => { const v = document.querySelector('video'); v?.play().catch(() => {}); });
await sleep(4000);
console.log('video state:', await yt.evaluate(() => { const v = document.querySelector('video'); return v ? { paused: v.paused, t: v.currentTime, src: v.currentSrc.slice(0, 30), ready: v.readyState } : null; }));

const popup = await browser.newPage();
await popup.setViewport({ width: 400, height: 600, deviceScaleFactor: 2 });
await popup.goto(`chrome-extension://${extId}/popup.html`);
await sleep(2500);
console.log('popup text:', JSON.stringify((await popup.evaluate(() => document.body.innerText)).slice(0, 220)));
await popup.screenshot({ path: 'tests/shots/real-youtube.png' });

// SPA navigation: click another video from the sidebar if present, then re-read status
const next = await yt.evaluate(() => { const a = document.querySelector('ytd-compact-video-renderer a#thumbnail, a.yt-lockup-view-model-wiz__content-image'); if (a) { a.click(); return a.href; } return null; });
console.log('navigated to:', next);
await sleep(7000);
await yt.evaluate(() => document.querySelector('video')?.play().catch(() => {}));
await sleep(2000);
await popup.reload();
await sleep(2500);
console.log('popup text after nav:', JSON.stringify((await popup.evaluate(() => document.body.innerText)).slice(0, 220)));
console.log('content logs:', logs);
await browser.close();
