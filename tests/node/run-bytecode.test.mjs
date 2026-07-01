// M4: the Wasm runtime executes a precompiled Moscow ML bytecode file.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import createMosmlRuntime from '../../dist/camlrunm.mjs';

const fixture = fileURLToPath(new URL('../fixtures/tiny.bytecode', import.meta.url));

let stdout = '', stderr = '';
const runtime = await createMosmlRuntime({
  print: (s) => { stdout += s + '\n'; },
  printErr: (s) => { stderr += s + '\n'; },
  stdin: () => null,
});
runtime.FS.writeFile('/tiny.bytecode', readFileSync(fixture));
const code = runtime.callMain(['/tiny.bytecode']);

console.log(JSON.stringify({ code, stdout, stderr }));
if (stdout !== 'fib 20 = 6765\n') {
  console.error('FAIL: unexpected stdout');
  process.exit(1);
}
console.log('PASS');
