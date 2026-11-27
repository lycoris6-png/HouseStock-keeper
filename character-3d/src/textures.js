// Canvas-painted decal textures: anime face (eyes, brows, mouth, blush) and the gold chest emblem.
import * as THREE from 'three';
import { HEAD_C } from './dims.js';

const Y0 = HEAD_C.y;
export const FACE_REGION = { x0: -0.1, x1: 0.1, y0: Y0 - 0.115, y1: Y0 + 0.085 };
export const EMBLEM_REGION = { x0: -0.095, x1: 0.095, y0: 1.09, y1: 1.31 };

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------------------
// Face
// ---------------------------------------------------------------------------
const FS = 1024;
const fx = (x) => ((x - FACE_REGION.x0) / (FACE_REGION.x1 - FACE_REGION.x0)) * FS;
const fy = (y) => (1 - (y - FACE_REGION.y0) / (FACE_REGION.y1 - FACE_REGION.y0)) * FS;

function eyePath(ctx, X, Y) {
  ctx.beginPath();
  ctx.moveTo(X(-1.0), Y(-0.1));
  ctx.bezierCurveTo(X(-0.72), Y(0.55), X(-0.05), Y(1.0), X(0.55), Y(0.84)); // upper lid
  ctx.bezierCurveTo(X(0.86), Y(0.75), X(1.0), Y(0.52), X(1.08), Y(0.4)); // to outer corner
  ctx.bezierCurveTo(X(0.86), Y(-0.36), X(0.15), Y(-0.78), X(-0.45), Y(-0.56)); // lower lid
  ctx.bezierCurveTo(X(-0.75), Y(-0.46), X(-0.95), Y(-0.28), X(-1.0), Y(-0.1));
  ctx.closePath();
}

