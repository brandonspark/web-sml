// Main thread: one Worker per run; Stop/timeout = worker.terminate().
const codeEl = document.getElementById('code');
const outEl = document.getElementById('output');
const runBtn = document.getElementById('run');
const stopBtn = document.getElementById('stop');
const quietEl = document.getElementById('quiet');
const timeoutEl = document.getElementById('timeout');
const statusEl = document.getElementById('status');

let worker = null;
let timer = null;

function setRunning(running) {
  runBtn.disabled = running;
  stopBtn.disabled = !running;
}

function append(text, cls) {
  const span = document.createElement('span');
  span.className = cls;
  span.textContent = text + '\n';
  outEl.appendChild(span);
  outEl.scrollTop = outEl.scrollHeight;
}

function finish(status) {
  if (timer) clearTimeout(timer);
  timer = null;
  if (worker) worker.terminate();
  worker = null;
  setRunning(false);
  statusEl.textContent = status;
}

function run() {
  if (worker) return;
  outEl.textContent = '';
  statusEl.textContent = 'running…';
  setRunning(true);

  worker = new Worker('worker.js', { type: 'module' });
  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === 'line') append(msg.text, msg.stream === 'err' ? 'err' : 'out');
    else if (msg.type === 'result') finish(`done (exit ${msg.exitCode})`);
    else if (msg.type === 'error') { append(msg.message, 'err'); finish('runner error'); }
  };
  worker.onerror = (e) => { append(e.message ?? 'worker error', 'err'); finish('worker error'); };
  worker.postMessage({ source: codeEl.value, quiet: quietEl.checked });

  const timeoutMs = Math.max(1, Number(timeoutEl.value) || 10) * 1000;
  timer = setTimeout(() => { append('— timed out —', 'err'); finish('timed out'); }, timeoutMs);
}

runBtn.onclick = run;
stopBtn.onclick = () => { append('— stopped —', 'err'); finish('stopped'); };
codeEl.onkeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !runBtn.disabled) run();
};
setRunning(false);
