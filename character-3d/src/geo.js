// Geometry toolkit: swept tubes, closed loops, skin weights, decals.
// Units are meters, +Y up, character faces +Z, character's LEFT is +X (glTF convention).
import * as THREE from 'three';

export const DEG = Math.PI / 180;
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = THREE.MathUtils.clamp;
export const lerp = THREE.MathUtils.lerp;
export const sstep = (x, a, b) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Catmull-Rom interpolation over rows: rows[i] = [key, v1, v2, ...]. Returns [v1, v2, ...]. */
export function rowsAt(rows, key) {
  const n = rows.length;
  if (key <= rows[0][0]) return rows[0].slice(1);
  if (key >= rows[n - 1][0]) return rows[n - 1].slice(1);
  let i = 0;
  while (i < n - 2 && key > rows[i + 1][0]) i++;
  const r0 = rows[Math.max(0, i - 1)], r1 = rows[i], r2 = rows[i + 1], r3 = rows[Math.min(n - 1, i + 2)];
  const u = (key - r1[0]) / (r2[0] - r1[0]);
  const out = [];
  for (let k = 1; k < r1.length; k++) {
    const p0 = r0[k], p1 = r1[k], p2 = r2[k], p3 = r3[k];
    out.push(
      0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u),
    );
  }
  return out;
}

/** Smooth evenly spaced path through points. */
export function smoothPath(points, count) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return curve.getSpacedPoints(count);
}

// ---------------------------------------------------------------------------
// Tubes
// ---------------------------------------------------------------------------

/**
 * rings: [{c, N, B, rx, ry, ox, oy, pow}] with (N, B, T) right-handed where T is the progression direction.
 * Cross-section is a super-ellipse in the N/B plane.
 */
