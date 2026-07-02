// The zip must be self-sufficient: unzip it anywhere, serve it, and the
// bundled example page runs SML — no files from the repo checkout.
import { writeSync } from 'node:fs';

// CI watchdog: a hang anywhere below becomes a diagnosable failure. The
// message is written synchronously so pipe buffering cannot swallow it.
const WATCHDOG_MS = 150000;
const watchdog = setTimeout(() => {
  writeSync(2, `WATCHDOG: test still running after ${WATCHDOG_MS}ms, aborting\n`);
  process.exit(3);
}, WATCHDOG_MS);
watchdog.unref();

import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const spec of ['playwright',
      join(execSync('npm root -g').toString().trim(), 'playwright')]) {
    try { return require(spec); } catch { /* next */ }
  }
  throw new Error('playwright not found');
})();

const repo = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const root = await mkdtemp(join(tmpdir(), 'web-sml-bundle-'));
execSync(`unzip -o -q ${join(repo, 'dist/web-sml.zip')} -d ${root}`,
  { timeout: 60000, stdio: ['ignore', 'inherit', 'inherit'] });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.wasm': 'application/wasm', '.json': 'application/json',
  '.data': 'application/octet-stream' };
const server = createServer(async (req, res) => {
  try {
    let p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (p.endsWith('/')) p = join(p, 'index.html');
    const body = await readFile(p);
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
let failures = 0;
const check = (name, cond) => {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.log(`FAIL ${name}`); }
};

await page.goto(`${base}/web-sml/examples/exercises/index.html`);
const ex = page.locator('#ex-fact');
await ex.locator('textarea').fill('fun fact 0 = 1 | fact n = n * fact (n-1)');
await ex.locator('.sml-run').click();
await page.waitForFunction(() =>
  /passed|error|timed/.test(document.querySelector('#ex-fact .sml-status').textContent),
  null, { timeout: 60000 });
check('bundle runs SML standalone', (await ex.locator('.sml-status').textContent()) === '4/4 passed');

await browser.close();
server.close();
await rm(root, { recursive: true, force: true });
process.exit(failures ? 1 : 0);
