// Viewer app: toon + ink outline, PBR (what the GLB looks like), pose / view presets, GLB export.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createCharacter } from './character.js';
import { createMaterials } from './materials.js';
import { makeFaceTexture, makeEmblemTexture } from './textures.js';

const cfg = window.__HERO_CONFIG || {};
const params = new URLSearchParams(location.search);
if (params.get('ui') === '0') document.body.classList.add('no-ui');

const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, params.get('dpr') ? Number(params.get('dpr')) : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.2;
controls.maxDistance = 10;
controls.maxPolarAngle = Math.PI * 0.56;
controls.autoRotateSpeed = 1.6;

// ---- lights -------------------------------------------------------------
const key = new THREE.DirectionalLight(0xffffff, 3.0);
key.position.set(-2.2, 3.4, 4.2);
const rim = new THREE.DirectionalLight(0xbfd6ff, 1.3);
rim.position.set(3, 2.5, -3);
const fill = new THREE.AmbientLight(0xffffff, 0.22);
scene.add(key, rim, fill);

const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---- ground shadow ------------------------------------------------------
function makeShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 6, 128, 128, 126);
  grad.addColorStop(0, 'rgba(20,24,40,0.55)');
  grad.addColorStop(0.55, 'rgba(20,24,40,0.22)');
  grad.addColorStop(1, 'rgba(20,24,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 48),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.001;
  m.renderOrder = -1;
  return m;
}
const shadow = makeShadow();
scene.add(shadow);

// ---- character ----------------------------------------------------------
const faceTex = makeFaceTexture();
const emblemTex = makeEmblemTexture();
const materials = createMaterials({ faceTex, emblemTex });
const hide = (params.get('hide') || '').split(',').filter(Boolean);
const chr = createCharacter(materials, { skip: hide });
scene.add(chr.group);

const state = { pose: 'leap', style: 'toon', outline: true, wire: false };

function bounds() {
  const pos = chr.geometry.attributes.position;
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 4) {
    v.fromBufferAttribute(pos, i);
    chr.body.applyBoneTransform(i, v);
    box.expandByPoint(v);
  }
  return box;
}

function frameDistance(box) {
  const size = box.getSize(new THREE.Vector3());
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const dv = (size.y * 0.7) / Math.tan(fov / 2);
  const dh = (Math.max(size.x, size.z) * 0.7) / (Math.tan(fov / 2) * camera.aspect);
  return Math.max(dv, dh, 3.4);
}

let currentBox = new THREE.Box3();
function setPose(name) {
  state.pose = name;
  chr.setPose(name);
  currentBox = bounds();
  const c = currentBox.getCenter(new THREE.Vector3());
  // aim a little below the model's centre so it sits above the control dock
  controls.target.set(0, c.y - currentBox.getSize(new THREE.Vector3()).y * 0.06, 0);
  shadow.position.y = 0.001;
  syncUI();
}

function setView(azDeg, elDeg = 6, distMul = 1, target = null) {
  const d = frameDistance(currentBox) * distMul;
  if (Array.isArray(target)) controls.target.set(target[0], target[1], target[2]);
  else if (typeof target === 'number') controls.target.set(0, target, 0);
  const az = THREE.MathUtils.degToRad(azDeg), el = THREE.MathUtils.degToRad(elDeg);
  const t = controls.target;
  camera.position.set(
    t.x + d * Math.sin(az) * Math.cos(el),
    t.y + d * Math.sin(el),
    t.z + d * Math.cos(az) * Math.cos(el),
  );
  camera.lookAt(t);
  controls.update();
}

function setStyle(name) {
  state.style = name;
  chr.body.material = name === 'toon' ? materials.toon : materials.pbr;
  chr.outline.visible = name === 'toon' && state.outline;
  scene.environment = name === 'pbr' ? envTex : null;
  key.intensity = name === 'toon' ? 3.0 : 1.6;
  rim.intensity = name === 'toon' ? 1.3 : 0.7;
  fill.intensity = name === 'toon' ? 0.22 : 0.0;
  applyWire();
  syncUI();
}

function setOutline(on) {
  state.outline = on;
  chr.outline.visible = state.style === 'toon' && on;
  syncUI();
}

function applyWire() {
  for (const set of [materials.toon, materials.pbr]) for (const m of set) m.wireframe = state.wire;
}
function setWire(on) {
  state.wire = on;
  applyWire();
  syncUI();
}

function setSpin(on) {
  controls.autoRotate = on;
  syncUI();
}

// ---- GLB export ---------------------------------------------------------
async function exportGLB(poseName) {
  const prevPose = state.pose;
  const prevMat = chr.body.material;
  const prevOutline = chr.outline.visible;
  chr.setPose(poseName);
  chr.body.material = materials.pbr;
  chr.outline.visible = false;
  const exportGeo = chr.geometry.clone();
  exportGeo.deleteAttribute('outlineScale');
  const prevGeo = chr.body.geometry;
  chr.body.geometry = exportGeo;
  chr.body.bind(chr.skeleton, chr.body.bindMatrix);
  try {
    const exporter = new GLTFExporter();
    // skeleton root and skinned mesh are exported as sibling scene roots (glTF requires skinned meshes at the root)
    const buf = await exporter.parseAsync([chr.rig.root, chr.body], { binary: true, trs: true, onlyVisible: true });
    return buf;
  } finally {
    chr.body.geometry = prevGeo;
    chr.body.material = prevMat;
    chr.outline.visible = prevOutline;
    chr.setPose(prevPose);
    exportGeo.dispose();
  }
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(s);
}

