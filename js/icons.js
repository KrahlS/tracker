// Fantasy icons: drawn as shaded silhouettes on a small canvas, then ordered-dithered to 1-bit.
const S = 72; // working resolution; displayed pixelated

const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
];

function shade(ctx, x0, y0, x1, y1, a = 1, b = 0.25) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, `rgba(255,255,255,${a})`);
  g.addColorStop(1, `rgba(255,255,255,${b})`);
  return g;
}
const circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); };
const cut = (ctx, fn) => { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000'; fn(); ctx.restore(); };

const ICONS = {
  sword(c) {
    c.fillStyle = shade(c, 20, 0, 52, 60, 1, 0.35);
    poly(c, [[36, 3], [41, 12], [41, 46], [31, 46], [31, 12]]);
    c.fillStyle = shade(c, 0, 44, 72, 52, 0.95, 0.5);
    poly(c, [[16, 45], [56, 45], [52, 51], [20, 51]]);
    c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(33, 51, 6, 12);
    c.fillStyle = 'rgba(255,255,255,.9)'; circle(c, 36, 66, 4);
    cut(c, () => c.fillRect(35.5, 10, 1.2, 33));
  },
  skull(c) {
    c.fillStyle = shade(c, 14, 6, 56, 64, 1, 0.3);
    circle(c, 36, 30, 22);
    c.fillRect(24, 40, 24, 18);
    cut(c, () => {
      c.beginPath(); c.ellipse(27, 33, 6, 7, 0.2, 0, 7); c.ellipse(45, 33, 6, 7, -0.2, 0, 7); c.fill();
      poly(c, [[36, 40], [32, 48], [40, 48]]);
      for (let x = 27; x <= 45; x += 4.5) c.fillRect(x, 52, 1.6, 7);
    });
  },
  moon(c) {
    c.fillStyle = shade(c, 8, 8, 60, 64, 1, 0.3);
    circle(c, 34, 36, 26);
    cut(c, () => circle(c, 46, 28, 22));
    c.fillStyle = '#fff';
    for (const [x, y, r] of [[56, 52, 2], [62, 10, 1.6], [48, 6, 1.2], [66, 34, 1.4]]) circle(c, x, y, r);
  },
  crown(c) {
    c.fillStyle = shade(c, 0, 8, 0, 60, 1, 0.35);
    poly(c, [[8, 54], [10, 18], [24, 36], [36, 10], [48, 36], [62, 18], [64, 54]]);
    c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(8, 56, 56, 7);
    for (const [x, y] of [[10, 16], [36, 8], [62, 16]]) circle(c, x, y, 3.5);
    cut(c, () => { circle(c, 24, 47, 3); circle(c, 36, 45, 4); circle(c, 48, 47, 3); });
  },
  tower(c) {
    c.fillStyle = shade(c, 10, 0, 60, 70, 1, 0.3);
    c.fillRect(20, 16, 32, 52);
    for (let x = 18; x < 54; x += 9) c.fillRect(x, 8, 6, 10);
    c.fillRect(16, 14, 40, 5);
    cut(c, () => {
      c.beginPath(); c.moveTo(30, 68); c.lineTo(30, 54); c.arc(36, 54, 6, Math.PI, 0); c.lineTo(42, 68); c.fill();
      c.fillRect(34, 28, 4, 10);
    });
  },
  axe(c) {
    c.fillStyle = 'rgba(255,255,255,.65)';
    c.save(); c.translate(36, 36); c.rotate(-0.6); c.fillRect(-2.5, -32, 5, 66); c.restore();
    c.fillStyle = shade(c, 20, 6, 64, 50, 1, 0.35);
    c.beginPath(); c.moveTo(30, 22); c.quadraticCurveTo(40, 2, 62, 8); c.quadraticCurveTo(58, 30, 66, 46); c.quadraticCurveTo(44, 42, 40, 32); c.closePath(); c.fill();
  },
  eye(c) {
    c.fillStyle = shade(c, 0, 14, 0, 58, 1, 0.3);
    c.beginPath(); c.moveTo(4, 36); c.quadraticCurveTo(36, 2, 68, 36); c.quadraticCurveTo(36, 70, 4, 36); c.fill();
    cut(c, () => circle(c, 36, 36, 15));
    c.fillStyle = shade(c, 22, 22, 50, 50, 0.9, 0.2); circle(c, 36, 36, 12);
    cut(c, () => { c.beginPath(); c.ellipse(36, 36, 3, 11, 0, 0, 7); c.fill(); });
  },
  flame(c) {
    c.fillStyle = shade(c, 0, 66, 0, 4, 1, 0.3);
    c.beginPath(); c.moveTo(36, 4); c.bezierCurveTo(46, 22, 62, 30, 56, 50); c.bezierCurveTo(52, 64, 20, 66, 16, 50);
    c.bezierCurveTo(12, 36, 24, 32, 26, 18); c.bezierCurveTo(32, 26, 30, 30, 36, 4); c.fill();
    cut(c, () => { c.beginPath(); c.moveTo(36, 30); c.bezierCurveTo(46, 42, 46, 56, 36, 58); c.bezierCurveTo(26, 56, 28, 44, 36, 30); c.fill(); });
    c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.moveTo(36, 40); c.bezierCurveTo(42, 48, 40, 55, 36, 55); c.bezierCurveTo(32, 55, 31, 48, 36, 40); c.fill();
  },
  mountain(c) {
    c.fillStyle = 'rgba(255,255,255,.95)'; circle(c, 50, 18, 9);
    c.fillStyle = shade(c, 0, 14, 40, 70, 0.95, 0.25);
    poly(c, [[2, 66], [26, 22], [40, 42], [48, 32], [70, 66]]);
    cut(c, () => poly(c, [[26, 22], [20, 34], [25, 31], [29, 36], [32, 30]]));
  },
  helm(c) {
    c.fillStyle = shade(c, 12, 6, 58, 66, 1, 0.3);
    c.beginPath(); c.moveTo(14, 66); c.lineTo(14, 32); c.quadraticCurveTo(14, 8, 36, 8); c.quadraticCurveTo(58, 8, 58, 32); c.lineTo(58, 66); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.8)'; poly(c, [[34, 2], [38, 2], [40, 10], [32, 10]]);
    cut(c, () => { c.fillRect(18, 30, 15, 4); c.fillRect(39, 30, 15, 4); c.fillRect(34.5, 30, 3, 26); for (let y = 42; y < 60; y += 5) { c.fillRect(22, y, 2, 3); c.fillRect(48, y, 2, 3); } });
  },
  hourglass(c) {
    c.fillStyle = 'rgba(255,255,255,.95)'; c.fillRect(14, 4, 44, 6); c.fillRect(14, 62, 44, 6);
    c.fillStyle = shade(c, 0, 10, 0, 62, 0.85, 0.35);
    poly(c, [[18, 10], [54, 10], [38, 36], [54, 62], [18, 62], [34, 36]]);
    cut(c, () => { poly(c, [[22, 13], [50, 13], [37, 32], [35, 32]]); poly(c, [[36, 40], [50, 59], [22, 59]]); });
    c.fillStyle = '#fff'; poly(c, [[30, 22], [42, 22], [36, 31]]); poly(c, [[36, 48], [47, 59], [25, 59]]); c.fillRect(35.5, 32, 1, 16);
  },
  dagger(c) {
    c.save(); c.translate(36, 36); c.rotate(0.78);
    c.fillStyle = shade(c, -6, -34, 6, 10, 1, 0.3); poly(c, [[0, -34], [6, -24], [5, 8], [-5, 8], [-6, -24]]);
    c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(-15, 8, 30, 5); c.fillRect(-3, 13, 6, 14); circle(c, 0, 30, 4);
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.beginPath(); c.arc(36, 36, 31, 0, 7); c.stroke();
  },
  rune(c) {
    c.strokeStyle = shade(c, 0, 0, 72, 72, 1, 0.4); c.lineWidth = 3;
    c.beginPath(); c.arc(36, 36, 30, 0, 7); c.stroke();
    c.lineWidth = 1.5; c.beginPath(); c.arc(36, 36, 24, 0, 7); c.stroke();
    c.lineWidth = 4; c.lineCap = 'square'; c.beginPath();
    c.moveTo(30, 16); c.lineTo(30, 56); c.moveTo(30, 22); c.lineTo(44, 32); c.lineTo(30, 42); c.moveTo(42, 46); c.lineTo(48, 56); c.stroke();
  },
  wolf(c) {
    c.fillStyle = shade(c, 10, 4, 60, 70, 1, 0.3);
    poly(c, [[14, 6], [26, 22], [46, 22], [58, 6], [60, 34], [52, 52], [36, 68], [20, 52], [12, 34]]);
    cut(c, () => { poly(c, [[22, 34], [32, 38], [24, 40]]); poly(c, [[50, 34], [40, 38], [48, 40]]); poly(c, [[32, 54], [40, 54], [36, 60]]); });
  },
};
export const ICON_NAMES = Object.keys(ICONS);

// Render icon `name` into a canvas element, 1-bit dithered. fg/bg are CSS colors.
export function renderIcon(canvas, name, fg = '#ece8df', bg = '#0b0b0b', seed = 1) {
  canvas.width = S; canvas.height = S;
  const off = document.createElement('canvas'); off.width = S; off.height = S;
  const c = off.getContext('2d');
  // dim halo behind the figure
  const halo = c.createRadialGradient(36, 36, 4, 36, 36, 40);
  halo.addColorStop(0, 'rgba(255,255,255,.28)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = halo; c.fillRect(0, 0, S, S);
  (ICONS[name] || ICONS.sword)(c);
  const src = c.getImageData(0, 0, S, S).data;
  const out = canvas.getContext('2d');
  out.fillStyle = bg; out.fillRect(0, 0, S, S);
  out.fillStyle = fg;
  let r = seed * 9301 + 49297;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = src[(y * S + x) * 4 + 3] / 255;
    r = (r * 9301 + 49297) % 233280;
    const grit = (r / 233280 - 0.5) * 0.12;
    if (a + grit > (BAYER[y % 8][x % 8] + 0.5) / 64) out.fillRect(x, y, 1, 1);
  }
}
