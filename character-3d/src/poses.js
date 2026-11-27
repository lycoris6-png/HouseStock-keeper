// Poses. Limb segments are given as world-space direction vectors (camera at +Z, +X = image right).
// "Left"/"Right" are the character's own sides (character's left = +X at rest).
export const POSES = {
  apose: {},

  // Mid-air dash from the reference illustration: right knee driven high, left leg trailing,
  // torso twisted toward camera, left arm swung back, right fist at the hip, scarf streaming behind.
  leap: {
    clearance: 0.3,
    hips: { pos: [0, 0, 0], pitch: 10, yaw: -25, roll: -8 },
    spine: { pitch: 3, yaw: -5, roll: 10 },
    chest: { pitch: 2, yaw: -5, roll: 9 },
    upperChest: { pitch: 0, yaw: -4, roll: 5 },
    neck: { pitch: 0, yaw: 10, roll: -4 },
    head: { pitch: 4, yaw: 16, roll: -6 },
    legR: { thigh: [-0.88, -0.14, 0.45], shin: [0.8, -0.58, 0.1], foot: [-0.25, -0.92, 0.3] },
    legL: { thigh: [0.42, -0.72, -0.55], shin: [0.47, -0.78, -0.41], foot: [-0.25, -0.85, 0.45] },
    armL: { upper: [0.55, -0.45, -0.7], fore: [0.75, -0.5, -0.45], hand: [0.75, -0.5, -0.45] },
    armR: { upper: [-0.1, -0.97, -0.2], fore: [0.2, 0.25, 0.95], hand: [0.2, 0.25, 0.95] },
    scarf: [
      [0.85, 0.1, -0.52],
      [0.9, 0.2, -0.35],
      [0.95, 0.05, -0.25],
      [0.9, -0.2, -0.3],
      [0.85, 0.3, -0.3],
      [0.7, 0.6, -0.3],
    ],
    scarfSide: [
      [0, 1, 0],
      [0, 1, 0],
      [0.3, 1, 0.2],
      [0.5, 1, 0.5],
      [0, 1, 0.6],
      [0, 0.7, 1],
    ],
  },
};