export function tubeFromRings(rings, opt = {}) {
  const radial = opt.radial ?? 20;
  const closed = !!opt.closed;
  const n = rings.length;
  const P = [], C = [], UV = [], I = [];
  for (let k = 0; k < n; k++) {
    const r = rings[k];
    const e = 2 / (r.pow ?? 2);
    for (let j = 0; j < radial; j++) {
      const th = (j / radial) * Math.PI * 2;
      const c = Math.cos(th), s = Math.sin(th);
      const x = Math.sign(c) * Math.pow(Math.abs(c), e);
      const y = Math.sign(s) * Math.pow(Math.abs(s), e);
      const m = opt.radialMod ? opt.radialMod(k, th, r) : 1;
      const a = x * r.rx * m + (r.ox || 0);
      const b = y * r.ry * m + (r.oy || 0);
      P.push(r.c.x + r.N.x * a + r.B.x * b, r.c.y + r.N.y * a + r.B.y * b, r.c.z + r.N.z * a + r.B.z * b);
      const col = opt.colorFn ? opt.colorFn(k, j, r) : null;
      if (col) C.push(col[0], col[1], col[2]);
      else C.push(1, 1, 1);
      UV.push(j / radial, k / Math.max(1, n - 1));
    }
  }
  const rowsN = closed ? n : n - 1;
  for (let k = 0; k < rowsN; k++) {
    const k1 = (k + 1) % n;
    for (let j = 0; j < radial; j++) {
      const j1 = (j + 1) % radial;
      const a = k * radial + j, b = k1 * radial + j, c = k1 * radial + j1, d = k * radial + j1;
      I.push(a, c, b, a, d, c);
    }
  }
  const addCap = (ring, k, atEnd) => {
    const ci = P.length / 3;
    const a = ring.ox || 0, b = ring.oy || 0;
    P.push(
      ring.c.x + ring.N.x * a + ring.B.x * b,
      ring.c.y + ring.N.y * a + ring.B.y * b,
      ring.c.z + ring.N.z * a + ring.B.z * b,
    );
    const ccol = opt.colorFn ? opt.colorFn(k, 0, ring) : null;
    if (ccol) C.push(ccol[0], ccol[1], ccol[2]);
    else C.push(1, 1, 1);
    UV.push(0.5, atEnd ? 1 : 0);
    for (let j = 0; j < radial; j++) {
      const j1 = (j + 1) % radial;
      const v0 = k * radial + j, v1 = k * radial + j1;
      if (atEnd) I.push(ci, v0, v1);
      else I.push(ci, v1, v0);
    }
  };
  if (!closed && opt.capStart) addCap(rings[0], 0, false);
  if (!closed && opt.capEnd) addCap(rings[n - 1], n - 1, true);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

function framesAlong(points, hint, twistFn) {
  const n = points.length;
  const T = points.map((_, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
    return b.clone().sub(a).normalize();
  });
  const N = [], B = [];
  let n0 = hint ? hint.clone() : V(0, 1, 0);
  if (Math.abs(n0.clone().normalize().dot(T[0])) > 0.95) n0 = Math.abs(T[0].x) < 0.9 ? V(1, 0, 0) : V(0, 0, 1);
  n0.addScaledVector(T[0], -n0.dot(T[0])).normalize();
  N.push(n0);
  for (let i = 1; i < n; i++) {
    const q = new THREE.Quaternion().setFromUnitVectors(T[i - 1], T[i]);
    const ni = N[i - 1].clone().applyQuaternion(q);
    ni.addScaledVector(T[i], -ni.dot(T[i])).normalize();
    N.push(ni);
  }
  for (let i = 0; i < n; i++) {
    B.push(new THREE.Vector3().crossVectors(T[i], N[i]).normalize());
    if (twistFn) {
      const a = twistFn(i / Math.max(1, n - 1), i);
      const c = Math.cos(a), s = Math.sin(a);
      const Nn = N[i].clone().multiplyScalar(c).addScaledVector(B[i], s);
      const Bn = B[i].clone().multiplyScalar(c).addScaledVector(N[i], -s);
      N[i] = Nn;
      B[i] = Bn;
    }
  }
  return { T, N, B };
}

/** Sweep a super-ellipse along a polyline. sec(k, t) -> {rx, ry, ox, oy, pow}. rx lies along the hint direction. */
export function sweep(points, sec, opt = {}) {
  const { N, B } = framesAlong(points, opt.hint, opt.twist);
  const n = points.length;
  const rings = points.map((c, k) => {
    const s = sec(k, k / Math.max(1, n - 1));
    return {
      c, N: N[k], B: B[k],
      rx: Math.max(s.rx, 1e-4), ry: Math.max(s.ry ?? s.rx, 1e-4),
      ox: s.ox || 0, oy: s.oy || 0, pow: s.pow || 2,
    };
  });
  return tubeFromRings(rings, opt);
}

/**
 * Closed loop tube around a roughly horizontal loop. fn(theta) -> {c, a, b, ox, oy, pow}:
 * a = half size outward (radial), b = half size vertical. theta 0 = +X (left), 90deg = +Z (front).
 */
export function loopTube(fn, opt = {}) {
  const M = opt.segments ?? 72;
  const rings = [];
  for (let i = 0; i < M; i++) {
    const th = (i / M) * Math.PI * 2;
    const s = fn(th);
    const N = s.N ? s.N.clone().normalize() : V(Math.cos(th), 0, Math.sin(th));
    const B = s.B ? s.B.clone().normalize() : V(0, 1, 0);
    rings.push({ c: s.c, N, B, rx: Math.max(s.a, 1e-4), ry: Math.max(s.b, 1e-4), ox: s.ox || 0, oy: s.oy || 0, pow: s.pow || 2 });
  }
  return tubeFromRings(rings, { ...opt, closed: true });
}

// ---------------------------------------------------------------------------
// Misc geometry helpers
// ---------------------------------------------------------------------------

export function place(geo, { pos, quat, scale } = {}) {
  const m = new THREE.Matrix4().compose(
    pos ?? V(),
    quat ?? new THREE.Quaternion(),
    scale ?? V(1, 1, 1),
  );
  geo.applyMatrix4(m);
  return geo;
}

/** Orient a unit axis to a target direction, return quaternion. */
export function quatFromTo(from, to) {
  return new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
}

/** Mirror a geometry across x = 0 (keeps winding outward). */
export function mirrorX(geo) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, -p.getX(i));
  const n = geo.attributes.normal;
  if (n) for (let i = 0; i < n.count; i++) n.setX(i, -n.getX(i));
  const idx = geo.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const t = idx[i + 1];
    idx[i + 1] = idx[i + 2];
    idx[i + 2] = t;
  }
  return geo;
}

