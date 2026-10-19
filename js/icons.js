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

  // ---- dragons, knights, wizards & co ----
  dragon(c) { // head in profile
    c.fillStyle = shade(c, 0, 8, 60, 66, 1, 0.3);
    c.beginPath(); c.moveTo(6, 40); c.lineTo(20, 32); c.lineTo(30, 26); c.lineTo(34, 8); c.lineTo(42, 22); c.lineTo(54, 6); c.lineTo(52, 24);
    c.quadraticCurveTo(66, 34, 64, 52); c.lineTo(60, 68); c.lineTo(44, 68); c.quadraticCurveTo(42, 56, 32, 52); c.lineTo(22, 50); c.lineTo(10, 52); c.closePath(); c.fill();
    cut(c, () => {
      poly(c, [[34, 34], [44, 30], [40, 37]]);
      c.fillRect(9, 44, 18, 2);
      for (let x = 12; x < 26; x += 4) poly(c, [[x, 46], [x + 2, 46], [x + 1, 50]]);
      circle(c, 12, 39, 1.2);
      for (let y = 40; y < 64; y += 7) c.fillRect(52, y, 6, 1.5);
    });
  },
  wyvern(c) { // flying, wings spread
    c.fillStyle = shade(c, 0, 4, 0, 66, 1, 0.3);
    for (const sx of [1, -1]) {
      c.save(); c.translate(36, 0); c.scale(sx, 1);
      c.beginPath(); c.moveTo(2, 30); c.lineTo(20, 10); c.lineTo(34, 6); c.lineTo(32, 16);
      c.quadraticCurveTo(30, 22, 34, 28); c.quadraticCurveTo(26, 26, 24, 32); c.quadraticCurveTo(18, 30, 14, 38); c.quadraticCurveTo(10, 34, 4, 40); c.closePath(); c.fill();
      c.restore();
    }
    c.beginPath(); c.ellipse(36, 34, 5, 12, 0, 0, 7); c.fill();
    poly(c, [[33, 22], [36, 12], [39, 22]]);
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(36, 44); c.quadraticCurveTo(40, 58, 30, 62); c.quadraticCurveTo(22, 66, 26, 70); c.stroke();
    poly(c, [[24, 68], [30, 70], [24, 72]]);
  },
  knight(c) { // chess knight
    c.fillStyle = shade(c, 10, 4, 60, 70, 1, 0.3);
    c.beginPath(); c.moveTo(18, 64); c.lineTo(22, 50); c.quadraticCurveTo(30, 40, 26, 34); c.lineTo(14, 38); c.lineTo(10, 30);
    c.lineTo(24, 14); c.lineTo(28, 6); c.lineTo(32, 12); c.quadraticCurveTo(56, 14, 56, 44); c.lineTo(54, 64); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(12, 62, 48, 6);
    cut(c, () => { circle(c, 27, 22, 2.5); c.fillRect(34, 18, 2, 30); circle(c, 14, 33, 1.3); });
  },
  shield(c) {
    c.fillStyle = shade(c, 8, 4, 60, 70, 1, 0.3);
    c.beginPath(); c.moveTo(12, 8); c.lineTo(60, 8); c.lineTo(60, 32); c.quadraticCurveTo(60, 56, 36, 68); c.quadraticCurveTo(12, 56, 12, 32); c.closePath(); c.fill();
    cut(c, () => { c.fillRect(33, 14, 6, 46); c.fillRect(18, 26, 36, 6); });
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(34.5, 15, 3, 44); c.fillRect(19, 27.5, 34, 3);
  },
  wizard(c) { // pointed hat, glowing eyes, long beard
    c.fillStyle = shade(c, 10, 0, 60, 40, 1, 0.35);
    poly(c, [[16, 34], [33, 8], [40, 2], [48, 6], [42, 10], [56, 34]]);
    c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.ellipse(36, 35, 30, 5, 0, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.fillRect(27, 41, 6, 2); c.fillRect(39, 41, 6, 2);
    c.fillStyle = shade(c, 0, 44, 0, 72, 0.95, 0.3);
    c.beginPath(); c.moveTo(20, 45); c.lineTo(52, 45); c.quadraticCurveTo(48, 58, 40, 62); c.lineTo(36, 71); c.lineTo(32, 62); c.quadraticCurveTo(24, 58, 20, 45); c.fill();
    cut(c, () => { poly(c, [[36, 16], [37.5, 20], [41, 20], [38, 22.5], [39, 26], [36, 24], [33, 26], [34, 22.5], [31, 20], [34.5, 20]]); c.fillRect(30, 50, 12, 1.5); circle(c, 26, 28, 1.2); circle(c, 46, 24, 1); });
  },
  staff(c) {
    c.fillStyle = 'rgba(255,255,255,.7)';
    c.save(); c.translate(36, 40); c.rotate(0.35); c.fillRect(-2, -22, 4, 54); c.restore();
    const g = c.createRadialGradient(28, 18, 1, 28, 18, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; circle(c, 28, 18, 16);
    c.fillStyle = '#fff'; circle(c, 28, 18, 6);
    for (const [x, y] of [[50, 10], [12, 32], [46, 30], [16, 6]]) poly(c, [[x, y - 4], [x + 1, y - 1], [x + 4, y], [x + 1, y + 1], [x, y + 4], [x - 1, y + 1], [x - 4, y], [x - 1, y - 1]]);
  },
  swords(c) { // crossed
    for (const a of [0.78, -0.78]) {
      c.save(); c.translate(36, 36); c.rotate(a);
      c.fillStyle = shade(c, 0, -32, 0, 20, 1, 0.35); poly(c, [[0, -32], [4, -26], [4, 14], [-4, 14], [-4, -26]]);
      c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(-11, 14, 22, 4); c.fillRect(-2, 18, 4, 10); circle(c, 0, 31, 3);
      c.restore();
    }
  },
  potion(c) {
    c.fillStyle = 'rgba(255,255,255,.55)'; circle(c, 36, 46, 21); c.fillRect(30, 12, 12, 18);
    c.fillStyle = '#fff'; c.fillRect(28, 6, 16, 7);
    c.fillStyle = shade(c, 0, 40, 0, 68, 1, 0.6);
    c.save(); c.beginPath(); c.arc(36, 46, 21, 0, 7); c.clip(); c.fillRect(10, 44, 52, 30); c.restore();
    cut(c, () => { circle(c, 28, 38, 3); circle(c, 44, 54, 2); circle(c, 34, 58, 1.5); c.fillRect(22, 30, 3, 8); });
  },
  spellbook(c) {
    c.fillStyle = shade(c, 6, 8, 60, 66, 1, 0.35);
    c.fillRect(14, 8, 44, 56);
    c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(10, 10, 4, 54); c.fillRect(14, 62, 44, 4);
    cut(c, () => {
      c.lineWidth = 2.5; c.strokeStyle = '#000'; c.beginPath(); c.arc(36, 34, 13, 0, 7); c.stroke();
      poly(c, [[36, 24], [38, 32], [46, 34], [38, 36], [36, 44], [34, 36], [26, 34], [34, 32]]);
      c.fillRect(20, 14, 32, 2); c.fillRect(20, 54, 32, 2);
    });
  },
  orb(c) { // crystal ball
    const g = c.createRadialGradient(28, 24, 2, 36, 32, 24); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,.2)');
    c.fillStyle = g; circle(c, 36, 32, 22);
    cut(c, () => { c.beginPath(); c.ellipse(28, 24, 6, 3, -0.6, 0, 7); c.fill(); });
    c.fillStyle = 'rgba(255,255,255,.9)'; poly(c, [[18, 56], [54, 56], [60, 66], [12, 66]]); c.fillRect(24, 50, 24, 6);
  },
  bow(c) {
    c.strokeStyle = shade(c, 0, 0, 0, 72, 1, 0.5); c.lineWidth = 4;
    c.beginPath(); c.moveTo(20, 6); c.quadraticCurveTo(64, 36, 20, 66); c.stroke();
    c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.moveTo(20, 6); c.lineTo(20, 66); c.stroke();
    c.fillStyle = '#fff'; c.fillRect(8, 35, 52, 2.5); poly(c, [[60, 36], [52, 31], [52, 41]]);
    poly(c, [[8, 36], [4, 31], [12, 33]]); poly(c, [[8, 36], [4, 41], [12, 39]]);
  },
  phoenix(c) {
    c.fillStyle = shade(c, 0, 4, 0, 70, 1, 0.3);
    for (const sx of [1, -1]) {
      c.save(); c.translate(36, 0); c.scale(sx, 1);
      c.beginPath(); c.moveTo(2, 34); c.quadraticCurveTo(16, 30, 22, 8); c.quadraticCurveTo(26, 20, 32, 6); c.quadraticCurveTo(32, 24, 34, 22); c.quadraticCurveTo(26, 40, 4, 44); c.closePath(); c.fill();
      c.restore();
    }
    circle(c, 36, 24, 5); poly(c, [[36, 20], [42, 22], [36, 25]]);
    c.beginPath(); c.moveTo(30, 34); c.quadraticCurveTo(36, 50, 26, 70); c.quadraticCurveTo(36, 60, 36, 70); c.quadraticCurveTo(38, 60, 46, 70); c.quadraticCurveTo(36, 50, 42, 34); c.closePath(); c.fill();
  },
  serpent(c) {
    c.strokeStyle = shade(c, 0, 0, 72, 72, 1, 0.35); c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(14, 64); c.bezierCurveTo(70, 60, 2, 34, 50, 26); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(54, 22, 9, 6, -0.4, 0, 7); c.fill();
    cut(c, () => circle(c, 56, 19, 1.5));
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(62, 20); c.lineTo(68, 16); c.moveTo(66, 17); c.lineTo(68, 20); c.stroke();
  },
  grail(c) {
    c.fillStyle = shade(c, 0, 4, 0, 70, 1, 0.35);
    c.beginPath(); c.moveTo(14, 10); c.lineTo(58, 10); c.quadraticCurveTo(58, 38, 36, 40); c.quadraticCurveTo(14, 38, 14, 10); c.fill();
    c.fillRect(33, 40, 6, 16); poly(c, [[20, 66], [52, 66], [44, 56], [28, 56]]);
    cut(c, () => { circle(c, 36, 22, 4); c.fillRect(18, 14, 36, 2); });
    c.fillStyle = 'rgba(255,255,255,.4)'; for (const [x, y] of [[20, 4], [36, 2], [52, 4]]) c.fillRect(x - 0.5, y, 1, 4);
  },
  key(c) {
    c.fillStyle = shade(c, 0, 0, 72, 72, 1, 0.4);
    circle(c, 22, 22, 14);
    cut(c, () => { circle(c, 22, 22, 6); });
    c.save(); c.translate(22, 22); c.rotate(0.78); c.fillRect(10, -3, 44, 6); c.fillRect(40, 3, 5, 10); c.fillRect(48, 3, 5, 8); c.restore();
  },
  lantern(c) {
    c.fillStyle = 'rgba(255,255,255,.85)';
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2; c.beginPath(); c.arc(36, 10, 6, Math.PI, 0); c.stroke();
    poly(c, [[24, 14], [48, 14], [52, 22], [20, 22]]); c.fillRect(20, 60, 32, 6);
    const g = c.createRadialGradient(36, 42, 1, 36, 42, 18); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,.25)');
    c.fillStyle = g; c.fillRect(22, 22, 28, 38);
    cut(c, () => { c.fillRect(30, 22, 2, 38); c.fillRect(40, 22, 2, 38); });
  },
  hammer(c) {
    c.save(); c.translate(36, 36); c.rotate(-0.5);
    c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(-2.5, -18, 5, 52);
    c.fillStyle = shade(c, -20, -30, 20, -10, 1, 0.4); c.fillRect(-20, -30, 40, 16);
    poly(c, [[20, -30], [28, -22], [20, -14]]);
    cut(c, () => { c.fillRect(-14, -26, 2, 8); c.fillRect(-8, -26, 2, 8); });
    c.restore();
  },
  castle(c) {
    c.fillStyle = shade(c, 0, 10, 0, 70, 1, 0.3);
    c.fillRect(6, 30, 14, 38); c.fillRect(52, 30, 14, 38); c.fillRect(20, 40, 32, 28); c.fillRect(28, 16, 16, 24);
    poly(c, [[4, 30], [13, 16], [22, 30]]); poly(c, [[50, 30], [59, 16], [68, 30]]); poly(c, [[26, 16], [36, 2], [46, 16]]);
    for (let x = 20; x < 52; x += 6) c.fillRect(x, 36, 4, 4);
    cut(c, () => { c.beginPath(); c.moveTo(30, 68); c.lineTo(30, 56); c.arc(36, 56, 6, Math.PI, 0); c.lineTo(42, 68); c.fill(); c.fillRect(12, 40, 2, 6); c.fillRect(58, 40, 2, 6); c.fillRect(35, 24, 2, 6); });
  },
  trident(c) {
    c.fillStyle = shade(c, 0, 0, 0, 72, 1, 0.45);
    c.fillRect(34, 22, 4, 48);
    c.beginPath(); c.moveTo(16, 6); c.lineTo(20, 14); c.lineTo(20, 24); c.quadraticCurveTo(36, 34, 52, 24); c.lineTo(52, 14); c.lineTo(56, 6); c.lineTo(58, 26); c.quadraticCurveTo(36, 42, 14, 26); c.closePath(); c.fill();
    poly(c, [[36, 2], [40, 12], [38, 26], [34, 26], [32, 12]]);
  },
  banner(c) {
    c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(14, 4, 3, 66); circle(c, 15.5, 4, 3);
    c.fillStyle = shade(c, 16, 8, 64, 60, 1, 0.35);
    poly(c, [[17, 10], [62, 10], [62, 56], [40, 46], [17, 56]]);
    cut(c, () => { poly(c, [[40, 18], [48, 28], [44, 40], [40, 36], [36, 40], [32, 28]]); });
  },
  crystals(c) {
    c.fillStyle = shade(c, 0, 0, 72, 72, 1, 0.3); poly(c, [[30, 66], [24, 26], [34, 6], [44, 26], [40, 66]]);
    c.fillStyle = shade(c, 0, 20, 30, 70, 0.8, 0.25); poly(c, [[22, 66], [10, 40], [16, 28], [26, 42], [28, 66]]);
    c.fillStyle = shade(c, 72, 20, 40, 70, 0.8, 0.25); poly(c, [[44, 66], [50, 36], [58, 28], [62, 44], [52, 66]]);
    cut(c, () => { c.fillRect(33.5, 10, 1, 54); });
    c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(6, 66, 60, 3);
  },
  kraken(c) {
    c.strokeStyle = shade(c, 0, 0, 0, 72, 1, 0.4); c.lineCap = 'round';
    for (const [x, d, w] of [[14, 1, 6], [30, -1, 7], [46, 1, 7], [60, -1, 5]]) {
      c.lineWidth = w; c.beginPath(); c.moveTo(x, 70); c.bezierCurveTo(x + 10 * d, 50, x - 12 * d, 34, x + 4 * d, 14); c.stroke();
    }
    c.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 8; i++) c.fillRect(i * 9, 66 + (i % 2) * 2, 6, 1);
  },
  toadstool(c) {
    c.fillStyle = shade(c, 0, 8, 0, 40, 1, 0.5);
    c.beginPath(); c.moveTo(6, 40); c.quadraticCurveTo(8, 8, 36, 8); c.quadraticCurveTo(64, 8, 66, 40); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.moveTo(28, 40); c.lineTo(26, 66); c.lineTo(46, 66); c.lineTo(44, 40); c.fill();
    cut(c, () => { circle(c, 22, 26, 4); circle(c, 38, 18, 5); circle(c, 52, 30, 3.5); circle(c, 34, 34, 2.5); });
  },
  ring(c) {
    c.strokeStyle = shade(c, 0, 20, 0, 64, 1, 0.45); c.lineWidth = 6; c.beginPath(); c.ellipse(36, 44, 20, 16, 0, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(36, 44, 27, 23, 0, 0, 7); c.stroke();
    c.fillStyle = '#fff'; poly(c, [[36, 14], [45, 23], [36, 32], [27, 23]]);
    cut(c, () => poly(c, [[36, 18], [41, 23], [36, 28], [31, 23]]));
    c.fillStyle = 'rgba(255,255,255,.7)'; poly(c, [[36, 20], [39, 23], [36, 26], [33, 23]]);
  },
  menhir(c) { // rune stone
    c.fillStyle = shade(c, 10, 4, 60, 70, 1, 0.3);
    c.beginPath(); c.moveTo(22, 68); c.lineTo(18, 24); c.quadraticCurveTo(24, 4, 38, 6); c.quadraticCurveTo(54, 10, 52, 30); c.lineTo(50, 68); c.closePath(); c.fill();
    cut(c, () => { c.lineWidth = 3; c.strokeStyle = '#000'; c.beginPath(); c.moveTo(35, 18); c.lineTo(35, 56); c.moveTo(35, 26); c.lineTo(44, 20); c.moveTo(35, 34); c.lineTo(44, 28); c.moveTo(35, 44); c.lineTo(27, 50); c.stroke(); });
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(8, 66, 56, 3);
  },
  candles(c) {
    c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(20, 30, 10, 34); c.fillRect(42, 38, 10, 26);
    const f = (x, y) => { c.beginPath(); c.moveTo(x, y - 12); c.quadraticCurveTo(x + 6, y - 2, x, y); c.quadraticCurveTo(x - 6, y - 2, x, y - 12); c.fill(); };
    c.fillStyle = '#fff'; f(25, 28); f(47, 36);
    c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.moveTo(28, 30); c.quadraticCurveTo(32, 40, 30, 46); c.lineTo(30, 30); c.fill();
    c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(8, 64, 56, 5);
  },
  helmPlume(c) { // knight's great helm with plume
    c.fillStyle = 'rgba(255,255,255,.7)';
    c.beginPath(); c.moveTo(36, 16); c.quadraticCurveTo(44, 0, 64, 4); c.quadraticCurveTo(50, 8, 46, 20); c.closePath(); c.fill();
    c.fillStyle = shade(c, 14, 14, 58, 70, 1, 0.3);
    c.beginPath(); c.moveTo(16, 68); c.lineTo(16, 34); c.quadraticCurveTo(16, 16, 36, 16); c.quadraticCurveTo(56, 16, 56, 34); c.lineTo(56, 68); c.closePath(); c.fill();
    cut(c, () => { c.fillRect(20, 36, 32, 4); for (let x = 24; x <= 48; x += 6) for (let y = 48; y <= 60; y += 6) c.fillRect(x, y, 2, 2); c.fillRect(35, 40, 2, 26); });
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
