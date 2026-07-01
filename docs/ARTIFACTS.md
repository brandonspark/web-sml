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

## 32-bit bytecode rebuild (the artifacts actually shipped)

The native build's bytecode artifacts are 64-bit flavored (extern data format
LE64, and 64-bit constants folded into `mosmllib` by the `.mlp`→`.sml`
preprocessing against `config/m.h`). The wasm runtime is wasm32, and 64→32
extern shrinkage fails on constants like `Int.maxInt`.

`scripts/build-bytecode-32.sh` therefore:

1. writes a 32-bit `config/m.h` (used by `cpp` on `mosmllib/*.mlp`),
2. replaces `src/camlrunm` with a shim that runs `dist/camlrunm-node.mjs`
   (wasm32 runtime, NODERAWFS) under Node — the native binary is kept as
   `src/camlrunm.native`,
3. reruns `make -C mosmllib clean all` and `make -C compiler clean all`.

The checked-in bootstrap images (`src/mosmlcmp`, `src/mosmllnk`,
`src/mosmllex`, all LE32) run directly on the wasm runtime and recompile the
whole library and compiler to LE32. Verify with the trailer check at the end
of the script (extern magic `0x8495a6ba` = little-endian 32).

Shipped browser assets (`dist/mosml-assets.data`, packed by
`scripts/pack-assets.mjs`): `compiler/mosmltop` + `mosmllib/*.ui,*.uo` from
this rebuild.

## Wasm runtime build (`wasm/Makefile`)

- Compiles the `BASEOBJS` source list plus `dynlib.c` (so the primitive
  table matches the native `primitives` file; its `dlopen` fails cleanly at
  runtime) and the generated `prims.c` from the native build.
- `wasm/m.h`: 32-bit, little-endian, `ALIGNMENT` defined (bytewise operand
  reads). `wasm/s.h`: mirrors the macOS feature set; unsupportable POSIX
  calls exist as stubs that fail at runtime.
- One source patch, applied to the build copy: `Tag_val`'s
  `[-sizeof(value)]` becomes `[-(long)sizeof(value)]` — the unsigned index
  folds into the wasm load offset immediate and traps (33-bit effective
  address, no wraparound).

## Invocation model (from `src/launch/*.tpl`)

- Toplevel: `camlrunm $stdlib/mosmltop -stdlib $stdlib [-P full] [-quietdec] [file.sml ...]`
  - reads the files, then reads stdin; exits at stdin EOF
  - `-P full` preloads the full basis (Int, List, String, ...)
  - `-quietdec` suppresses the banner and `> val x = ...` echoes
- Batch: `camlrunm $stdlib/mosmlcmp -stdlib $stdlib file.sml` then
  `camlrunm $stdlib/mosmllnk -stdlib $stdlib -exec out file.sml`; run with `camlrunm out`
