// Procedural anime-style character: orange-scarf hero with spiky auburn hair, black tunic over white shirt,
// blue cargo pants. Everything is built in an A-pose and skinned to the skeleton from rig.js.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  V, clamp, lerp, sstep, rowsAt, smoothPath, sweep, loopTube, place, quatFromTo, fixWinding,
  normalizeAttrs, skinRigid, skinChain, makeDecal, rayHit, mirrorX, cutTriangles, DEG,
} from './geo.js';
import { buildRig, applyPose, SCARF_REST } from './rig.js';
import { MAT, MAT_INDEX } from './materials.js';
import { FACE_REGION, EMBLEM_REGION } from './textures.js';
import { HEAD_C, HEAD_R } from './dims.js';
import { POSES } from './poses.js';

// RoundedBoxGeometry is non-indexed in three r160; weld it so it merges with indexed geometry.
const rbox = (w, h, d, seg, r) => mergeVertices(new RoundedBoxGeometry(w, h, d, seg, r), 1e-5);

export { HEAD_C, HEAD_R };
const HAIR_SCALE = V(1.17, 1.09, 1.12);

// Torso shell rows keyed by y: [rx, rz, centre z]
const TORSO_ROWS = [
  [0.9, 0.168, 0.118, 0.0],
  [0.975, 0.172, 0.122, 0.0],
  [1.02, 0.16, 0.116, 0.002],
  [1.1, 0.15, 0.108, 0.004],
  [1.2, 0.163, 0.114, 0.008],
  [1.3, 0.178, 0.112, 0.004],
  [1.36, 0.19, 0.104, -0.004],
  [1.4, 0.15, 0.088, -0.006],
  [1.425, 0.088, 0.07, -0.004],
  [1.445, 0.062, 0.06, 0.0],
];

// Baggy cargo-pants leg rows keyed by y: [rx, rz]
const LEG_ROWS = [
  [0.04, 0.118, 0.118],
  [0.085, 0.108, 0.108],
  [0.15, 0.108, 0.108],
  [0.28, 0.108, 0.108],
  [0.47, 0.116, 0.118],
  [0.6, 0.128, 0.126],
  [0.72, 0.136, 0.132],
  [0.85, 0.124, 0.126],
  [0.95, 0.104, 0.112],
  [1.0, 0.08, 0.095],
  [1.1, 0.07, 0.09],
];

const HAIRLINE = [[0, 24], [20, 22], [40, 16], [60, 8], [80, -2], [100, -12], [125, -24], [160, -36], [180, -38]];
const hairline = (phiDeg) => {
  const a = Math.abs((((phiDeg + 180) % 360) + 360) % 360 - 180);
  return rowsAt(HAIRLINE, a)[0];
};

// ---------------------------------------------------------------------------

function circleBasis(axis) {
  const a = axis.clone().normalize();
  const h = Math.abs(a.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(h, a).normalize();
  const v = new THREE.Vector3().crossVectors(a, u).normalize();
  return { u, v, a };
}

/** Ring (closed loop tube) around `axis` through `center`. */
function ringAround(center, axis, R, a, b, opt = {}) {
  const { u, v, a: ax } = circleBasis(axis);
  return loopTube(
    (th) => {
      const N = u.clone().multiplyScalar(Math.cos(th)).addScaledVector(v, Math.sin(th));
      const Rr = typeof R === 'function' ? R(th) : R;
      return { c: center.clone().addScaledVector(N, Rr), N, B: ax.clone().negate(), a, b };
    },
    { segments: opt.segments ?? 40, radial: opt.radial ?? 10, ...opt },
  );
}

function torsoLoft(y0, y1, grow, { rings = 44, radial = 56, flare = null } = {}) {
  const pts = [];
  for (let i = 0; i < rings; i++) pts.push(V(0, lerp(y0, y1, i / (rings - 1)), 0));
  return sweep(
    pts,
    (k) => {
      const y = pts[k].y;
      const row = rowsAt(TORSO_ROWS, y);
      let rx = row[0], rz = row[1];
      const cz = row[2];
      if (flare) {
        const f = flare(y);
        rx += f;
        rz += f * 0.7;
      }
      return { rx: rx + grow, ry: rz + grow, oy: -cz, pow: 2.3 };
    },
    { radial, hint: V(1, 0, 0) },
  );
}

function shapeHem(geo, yBottom, yRef, hemFn) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y >= yRef) continue;
    const hem = hemFn(x, z);
    const t = (y - yBottom) / (yRef - yBottom);
    p.setY(i, hem + t * (yRef - hem));
  }
  geo.computeVertexNormals();
}

