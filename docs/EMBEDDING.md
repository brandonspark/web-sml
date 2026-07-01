# Embedding SML exercises in a static site

Everything is client-side static files; any static host works (GitHub Pages,
Netlify, nginx, `python3 -m http.server`).

## Files to serve

Copy these directories **preserving their relative layout** (the modules
import each other by relative path):

```
your-site/
  sml/
    dist/                camlrunm.mjs, camlrunm.wasm, mosml-assets.json, mosml-assets.data
    js/                  runsml.mjs
    web/                 worker.js
    examples/exercises/  exercise.js, exercise-core.mjs   (the grading widget)
```

`dist/` is produced by `make` (or grab it from a CI artifact).
`camlrunm-node.*` are build-time tools and don't need to be served. If you
prefer a different layout, pass `workerUrl` in the options instead.

## Adding an exercise to a page

```html
<div id="ex-fact"></div>
<script type="module">
  import { mountExercise } from '/sml/examples/exercises/exercise.js';

  mountExercise(document.getElementById('ex-fact'), {
    title: 'Factorial',
    prompt: 'Define <code>fact : int -> int</code>.',
    starter: 'fun fact n = raise Fail "unimplemented"\n',
    tests: [
      { name: 'fact 0 = 1',   expr: 'fact 0 = 1' },
      { name: 'fact 5 = 120', expr: 'fact 5 = 120' },
    ],
  }, { timeoutMs: 10000 });
</script>
```

- `tests[].expr` is any SML expression of type `bool`, evaluated after the
  user's code. A test shows *pass*, *fail* (wrong answer / raised exception),
  or *not run* (the code didn't compile — diagnostics appear in the output
  pane).
- Style hooks: `.sml-exercise`, `.sml-pass`, `.sml-fail`, `.sml-not-run`,
  `.sml-output`, `.sml-controls` — see `examples/exercises/index.html` for a
  working stylesheet.
- `examples/exercises/index.html` is a complete example page; view it live
  via the repo's GitHub Pages demo.

## Hosting notes

- **Same origin**: the widget spawns a module Web Worker; workers cannot be
  loaded cross-origin, so serve the `sml/` tree from your own domain.
- **MIME types**: `.wasm` must be `application/wasm` (every mainstream host
  does this); `.data`/`.mjs` need nothing special.
- **Size/caching**: ~2.3 MB total, dominated by `mosml-assets.data` (~2 MB).
  Long cache lifetimes are safe if you version the directory (e.g.
  `/sml-v1/`). Compression (gzip/brotli) roughly halves it.
- **Browser support**: module workers — Chrome 80+, Safari 15+, Firefox 114+.

## Honesty box

Grading is fully client-side: the tests are visible in page source, and a
determined user can `print` the sentinel lines themselves. Fine for
self-study exercises; do not use it as an exam proctor.

## License

The `dist/` artifacts are GPL-2.0-or-later derivative works of Moscow ML /
Caml Light (your page's own code is unaffected — it merely runs alongside).
Keep a visible link to https://github.com/brandonspark/web-sml or the
Moscow ML sources when hosting them. See `NOTICE`.
