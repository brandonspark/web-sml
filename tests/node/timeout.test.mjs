// M6: timeout semantics — an infinite loop is stopped by terminating the
// worker, and a subsequent run on a fresh runtime works normally.
import { runSMLWithTimeout } from '../../js/run-node.mjs';

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log(`FAIL ${msg}`); }
  else console.log(`PASS ${msg}`);
}

const loop = await runSMLWithTimeout('fun f () = f (); val _ = f ();', { timeoutMs: 3000 });
assert(loop.timedOut === true, 'infinite loop times out');

const partial = await runSMLWithTimeout(
  'val () = print "before\\n"; fun f () = f (); val _ = f ();',
  { quiet: true, timeoutMs: 3000 });
assert(partial.timedOut && partial.stdout.includes('before'),
  'partial output survives a timeout');

const after = await runSMLWithTimeout('val x = 1 + 1;', { timeoutMs: 10000 });
assert(!after.timedOut && after.stdout.includes('val x = 2 : int'),
  'a normal run works after a timeout');

process.exit(failures ? 1 : 0);
