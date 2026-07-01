#!/bin/sh
# Fetch the pinned Moscow ML source revision into vendor/mosml.
# Runtime and bytecode artifacts MUST come from this same tree.
set -e

MOSML_REPO=https://github.com/kfl/mosml.git
MOSML_REV=13c581aec46eea134e478f2e2b6456278e36ecce  # master, 2021-07-02

cd "$(dirname "$0")/.."
if [ ! -d vendor/mosml ]; then
  git clone "$MOSML_REPO" vendor/mosml
fi
git -C vendor/mosml checkout "$MOSML_REV"
echo "vendor/mosml at $(git -C vendor/mosml rev-parse HEAD)"