/** Keep only triangles whose centroid satisfies keep(centroid). */
export function cutTriangles(geo, keep) {
  const p = geo.attributes.position, idx = geo.index.array;
  const out = [];
  const c = V(), t = V();
  for (let i = 0; i < idx.length; i += 3) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(t.fromBufferAttribute(p, idx[i + k]));
    c.multiplyScalar(1 / 3);
    if (keep(c)) out.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  geo.setIndex(out);
  return geo;
}

/** Flip triangle winding if the surface mostly faces toward `center` (i.e. inward). */
export function fixWinding(geo, center) {
  const p = geo.attributes.position, idx = geo.index.array;
  const a = V(), b = V(), c = V(), n = V(), m = V();
  let sum = 0;
  for (let i = 0; i < idx.length; i += 3) {
    a.fromBufferAttribute(p, idx[i]);
    b.fromBufferAttribute(p, idx[i + 1]);
    c.fromBufferAttribute(p, idx[i + 2]);
    n.crossVectors(b.clone().sub(a), c.clone().sub(a));
    m.copy(a).add(b).add(c).multiplyScalar(1 / 3).sub(center);
    sum += n.dot(m);
  }
  if (sum < 0) {
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
  }
  geo.computeVertexNormals();
  return geo;
}

export function signedVolume(geo) {
  const p = geo.attributes.position, idx = geo.index ? geo.index.array : null;
  const a = V(), b = V(), c = V();
  let v = 0;
  const count = idx ? idx.length : p.count;
  for (let i = 0; i < count; i += 3) {
    const i0 = idx ? idx[i] : i, i1 = idx ? idx[i + 1] : i + 1, i2 = idx ? idx[i + 2] : i + 2;
    a.fromBufferAttribute(p, i0);
    b.fromBufferAttribute(p, i1);
    c.fromBufferAttribute(p, i2);
    v += a.dot(b.clone().cross(c)) / 6;
  }
  return v;
}

/** Make sure a geometry carries exactly the attributes we merge on. */
export function normalizeAttrs(geo, { outline = 1, color = null } = {}) {
  if (!geo.index) {
    const n = geo.attributes.position.count;
    const idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  const n = geo.attributes.position.count;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  if (!geo.attributes.color) {
    const c = new Float32Array(n * 3).fill(1);
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  if (color) {
    const arr = geo.attributes.color.array;
    for (let i = 0; i < n; i++) {
      arr[i * 3] *= color[0];
      arr[i * 3 + 1] *= color[1];
      arr[i * 3 + 2] *= color[2];
    }
  }
  geo.setAttribute('outlineScale', new THREE.BufferAttribute(new Float32Array(n).fill(outline), 1));
  for (const name of Object.keys(geo.attributes)) {
    if (!['position', 'normal', 'uv', 'color', 'outlineScale', 'skinIndex', 'skinWeight'].includes(name)) geo.deleteAttribute(name);
  }
  return geo;
}

// ---------------------------------------------------------------------------
// Skinning
// ---------------------------------------------------------------------------

function setSkin(geo, indices, weights) {
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
}

export function skinRigid(geo, boneIndex) {
  const n = geo.attributes.position.count;
  const idx = new Uint16Array(n * 4), w = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    idx[i * 4] = boneIndex;
    w[i * 4] = 1;
  }
  setSkin(geo, idx, w);
  return geo;
}

/**
 * Chain skinning: joints[0..m] are rest positions, bones[0..m-1] the bone index that owns segment i,
 * blends[0..m-2] the half width of the smooth blend around interior joint i+1.
 */
export function skinChain(geo, joints, bones, blends = []) {
  const pos = geo.attributes.position;
  const m = bones.length;
  const segs = [];
  let S = 0;
  for (let i = 0; i < m; i++) {
    const a = joints[i], d = joints[i + 1].clone().sub(joints[i]);
    const len = d.length();
    segs.push({ a, dd: d.clone().divideScalar(len), len, s0: S });
    S += len;
  }
  const n = pos.count;
  const idx = new Uint16Array(n * 4), wgt = new Float32Array(n * 4);
  const p = V(), q = V();
  for (let v = 0; v < n; v++) {
    p.fromBufferAttribute(pos, v);
    let best = Infinity, sBest = 0;
    for (const sg of segs) {
      const t = clamp(q.copy(p).sub(sg.a).dot(sg.dd), 0, sg.len);
      const dx = p.x - (sg.a.x + sg.dd.x * t), dy = p.y - (sg.a.y + sg.dd.y * t), dz = p.z - (sg.a.z + sg.dd.z * t);
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < best) {
        best = d2;
        sBest = sg.s0 + t;
      }
    }
    const step = new Array(m + 1).fill(0);
    step[0] = 1;
    for (let i = 1; i < m; i++) {
      const h = Math.max(1e-4, blends[i - 1] ?? 0.04);
      step[i] = sstep(sBest, segs[i].s0 - h, segs[i].s0 + h);
    }
    step[m] = 0;
    const w = [];
    for (let i = 0; i < m; i++) w.push({ b: bones[i], w: Math.max(0, step[i] - step[i + 1]) });
    w.sort((x, y) => y.w - x.w);
    // keep up to 4 meaningful influences, renormalise over exactly those, and make the float32 sum exact
    const use = w.slice(0, 4).filter((e) => e.w > 1e-5);
    if (use.length === 0) use.push({ b: bones[0], w: 1 });
    const tot = use.reduce((a, e) => a + e.w, 0);
    const f32 = new Float32Array(use.map((e) => e.w / tot));
    let rest = 0;
    for (let k = 1; k < f32.length; k++) rest += f32[k];
    f32[0] = 1 - rest;
    for (let k = 0; k < 4; k++) {
      idx[v * 4 + k] = k < use.length ? use[k].b : 0; // unused slots point at joint 0 with weight 0
      wgt[v * 4 + k] = k < use.length ? f32[k] : 0;
    }
  }
  setSkin(geo, idx, wgt);
  return geo;
}

