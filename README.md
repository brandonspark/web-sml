# Moscow ML in the browser

Paste Standard ML, click **Run**, get output — entirely in the browser.

Moscow ML's C bytecode runtime (the Caml Light VM) is compiled to WebAssembly
with Emscripten. The Moscow ML compiler/toplevel is **not** compiled to wasm:
it stays what it always was — Moscow ML bytecode — and is loaded as data into
the Emscripten virtual filesystem, where the wasm runtime executes it. The
toplevel compiles the user's source into bytecode in memory and the same
runtime executes that too.

Each click of Run spawns a fresh Web Worker with a fresh runtime instance
(clean heap, clean filesystem). Timeouts and Stop are implemented by
terminating the Worker; a crashed or stopped run cannot affect the next one.

## Building

Prerequisites: Xcode CLT (clang, make, perl), Emscripten (`brew install
emscripten`), Node ≥ 18, Python 3.

```sh
make          # fetch + native + wasm + bytecode32 + assets
make serve    # then open http://127.0.0.1:8000/web/
make test     # runtime, toplevel, timeout, and browser tests
```

The build has four stages (see `Makefile`):

1. **native** — build Moscow ML normally (`make world` in `vendor/mosml/src`,
   with `-std=gnu89`: the tree is early-90s C that modern clang otherwise
   rejects; without it the configure step loops forever). This produces the
   native runtime, `mosmlyac`, and the generated runtime headers/primitive
   table. The `basisdynlib` stage needs GMP and is skipped — dynamic
   libraries are out of scope anyway.
2. **wasm** — compile *only* `src/runtime` with `emcc` (see `wasm/Makefile`),
   producing `dist/camlrunm.mjs/.wasm` (browser, in-memory FS) and
   `dist/camlrunm-node.mjs/.wasm` (Node, real FS). Runtime and bytecode must
   come from the same tree: the bytecode instruction set and primitive table
   have to match.
3. **bytecode32** — rebuild `mosmllib` and the compiler images
   (`mosmlcmp`/`mosmllnk`/`mosmltop`) in **32-bit** extern format by running
   every bytecode build step under the wasm32 runtime itself
   (`scripts/build-bytecode-32.sh`). This matters: bytecode *data segments*
   are word-size flavored, and artifacts from the 64-bit native build contain
   64-bit integer literals (e.g. `Int.maxInt`) that a 32-bit runtime cannot
   represent. The checked-in bootstrap compiler images are 32-bit format, so
   the wasm runtime runs them directly.
4. **assets** — pack `mosmltop` + `mosmllib/*.ui,*.uo` into
   `dist/mosml-assets.data` + manifest for the browser FS.

`docs/ARTIFACTS.md` records the pinned Moscow ML revision and per-artifact
provenance.

## What is supported

Single-file SML programs in Moscow ML 2.10's dialect: top-level declarations
(echoed as `val x = 5 : int`, like the REPL; disable with *quiet*), `print`,
modules/signatures/functors, exceptions, and the Moscow ML basis library
(`Int`, `List`, `String`, `Array`, `TextIO`, … — preloaded via `-P full`).
Syntax/type errors and uncaught exceptions are reported in the output pane.
Runaway programs are stopped by the timeout (default 10 s).

## What is intentionally unsupported

- No interactive REPL and no stdin (the toplevel reads the file, then sees
  EOF). No persistent state between runs, no persistent files.
- No `IntInf`/GMP, no `Socket`, no `Unix`/process APIs, no `Dynlib`: these
  are native dynamic libraries, which browser wasm cannot load. The
  primitives exist but fail with an exception.
- `Int` is 31-bit (the runtime is wasm32), as on any 32-bit Moscow ML.
- Not SML/NJ: no `fun f x = ...` at the prompt without `;` niceties beyond
  what Moscow ML 2.10 accepts, different error messages, etc.

## Layout

- `wasm/` — Emscripten build of the runtime (`m.h`/`s.h` wasm32 config)
- `js/runsml.mjs` — core API: run one source string on a fresh runtime
- `js/run-node.mjs` — Node variant with worker-thread timeout (used in tests)
- `web/` — the page: `index.html`, `main.js`, `worker.js`
- `tests/` — level 1 (wasm runtime runs precompiled bytecode), level 2
  (toplevel evaluates source), timeout semantics, and Playwright browser
  tests (uses the globally-installed `playwright`)

## Porting notes (the three bugs that mattered)

1. **Modern clang vs 1990s C**: build everything with `-std=gnu89`; the
   configure probes otherwise fail to compile and `config/autoconf` loops.
2. **Word size is baked into bytecode data**: the runtime can shrink 64-bit
   extern data to 32-bit only when every integer fits in 31 bits — and the
   64-bit-compiled stdlib contains constants that don't. Hence the
   wasm-hosted 32-bit bytecode rebuild (stage 3). A startup quirk hides such
   errors: `main.c` maps any early exception to "out of memory" because the
   exception-name table isn't loaded yet.
3. **Unsigned negative offsets trap on wasm**: `Tag_val`'s
   `ptr[-sizeof(value)]` index is a *positive* 4-byte-shy-of-4GB `size_t`;
   clang folds it into the wasm load's unsigned offset immediate, and the
   33-bit effective address traps instead of wrapping. Patched to a signed
   index in `wasm/Makefile` (native builds wrap silently and never noticed).