function rnd(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ---------------------------------------------------------------------------
// Head, face, hair
// ---------------------------------------------------------------------------

function headGeometry() {
  let g = new THREE.SphereGeometry(1, 72, 52);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const u = Math.max(0, -y);
    const jaw = 1 - 0.3 * Math.pow(u, 1.3) - 0.26 * Math.pow(u, 3.0);
    const depth = 1 - 0.1 * u;
    const X = x * HEAD_R.x * jaw;
    const Y = y * HEAD_R.y * (1 + 0.045 * u);
    let Z = z * HEAD_R.z * depth;
    Z += 0.012 * Math.pow(u, 2.5) * (z > 0 ? 1 : 0.3);
    p.setXYZ(i, HEAD_C.x + X, HEAD_C.y + Y, HEAD_C.z + Z);
  }
  g.computeVertexNormals();
  return g;
}

function surf(phiDeg, elDeg, scale = 1) {
  const p = phiDeg * DEG, e = elDeg * DEG;
  const d = V(Math.sin(p) * Math.cos(e), Math.sin(e), Math.cos(p) * Math.cos(e));
  const pt = V(d.x * HEAD_R.x * scale, d.y * HEAD_R.y * scale, d.z * HEAD_R.z * scale).add(HEAD_C);
  const n = V(d.x / HEAD_R.x, d.y / HEAD_R.y, d.z / HEAD_R.z).normalize();
  return { pt, n };
}