// ---------------------------------------------------------------------------
// Decals: a grid patch projected onto a target mesh along a direction.
// ---------------------------------------------------------------------------

export function makeDecal(targetGeo, region, nx, ny, opt = {}) {
  const mesh = new THREE.Mesh(targetGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  const rc = new THREE.Raycaster();
  const dir = (opt.dir ?? V(0, 0, -1)).clone().normalize();
  const off = opt.offset ?? 0.0015;
  const zStart = region.z ?? 2;
  const grid = [];
  const ok = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = lerp(region.x0, region.x1, i / nx), y = lerp(region.y0, region.y1, j / ny);
      const origin = V(x, y, zStart);
      rc.set(origin, dir);
      const hit = rc.intersectObject(mesh, false)[0];
      if (hit) {
        grid.push(hit.point.clone());
        ok.push(true);
      } else {
        grid.push(V(x, y, 0));
        ok.push(false);
      }
    }
  }
  const at = (i, j) => grid[clamp(j, 0, ny) * (nx + 1) + clamp(i, 0, nx)];
  const P = [], N = [], UV = [], I = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const du = at(i + 1, j).clone().sub(at(i - 1, j));
      const dv = at(i, j + 1).clone().sub(at(i, j - 1));
      const n = du.cross(dv).normalize();
      if (n.dot(dir) > 0) n.negate();
      const p = at(i, j).clone().addScaledVector(n, off);
      P.push(p.x, p.y, p.z);
      N.push(n.x, n.y, n.z);
      UV.push(i / nx, j / ny);
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      if (!(ok[a] && ok[b] && ok[c] && ok[d])) continue;
      I.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  return ensureFacing(g, dir);
}

function ensureFacing(g, dir) {
  // triangles should face against the projection direction
  const p = g.attributes.position, idx = g.index.array;
  const a = V(), b = V(), c = V(), n = V();
  let sum = 0;
  for (let i = 0; i < idx.length; i += 3) {
    a.fromBufferAttribute(p, idx[i]);
    b.fromBufferAttribute(p, idx[i + 1]);
    c.fromBufferAttribute(p, idx[i + 2]);
    n.crossVectors(b.clone().sub(a), c.clone().sub(a));
    sum += n.dot(dir);
  }
  if (sum > 0) {
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
  }
  return g;
}

/** Closest surface hit along a ray against a geometry; returns {point, normal} or null. */
export function rayHit(targetGeo, origin, dir) {
  const mesh = new THREE.Mesh(targetGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  const rc = new THREE.Raycaster(origin, dir.clone().normalize());
  const hit = rc.intersectObject(mesh, false)[0];
  return hit ? { point: hit.point.clone(), normal: hit.face.normal.clone() } : null;
}
