// Material sets. All three sets share the same order so geometry groups line up:
//   toon    - anime shading used by the viewer
//   pbr     - MeshStandardMaterial set that is exported to GLB
//   outline - inverted-hull ink outline (decals are skipped)
import * as THREE from 'three';

export const MAT = [
  'skin', 'hair', 'scarf', 'tunic', 'gold', 'shirt', 'pants', 'leather', 'metal', 'shoe', 'sole', 'face', 'emblem',
];
export const MAT_INDEX = Object.fromEntries(MAT.map((n, i) => [n, i]));

// color = lit colour; sh / mid = multipliers for the shadow and mid bands (tinted per material, anime style)
const SPEC = {
  skin: { color: '#ffd3be', rough: 0.7, sh: [0.93, 0.7, 0.76], mid: [0.99, 0.9, 0.9] },
  hair: { color: '#c9612c', rough: 0.55, sh: [0.56, 0.44, 0.62], mid: [0.84, 0.76, 0.86] },
  scarf: { color: '#f68b24', rough: 0.9, sh: [0.86, 0.5, 0.46], mid: [0.96, 0.82, 0.78] },
  tunic: { color: '#201e29', rough: 0.8, sh: [0.7, 0.7, 0.9], mid: [0.9, 0.9, 1] },
  gold: { color: '#efb33c', rough: 0.35, metal: 0.55, sh: [0.78, 0.55, 0.5], mid: [0.92, 0.84, 0.8] },
  shirt: { color: '#f7f8ff', rough: 0.9, sh: [0.68, 0.76, 1.0], mid: [0.9, 0.93, 1] },
  pants: { color: '#2f86e2', rough: 0.85, sh: [0.46, 0.46, 0.76], mid: [0.8, 0.8, 0.94] },
  leather: { color: '#a9622b', rough: 0.7, sh: [0.66, 0.5, 0.56], mid: [0.88, 0.8, 0.86] },
  metal: { color: '#d0d5df', rough: 0.3, metal: 0.8, sh: [0.62, 0.64, 0.86], mid: [0.86, 0.88, 0.98] },
  shoe: { color: '#1d1d25', rough: 0.7, sh: [0.7, 0.7, 0.92], mid: [0.9, 0.9, 1] },
  sole: { color: '#f5f6fb', rough: 0.6, sh: [0.72, 0.76, 0.98], mid: [0.9, 0.92, 1] },
};

const DECALS = new Set(['face', 'emblem']);

const gradientCache = new Map();
function makeGradient(shadow, mid) {
  // 20 texels across dot(N,L) in [-1,1]: shadow < ~0.05 <= mid < ~0.5 <= lit.
  const key = `${shadow}|${mid}`;
  if (gradientCache.has(key)) return gradientCache.get(key);
  const lit = [1, 1, 1];
  const n = 20;
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const c = i < 11 ? shadow : i < 15 ? mid : lit;
    data[i * 4] = Math.round(c[0] * 255);
    data[i * 4 + 1] = Math.round(c[1] * 255);
    data[i * 4 + 2] = Math.round(c[2] * 255);
    data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  gradientCache.set(key, t);
  return t;
}

const GRADIENT_RGB_CHUNK = (() => {
  const src = THREE.ShaderChunk.gradientmap_pars_fragment;
  const out = src.replace('vec3( texture2D( gradientMap, coord ).r )', 'texture2D( gradientMap, coord ).rgb');
  if (out === src) console.warn('toon gradient patch did not apply');
  return out;
})();

function decalOpts() {
  return { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
}

export function createMaterials({ faceTex, emblemTex }) {
  const defaultGradient = makeGradient([0.5, 0.47, 0.76], [0.8, 0.8, 0.94]);
  const toon = [], pbr = [];

  for (const name of MAT) {
    if (name === 'face') {
      toon.push(new THREE.MeshBasicMaterial({ map: faceTex, vertexColors: false, toneMapped: false, ...decalOpts() }));
      pbr.push(new THREE.MeshBasicMaterial({ map: faceTex, vertexColors: false, toneMapped: false, ...decalOpts() }));
      continue;
    }
    if (name === 'emblem') {
      const t = new THREE.MeshToonMaterial({ map: emblemTex, gradientMap: makeGradient(SPEC.gold.sh, SPEC.gold.mid), ...decalOpts() });
      t.onBeforeCompile = (s) => {
        s.fragmentShader = s.fragmentShader.replace('#include <gradientmap_pars_fragment>', GRADIENT_RGB_CHUNK);
      };
      t.customProgramCacheKey = () => 'toon-rgb-v1';
      toon.push(t);
      pbr.push(new THREE.MeshStandardMaterial({ map: emblemTex, roughness: 0.4, metalness: 0.5, ...decalOpts() }));
      continue;
    }
    const s = SPEC[name];
    const t = new THREE.MeshToonMaterial({ color: s.color, gradientMap: makeGradient(s.sh, s.mid), vertexColors: true });
    t.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <gradientmap_pars_fragment>', GRADIENT_RGB_CHUNK);
    };
    t.customProgramCacheKey = () => 'toon-rgb-v1';
    t.name = name;
    toon.push(t);
    const p = new THREE.MeshStandardMaterial({
      color: s.color, roughness: s.rough, metalness: s.metal ?? 0, vertexColors: true, envMapIntensity: 1.5,
    });
    // a little self-light keeps skin/hair shadows from going muddy in other viewers (baked into the colour: glTF-safe)
    const glow = { skin: 0.2, hair: 0.09 }[name];
    if (glow) p.emissive = new THREE.Color(s.color).multiplyScalar(glow);
    p.name = name;
    pbr.push(p);
  }
  toon[MAT_INDEX.face].name = 'face';
  pbr[MAT_INDEX.face].name = 'face';
  toon[MAT_INDEX.emblem].name = 'emblem';
  pbr[MAT_INDEX.emblem].name = 'emblem';

  // Outline (inverted hull, pushes vertices along the skinned normal)
  const uniforms = { uOutline: { value: 0.0042 } };
  const ink = new THREE.MeshBasicMaterial({ color: 0x1c0f15, side: THREE.BackSide, toneMapped: false });
  ink.onBeforeCompile = (shader) => {
    shader.uniforms.uOutline = uniforms.uOutline;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float outlineScale;\nuniform float uOutline;')
      .replace(
        '#include <skinning_vertex>',
        '#include <skinning_vertex>\ntransformed += normalize(objectNormal) * uOutline * outlineScale;',
      );
  };
  ink.customProgramCacheKey = () => 'ink-outline-v1';
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const outline = MAT.map((n) => (DECALS.has(n) ? hidden : ink));

  return { toon, pbr, outline, uniforms, gradient: defaultGradient };
}
