// M8 browser tests: valid programs run, type errors report diagnostics,
// infinite loops time out, and the page stays usable after a timeout.
// Uses the globally-installed playwright (chromium).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('/opt/homebrew/lib/node_modules/playwright');
const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.wasm': 'application/wasm', '.json': 'application/json',
  '.data': 'application/octet-stream',
};
const server = createServer(async (req, res) => {
  try {
    const path = join(root, new URL(req.url, 'http://x').pathname);
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
let failures = 0;

async function runProgram(code, { timeoutSecs, quiet } = {}) {
  await page.fill('#code', code);
  if (timeoutSecs) await page.fill('#timeout', String(timeoutSecs));
  await page.setChecked('#quiet', !!quiet);
  await page.click('#run');
  await page.waitForFunction(
    () => !/running/.test(document.getElementById('status').textContent),
    null, { timeout: 60000 });
  return {
    output: await page.textContent('#output'),
    status: await page.textContent('#status'),
  };
}

async function check(name, cond) {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.log(`FAIL ${name}`); }
}

await page.goto(`${base}/web/index.html`);

let r = await runProgram(
  'fun fact 0 = 1 | fact n = n * fact (n-1);\nval () = print ("fact 10 = " ^ Int.toString (fact 10) ^ "\\n");');
await check('valid program runs', r.output.includes('fact 10 = 3628800') && r.status.startsWith('done'));

r = await runProgram('val bad = 1 + "foo";');
await check('type error reports diagnostics', r.output.includes('Type clash'));

r = await runProgram('fun f () = f ();\nval _ = f ();', { timeoutSecs: 2 });
await check('infinite loop times out', r.status === 'timed out');

r = await runProgram('val x = 1 + 1;');
await check('page usable after timeout', r.output.includes('val x = 2 : int') && r.status.startsWith('done'));

await browser.close();
server.close();
process.exit(failures ? 1 : 0);
