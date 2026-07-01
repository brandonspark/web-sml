// M5/M6: the wasm runtime starts the Moscow ML toplevel and evaluates SML
// source from the virtual filesystem, via the runSML API.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import createRuntime from '../../dist/camlrunm.mjs';
import { runSML } from '../../js/runsml.mjs';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const assets = {
  manifest: JSON.parse(readFileSync(join(root, 'dist/mosml-assets.json'), 'utf8')),
  data: readFileSync(join(root, 'dist/mosml-assets.data')),
};
const env = { createRuntime, assets };

let failures = 0;
async function check(name, source, options, expect) {
  const res = await runSML(source, options, env);
  const problems = [];
  for (const s of expect.stdoutHas ?? []) {
    if (!res.stdout.includes(s)) problems.push(`stdout missing ${JSON.stringify(s)}`);
  }
  for (const s of expect.stdoutLacks ?? []) {
    if (res.stdout.includes(s)) problems.push(`stdout should not contain ${JSON.stringify(s)}`);
  }
  if (problems.length) {
    failures++;
    console.log(`FAIL ${name}: ${problems.join('; ')}\n  stdout=${JSON.stringify(res.stdout)}\n  stderr=${JSON.stringify(res.stderr)}`);
  } else {
    console.log(`PASS ${name}`);
  }
}

await check('arithmetic+val echo', 'val x = 2 + 3;', {},
  { stdoutHas: ['val x = 5 : int'] });

await check('functions+recursion+print',
  'fun fact 0 = 1 | fact n = n * fact (n-1);\nval () = print (Int.toString (fact 10) ^ "\\n");',
  {}, { stdoutHas: ['val fact = fn : int -> int', '3628800'] });

await check('quiet mode',
  'val x = 42;\nval () = print "only this\\n";', { quiet: true },
  { stdoutHas: ['only this'], stdoutLacks: ['val x', 'Moscow ML'] });

await check('modules and signatures', `
signature COUNTER = sig type t val zero : t val next : t -> t val get : t -> int end;
structure Counter :> COUNTER = struct
  type t = int
  val zero = 0
  fun next c = c + 1
  fun get c = c
end;
val () = print (Int.toString (Counter.get (Counter.next Counter.zero)) ^ "\\n");
`, {}, { stdoutHas: ['structure Counter', '1'] });

await check('functor', `
functor Twice (val f : int -> int) = struct fun g x = f (f x) end;
structure T = Twice (val f = fn x => x + 1);
val four = T.g 2;
`, {}, { stdoutHas: ['val four = 4 : int'] });

await check('type error diagnostics', 'val bad = 1 + "foo";', {},
  { stdoutHas: ['Type clash'] });

await check('syntax error diagnostics', 'val = = 3;', {},
  { stdoutHas: ['Syntax error'] });

await check('uncaught exception', 'exception Boom;\nval () = raise Boom;', {},
  { stdoutHas: ['Boom'] });

await check('stdlib: List/String', `
val sum = List.foldl op+ 0 [1,2,3,4,5];
val s = String.concatWith "," (List.map Int.toString [1,2,3]);
`, {}, { stdoutHas: ['val sum = 15 : int', 'val s = "1,2,3" : string'] });

process.exit(failures ? 1 : 0);