function drawEye(ctx, ex, ey, side) {
  const w = 142, h = 90;
  const X = (u) => ex + side * u * w;
  const Y = (v) => ey - v * h;

  ctx.save();
  eyePath(ctx, X, Y);
  const sg = ctx.createLinearGradient(0, ey - h, 0, ey + h);
  sg.addColorStop(0, '#d8c4ca');
  sg.addColorStop(0.4, '#ffffff');
  sg.addColorStop(1, '#fff3f2');
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.clip();

  // iris
  const ix = ex + side * 0.06 * w, iy = ey + 2;
  const rx = 82, ry = 102;
  const ig = ctx.createLinearGradient(0, iy - ry, 0, iy + ry);
  ig.addColorStop(0, '#0d4527');
  ig.addColorStop(0.42, '#2b9a4a');
  ig.addColorStop(1, '#a4ec7e');
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.ellipse(ix, iy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 9;
  ctx.strokeStyle = 'rgba(6,44,26,0.85)';
  ctx.stroke();
  const rg = ctx.createRadialGradient(ix, iy + 44, 4, ix, iy + 44, 70);
  rg.addColorStop(0, 'rgba(214,255,160,0.75)');
  rg.addColorStop(1, 'rgba(214,255,160,0)');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.ellipse(ix, iy, rx - 4, ry - 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // pupil
  ctx.fillStyle = '#06200e';
  ctx.beginPath();
  ctx.ellipse(ix, iy - 2, 34, 45, 0, 0, Math.PI * 2);
  ctx.fill();
  // highlights
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(ix - 30, iy - 46, 19, 24, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(ix + 34, iy + 42, 9, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // eyelid shadow
  const lg = ctx.createLinearGradient(0, ey - h * 1.05, 0, ey - h * 0.1);
  lg.addColorStop(0, 'rgba(24,10,18,0.6)');
  lg.addColorStop(1, 'rgba(24,10,18,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(ex - w * 1.4, ey - h * 1.1, w * 2.8, h * 1.1);
  ctx.restore();

  // upper lash line (thick) + outer flick
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1a0e12';
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(X(-1.0), Y(-0.1));
  ctx.bezierCurveTo(X(-0.72), Y(0.55), X(-0.05), Y(1.0), X(0.55), Y(0.84));
  ctx.bezierCurveTo(X(0.86), Y(0.75), X(1.0), Y(0.52), X(1.08), Y(0.4));
  ctx.stroke();
  ctx.lineWidth = 21;
  ctx.beginPath();
  ctx.moveTo(X(0.1), Y(0.95));
  ctx.bezierCurveTo(X(0.3), Y(0.93), X(0.45), Y(0.88), X(0.55), Y(0.84));
  ctx.bezierCurveTo(X(0.86), Y(0.75), X(1.0), Y(0.52), X(1.08), Y(0.4));
  ctx.stroke();
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(X(1.05), Y(0.42));
  ctx.quadraticCurveTo(X(1.22), Y(0.46), X(1.34), Y(0.7));
  ctx.stroke();
  // lower lash line
  ctx.strokeStyle = '#6a3f45';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(X(1.05), Y(0.36));
  ctx.bezierCurveTo(X(0.86), Y(-0.36), X(0.15), Y(-0.78), X(-0.3), Y(-0.6));
  ctx.stroke();
  // eyelid crease
  ctx.strokeStyle = 'rgba(150,80,70,0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(X(-0.55), Y(0.95));
  ctx.bezierCurveTo(X(-0.2), Y(1.35), X(0.45), Y(1.4), X(0.95), Y(0.92));
  ctx.stroke();
}

function drawBrow(ctx, side) {
  // inner end lower than outer end: a determined, confident brow
  const xi = fx(side * 0.017), xo = fx(side * 0.08);
  const yi = fy(Y0 + 0.02), yo = fy(Y0 + 0.043);
  const xm = (xi + xo) / 2, ym = Math.min(yi, yo) - 14;
  ctx.fillStyle = '#5a2816';
  ctx.beginPath();
  ctx.moveTo(xi, yi - 8);
  ctx.quadraticCurveTo(xm, ym - 12, xo, yo - 3);
  ctx.lineTo(xo + side * 10, yo + 3);
  ctx.quadraticCurveTo(xm, ym + 6, xi, yi + 9);
  ctx.closePath();
  ctx.fill();
}

export function makeFaceTexture() {
  const c = makeCanvas(FS, FS);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, FS, FS);
  // blush
  for (const s of [-1, 1]) {
    const bx = fx(s * 0.064), by = fy(Y0 - 0.045);
    const g = ctx.createRadialGradient(bx, by, 4, bx, by, 115);
    g.addColorStop(0, 'rgba(255,120,120,0.32)');
    g.addColorStop(1, 'rgba(255,120,120,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(1, 0.55);
    ctx.translate(-bx, -by);
    ctx.fillRect(bx - 130, by - 210, 260, 420);
    ctx.restore();
  }
  // eyes (+x = character's left = canvas right)
  drawEye(ctx, fx(0.047), fy(Y0 - 0.006), +1);
  drawEye(ctx, fx(-0.047), fy(Y0 - 0.006), -1);
  drawBrow(ctx, +1);
  drawBrow(ctx, -1);
  // nose
  ctx.strokeStyle = '#d28c7e';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(fx(-0.005), fy(Y0 - 0.052));
  ctx.quadraticCurveTo(fx(-0.001), fy(Y0 - 0.063), fx(0.007), fy(Y0 - 0.0625));
  ctx.stroke();
  // mouth: confident smirk, right side a little higher
  ctx.strokeStyle = '#8a3a36';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(fx(-0.024), fy(Y0 - 0.0875));
  ctx.quadraticCurveTo(fx(0.002), fy(Y0 - 0.1005), fx(0.029), fy(Y0 - 0.0845));
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(fx(0.029), fy(Y0 - 0.0845));
  ctx.lineTo(fx(0.033), fy(Y0 - 0.0805));
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232,140,128,0.65)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(fx(-0.007), fy(Y0 - 0.106));
  ctx.quadraticCurveTo(fx(0.004), fy(Y0 - 0.1085), fx(0.014), fy(Y0 - 0.1055));
  ctx.stroke();
  return toTexture(c);
}

// ---------------------------------------------------------------------------
// Gold chest emblem
// ---------------------------------------------------------------------------
export function makeEmblemTexture() {
  const W = 544, H = 640;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2;
  // draw around the V apex, scaled up so the ornament reads at viewing distance
  ctx.save();
  ctx.translate(cx, 300);
  ctx.scale(1.5, 1.5);
  ctx.translate(-cx, -300);

  const drawHalf = (mirror) => {
    ctx.save();
    if (mirror) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    const paint = (fn) => {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#a8671a';
      ctx.lineWidth = 26;
      fn();
      ctx.stroke();
      ctx.strokeStyle = '#f2b73f';
      ctx.lineWidth = 17;
      fn();
      ctx.stroke();
      ctx.strokeStyle = '#ffd877';
      ctx.lineWidth = 5;
      ctx.save();
      ctx.translate(-3, -3);
      fn();
      ctx.stroke();
      ctx.restore();
    };
    paint(() => {
      ctx.beginPath();
      ctx.moveTo(cx - 6, 300);
      ctx.bezierCurveTo(cx - 52, 368, cx - 140, 388, cx - 164, 322);
      ctx.bezierCurveTo(cx - 186, 262, cx - 128, 226, cx - 92, 252);
      ctx.bezierCurveTo(cx - 66, 272, cx - 80, 306, cx - 106, 298);
    });
    paint(() => {
      ctx.beginPath();
      ctx.moveTo(cx - 30, 250);
      ctx.bezierCurveTo(cx - 70, 214, cx - 70, 170, cx - 40, 150);
    });
    paint(() => {
      ctx.beginPath();
      ctx.moveTo(cx - 128, 196);
      ctx.lineTo(cx - 168, 164);
      ctx.moveTo(cx - 150, 236);
      ctx.lineTo(cx - 198, 226);
      ctx.moveTo(cx - 108, 164);
      ctx.lineTo(cx - 128, 118);
    });
    ctx.restore();
  };
  drawHalf(false);
  drawHalf(true);
  ctx.beginPath();
  ctx.moveTo(cx, 322);
  ctx.bezierCurveTo(cx - 30, 360, cx - 28, 420, cx, 474);
  ctx.bezierCurveTo(cx + 28, 420, cx + 30, 360, cx, 322);
  ctx.closePath();
  ctx.fillStyle = '#f2b73f';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#a8671a';
  ctx.stroke();
  ctx.restore();
  return toTexture(c);
}