function hairCap() {
  const nphi = 72, nt = 28;
  const P = [], C = [], I = [];
  for (let i = 0; i < nt; i++) {
    const t = i / (nt - 1);
    for (let j = 0; j < nphi; j++) {
      const phi = (j / nphi) * 360;
      const el = lerp(hairline(phi), 90, Math.pow(t, 0.9));
      const sf = surf(phi, el, 1);
      const s = { pt: V(HEAD_C.x + (sf.pt.x - HEAD_C.x) * HAIR_SCALE.x, HEAD_C.y + (sf.pt.y - HEAD_C.y) * HAIR_SCALE.y, HEAD_C.z + (sf.pt.z - HEAD_C.z) * HAIR_SCALE.z) };
      P.push(s.pt.x, s.pt.y, s.pt.z);
      C.push(0.66, 0.5, 0.45);
    }
  }
  for (let i = 0; i < nt - 1; i++) {
    for (let j = 0; j < nphi; j++) {
      const j1 = (j + 1) % nphi;
      const a = i * nphi + j, b = (i + 1) * nphi + j, c = (i + 1) * nphi + j1, d = i * nphi + j1;
      I.push(a, b, c, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  return fixWinding(g, HEAD_C);
}

// Hair clumps: flat, flame-shaped blades that lie on the scalp, flow toward a whorl at the upper back
// and lift off the head at the tip. {phi, el} start (deg, phi 0 = front, + = character's left),
// flow ('up' | 'back' | 'down' | [x,y,z]), a = sweep angle (deg), lift = tip height above scalp (m),
// w = blade width (m), th = thickness (m), delta = heading offset (deg, + = toward character's right).
const CLUMPS = [
  // front row (just behind the hairline)
  { phi: -58, el: 22, flow: 'up', a: 60, lift: 0.055, w: 0.09, delta: 14 },
  { phi: -36, el: 28, flow: 'up', a: 62, lift: 0.095, w: 0.095, delta: 12 },
  { phi: -12, el: 31, flow: 'up', a: 60, lift: 0.07, w: 0.092, delta: 4 },
  { phi: 12, el: 31, flow: 'up', a: 60, lift: 0.065, w: 0.092, delta: -4 },
  { phi: 36, el: 28, flow: 'up', a: 60, lift: 0.06, w: 0.09, delta: -10 },
  { phi: 58, el: 22, flow: 'up', a: 56, lift: 0.05, w: 0.088, delta: -16 },
  // middle row
  { phi: -70, el: 48, flow: 'up', a: 42, lift: 0.07, w: 0.092, delta: 24 },
  { phi: -42, el: 55, flow: 'up', a: 42, lift: 0.095, w: 0.092, delta: 12 },
  { phi: -14, el: 58, flow: 'up', a: 40, lift: 0.1, w: 0.092, delta: 4 },
  { phi: 14, el: 58, flow: 'up', a: 40, lift: 0.09, w: 0.092, delta: -4 },
  { phi: 42, el: 55, flow: 'up', a: 42, lift: 0.08, w: 0.092, delta: -12 },
  { phi: 70, el: 48, flow: 'up', a: 42, lift: 0.07, w: 0.092, delta: -24 },
  // crown spikes: tallest leans toward the character's right-front
  { phi: -38, el: 72, flow: 'up', a: 28, lift: 0.135, w: 0.088, delta: 12 },
  { phi: -8, el: 76, flow: 'up', a: 28, lift: 0.115, w: 0.085, delta: 2 },
  { phi: 24, el: 72, flow: 'up', a: 28, lift: 0.1, w: 0.085, delta: -6 },
  { phi: 54, el: 68, flow: 'up', a: 28, lift: 0.09, w: 0.082, delta: -14 },
  { phi: -68, el: 66, flow: 'up', a: 28, lift: 0.1, w: 0.082, delta: 22 },
  { phi: 82, el: 62, flow: 'up', a: 28, lift: 0.08, w: 0.08, delta: -22 },
  // sides, behind the ears
  { phi: -98, el: 28, flow: 'back', a: 46, lift: 0.07, w: 0.09, delta: 12 },
  { phi: 98, el: 28, flow: 'back', a: 46, lift: 0.07, w: 0.09, delta: -12 },
  { phi: -118, el: 46, flow: 'back', a: 42, lift: 0.085, w: 0.092 },
  { phi: 118, el: 46, flow: 'back', a: 42, lift: 0.085, w: 0.092 },
  // back
  { phi: 150, el: 36, flow: 'back', a: 40, lift: 0.08, w: 0.092 },
  { phi: -150, el: 36, flow: 'back', a: 40, lift: 0.08, w: 0.092 },
  { phi: 180, el: 52, flow: 'back', a: 36, lift: 0.1, w: 0.092 },
  { phi: 172, el: 20, flow: 'back', a: 36, lift: 0.07, w: 0.09 },
  { phi: -172, el: 20, flow: 'back', a: 36, lift: 0.07, w: 0.09 },
  { phi: 138, el: 12, flow: 'back', a: 34, lift: 0.06, w: 0.085 },
  { phi: -138, el: 12, flow: 'back', a: 34, lift: 0.06, w: 0.085 },
  // lower side and nape strands
  { phi: -105, el: 8, flow: 'back', a: 38, lift: 0.05, w: 0.085, delta: 8 },
  { phi: 105, el: 8, flow: 'back', a: 38, lift: 0.05, w: 0.085, delta: -8 },
  { phi: -128, el: 16, flow: 'back', a: 36, lift: 0.055, w: 0.09 },
  { phi: 128, el: 16, flow: 'back', a: 36, lift: 0.055, w: 0.09 },
  { phi: -150, el: -2, flow: 'down', a: 30, lift: 0.04, w: 0.088 },
  { phi: 150, el: -2, flow: 'down', a: 30, lift: 0.04, w: 0.088 },
  { phi: -172, el: -10, flow: 'down', a: 28, lift: 0.035, w: 0.09 },
  { phi: 172, el: -10, flow: 'down', a: 28, lift: 0.035, w: 0.09 },
  { phi: 180, el: -22, flow: 'down', a: 24, lift: 0.03, w: 0.09 },
  // sideburn locks and the temple spike (placed toward the front so they read face-on)
  { phi: -60, el: 30, flow: 'down', a: 38, lift: 0.03, w: 0.062, th: 0.011, delta: -4 },
  { phi: 60, el: 30, flow: 'down', a: 36, lift: 0.03, w: 0.062, th: 0.011, delta: 4 },
  { phi: -72, el: 38, flow: [-1, -0.35, 0.45], a: 26, lift: 0.06, w: 0.066, th: 0.012 },
  { phi: 72, el: 38, flow: [1, -0.35, 0.3], a: 24, lift: 0.05, w: 0.066, th: 0.012 },
];

const FLOWS = {
  up: V(0, 1, -0.95).normalize(),
  back: V(0, 0.25, -1).normalize(),
  down: V(0, -1, -0.15).normalize(),
};

function clumpGeometry(c, idx) {
  const F = Array.isArray(c.flow) ? V(...c.flow).normalize() : FLOWS[c.flow];
  const steps = 14;
  const dth = (c.a * DEG) / steps;
  let d = V(
    Math.sin(c.phi * DEG) * Math.cos(c.el * DEG),
    Math.sin(c.el * DEG),
    Math.cos(c.phi * DEG) * Math.cos(c.el * DEG),
  );
  const pts = [];
  let width0 = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const n = V(d.x / (HEAD_R.x * HAIR_SCALE.x), d.y / (HEAD_R.y * HAIR_SCALE.y), d.z / (HEAD_R.z * HAIR_SCALE.z)).normalize();
    pts.push(
      V(HEAD_C.x + d.x * HEAD_R.x * HAIR_SCALE.x, HEAD_C.y + d.y * HEAD_R.y * HAIR_SCALE.y, HEAD_C.z + d.z * HEAD_R.z * HAIR_SCALE.z).addScaledVector(
        n,
        c.lift * Math.pow(t, 1.4),
      ),
    );
    let u = F.clone().addScaledVector(d, -F.dot(d));
    if (u.lengthSq() < 1e-6) u = V(1, 0, 0).addScaledVector(d, -d.x);
    u.normalize();
    if (c.delta) {
      const dl = c.delta * DEG;
      u = u.multiplyScalar(Math.cos(dl)).addScaledVector(new THREE.Vector3().crossVectors(d, u), Math.sin(dl));
    }
    if (i === 0) width0 = new THREE.Vector3().crossVectors(d, u).normalize();
    d = d.multiplyScalar(Math.cos(dth)).addScaledVector(u, Math.sin(dth)).normalize();
  }
  const th0 = c.th ?? 0.017;
  const jitter = 0.94 + 0.06 * rnd(idx);
  const prof = (t) =>
    t < 0.3 ? 0.45 + 0.55 * Math.sin(((t / 0.3) * Math.PI) / 2) : Math.pow(Math.max(0, 1 - Math.pow((t - 0.3) / 0.7, 1.7)), 0.8);
  return sweep(
    pts,
    (k, t) => ({ rx: 0.5 * c.w * prof(t) + 0.0006, ry: 0.5 * th0 * (1 - 0.8 * t) + 0.0005, pow: 2.4 }),
    {
      radial: 10,
      hint: width0,
      capStart: true,
      colorFn: (k) => {
        const t = k / steps;
        const m = sstep(t, 0.05, 0.75);
        return [lerp(0.6, 1, m) * jitter, lerp(0.4, 1, m) * jitter, lerp(0.36, 1, m) * jitter];
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Hand, shoe
// ---------------------------------------------------------------------------

function fistGeometry() {
  const parts = [];
  const palm = rbox(0.08, 0.09, 0.064, 4, 0.022);
  place(palm, { pos: V(0.004, -0.05, 0) });
  parts.push(palm);
  for (const z of [-0.024, -0.008, 0.008, 0.024]) {
    const f = new THREE.CapsuleGeometry(0.0105, 0.034, 4, 8);
    f.rotateZ(Math.PI / 2);
    place(f, { pos: V(-0.016, -0.091, z) });
    parts.push(f);
  }
  const th = new THREE.CapsuleGeometry(0.0115, 0.03, 4, 8);
  th.rotateZ(Math.PI / 2 - 0.25);
  place(th, { pos: V(-0.012, -0.068, 0.038) });
  parts.push(th);
  return mergeGeometries(parts, false);
}

function soleGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.078);
  s.bezierCurveTo(0.03, -0.078, 0.042, -0.06, 0.043, -0.03);
  s.bezierCurveTo(0.044, 0.03, 0.05, 0.1, 0.054, 0.15);
  s.bezierCurveTo(0.058, 0.215, 0.034, 0.262, 0, 0.266);
  s.bezierCurveTo(-0.034, 0.262, -0.058, 0.215, -0.054, 0.15);
  s.bezierCurveTo(-0.05, 0.1, -0.044, 0.03, -0.043, -0.03);
  s.bezierCurveTo(-0.042, -0.06, -0.03, -0.078, 0, -0.078);
  let g = new THREE.ExtrudeGeometry(s, {
    depth: 0.024, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 20,
  });
  g.clearGroups();
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-6);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0.028, 0);
  // toe spring
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    if (z > 0.15) p.setY(i, p.getY(i) + 0.022 * Math.pow((z - 0.15) / 0.12, 2));
  }
  g.computeVertexNormals();
  return g;
}

function shoeUpperGeometry() {
  const rows = [
    // z, half-height, half-width, vertical centre
    [-0.076, 0.044, 0.03, 0.074],
    [-0.055, 0.052, 0.039, 0.082],
    [-0.01, 0.054, 0.043, 0.086],
    [0.05, 0.044, 0.046, 0.074],
    [0.115, 0.035, 0.05, 0.065],
    [0.18, 0.029, 0.05, 0.059],
    [0.23, 0.023, 0.04, 0.053],
    [0.262, 0.012, 0.018, 0.047],
  ];
  const pts = [];
  const n = 22;
  for (let i = 0; i < n; i++) pts.push(V(0, 0, lerp(-0.076, 0.262, i / (n - 1))));
  return sweep(
    pts,
    (k) => {
      const [h, w, c] = rowsAt(rows.map((r) => [r[0], r[1], r[2], r[3]]), pts[k].z);
      return { rx: h, ry: w, ox: c, pow: 2.4 };
    },
    { radial: 28, hint: V(0, 1, 0), capStart: true, capEnd: true },
  );
}

// ---------------------------------------------------------------------------

export function buildParts(rig, { skip = [] } = {}) {
  const parts = [];
  const bi = (n) => rig.index[n];
  const wanted = (name) => !skip.some((s) => name.startsWith(s));

  const add = (name, mat, geo, skin, opt = {}) => {
    if (!wanted(name)) return geo;
    normalizeAttrs(geo, { outline: opt.outline ?? 1, color: opt.tint });
    if (skin.rigid) skinRigid(geo, bi(skin.rigid));
    else skinChain(geo, skin.joints, skin.bones, skin.blends);
    parts.push({ name, mat: MAT_INDEX[mat], geo });
    return geo;
  };
  const rigid = (bone) => ({ rigid: bone });
  const chain = (names, blends, pre = null, endPoint = null) => {
    const joints = [], bones = [];
    if (pre) {
      joints.push(pre.p.clone());
      bones.push(bi(pre.bone));
    }
    names.forEach((n) => {
      joints.push(rig.rest(n));
      bones.push(bi(n));
    });
    joints.push(endPoint ?? rig.end(names[names.length - 1]));
    return { joints, bones, blends };
  };
  const torsoChain = () => chain(['Hips', 'Spine', 'Chest', 'UpperChest', 'Neck', 'Head'], [0.07, 0.07, 0.06, 0.03, 0.03]);

  // ------------------------------ head ------------------------------
  const head = headGeometry();
  const headForRay = head.clone();
  add('head.skin', 'skin', head, rigid('Head'));
  add('head.neck', 'skin', sweep([V(0, 1.38, 0), V(0, 1.44, 0), V(0, 1.5, 0.004)], () => ({ rx: 0.047, ry: 0.047 }), {
    radial: 20, hint: V(1, 0, 0), capStart: true, capEnd: true,
  }), chain(['Neck', 'Head'], [0.04]));
  for (const s of [1, -1]) {
    const ear = new THREE.SphereGeometry(1, 20, 14);
    ear.scale(0.012, 0.03, 0.02);
    ear.rotateZ(s * -0.12);
    place(ear, { pos: V(s * 0.0985, 1.583, -0.006) });
    add(`head.ear${s}`, 'skin', ear, rigid('Head'));
  }
  add('face.decal', 'face', makeDecal(headForRay, FACE_REGION, 64, 64, { offset: 0.0012 }), rigid('Head'), { outline: 0 });

  // ------------------------------ hair ------------------------------
  add('hair.cap', 'hair', hairCap(), rigid('Head'));
  CLUMPS.forEach((c, i) => add(`hair.clump${i}`, 'hair', clumpGeometry(c, i), rigid('Head'), { outline: 0.85 }));

  // ------------------------------ torso garments ------------------------------
  const shirt = torsoLoft(0.93, 1.445, 0.012, { flare: (y) => 0.012 * (1 - sstep(y, 0.93, 1.12)) });
  shapeHem(shirt, 0.93, 1.07, (x, z) => {
    const f = z / (Math.hypot(x, z) + 1e-6);
    return 0.945 + 0.075 * sstep(f, 0.25, 0.92) + 0.018 * sstep(-f, 0.4, 0.95);
  });
  add('shirt.body', 'shirt', shirt, torsoChain());

  const tunicFull = torsoLoft(1.045, 1.445, 0.022, { flare: (y) => 0.01 * (1 - sstep(y, 1.045, 1.15)) });
  shapeHem(tunicFull, 1.045, 1.12, (x, z) => {
    const f = z / (Math.hypot(x, z) + 1e-6);
    return 1.062 + 0.02 * sstep(f, 0.3, 0.95);
  });
  const tunicUncut = tunicFull.clone();
  cutTriangles(tunicFull, (c) => !(c.z > 0.01 && c.y > 1.212 + 1.95 * Math.abs(c.x)));
  add('tunic.body', 'tunic', tunicFull, torsoChain());

  // gold V-neck trim
  {
    const pts = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) pts.push(0.108 * (1 - i / steps));
    const xs = [...pts, ...pts.slice(0, -1).reverse().map((x) => -x)].filter((x, i, a) => i === 0 || x !== a[i - 1]);
    const path = xs.map((x) => {
      const y = 1.212 + 1.95 * Math.abs(x);
      const hit = rayHit(tunicUncut, V(x, y, 2), V(0, 0, -1));
      return V(x, y, (hit ? hit.point.z : 0.1) + 0.003);
    });
    add('tunic.vtrim', 'gold', sweep(smoothPath(path, 40), () => ({ rx: 0.0068, ry: 0.0068 }), {
      radial: 8, capStart: true, capEnd: true,
    }), torsoChain(), { outline: 0.7 });
  }
  add('tunic.emblem', 'emblem', makeDecal(tunicUncut, EMBLEM_REGION, 44, 52, { offset: 0.002 }), torsoChain(), { outline: 0 });

  // ------------------------------ arms ------------------------------
  for (const s of [1, -1]) {
    const S = s > 0 ? 'Left' : 'Right';
    const sh = rig.rest(`${S}UpperArm`), el = rig.rest(`${S}LowerArm`), wr = rig.rest(`${S}Hand`);
    const armDir = wr.clone().sub(el).normalize();
    const armChain = (blends) =>
      chain([`${S}Shoulder`, `${S}UpperArm`, `${S}LowerArm`, `${S}Hand`], blends);

    // white undershirt sleeve
    const sleevePts = smoothPath(
      [
        sh.clone().add(V(-s * 0.022, -0.012, 0)),
        sh,
        sh.clone().lerp(el, 0.5),
        el,
        el.clone().lerp(wr, 0.5),
        wr.clone().addScaledVector(armDir, 0.014),
      ],
      28,
    );
    const sleeveRows = [[0, 0.056], [0.12, 0.057], [0.45, 0.053], [0.55, 0.051], [0.85, 0.047], [0.94, 0.046], [1, 0.05]];
    add(`shirt.sleeve${s}`, 'shirt', sweep(sleevePts, (k, t) => {
      const r = rowsAt(sleeveRows, t)[0];
      return { rx: r, ry: r };
    }, { radial: 22, hint: V(0, 0, 1), capStart: true, capEnd: true }), armChain([0.05, 0.06, 0.03]));

    // black short sleeve + gold cuff
    const endP = sh.clone().lerp(el, 0.62);
    const blackPts = smoothPath([sh.clone().add(V(-s * 0.025, -0.006, 0)), sh, endP], 14);
    add(`tunic.sleeve${s}`, 'tunic', sweep(blackPts, (k, t) => ({ rx: lerp(0.068, 0.064, t), ry: lerp(0.068, 0.064, t) }), {
      radial: 24, hint: V(0, 0, 1), capStart: true,
    }), armChain([0.05, 0.06, 0.03]));
    const axisU = blackPts[blackPts.length - 1].clone().sub(blackPts[blackPts.length - 2]).normalize();
    add(`tunic.cuff${s}`, 'gold', ringAround(blackPts[blackPts.length - 1], axisU, 0.0655, 0.0072, 0.0072, { segments: 36, radial: 8 }),
      armChain([0.05, 0.06, 0.03]), { outline: 0.7 });

    // fist
    const fist = fistGeometry();
    fist.scale(1.12, 1.12, 1.12);
    if (s < 0) mirrorX(fist);
    place(fist, { pos: wr.clone().addScaledVector(armDir, 0.008), quat: quatFromTo(V(0, -1, 0), armDir) });
    add(`hand.fist${s}`, 'skin', fist, rigid(`${S}Hand`), { outline: 0.8 });
  }

  // ------------------------------ pants ------------------------------
  {
    const rows = [
      [0.78, 0.125, 0.1, 0],
      [0.84, 0.148, 0.108, 0],
      [0.93, 0.16, 0.113, 0],
      [0.99, 0.151, 0.107, 0],
      [1.012, 0.147, 0.104, 0],
    ];
    const pts = [];
    for (let i = 0; i < 16; i++) pts.push(V(0, lerp(0.78, 1.012, i / 15), 0));
    const pelvis = sweep(pts, (k) => {
      const r = rowsAt(rows, pts[k].y);
      return { rx: r[0], ry: r[1], pow: 2.4 };
    }, { radial: 48, hint: V(1, 0, 0), capStart: true, capEnd: true });
    add('pants.pelvis', 'pants', pelvis, torsoChain());
  }
  const legGeos = {};
  for (const s of [1, -1]) {
    const S = s > 0 ? 'Left' : 'Right';
    const hip = rig.rest(`${S}UpperLeg`), knee = rig.rest(`${S}LowerLeg`), ankle = rig.rest(`${S}Foot`);
    const pts = smoothPath(
      [
        hip.clone().add(V(-s * 0.022, 0.1, 0)),
        hip,
        hip.clone().lerp(knee, 0.45),
        knee,
        knee.clone().lerp(ankle, 0.5),
        ankle.clone().add(V(0, 0.015, 0)),
        ankle.clone().add(V(0, -0.035, 0)),
      ],
      46,
    );
    const leg = sweep(
      pts,
      (k) => {
        const r = rowsAt(LEG_ROWS, pts[k].y);
        return { rx: r[0], ry: r[1], pow: 2.3 };
      },
      {
        radial: 36,
        hint: V(1, 0, 0),
        capStart: true,
        radialMod: (k, th, ring) => {
          const y = ring.c.y;
          const A = 0.022 * Math.exp(-Math.pow((y - 0.47) / 0.1, 2)) + 0.03 * Math.exp(-Math.pow((y - 0.1) / 0.07, 2));
          return 1 + A * Math.sin(7 * th + 23 * y);
        },
      },
    );
    legGeos[s] = leg.clone();
    const legChain = () =>
      chain([`${S}UpperLeg`, `${S}LowerLeg`, `${S}Foot`], [0.08, 0.07, 0.04], { bone: 'Hips', p: hip.clone().add(V(0, 0.1, 0)) }, rig.rest(`${S}Toes`));
    add(`pants.leg${s}`, 'pants', leg, legChain());

    // cargo pocket on the outer thigh
    {
      const y = 0.665, z = 0.02;
      const hit = rayHit(legGeos[s], V(s * 1.0, y, z), V(-s, 0, 0));
      if (hit) {
        const nrm = hit.normal.clone();
        if (nrm.dot(V(s, 0, 0)) < 0) nrm.negate();
        const q = quatFromTo(V(1, 0, 0), nrm);
        const at = (off, along) => hit.point.clone().addScaledVector(nrm, off).add(V(0, along, 0).applyQuaternion(q));
        const box = rbox(0.04, 0.17, 0.134, 3, 0.012);
        place(box, { pos: at(0.014, 0), quat: q });
        add(`pants.pocket${s}`, 'pants', box, legChain(), { outline: 0.8 });
        const flap = rbox(0.044, 0.052, 0.14, 3, 0.013);
        place(flap, { pos: at(0.019, 0.064), quat: q });
        add(`pants.flap${s}`, 'pants', flap, legChain(), { outline: 0.8 });
        const btn = new THREE.CylinderGeometry(0.0095, 0.0095, 0.008, 14);
        btn.rotateZ(-Math.PI / 2);
        place(btn, { pos: at(0.043, 0.058), quat: q });
        add(`pants.button${s}`, 'gold', btn, legChain(), { outline: 0.5 });
      }
    }

    // sneaker
    {
      const footC = rig.rest(`${S}Foot`);
      const place0 = (g) => place(g.scale(1.1, 1.08, 1.1), { pos: V(footC.x, 0, footC.z) });
      const shoeChain = () => chain([`${S}Foot`, `${S}Toes`], [0.025]);
      add(`shoe.sole${s}`, 'sole', place0(soleGeometry()), shoeChain(), { outline: 0.9 });
      add(`shoe.upper${s}`, 'shoe', place0(shoeUpperGeometry()), shoeChain(), { outline: 0.9 });
      const tab = rbox(0.024, 0.05, 0.012, 3, 0.005);
      place(tab, { pos: V(footC.x, 0.088, footC.z - 0.082) });
      add(`shoe.tab${s}`, 'sole', tab, shoeChain(), { outline: 0.6 });
      const strap = rbox(0.098, 0.024, 0.046, 3, 0.008);
      place(strap, { pos: V(footC.x, 0.108, footC.z + 0.06), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.28, 0, 0)) });
      add(`shoe.strap${s}`, 'shoe', strap, shoeChain(), { outline: 0.6 });
    }
  }

  // ------------------------------ belt & pouches ------------------------------
  {
    const Rx = 0.154, Rz = 0.109, y = 0.992;
    const belt = loopTube(
      (th) => {
        const c = V(Rx * Math.cos(th), y, Rz * Math.sin(th));
        const N = V(Math.cos(th) / Rx, 0, Math.sin(th) / Rz).normalize();
        return { c, N, B: V(0, 1, 0), a: 0.005, b: 0.02, pow: 4 };
      },
      { segments: 72, radial: 14 },
    );
    add('belt.strap', 'leather', belt, torsoChain(), { outline: 0.8 });
    const frame = rbox(0.054, 0.042, 0.012, 3, 0.005);
    place(frame, { pos: V(0, y, Rz + 0.008) });
    add('belt.buckle', 'metal', frame, torsoChain(), { outline: 0.7 });
    const hole = rbox(0.032, 0.022, 0.006, 3, 0.003);
    place(hole, { pos: V(0, y, Rz + 0.0125) });
    add('belt.buckleHole', 'shoe', hole, torsoChain(), { outline: 0 });

    for (const s of [1, -1]) {
      const big = s > 0;
      const dims = big ? [0.058, 0.108, 0.094] : [0.046, 0.12, 0.062];
      const cy = big ? 0.895 : 0.89, cz = big ? 0.045 : -0.03;
      const pouch = rbox(dims[0], dims[1], dims[2], 3, 0.012);
      place(pouch, { pos: V(s * (big ? 0.222 : 0.226), cy, cz) });
      add(`belt.pouch${s}`, 'leather', pouch, torsoChain(), { outline: 0.8 });
      const flap = rbox(dims[0] + 0.006, 0.04, dims[2] + 0.006, 3, 0.012);
      place(flap, { pos: V(s * (big ? 0.222 : 0.226), cy + dims[1] / 2 - 0.012, cz) });
      add(`belt.pouchFlap${s}`, 'leather', flap, torsoChain(), { outline: 0.8, tint: [0.82, 0.74, 0.7] });
      const stud = new THREE.CylinderGeometry(0.007, 0.007, 0.006, 12);
      stud.rotateZ(-Math.PI / 2 * s);
      place(stud, { pos: V(s * (big ? 0.222 : 0.226) + s * (dims[0] / 2 + 0.006), cy + dims[1] / 2 - 0.016, cz) });
      add(`belt.pouchStud${s}`, 'gold', stud, torsoChain(), { outline: 0.5 });
    }
  }

  // ------------------------------ scarf ------------------------------
  {
    const neckChain = () => chain(['UpperChest', 'Neck'], [0.06]);
    const droop = (th, k, w) => Math.exp(-Math.pow(((th - w) * 180) / Math.PI / 55, 2)) * k;
    const wrinkle = (k, th) => 1 + 0.09 * Math.sin(2.0 * th + k * 0.62) * Math.cos(k * 0.17 + 1.0) + 0.04 * Math.sin(5 * th - k * 0.9);
    const ringA = loopTube(
      (th) => {
        const y = 1.44 - droop(th, 0.016, 1.9);
        const R = 0.088 + droop(th, 0.012, 1.9);
        return { c: V(R * Math.cos(th), y, 0.004 + R * Math.sin(th)), a: 0.046, b: 0.042 };
      },
      { segments: 72, radial: 20, radialMod: wrinkle },
    );
    add('scarf.ringA', 'scarf', ringA, neckChain());
    const ringB = loopTube(
      (th) => {
        const y = 1.395 - droop(th, 0.05, 2.2) - droop(th, 0.012, 1.2);
        const R = 0.11 + droop(th, 0.014, 2.1);
        return {
          c: V(R * Math.cos(th), y, 0.012 + R * Math.sin(th)),
          a: 0.052 + droop(th, 0.014, 2.1),
          b: 0.046 + droop(th, 0.012, 2.1),
        };
      },
      { segments: 84, radial: 20, radialMod: wrinkle },
    );
    add('scarf.ringB', 'scarf', ringB, neckChain());

    // drape: puffy end of the scarf lying over the character's right chest
    {
      const pts = smoothPath(
        [V(-0.05, 1.375, 0.132), V(-0.078, 1.325, 0.15), V(-0.092, 1.265, 0.155), V(-0.094, 1.215, 0.15)],
        20,
      );
      const drape = sweep(
        pts,
        (k, t) => ({
          rx: lerp(0.058, 0.05, t) * (1 - 0.35 * sstep(t, 0.8, 1)),
          ry: 0.019 * (1 - 0.4 * sstep(t, 0.85, 1)),
          pow: 2.6,
        }),
        { radial: 18, hint: V(1, 0, 0), capStart: true, capEnd: true },
      );
      add('scarf.drape', 'scarf', drape, torsoChain());
    }

    // tail: wide flat ribbon with ripples and a swallow-tail end; hangs down the back at rest
    const endPt = V(0.062, 0.65, -0.15);
    const tailPts = smoothPath([...SCARF_REST.map((p) => V(...p)), endPt], 60);
    const tail = sweep(tailPts, (k, t) => ({ rx: lerp(0.075, 0.09, t), ry: 0.0075, pow: 4 }), {
      radial: 24,
      hint: V(1, 0, 0),
      capStart: true,
      capEnd: true,
      colorFn: (k) => {
        const t = k / (tailPts.length - 1);
        return [1, lerp(1, 0.86, t), lerp(1, 0.72, t)];
      },
    });
    {
      const p = tail.attributes.position;
      const yEnd = 0.65, D = 0.105, hw = 0.092;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) - 0.062;
        let y = p.getY(i), z = p.getZ(i);
        const e = Math.min(1, Math.abs(x) / hw);
        const ph = ((1.4 - y) / 0.2) * Math.PI * 2;
        z += 0.013 * Math.sin(ph) * (0.3 + 0.7 * e) + 0.008 * Math.sin(ph * 1.9 + Math.sign(x) * 1.4) * e * e;
        const w = sstep(y, yEnd + 0.14, yEnd);
        y += D * Math.max(0, 1 - Math.abs(x) / hw) * w;
        p.setY(i, y);
        p.setZ(i, z);
      }
      tail.computeVertexNormals();
    }
    add(
      'scarf.tail',
      'scarf',
      tail,
      chain(SCARF_REST.map((_, i) => `Scarf${i + 1}`), [0.05, 0.05, 0.05, 0.05, 0.05], null, endPt),
    );
  }

  return parts;
}

