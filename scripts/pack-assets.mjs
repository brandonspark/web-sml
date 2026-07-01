// Pack the Moscow ML toplevel + stdlib into a single binary bundle:
//   dist/mosml-assets.data  (concatenated file bytes)
//   dist/mosml-assets.json  (manifest: [{path, offset, size}, ...])
// The runner writes these into the Emscripten FS under /mosml/lib.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, 'vendor/mosml/src');

const files = [
  { vpath: 'mosmltop', host: join(src, 'compiler/mosmltop') },
  ...readdirSync(join(src, 'mosmllib'))
    .filter((f) => f.endsWith('.ui') || f.endsWith('.uo'))
    .map((f) => ({ vpath: f, host: join(src, 'mosmllib', f) })),
];

const manifest = [];
const chunks = [];
let offset = 0;
for (const { vpath, host } of files) {
  const bytes = readFileSync(host);
  manifest.push({ path: vpath, offset, size: bytes.length });
  chunks.push(bytes);
  offset += bytes.length;
}

writeFileSync(join(root, 'dist/mosml-assets.data'), Buffer.concat(chunks));
writeFileSync(join(root, 'dist/mosml-assets.json'), JSON.stringify(manifest));
console.log(`packed ${manifest.length} files, ${offset} bytes`);
