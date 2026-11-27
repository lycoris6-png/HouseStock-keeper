// Export rigged GLB files and preview renders using headless Chromium (needs `npm run build` first).
//   node export.mjs            -> dist/character_pose.glb, dist/character_apose.glb, previews/*.jpg
//   node export.mjs glb        -> GLB files only
//   node export.mjs previews   -> preview JPEGs only
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const previews = path.join(root, 'previews');
const mode = process.argv[2] || 'all';
const viewer = path.join(dist, 'viewer.html');
if (!fs.existsSync(viewer)) {
  console.error('dist/viewer.html not found. Run `npm run build` first.');
  process.exit(1);
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(`file://${viewer}?ui=0&dpr=1`);
await page.waitForFunction(() => document.documentElement.dataset.ready === '1', null, { timeout: 120000 });

if (mode === 'all' || mode === 'glb') {
  for (const [pose, file] of [['leap', 'character_pose.glb'], ['apose', 'character_apose.glb']]) {
    const b64 = await page.evaluate((p) => window.__hero.exportGLBBase64(p), pose);
    const out = path.join(dist, file);
    fs.writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log(`wrote ${path.relative(root, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
  }
}

if (mode === 'all' || mode === 'previews') {
  fs.mkdirSync(previews, { recursive: true });
  const shots = [
    ['pose_front', 'leap', 0],
    ['pose_three_quarter', 'leap', 38],
    ['pose_side', 'leap', 90],
    ['pose_back', 'leap', 180],
    ['apose_front', 'apose', 0],
    ['apose_side', 'apose', 90],
    ['apose_back', 'apose', 180],
  ];
  for (const [name, pose, az] of shots) {
    await page.evaluate(([p, a]) => {
      window.__hero.setPose(p);
      window.__hero.setView(a, 6, 1);
    }, [pose, az]);
    await page.waitForTimeout(500);
    const out = path.join(previews, `${name}.jpg`);
    await page.screenshot({ path: out, type: 'jpeg', quality: 90 });
    console.log(`wrote ${path.relative(root, out)}`);
  }
}
await browser.close();
