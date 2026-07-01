# Artifact provenance

All runtime and bytecode artifacts come from **one** source tree; the bytecode
instruction set and primitive table must match between them.

- Source: https://github.com/kfl/mosml.git
- Revision: `13c581aec46eea134e478f2e2b6456278e36ecce` (master, 2021-07-02)
- Fetch: `scripts/fetch-mosml.sh`

## Native build (Milestone 1)

```sh
cd vendor/mosml/src
make world CC="gcc -std=gnu89 -Wno-implicit-function-declaration -Wno-return-type"
```

`-std=gnu89` is required: the tree is early-90s C (K&R definitions, implicit
int) that Xcode's clang rejects under its C23 default; the config step's
`align.c` probe otherwise fails to compile and `config/autoconf` loops forever
on "Your compiler chokes on volatile".

The `basisdynlib` step fails (needs GMP) and is not needed: it builds the
dynamic-library basis units (IntInf etc.), which are out of scope — browser
Wasm cannot load native shared libraries anyway.

Artifacts produced (all under `vendor/mosml/src`):

| Artifact | Role |
|---|---|
| `runtime/camlrunm` | C bytecode runtime (Caml Light VM) — the only part ported to Wasm |
| `compiler/mosmltop` | toplevel/compiler bytecode image, run BY camlrunm |
| `compiler/mosmlcmp` | batch compiler bytecode image |
| `compiler/mosmllnk` | linker bytecode image |
| `mosmllib/*.ui,*.uo` | standard library interface/object files |

## Invocation model (from `src/launch/*.tpl`)

- Toplevel: `camlrunm $stdlib/mosmltop -stdlib $stdlib [-P full] [-quietdec] [file.sml ...]`
  - reads the files, then reads stdin; exits at stdin EOF
  - `-P full` preloads the full basis (Int, List, String, ...)
  - `-quietdec` suppresses the banner and `> val x = ...` echoes
- Batch: `camlrunm $stdlib/mosmlcmp -stdlib $stdlib file.sml` then
  `camlrunm $stdlib/mosmllnk -stdlib $stdlib -exec out file.sml`; run with `camlrunm out`
