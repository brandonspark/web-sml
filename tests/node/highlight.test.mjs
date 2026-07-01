// SML tokenizer: display-only, but wrong lexing looks broken — pin the basics.
import { highlightSML } from '../../examples/exercises/highlight-sml.mjs';

let failures = 0;
function check(name, got, expect) {
  const ok = got === expect;
  if (!ok) { failures++; console.log(`FAIL ${name}\n  got:    ${got}\n  expect: ${expect}`); }
  else console.log(`PASS ${name}`);
}

check('keyword + ident',
  highlightSML('fun f x'),
  '<span class="sml-kw">fun</span> f x');

check('constructor vs ident',
  highlightSML('SOME x'),
  '<span class="sml-con">SOME</span> x');

check('string with escaped quote',
  highlightSML('val s = "a\\"b"'),
  '<span class="sml-kw">val</span> s = <span class="sml-str">"a\\"b"</span>');

check('char literal',
  highlightSML('#"c"'),
  '<span class="sml-str">#"c"</span>');

check('nested comment',
  highlightSML('(* a (* b *) c *) x'),
  '<span class="sml-com">(* a (* b *) c *)</span> x');

check('numbers incl. negative and real',
  highlightSML('~2 + 1.5e~3'),
  '<span class="sml-num">~2</span> + <span class="sml-num">1.5e~3</span>');

check('type variable',
  highlightSML("'a list"),
  '<span class="sml-tyvar">\'a</span> list');

check('html is escaped',
  highlightSML('1 < 2 andalso "a<b"'),
  '<span class="sml-num">1</span> &lt; <span class="sml-num">2</span> <span class="sml-kw">andalso</span> <span class="sml-str">"a&lt;b"</span>');

check('keyword-prefixed ident is not a keyword',
  highlightSML('functional'),
  'functional');

process.exit(failures ? 1 : 0);
