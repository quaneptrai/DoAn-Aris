import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

process.chdir(dirname(fileURLToPath(import.meta.url)));
const out = resolve('../wwwroot/resume-engine');
await mkdir(out, { recursive: true });
execFileSync(process.execPath, ['generate-contract.mjs'], { stdio: 'inherit', windowsHide: true });
await copyFile('catalog/external-templates.json', resolve(out, 'external-templates.json'));
const importedFontFiles = [
  'arimo-regular.ttf', 'arimo-bold.ttf', 'arimo-italic.ttf', 'arimo-bold-italic.ttf',
  'caladea-regular.ttf', 'caladea-bold.ttf', 'caladea-italic.ttf', 'caladea-bold-italic.ttf',
  'carlito-regular.ttf', 'carlito-bold.ttf', 'carlito-italic.ttf', 'carlito-bold-italic.ttf',
  'cousine-regular.ttf', 'cousine-bold.ttf', 'cousine-italic.ttf', 'cousine-bold-italic.ttf',
  'tinos-regular.ttf', 'tinos-bold.ttf', 'tinos-italic.ttf', 'tinos-bold-italic.ttf',
  'LICENSE-Arimo-OFL-1.1.txt', 'LICENSE-Caladea-OFL-1.1.txt', 'LICENSE-Carlito-OFL-1.1.txt',
  'LICENSE-Cousine-OFL-1.1.txt', 'LICENSE-Tinos-OFL-1.1.txt', 'README.md',
];
const importedFontOut = resolve(out, 'fonts');
await mkdir(importedFontOut, { recursive: true });
await Promise.all(importedFontFiles.map(file => copyFile(resolve('src/imported-fonts', file), resolve(importedFontOut, file))));
if (!process.env.RESUME_ENGINE_HTML_ONLY) {
  execFileSync(process.execPath, ['./node_modules/@tailwindcss/cli/dist/index.mjs', '-i', './src/tailwind.css', '-o', resolve(out, 'utilities.css'), '--minify'], { stdio: 'inherit', windowsHide: true });
  await build({ entryPoints: ['src/main.tsx'], outdir: out, entryNames: 'app', bundle: true, minify: true,
    target: 'es2022', jsx: 'automatic', loader: { '.tsx': 'tsx', '.ts': 'ts', '.css': 'css' },
    // These are copied above as stable static deployment assets, not imports
    // for esbuild to fingerprint or resolve from the filesystem root.
    external: ['/resume-engine/fonts/*'],
    publicPath: '/resume-engine', metafile: true });
}
const html = (await readFile('index.html', 'utf8'))
  .replace('</head>', '  <link rel="stylesheet" href="/resume-engine/utilities.css" />\n  <link rel="stylesheet" href="/resume-engine/app.css" />\n</head>')
  .replace('<script type="module" src="/src/main.tsx"></script>', '<script type="module" src="/resume-engine/app.js"></script>');
await writeFile(resolve(out, 'index.html'), html);
