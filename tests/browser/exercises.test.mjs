// End-to-end widget test: solve an exercise correctly and incorrectly on the
// sample exercises page.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
function resolvePlaywright() {
  for (const spec of ['playwright',
      join(execSync('npm root -g').toString().trim(), 'playwright')]) {
    try { return require(spec); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}
const { chromium } = resolvePlaywright();
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
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
let failures = 0;
async function check(name, cond) {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.log(`FAIL ${name}`); }
}

await page.goto(`${base}/examples/exercises/index.html`);
const ex = page.locator('#ex-fact');

async function submit(code) {
  await ex.locator('textarea').fill(code);
  await ex.locator('.sml-run').click();
  await page.waitForFunction(() =>
    !/running/.test(document.querySelector('#ex-fact .sml-status').textContent),
    null, { timeout: 60000 });
  return ex.locator('.sml-status').textContent();
}

let status = await submit('fun fact 0 = 1 | fact n = n * fact (n-1)');
await check('correct solution: all tests pass', status === '4/4 passed');
await check('pass rows rendered', (await ex.locator('.sml-pass').count()) === 4);

status = await submit('fun fact n = 1');
await check('wrong solution: partial pass', status === '2/2 passed' ? false : /\/4 passed/.test(status) && !status.startsWith('4/'));
await check('fail rows rendered', (await ex.locator('.sml-fail').count()) > 0);

status = await submit('fun fact = ');
await check('non-compiling: 0 passed', status === '0/4 passed');
await check('diagnostics shown in output', (await ex.locator('.sml-output').textContent()).includes('!'));

await browser.close();
server.close();
process.exit(failures ? 1 : 0);
