// Validate the exported GLB files with the Khronos glTF validator and print a short structural summary.
//   node validate.mjs [file.glb ...]   (defaults to dist/*.glb)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import validator from 'gltf-validator';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const files = process.argv.length > 2
  ? process.argv.slice(2)
  : fs.readdirSync(dist).filter((f) => f.endsWith('.glb')).map((f) => path.join(dist, f));

let failed = false;
for (const file of files) {
  const buf = fs.readFileSync(file);
  const report = await validator.validateBytes(new Uint8Array(buf), { uri: file, maxIssues: 200 });
  const { numErrors, numWarnings, numInfos } = report.issues;
  const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
  console.log(`\n${path.relative(root, file)}  (${(buf.length / 1024).toFixed(0)} KB)`);
  console.log(`  validator : ${numErrors} errors, ${numWarnings} warnings, ${numInfos} infos`);
  console.log(
    `  structure : ${json.skins?.[0]?.joints?.length ?? 0} joints, ${json.meshes?.length} mesh / ${json.meshes?.[0]?.primitives?.length} primitives, ` +
      `${json.materials?.length} materials, ${json.textures?.length ?? 0} textures, ${json.accessors?.length} accessors`,
  );
  for (const m of report.issues.messages.filter((m) => m.severity <= 1).slice(0, 10)) {
    console.log(`  ${m.severity === 0 ? 'ERROR' : 'WARN '} ${m.code} ${m.pointer}`);
  }
  if (numErrors > 0) failed = true;
}
process.exit(failed ? 1 : 0);
