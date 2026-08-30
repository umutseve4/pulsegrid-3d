import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const targetUrl = process.env.TARGET_URL;
if (!targetUrl) throw new Error('TARGET_URL is required.');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const processes = [];
const cleanup = () => { for (const child of processes) child.kill('SIGTERM'); };
function launch(command, args) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  processes.push(child);
  child.stdout.on('data', (data) => process.stdout.write(data));
  child.stderr.on('data', (data) => process.stderr.write(data));
  child.on('error', (error) => console.error(`DIAGNOSTIC: Chrome spawn error: ${error.message}`));
  child.on('exit', (code, signal) => console.error(`DIAGNOSTIC: Chrome exited code=${code} signal=${signal}`));
  return child;
}
async function waitFor(url, attempts = 60) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return response;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
}

const pageResponse = await waitFor(targetUrl);
assert(pageResponse.url === targetUrl, `hosted URL resolves without redirect (${targetUrl})`);
const profile = await mkdtemp(join(tmpdir(), 'pulsegrid-hosted-chrome-'));
const chrome = launch('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  '--use-angle=swiftshader', '--remote-debugging-port=9222',
  `--user-data-dir=${profile}`, 'about:blank'
]);
try {
  await waitFor('http://127.0.0.1:9222/json/version');
} catch (error) {
  console.error(`DIAGNOSTIC: Chrome pid=${chrome.pid} exitCode=${chrome.exitCode} signalCode=${chrome.signalCode} killed=${chrome.killed}`);
  throw error;
}
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const page = targets.find((item) => item.type === 'page' && item.url === 'about:blank')
  ?? targets.find((item) => item.type === 'page');
if (!page) throw new Error('Chrome did not expose a page target.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const runtimeErrors = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text);
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') runtimeErrors.push(message.params.entry.text);
  if (!message.id) return;
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
});
function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function load() {
  await send('Page.navigate', { url: targetUrl });
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    if (await evaluate("document.readyState === 'complete' && Boolean(document.querySelector('#pipeline-table tr'))")) return;
    await sleep(250);
  }
  const state = await evaluate("({ href: location.href, title: document.title, readyState: document.readyState, rows: document.querySelectorAll('#pipeline-table tr').length, body: document.body?.innerText.slice(0, 240) })");
  throw new Error(`Hosted application did not become ready: ${JSON.stringify(state)}`);
}

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  await load();

  const identity = await evaluate("({ href: location.href, title: document.title, marker: document.querySelector('.live-pill')?.textContent.trim() })");
  assert(
    identity.href === targetUrl
      && identity.title === 'PulseGrid — Living Data Reliability'
      && identity.marker === 'SIMULATION LIVE',
    'the canonical hosted application is loaded'
  );

  const semantics = await evaluate(`(() => ({
    lang: document.documentElement.lang,
    canvasLabel: document.querySelector('#scene')?.getAttribute('aria-label'),
    live: document.querySelector('#announcer')?.getAttribute('aria-live'),
    caption: document.querySelector('table caption')?.textContent.trim(),
    rows: document.querySelectorAll('#pipeline-table tr').length
  }))()`);
  assert(semantics.lang === 'en' && semantics.canvasLabel && semantics.live === 'polite' && semantics.caption && semantics.rows === 4,
    'semantic canvas, live region, and four-row evidence table are present');
  assert(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), '360 px viewport has no horizontal overflow');

  await evaluate("document.querySelector('#scene').focus()");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight' });
  assert(await evaluate("document.querySelector('[data-district=\"1\"]')?.getAttribute('aria-current')") === 'true',
    'ArrowRight moves canvas district focus');

  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space' });
  assert(await evaluate("document.querySelector('#motion-toggle')?.getAttribute('aria-pressed')") === 'true',
    'Space toggles reduced motion from the canvas');

  const lifecycle = await evaluate(`(() => {
    const labels = [];
    const button = document.querySelector('#scenario-button');
    for (let index = 0; index < 5; index += 1) {
      labels.push(document.querySelector('#health-label').textContent);
      button.click();
    }
    return labels;
  })()`);
  assert(JSON.stringify(lifecycle) === JSON.stringify(['NOMINAL', 'DEGRADED', 'CONTAINED', 'REPLAYING', 'RECOVERED']),
    'incident lifecycle is deterministic in the hosted browser');

  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await load();
  assert(await evaluate("document.querySelector('#motion-toggle')?.getAttribute('aria-pressed')") === 'true',
    'OS reduced-motion preference is honored on hosted startup');

  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return original.call(this, type, ...args);
    };
  ` });
  await load();
  const fallback = await evaluate(`(() => ({
    canvasHidden: document.querySelector('#scene').hidden,
    fallbackVisible: !document.querySelector('#fallback').hidden,
    controls: Boolean(document.querySelector('#scenario-button'))
  }))()`);
  assert(fallback.canvasHidden && fallback.fallbackVisible && fallback.controls,
    'WebGL failure preserves the hosted accessible fallback and incident controls');
  assert(runtimeErrors.length === 0, `hosted runtime produced no console/page errors (${runtimeErrors.length})`);
  console.log(JSON.stringify({ target_url: targetUrl, checks: 10, runtime_errors: runtimeErrors.length }));
} finally {
  socket.close();
  cleanup();
}
