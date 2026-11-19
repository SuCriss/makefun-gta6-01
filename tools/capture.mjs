import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const amp = String.fromCharCode(38);
const shots = [
  { file: '1-start.jpg', query: '?shot=start' },
  { file: '2-play.jpg', query: '?shot=play' },
  { file: '3-end.jpg', query: '?shot=end' + amp + 'seed=1' },
];

const waitFor = async (fn, timeout = 20000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('CDP helper timed out');
};

const connect = (url) => new Promise((ok, fail) => {
  const ws = new WebSocket(url);
  const pending = new Map();
  let id = 0;
  ws.onopen = () => ok(api);
  ws.onerror = fail;
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    const task = pending.get(msg.id);
    if (!task) return;
    pending.delete(msg.id);
    msg.error ? task.fail(new Error(msg.error.message)) : task.ok(msg.result);
  };
  const api = {
    send(method, params = {}) {
      return new Promise((resolveSend, rejectSend) => {
        const n = ++id;
        pending.set(n, { ok: resolveSend, fail: rejectSend });
        ws.send(JSON.stringify({ id: n, method, params }));
      });
    },
    close() { ws.close(); },
  };
});

const server = spawn(process.execPath, ['serve.ts', '--port', '8123'], { cwd: root, stdio: 'ignore' });
const browser = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9333', '--user-data-dir=' + join(tmpdir(), 'gta6-cdp'),
  '--window-size=1280,720', 'about:blank',
], { stdio: 'ignore' });

let api;
try {
  await waitFor(async () => {
    try { return (await fetch('http://127.0.0.1:8123/')).ok; } catch { return false; }
  });
  const pages = await waitFor(async () => {
    try { return (await (await fetch('http://127.0.0.1:9333/json/list')).json()).find((p) => p.type === 'page'); } catch { return false; }
  });
  api = await connect(pages.webSocketDebuggerUrl);
  await api.send('Page.enable');
  await api.send('Runtime.enable');
  await api.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

  const dir = join(root, 'screenshots');
  mkdirSync(dir, { recursive: true });
  for (const shot of shots) {
    await api.send('Page.navigate', { url: 'http://127.0.0.1:8123/' + shot.query });
    await waitFor(async () => {
      const r = await api.send('Runtime.evaluate', {
        expression: 'document.readyState === "complete" && document.getElementById("stage").style.getPropertyValue("--scale") !== ""',
        returnByValue: true,
      });
      return r.result.value === true;
    });
    try {
      await api.send('Animation.enable');
      await api.send('Animation.setPlaybackRate', { playbackRate: 0 });
    } catch { }
    const image = await api.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, fromSurface: true, captureBeyondViewport: false });
    const bytes = Buffer.from(image.data, 'base64');
    writeFileSync(join(dir, shot.file), bytes);
    console.log(shot.file, bytes.length + ' bytes');
  }
} finally {
  if (api) api.close();
  browser.kill();
  server.kill();
}
