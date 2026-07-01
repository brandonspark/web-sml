// Grading pipeline: hidden tests against correct/wrong/crashing/non-compiling
// solutions, plus timeout behavior. Uses the same worker path as the browser.
import { buildTestSource, gradeRun } from '../../examples/exercises/exercise-core.mjs';
import { runSMLWithTimeout } from '../../js/run-node.mjs';

const tests = [
  { name: 'fact 0', expr: 'fact 0 = 1' },
  { name: 'fact 5', expr: 'fact 5 = 120' },
];

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log(`FAIL ${msg}`); }
  else console.log(`PASS ${msg}`);
}

async function grade(userCode, timeoutMs = 10000) {
  const res = await runSMLWithTimeout(buildTestSource(userCode, tests), { quiet: true, timeoutMs });
  return { verdicts: gradeRun(tests, res.stdout.split('\n')), res };
}

let { verdicts } = await grade('fun fact 0 = 1 | fact n = n * fact (n-1)');
assert(verdicts.every((v) => v.status === 'pass'), 'correct solution passes all tests');

({ verdicts } = await grade('fun fact n = n'));
assert(verdicts[0].status === 'fail' && verdicts[1].status === 'fail',
  'wrong solution fails with wrong answer');

({ verdicts } = await grade('fun fact n = raise Fail "nope"'));
assert(verdicts.every((v) => v.status === 'fail' && v.detail.includes('raised')),
  'raising solution fails with exception detail');

let g = await grade('fun fact = 3');  // syntax error
assert(g.verdicts.every((v) => v.status === 'not run'),
  'non-compiling solution: no test runs');
assert(/^!/m.test(g.res.stdout + g.res.stderr),
  'non-compiling solution: diagnostics are visible');

g = await grade('fun fact n = fact n', 3000);  // infinite loop
assert(g.res.timedOut && g.verdicts.every((v) => v.status !== 'pass'),
  'looping solution times out without passing');

process.exit(failures ? 1 : 0);
