/* Machine config for wasm32 (Emscripten): 32-bit little-endian.
   ALIGNMENT is defined so unalignd.h composes multi-byte operands bytewise:
   wasm tolerates unaligned loads, but bytewise reads are endian-explicit and
   keep SAFE_HEAP debugging usable. */
#undef SIXTYFOUR
#undef MOSML_BIG_ENDIAN
#define ALIGNMENT
#undef ALIGN_DOUBLE
