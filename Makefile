# End-to-end build for the browser SML runner. See README.md.

NATIVE_CC = gcc -std=gnu89 -Wno-implicit-function-declaration -Wno-return-type

all: assets

vendor/mosml/src/Makefile:
	scripts/fetch-mosml.sh

# 1. Native build: C runtime, mosmlyac, generated headers; also produces
#    64-bit bytecode we do NOT ship (see scripts/build-bytecode-32.sh).
#    basisdynlib fails (needs GMP) and is not needed — ignore the error.
native: vendor/mosml/src/Makefile
	cd vendor/mosml/src && $(MAKE) world CC="$(NATIVE_CC)" || true
	test -x vendor/mosml/src/runtime/camlrunm

# 2. Wasm runtime (browser MEMFS variant + Node NODERAWFS variant).
wasm: native
	$(MAKE) -C wasm

# 3. Rebuild all bytecode artifacts in 32-bit extern format by running the
#    build's bytecode steps under the wasm runtime.
bytecode32: wasm
	scripts/build-bytecode-32.sh

# 4. Pack mosmltop + stdlib for the browser virtual filesystem.
assets: bytecode32
	node scripts/pack-assets.mjs

test:
	node tests/node/run-bytecode.test.mjs
	node tests/node/run-source.test.mjs
	node tests/node/timeout.test.mjs
	node tests/browser/browser.test.mjs

serve:
	@echo "open http://127.0.0.1:8000/web/"
	python3 -m http.server 8000

.PHONY: all native wasm bytecode32 assets test serve
