// Bundle the viewer (three.js + character code) into a single self-contained HTML file.
//   dist/viewer.html     - standalone page (has GLB download buttons)
//   .tmp/artifact.html   - fragment for publishing as a claude.ai Artifact (no downloads in that sandbox)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const tmp = path.join(root, '.tmp');
fs.mkdirSync(dist, { recursive: true });
fs.mkdirSync(tmp, { recursive: true });

const result = await build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  legalComments: 'none',
  logLevel: 'warning',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const head = fs.readFileSync(path.join(root, 'src/head.html'), 'utf8').trim();
const body = fs.readFileSync(path.join(root, 'src/body.html'), 'utf8').trim();

const standalone = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
</head>
<body>
${body}
<script>window.__HERO_CONFIG = { export: true };</script>
<script>${js}</script>
</body>
</html>
`;
const artifact = `${head}
${body}
<script>window.__HERO_CONFIG = { export: false };</script>
<script>${js}</script>
`;

fs.writeFileSync(path.join(dist, 'viewer.html'), standalone);
fs.writeFileSync(path.join(tmp, 'artifact.html'), artifact);
const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(0)} KB`;
console.log(`dist/viewer.html ${kb(standalone)}  |  .tmp/artifact.html ${kb(artifact)}`);
