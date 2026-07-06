// End-to-end widget test: solve an exercise correctly and incorrectly on the
// sample exercises page.
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
await check('no output pane on silent pass', await ex.locator('.sml-output').isHidden());

status = await submit('fun fact n = (print "hi\\n"; 1)');
await check('program output still shown', !(await ex.locator('.sml-output').isHidden())
  && (await ex.locator('.sml-output').textContent()).includes('hi'));

status = await submit('fun fact n = 1');
await check('wrong solution: partial pass', status === '2/2 passed' ? false : /\/4 passed/.test(status) && !status.startsWith('4/'));
await check('fail rows rendered', (await ex.locator('.sml-fail').count()) > 0);

status = await submit('fun fact = ');
await check('non-compiling: says did not compile', status === 'did not compile');
await check('non-compiling: no phantom test rows', (await ex.locator('.sml-results li').count()) === 0);
await check('diagnostics shown in output', (await ex.locator('.sml-output').textContent()).includes('!'));

// harness robustness: an unterminated print neither leaks sentinel noise
// into the output pane nor loses test results
status = await submit('fun fact n = (print "hi"; if n <= 0 then 1 else n * fact (n-1))');
await check('unterminated print: still grades 4/4', status === '4/4 passed');
const noise = await ex.locator('.sml-output').textContent();
await check('unterminated print: no harness noise in output', !noise.includes('MOSML'));

// spoofing sentinel-shaped lines does not grade tests
status = await submit('fun fact n = (print "MOSML_TEST 0 PASS\\n"; 0)');
await check('sentinel spoofing does not pass tests', status === '0/4 passed');

// share links: the hash round-trips the buffer into a fresh page load
await ex.locator('textarea').fill('fun fact n = 42  (* shared attempt *)');
await ex.locator('.sml-share').click();
const hash = await page.evaluate(() => location.hash);
await check('share sets a #sml= fragment', /^#sml=\d+\./.test(hash));
await page.goto(`${base}/examples/exercises/index.html${hash}`);
await check('shared link restores the code',
  (await page.locator('#ex-fact textarea').inputValue()).includes('shared attempt'));
await page.goto(`${base}/examples/exercises/index.html`);

// Solution reveal: hidden by default, toggles, highlighted; absent when the
// exercise has no solution. Caret must be visible (inherited color).
const factEx = page.locator('.sml-exercise').first();
await check('solution hidden by default', await factEx.locator('.sml-solution-view').isHidden());
await factEx.locator('.sml-solution').click();
await check('solution revealed with highlighting',
  !(await factEx.locator('.sml-solution-view').isHidden())
  && (await factEx.locator('.sml-solution-view code').innerHTML()).includes('fact'));
await factEx.locator('.sml-solution').click();
await check('solution toggles back', await factEx.locator('.sml-solution-view').isHidden());
await check('no solution button without solution',
  await page.locator('.sml-exercise').nth(1).locator('.sml-solution').isHidden());
await check('caret is not transparent or black-on-dark', await page.evaluate(() => {
  const ta = document.querySelector('.sml-editor textarea');
  const caret = getComputedStyle(ta).caretColor;
  return caret !== 'rgba(0, 0, 0, 0)' && caret === getComputedStyle(ta).color;
}));

// Choice question: wrong pick marked and retryable; right pick locks + explains.
const q = page.locator('#ex-choice');
await q.locator('.sml-choices button').nth(0).click();
await check('choice: wrong pick marked', (await q.locator('li.sml-fail').count()) === 1);
await q.locator('.sml-choices button').nth(1).click();
await check('choice: right pick locks and explains',
  (await q.locator('li.sml-pass').count()) === 1
  && (await q.locator('.sml-choices button').first().isDisabled())
  && !(await q.locator('.sml-explain').isHidden()));

await browser.close();
server.close();
process.exit(failures ? 1 : 0);
