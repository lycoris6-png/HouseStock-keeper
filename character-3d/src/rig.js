// Skeleton definition + pose application.
// Rest pose is an A-pose. Every bone has identity rotation at rest, so a bone's local axes equal world axes.
import * as THREE from 'three';
import { V, DEG } from './geo.js';

// [name, parent, world rest position]
const CENTER = [
  ['Hips', null, [0, 0.93, 0]],
  ['Spine', 'Hips', [0, 1.03, 0]],
  ['Chest', 'Spine', [0, 1.17, 0.004]],
  ['UpperChest', 'Chest', [0, 1.30, 0]],
  ['Neck', 'UpperChest', [0, 1.41, 0]],
  ['Head', 'Neck', [0, 1.49, -0.005]],
];

// Left side (+X). '@Name' = parent on the same side. Mirrored for the right side.
const SIDE = [
  ['Shoulder', 'UpperChest', [0.035, 1.375, -0.005]],
  ['UpperArm', '@Shoulder', [0.19, 1.36, -0.005]],
  ['LowerArm', '@UpperArm', [0.278, 1.089, -0.005]],
  ['Hand', '@LowerArm', [0.329, 0.8455, 0.025]],
  ['UpperLeg', 'Hips', [0.088, 0.885, 0.0]],
  ['LowerLeg', '@UpperLeg', [0.12, 0.47, 0.012]],
  ['Foot', '@LowerLeg', [0.13, 0.085, -0.004]],
  ['Toes', '@Foot', [0.13, 0.03, 0.135]],
];

// Scarf tail chain (hangs down the back at rest).
export const SCARF_REST = [
  [0.05, 1.4, -0.1],
  [0.052, 1.275, -0.13],
  [0.054, 1.15, -0.136],
  [0.056, 1.025, -0.14],
  [0.058, 0.9, -0.144],
  [0.06, 0.775, -0.148],
];
const SCARF_END = [0.062, 0.65, -0.15];

export const BONE_ORDER = [];

export function buildRig() {
  const defs = [];
  for (const d of CENTER) defs.push({ name: d[0], parent: d[1], p: V(...d[2]) });
  for (const s of [1, -1]) {
    const pre = s > 0 ? 'Left' : 'Right';
    for (const d of SIDE) {
      const parent = d[1].startsWith('@') ? pre + d[1].slice(1) : d[1];
      defs.push({ name: pre + d[0], parent, p: V(d[2][0] * s, d[2][1], d[2][2]) });
    }
  }
  SCARF_REST.forEach((p, i) =>
    defs.push({ name: `Scarf${i + 1}`, parent: i === 0 ? 'UpperChest' : `Scarf${i}`, p: V(...p) }),
  );

  const bones = [];
  const byName = {};
  const index = {};
  for (const d of defs) {
    const b = new THREE.Bone();
    b.name = d.name;
    b.userData.rest = d.p.clone();
    byName[d.name] = b;
    index[d.name] = bones.length;
    bones.push(b);
  }
  const firstChild = {};
  for (const d of defs) {
    const b = byName[d.name];
    if (d.parent) {
      byName[d.parent].add(b);
      b.position.copy(d.p).sub(byName[d.parent].userData.rest);
      if (!firstChild[d.parent]) firstChild[d.parent] = d.name;
    } else {
      b.position.copy(d.p);
    }
  }

  // rest axis (toward main child / end point)
  for (const d of defs) {
    const b = byName[d.name];
    let end;
    if (firstChild[d.name]) end = byName[firstChild[d.name]].userData.rest.clone();
    else if (d.name === 'Head') end = V(0, 1.72, 0);
    else if (d.name.endsWith('Toes')) end = V(d.p.x, 0.03, 0.265);
    else if (d.name.endsWith('Hand')) {
      const lower = byName[d.name.replace('Hand', 'LowerArm')].userData.rest;
      end = d.p.clone().add(d.p.clone().sub(lower).normalize().multiplyScalar(0.1));
    } else if (d.name === 'Scarf6') end = V(...SCARF_END);
    else end = d.p.clone().add(V(0, -0.1, 0));
    b.userData.end = end;
    b.userData.restAxis = end.clone().sub(d.p).normalize();
    b.userData.restSide = V(1, 0, 0);
  }

  const root = byName.Hips;
  const rig = {
    root,
    bones,
    byName,
    index,
    rest: (name) => byName[name].userData.rest.clone(),
    end: (name) => byName[name].userData.end.clone(),
    reset() {
      for (const b of bones) {
        b.quaternion.identity();
        b.scale.set(1, 1, 1);
        const parent = b.parent && b.parent.isBone ? b.parent : null;
        if (parent) b.position.copy(b.userData.rest).sub(parent.userData.rest);
        else b.position.copy(b.userData.rest);
      }
      root.updateMatrixWorld(true);
    },
  };
  return rig;
}

