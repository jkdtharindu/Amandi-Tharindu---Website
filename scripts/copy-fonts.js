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
  { pkg: '@fontsource/eb-garamond', files: ['400', '500', '600', '700'].map((w) => `eb-garamond-latin-${w}-normal`) },
  { pkg: '@fontsource/lora', files: ['400', '500', '600', '700'].map((w) => `lora-latin-${w}-normal`) },
  { pkg: '@fontsource/libre-baskerville', files: ['400', '700'].map((w) => `libre-baskerville-latin-${w}-normal`) },
  { pkg: '@fontsource/bodoni-moda', files: ['400', '500', '600', '700'].map((w) => `bodoni-moda-latin-${w}-normal`) },
  { pkg: '@fontsource/marcellus', files: ['400'].map((w) => `marcellus-latin-${w}-normal`) },
  { pkg: '@fontsource/cardo', files: ['400', '700'].map((w) => `cardo-latin-${w}-normal`) },
  { pkg: '@fontsource/great-vibes', files: ['400'].map((w) => `great-vibes-latin-${w}-normal`) },
  { pkg: '@fontsource/dancing-script', files: ['400', '500', '600', '700'].map((w) => `dancing-script-latin-${w}-normal`) },
  { pkg: '@fontsource/parisienne', files: ['400'].map((w) => `parisienne-latin-${w}-normal`) },
  { pkg: '@fontsource/montserrat', files: ['400', '500', '600', '700'].map((w) => `montserrat-latin-${w}-normal`) },
  { pkg: '@fontsource/josefin-sans', files: ['400', '500', '600', '700'].map((w) => `josefin-sans-latin-${w}-normal`) },
  { pkg: '@fontsource/raleway', files: ['400', '500', '600', '700'].map((w) => `raleway-latin-${w}-normal`) },
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
