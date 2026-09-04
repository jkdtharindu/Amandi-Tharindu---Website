// Copies the self-hosted webfont files referenced by src/theme/fontFaces.js
// from their @fontsource source packages into public/fonts/. Run this again
// if a weight/style is added to fontFaces.js. The output is committed to the
// repo, so this script does not need to run at deploy time.
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(rootDir, 'public', 'fonts');

const SOURCES = [
  { pkg: '@fontsource/cormorant-garamond', files: ['400-normal', '400-italic', '500-normal', '500-italic', '600-normal', '600-italic', '700-normal', '700-italic'].map((w) => `cormorant-garamond-latin-${w}`) },
  { pkg: '@fontsource/playfair-display', files: ['400', '500', '600', '700'].map((w) => `playfair-display-latin-${w}-normal`) },
  { pkg: '@fontsource/cinzel', files: ['400', '500', '600', '700'].map((w) => `cinzel-latin-${w}-normal`) },
  { pkg: '@fontsource/inter', files: ['400', '500', '600', '700'].map((w) => `inter-latin-${w}-normal`) },
];

mkdirSync(outDir, { recursive: true });

let copied = 0;
for (const { pkg, files } of SOURCES) {
  const filesDir = path.join(rootDir, 'node_modules', pkg, 'files');
  for (const name of files) {
    const src = path.join(filesDir, `${name}.woff2`);
    if (!existsSync(src)) {
      console.warn(`Missing expected font file: ${src}`);
      continue;
    }
    copyFileSync(src, path.join(outDir, `${name}.woff2`));
    copied += 1;
  }
}

console.log(`Copied ${copied} font files into public/fonts/`);