// Minimal store-only ZIP writer (the artifact `downloads` capability accepts .zip but not .glb)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zipStore(files) {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const chunks = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data), size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true); // UTF-8 file names
    lh.setUint16(8, 0, true); // stored
    lh.setUint16(10, dosTime, true);
    lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true);
    lh.setUint32(22, size, true);
    lh.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(lh.buffer), name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(12, dosTime, true);
    ch.setUint16(14, dosDate, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, size, true);
    ch.setUint32(24, size, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + size;
  }
  const centralSize = central.reduce((a, c) => a + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
async function makeGlbZip() {
  const files = [];
  for (const [pose, name] of [['leap', 'character_pose.glb'], ['apose', 'character_apose.glb']]) {
    files.push({ name, data: new Uint8Array(await exportGLB(pose)) });
  }
  return zipStore(files);
}

async function downloadGLB(poseName) {
  const buf = await exportGLB(poseName);
  const blob = new Blob([buf], { type: 'model/gltf-binary' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = poseName === 'leap' ? 'character_pose.glb' : 'character_apose.glb';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---- UI -----------------------------------------------------------------
const $ = (id) => document.getElementById(id);
function syncUI() {
  const mark = (id, on) => {
    const el = $(id);
    if (el) el.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
  mark('pose-leap', state.pose === 'leap');
  mark('pose-apose', state.pose === 'apose');
  mark('style-toon', state.style === 'toon');
  mark('style-pbr', state.style === 'pbr');
  mark('opt-outline', state.outline);
  mark('opt-wire', state.wire);
  mark('opt-spin', controls.autoRotate);
  const ol = $('opt-outline');
  if (ol) ol.disabled = state.style !== 'toon';
}

function bindUI() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', fn);
  };
  on('pose-leap', () => { setPose('leap'); setView(0); });
  on('pose-apose', () => { setPose('apose'); setView(0); });
  on('style-toon', () => setStyle('toon'));
  on('style-pbr', () => setStyle('pbr'));
  on('view-front', () => setView(0));
  on('view-q', () => setView(38));
  on('view-side', () => setView(90));
  on('view-back', () => setView(180));
  on('opt-outline', () => setOutline(!state.outline));
  on('opt-wire', () => setWire(!state.wire));
  on('opt-spin', () => setSpin(!controls.autoRotate));
  const dlGroup = document.querySelector('.seg.dl');
  if (cfg.export !== false) {
    on('dl-pose', () => downloadGLB('leap'));
    on('dl-apose', () => downloadGLB('apose'));
    $('dl-zip')?.setAttribute('hidden', '');
  } else {
    // Inside an artifact: direct downloads are blocked, so offer a .zip through the `downloads` capability
    $('dl-pose')?.setAttribute('hidden', '');
    $('dl-apose')?.setAttribute('hidden', '');
    dlGroup?.setAttribute('hidden', '');
    const asked = window.claude && typeof window.claude.use === 'function' ? window.claude.use('downloads') : null;
    Promise.resolve(asked)
      .catch(() => null)
      .then((dl) => {
        if (!dl) return;
        dlGroup?.removeAttribute('hidden');
        const btn = $('dl-zip');
        btn?.removeAttribute('hidden');
        on('dl-zip', async () => {
          const label = '2つのGLBをZIPで保存';
          btn.disabled = true;
          btn.textContent = '書き出し中…';
          let note = label;
          try {
            await dl.save({ filename: 'scarf-hero_glb.zip', data: await makeGlbZip() });
            note = '保存しました';
          } catch (e) {
            note = e && e.code === 'declined' ? label : '保存できませんでした';
          }
          btn.disabled = false;
          btn.textContent = note;
          if (note !== label) setTimeout(() => { btn.textContent = label; }, 2600);
        });
      });
  }
  const stats = $('stats');
  if (stats) {
    const tris = Math.round(chr.geometry.index.count / 3);
    stats.textContent = `${chr.rig.bones.length} ボーン · ${tris.toLocaleString('ja-JP')} ポリゴン · ${chr.parts.length} パーツ`;
  }
}

// ---- loop ---------------------------------------------------------------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', () => {
  resize();
});

function tick() {
  controls.update();
  const d = camera.position.distanceTo(controls.target);
  materials.uniforms.uOutline.value = 0.0036 * (d / 5.0);
  renderer.render(scene, camera);
}

resize();
bindUI();
setStyle(params.get('style') || 'toon');
setPose(params.get('pose') || 'leap');
setView(Number(params.get('az') ?? 0), Number(params.get('el') ?? 6), Number(params.get('zoom') ?? 1), params.get('ty') !== null ? Number(params.get('ty')) : null);
if (params.get('wire') === '1') setWire(true);
renderer.setAnimationLoop(tick);

// Hooks for scripted capture / export
window.__hero = {
  chr, scene, camera, controls, renderer, materials, state,
  setPose, setView, setStyle, setOutline, setWire, setSpin, resize,
  bounds: () => bounds(),
  boneWorld: (name) => chr.rig.byName[name].getWorldPosition(new THREE.Vector3()).toArray(),
  async zipBase64() {
    return toBase64(await (await makeGlbZip()).arrayBuffer());
  },
  async exportGLBBase64(poseName) {
    return toBase64(await exportGLB(poseName));
  },
  ready: true,
};
document.documentElement.dataset.ready = '1';