// ---------------------------------------------------------------------------

const _q = new THREE.Quaternion();
const worldQ = (b) => b.getWorldQuaternion(_q).clone();

function basisFrom(axis, side) {
  const a = axis.clone().normalize();
  let s = side.clone().addScaledVector(a, -side.dot(a));
  if (s.lengthSq() < 1e-6) s = Math.abs(a.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
  s.addScaledVector(a, -s.dot(a)).normalize();
  const c = new THREE.Vector3().crossVectors(a, s);
  return new THREE.Matrix4().makeBasis(a, s, c);
}

/** Rotate `bone` so that its rest axis points along `axisW` and its rest side along `sideW` (world space). */
export function orient(bone, axisW, sideW, rollDeg = 0) {
  let side = sideW.clone();
  if (rollDeg) {
    const a = axisW.clone().normalize();
    side.applyAxisAngle(a, rollDeg * DEG);
  }
  const R = basisFrom(axisW, side).multiply(basisFrom(bone.userData.restAxis, bone.userData.restSide).transpose());
  const qWorld = new THREE.Quaternion().setFromRotationMatrix(R);
  const pq = bone.parent ? worldQ(bone.parent) : new THREE.Quaternion();
  bone.quaternion.copy(pq.invert().multiply(qWorld));
  bone.updateMatrixWorld(true);
}

const euler = (r) => new THREE.Euler((r.pitch || 0) * DEG, (r.yaw || 0) * DEG, (r.roll || 0) * DEG, 'YXZ');

export function applyPose(rig, pose) {
  rig.reset();
  const B = rig.byName;
  if (!pose || Object.keys(pose).length === 0) return;
  const set = (name, r) => r && B[name].quaternion.setFromEuler(euler(r));
  if (pose.hips) {
    if (pose.hips.pos) B.Hips.position.add(V(...pose.hips.pos));
    set('Hips', pose.hips);
  }
  set('Spine', pose.spine);
  set('Chest', pose.chest);
  set('UpperChest', pose.upperChest);
  set('Neck', pose.neck);
  set('Head', pose.head);
  rig.root.updateMatrixWorld(true);

  const hipsLeft = V(1, 0, 0).applyQuaternion(worldQ(B.Hips));
  const chestLeft = V(1, 0, 0).applyQuaternion(worldQ(B.UpperChest));

  const limb = (S, spec, ref, names) => {
    if (!spec) return;
    const [a, b, c] = [V(...spec[names[0]]).normalize(), V(...spec[names[1]]).normalize(), V(...spec[names[2]]).normalize()];
    let hinge = new THREE.Vector3().crossVectors(a, b);
    if (hinge.length() < 0.25) hinge = ref.clone();
    else hinge.normalize();
    if (hinge.dot(ref) < 0) hinge.negate();
    if (spec.hinge) hinge = V(...spec.hinge).normalize();
    return { a, b, c, hinge };
  };

  for (const [S, key] of [['Left', 'legL'], ['Right', 'legR']]) {
    const L = pose[key];
    const r = limb(S, L, hipsLeft, ['thigh', 'shin', 'foot']);
    if (!r) continue;
    orient(B[`${S}UpperLeg`], r.a, r.hinge, L.roll || 0);
    orient(B[`${S}LowerLeg`], r.b, r.hinge, L.roll || 0);
    orient(B[`${S}Foot`], r.c, r.hinge, L.footRoll || 0);
    orient(B[`${S}Toes`], r.c, r.hinge, L.footRoll || 0);
    if (L.toes) orient(B[`${S}Toes`], V(...L.toes).normalize(), r.hinge, L.footRoll || 0);
  }
  for (const [S, key] of [['Left', 'armL'], ['Right', 'armR']]) {
    const A = pose[key];
    const r = limb(S, A, chestLeft, ['upper', 'fore', 'hand']);
    if (!r) continue;
    orient(B[`${S}UpperArm`], r.a, r.hinge, A.roll || 0);
    orient(B[`${S}LowerArm`], r.b, r.hinge, A.roll || 0);
    orient(B[`${S}Hand`], r.c, r.hinge, A.handRoll || 0);
  }
  if (pose.scarf) {
    pose.scarf.forEach((d, i) => {
      const side = pose.scarfSide ? V(...pose.scarfSide[i % pose.scarfSide.length]) : V(0, 1, 0);
      orient(B[`Scarf${i + 1}`], V(...d).normalize(), side, 0);
    });
  }
  rig.root.updateMatrixWorld(true);
}
