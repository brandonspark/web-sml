#!/bin/sh
# Assemble web-sml.zip: the single artifact a website needs to run SML.
# Internal layout matches the repository (and EMBEDDING.md), so relative
# imports between the modules keep working.
set -e
cd "$(dirname "$0")/.."

STAGE=build/bundle/web-sml
rm -rf build/bundle
mkdir -p "$STAGE/dist" "$STAGE/js" "$STAGE/web" "$STAGE/examples/exercises"

cp dist/camlrunm.mjs dist/camlrunm.wasm \
   dist/mosml-assets.json dist/mosml-assets.data "$STAGE/dist/"
cp js/runsml.mjs "$STAGE/js/"
cp web/worker.js "$STAGE/web/"
cp examples/exercises/exercise.js examples/exercises/exercise-core.mjs \
   examples/exercises/highlight-sml.mjs examples/exercises/index.html \
   "$STAGE/examples/exercises/"
cp docs/EMBEDDING.md LICENSE NOTICE "$STAGE/"

cat > "$STAGE/VERSION" <<EOF
web-sml $(git rev-parse HEAD 2>/dev/null || echo unknown)
built   $(date -u +%Y-%m-%dT%H:%M:%SZ)
source  https://github.com/brandonspark/web-sml
mosml   $(grep MOSML_REV= scripts/fetch-mosml.sh | cut -d= -f2 | cut -d' ' -f1)
EOF

rm -f dist/web-sml.zip
(cd build/bundle && zip -qr ../../dist/web-sml.zip web-sml)
echo "dist/web-sml.zip: $(du -h dist/web-sml.zip | cut -f1)"
unzip -l dist/web-sml.zip | tail -3