// ---------------------------------------------------------------------------

export function mergeParts(parts) {
  const byMat = MAT.map(() => []);
  for (const p of parts) byMat[p.mat].push(p.geo);
  const geos = [], used = [];
  MAT.forEach((n, i) => {
    if (byMat[i].length) {
      geos.push(mergeGeometries(byMat[i], false));
      used.push(i);
    }
  });
  const merged = mergeGeometries(geos, true);
  merged.groups.forEach((g, gi) => {
    g.materialIndex = used[gi];
  });
  return merged;
}

export function createCharacter(materials, opts = {}) {
  const rig = buildRig();
  const parts = buildParts(rig, opts);
  const geometry = mergeParts(parts);

  const group = new THREE.Group();
  group.name = 'Character';
  group.add(rig.root);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(rig.bones);

  const body = new THREE.SkinnedMesh(geometry, materials.toon);
  body.name = 'Body';
  body.frustumCulled = false;
  group.add(body);
  body.bind(skeleton);

  const outline = new THREE.SkinnedMesh(geometry, materials.outline);
  outline.name = 'Outline';
  outline.frustumCulled = false;
  group.add(outline);
  outline.bind(skeleton);

  const api = {
    group, rig, skeleton, body, outline, geometry, parts, materials,
    pose: 'apose',
    setPose(name, { clearance } = {}) {
      api.pose = name;
      applyPose(rig, POSES[name]);
      rig.root.updateMatrixWorld(true);
      skeleton.update();
      const c = clearance ?? POSES[name]?.clearance ?? 0;
      const minY = api.lowestPoint();
      rig.root.position.y += c - minY;
      rig.root.updateMatrixWorld(true);
      skeleton.update();
    },
    lowestPoint() {
      const pos = geometry.attributes.position;
      const v = V();
      let min = Infinity;
      for (let i = 0; i < pos.count; i += 3) {
        v.fromBufferAttribute(pos, i);
        body.applyBoneTransform(i, v);
        if (v.y < min) min = v.y;
      }
      return min;
    },
  };
  return api;
}
