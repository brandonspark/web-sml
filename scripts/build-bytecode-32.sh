#!/bin/sh
# Rebuild Moscow ML's bytecode artifacts (mosmllib *.ui/*.uo, mosmlcmp,
# mosmllnk, mosmltop) in 32-bit extern format, by running every bytecode step
# under the wasm32 runtime (dist/camlrunm-node.mjs via Node).
#
# Why: artifacts produced by the native 64-bit build embed 64-bit integer
# literals (e.g. Int.maxInt) and 64-bit extern data that a 32-bit runtime
# cannot load. The checked-in bootstrap compiler images (src/mosmlcmp,
# src/mosmllnk, src/mosmllex) are 32-bit format, so the wasm runtime can run
# them directly.
#
# Prerequisites: native `make world` has run (for mosmlyac, runtime headers,
# runtime/primitives) and `make -C wasm` has produced dist/camlrunm-node.mjs.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/vendor/mosml/src"

# 1. 32-bit machine config, used by cpp when preprocessing mosmllib/*.mlp
#    (selects 31-bit Int.maxInt etc.) — keep runtime/m.h (native build) as is.
cat > "$SRC/config/m.h" <<'EOF'
#undef SIXTYFOUR
#undef MOSML_BIG_ENDIAN
#undef ALIGNMENT
EOF

# 2. Substitute the wasm32 runtime for ROOTDIR/camlrunm in the build.
cp "$SRC/runtime/camlrunm" "$SRC/camlrunm.native"
cat > "$SRC/camlrunm" <<EOF
#!/bin/sh
exec node "$ROOT/js/camlrunm-node.mjs" "\$@"
EOF
chmod +x "$SRC/camlrunm"

# 3. Rebuild all bytecode: stdlib first, then the compiler/toplevel.
make -C "$SRC/mosmllib" clean
make -C "$SRC/mosmllib" all
make -C "$SRC/compiler" clean
make -C "$SRC/compiler" all

echo "--- extern format of rebuilt images (want LE32 = 0x8495a6ba) ---"
python3 - "$SRC" <<'EOF'
import struct, sys, glob
src = sys.argv[1]
for p in [src+'/compiler/mosmltop', src+'/compiler/mosmlcmp', src+'/compiler/mosmllnk']:
    d = open(p,'rb').read()
    cs, ds, ss, dbg, magic = struct.unpack('>5I', d[-20:])
    base = len(d) - 20 - dbg - ss - ds
    dmagic = struct.unpack('>I', d[base:base+4])[0]
    print(f"{p}: extern_magic={dmagic:#x}")
EOF
