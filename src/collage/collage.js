/*
 * 문경패러글라이딩 — 4.5s paper-collage reel (1080x1920, 30fps), Vox-style.
 *
 * Torn-paper sprites come from make_paper.py. Paper pieces animate "on twos"
 * (15 fps steps) and boil at 12 fps like stop-motion cut-outs, while the camera
 * drifts smoothly on top. Everything is a pure function of t.
 *
 *   0.0  sky strips / sun / clouds / mountains / hill tear in
 *   0.45 tandem photo print slaps down, tape, marker circle + "짜릿!"
 *   1.2  crew sticker pops up, arrow + "이륙!"
 *   2.0  logo card drops, letter stickers pop one by one, paper wing lands
 *   2.9  red strip tears across, 예약문의 label, 1688-6707 digit tiles
 *   3.7  marker underline, hold
 */
'use strict';

const W = 1080, H = 1920, DUR = 4.5, FPS = 30;
const PHONE = '1688-6707';
const C = { red: '#F70500', blue: '#004BC5', ink: '#14285E', wingA: '#14296F', wingB: '#0566AF', line: '#5E92E4', yellow: '#FFD23F', marker: '#E4271F' };

// ---------------------------------------------------------------- utilities
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  outCubic: x => 1 - Math.pow(1 - x, 3),
  inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outBack: (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
};
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let q = s;
    q = Math.imul(q ^ (q >>> 15), q | 1);
    q ^= q + Math.imul(q ^ (q >>> 7), q | 61);
    return ((q ^ (q >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = s => [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');

// ------------------------------------------------------------------ assets
const SP = window.SPRITES;
const IMG = {};
const loadImg = (k, src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = rej; im.src = src; });

const LOGO = window.LOGO;
const GLYPHS = LOGO.glyphs.map(g => ({ ...g, path: new Path2D(g.d), cx: (g.bbox[0] + g.bbox[2]) / 2, cy: (g.bbox[1] + g.bbox[3]) / 2 }));
const WING = new Path2D(LOGO.wing.d);
const WCX = (LOGO.wing.bbox[0] + LOGO.wing.bbox[2]) / 2, WCY = (LOGO.wing.bbox[1] + LOGO.wing.bbox[3]) / 2;
const PHONE_ICON = new Path2D('M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z');

// ------------------------------------------------------------- frame state
let BOIL = 0;                 // 12 fps boil step
const onTwos = t => Math.floor(t * 15 + 1e-6) / 15;

function paper(c, name, x, y, o = {}) {
  const sp = SP[name], im = IMG[name];
  const { rot = 0, s = 1, a = 1, boil = 1 } = o;
  const R = rng(hash(o.id || name) + BOIL * 7919);
  const jx = (R() - 0.5) * 2.6 * boil, jy = (R() - 0.5) * 2.6 * boil, jr = (R() - 0.5) * 0.006 * boil;
  c.save();
  c.globalAlpha *= a;
  c.translate(x + jx, y + jy); c.rotate(rot + jr); c.scale(s, s);
  c.drawImage(im, -sp.w / 2 - sp.pad, -sp.h / 2 - sp.pad);
  c.restore();
}
// run fn inside the (boiled) local frame of a paper piece, so drawings stick to it
function onPaper(c, name, x, y, o, fn) {
  const R = rng(hash(o.id || name) + BOIL * 7919);
  const jx = (R() - 0.5) * 2.6, jy = (R() - 0.5) * 2.6, jr = (R() - 0.5) * 0.006;
  c.save(); c.translate(x + jx, y + jy); c.rotate((o.rot || 0) + jr); c.scale(o.s || 1, o.s || 1);
  fn(c); c.restore();
}

// hand-drawn marker helpers (the wobble re-randomises each boil step)
function markerLoop(c, cx, cy, rx, ry, p, color, width, seed) {
  if (p <= 0) return;
  const R = rng(seed + BOIL * 13), n = 70, m = Math.max(2, Math.floor(n * p));
  c.save(); c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath();
  for (let i = 0; i <= m; i++) {
    const u = i / n, a = -2.4 + u * 1.2 * Math.PI * 2;
    const k = 1 + 0.05 * Math.sin(u * 9 + seed) + (R() - 0.5) * 0.025 + u * 0.1;
    const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.stroke(); c.restore();
}
function markerPath(c, pts, p, color, width, seed, head = false) {
  if (p <= 0) return;
  const R = rng(seed + BOIL * 17), m = Math.max(2, Math.floor((pts.length - 1) * p));
  c.save(); c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath();
  for (let i = 0; i <= m; i++) { const [x, y] = pts[i]; const jx = (R() - 0.5) * 2, jy = (R() - 0.5) * 2; i ? c.lineTo(x + jx, y + jy) : c.moveTo(x + jx, y + jy); }
  c.stroke();
  if (head && p >= 0.98) {
    const [x1, y1] = pts[pts.length - 1], [x0, y0] = pts[pts.length - 4];
    const a = Math.atan2(y1 - y0, x1 - x0);
    c.beginPath();
    c.moveTo(x1 + Math.cos(a + 2.5) * 38, y1 + Math.sin(a + 2.5) * 38); c.lineTo(x1, y1); c.lineTo(x1 + Math.cos(a - 2.6) * 38, y1 + Math.sin(a - 2.6) * 38);
    c.stroke();
  }
  c.restore();
}
function hand(c, text, x, y, size, color, p, rot = 0) {
  if (p <= 0) return;
  c.save(); c.translate(x, y); c.rotate(rot);
  c.font = `${size}px Pen`; c.textBaseline = 'middle';
  const w = c.measureText(text).width;
  c.beginPath(); c.rect(-10, -size, (w + 20) * p, size * 2); c.clip();
  c.fillStyle = color; c.strokeStyle = color; c.lineWidth = size * 0.04; c.lineJoin = 'round';
  c.strokeText(text, 0, 0); c.fillText(text, 0, 0);
  c.restore();
}
const curve = (p0, p1, p2, n = 40) => Array.from({ length: n + 1 }, (_, i) => {
  const u = i / n, v = 1 - u;
  return [v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0], v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1]];
});

// ------------------------------------------------------------------ camera
const SLAPS = [0.75, 1.47, 2.27, 3.13];
function camera(t, tq) {
  let sx = 0, sy = 0;
  for (const th of SLAPS) if (tq >= th) { const k = 7 * Math.exp(-(tq - th) * 14); sx += k * Math.sin(th * 50 + tq * 90); sy += k * Math.cos(th * 30 + tq * 70); }
  const z = 1.0 + 0.03 * E.inOutCubic(prog(t, 0, DUR));
  return { sx, sy, z, drift: lerp(26, -26, E.inOutCubic(prog(t, 0, DUR))) };
}

// ------------------------------------------------------------ scene pieces
const SKY = [['sky0', 110, -0.02, 0.0, -1], ['sky1', 245, 0.015, 0.05, 1], ['sky2', 385, -0.012, 0.1, -1], ['sky3', 540, 0.02, 0.15, 1], ['sky4', 690, -0.015, 0.2, -1]];
const CLOUDS = [['cloud0', 180, 262, 1], ['cloud1', 790, 452, 0.9], ['cloud2', 150, 585, 0.8], ['cloud3', 930, 640, 0.75]];
const MTN = [['mtn0', 815], ['mtn1', 895], ['mtn2', 975], ['mtn3', 1060]];
const HILL = [['hill2', 1255], ['hill1', 1330], ['hill0', 1410], ['ground0', 1690], ['ground1', 1860]];

function drawBackdrop(c, tq, t) {
  for (const [n, y, r, t0, dir] of SKY) {
    const p = prog(tq, t0, t0 + 0.27);
    if (p <= 0) continue;
    paper(c, n, W / 2 + dir * (1 - E.outBack(p, 1.1)) * 1350, y, { rot: r });
  }
  const sp = prog(tq, 0.25, 0.47);
  if (sp > 0) paper(c, 'sun', 885, 160, { s: E.outBack(sp, 2.4), rot: lerp(-1.2, 0, sp) + t * 0.12 });
  CLOUDS.forEach(([n, x, y, s], i) => {
    const p = prog(tq, 0.3 + i * 0.07, 0.5 + i * 0.07);
    if (p <= 0) return;
    paper(c, n, x + Math.sin(t * 0.9 + i) * 10 + (1 - E.outBack(p, 1.6)) * (i % 2 ? 500 : -500), y, { s });
  });
  MTN.forEach(([n, y], i) => {
    const p = prog(tq, 0.15 + i * 0.07, 0.42 + i * 0.07);
    if (p > 0) paper(c, n, W / 2 + (i % 2 ? 15 : -15), y + (1 - E.outBack(p, 1.3)) * 700);
  });
  HILL.forEach(([n, y], i) => {
    const p = prog(tq, 0.38 + i * 0.07, 0.65 + i * 0.07);
    if (p > 0) paper(c, n, W / 2 + (i % 2 ? -20 : 20), y + (1 - E.outBack(p, 1.3)) * 700);
  });
}

// tandem photo print
const TP = { x: 330, y: 842, rot: -0.085, s: 0.92 };
function tandemLocal(sx, sy) { // source-photo pixel -> print-local coords
  const m = SP.photo_tandem;
  return [(sx - m.srcCrop[0]) * m.srcScale + m.inner[0] - m.w / 2, (sy - m.srcCrop[1]) * m.srcScale + m.inner[1] - m.h / 2];
}
function drawTandem(c, tq) {
  const p = prog(tq, 0.45, 0.75);
  if (p <= 0) return;
  const e = E.outBack(p, 1.5);
  const o = { rot: lerp(-0.7, TP.rot, E.outCubic(p)), s: lerp(1.35, TP.s, e), id: 'tandem' };
  const x = lerp(-520, TP.x, e), y = lerp(260, TP.y, e);
  paper(c, 'photo_tandem', x, y, o);
  onPaper(c, 'photo_tandem', x, y, o, c => {
    const [fx, fy] = tandemLocal(362, 668);
    markerLoop(c, fx, fy, 70, 78, E.outCubic(prog(tq, 0.9, 1.25)), C.yellow, 9, 3);
    hand(c, '짜릿!', fx + 30, fy - 200, 130, C.yellow, prog(tq, 1.1, 1.4), -0.16);
    // tape on the top corners
    const m = SP.photo_tandem;
    const tp = [[prog(tq, 0.8, 0.87), -m.w / 2 + 70, -m.h / 2 + 4, -0.55, 'tape0'], [prog(tq, 0.87, 0.94), m.w / 2 - 60, -m.h / 2 + 8, 0.5, 'tape1']];
    for (const [q, tx, ty, tr, n] of tp) if (q > 0) paper(c, n, tx, ty, { rot: tr, s: lerp(1.5, 1, E.outBack(q, 2)), boil: 0 });
  });
}

// crew cut-out sticker
const CS = { x: 722, y: 1078, rot: 0.05, s: 1 };
function crewLocal(sx, sy) {
  const m = SP.photo_crew;
  return [(sx - m.srcCrop[0]) * m.srcScale + m.border - m.w / 2, (sy - m.srcCrop[1]) * m.srcScale + m.border - m.h / 2];
}
function drawCrew(c, tq) {
  const p = prog(tq, 1.2, 1.47);
  if (p <= 0) return;
  const e = E.outBack(p, 1.6);
  const o = { rot: lerp(0.4, CS.rot, E.outCubic(p)), s: lerp(0.5, CS.s, e), id: 'crew' };
  const x = CS.x, y = lerp(CS.y + 750, CS.y, e);
  paper(c, 'photo_crew', x, y, o);
}
function drawCrewNotes(c, tq) {
  const [kx, ky] = crewLocal(668, 850);
  const cs = Math.cos(CS.rot), sn = Math.sin(CS.rot);
  const tx = CS.x + kx * cs - ky * sn, ty = CS.y + kx * sn + ky * cs;
  hand(c, '이륙!', 790, 735, 120, C.marker, prog(tq, 1.55, 1.8), 0.1);
  markerPath(c, curve([845, 790], [640, 820], [tx - 6, ty - 70]), E.outCubic(prog(tq, 1.62, 1.9)), C.marker, 8, 9, true);
}

// logo card with letter stickers and the paper wing
const LC = { x: W / 2, y: 305, rot: -0.028, s: 1 };
const LS = 3.0;   // logo scale on the card
function drawLogoCard(c, tq) {
  const p = prog(tq, 2.0, 2.27);
  if (p <= 0) return;
  const e = E.outBack(p, 1.4);
  const o = { rot: lerp(0.3, LC.rot, E.outCubic(p)), s: lerp(1.3, 1, e), id: 'card' };
  const x = LC.x, y = lerp(-320, LC.y, e);
  paper(c, 'logo_card', x, y, o);
  onPaper(c, 'logo_card', x, y, o, c => {
    c.translate(-LOGO.width * LS / 2, -LOGO.height * LS / 2 + 6);
    GLYPHS.forEach((g, i) => {
      const st = 2.27 + i * 0.05, q = prog(tq, st, st + 0.2);
      if (q <= 0) return;
      const lift = 1 - q;
      c.save();
      c.translate(g.cx * LS, g.cy * LS); c.rotate(lerp(i % 2 ? 0.35 : -0.35, 0, E.outCubic(q)));
      c.scale(LS * lerp(1.9, 1, E.outBack(q, 1.8)), LS * lerp(1.9, 1, E.outBack(q, 1.8))); c.translate(-g.cx, -g.cy);
      sticker(c, g.path, g.layer === 'red' ? C.red : C.blue, lift);
      c.restore();
    });
    const wq = prog(tq, 2.68, 2.98);
    if (wq > 0) {
      const we = E.outBack(wq, 1.3);
      // riser lines once landed
      c.save(); c.strokeStyle = C.line; c.lineWidth = 0.5 * LS; c.lineCap = 'round';
      LOGO.lines.forEach((ln, i) => {
        const lp = E.outCubic(prog(tq, 2.95 + i * 0.04, 3.1 + i * 0.04));
        if (lp <= 0) return;
        c.beginPath(); c.moveTo(ln[0] * LS, ln[1] * LS); c.lineTo(lerp(ln[0], ln[2], lp) * LS, lerp(ln[1], ln[3], lp) * LS); c.stroke();
      });
      c.restore();
      c.save();
      c.translate(lerp(WCX + 260, WCX, we) * LS, lerp(WCY - 170, WCY, we) * LS); c.rotate(lerp(0.9, 0, E.outCubic(wq)));
      const ws = lerp(1.6, 1, we);
      c.scale(LS * ws, LS * ws); c.translate(-WCX, -WCY);
      const g = c.createLinearGradient(LOGO.wing.bbox[0], 0, LOGO.wing.bbox[2], 0);
      g.addColorStop(0, C.wingA); g.addColorStop(0.45, '#123E86'); g.addColorStop(1, C.wingB);
      sticker(c, WING, g, 1 - wq);
      c.restore();
    }
  });
}
function sticker(c, path, fill, lift) {
  c.save();
  c.shadowColor = 'rgba(30,20,10,0.35)'; c.shadowBlur = 5 + 22 * lift; c.shadowOffsetX = 3 + 10 * lift; c.shadowOffsetY = 4 + 16 * lift;
  c.lineJoin = 'round'; c.lineWidth = 1.5; c.strokeStyle = '#fff';
  c.fillStyle = '#fff'; c.stroke(path); c.fill(path, 'evenodd');
  c.restore();
  c.fillStyle = fill; c.fill(path, 'evenodd');
}

// booking: red strip + label + digit tiles
const RS = { x: W / 2, y: 1488, rot: -0.035 };
const TILE_S = 0.88;
const TILE_JIT = (() => { const R = rng(42); return [...PHONE].map(() => ({ dy: (R() - 0.5) * 22, r: (R() - 0.5) * 0.14 })); })();
function drawBooking(c, tq, t) {
  const p = prog(tq, 2.88, 3.13);
  if (p <= 0) return;
  paper(c, 'red_strip', RS.x - (1 - E.outExpo(p)) * 1400, RS.y, { rot: RS.rot });

  // digit tiles
  const ws = [...PHONE].map((ch, i) => SP['tile' + i].w * TILE_S);
  const gap = 5, total = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
  let x = W / 2 - total / 2;
  [...PHONE].forEach((ch, i) => {
    const cx = x + ws[i] / 2; x += ws[i] + gap;
    const st = 3.18 + i * 0.045, q = prog(tq, st, st + 0.17);
    if (q <= 0) return;
    const cy = RS.y + 12 + TILE_JIT[i].dy + (cx - W / 2) * Math.tan(RS.rot);
    const o = { rot: TILE_JIT[i].r + lerp(i % 2 ? 0.5 : -0.5, 0, E.outCubic(q)), s: TILE_S * lerp(2, 1, E.outBack(q, 1.8)), id: 'tile' + i };
    paper(c, 'tile' + i, cx, cy, o);
    if (ch !== '-') onPaper(c, 'tile' + i, cx, cy, o, c => {
      c.font = '138px BHS'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = C.ink;
      c.fillText(ch, 0, 52);
    });
  });

  // 예약문의 label with phone icon
  const lq = prog(tq, 3.08, 3.25);
  if (lq > 0) {
    const o = { rot: -0.075, s: lerp(1.8, 1, E.outBack(lq, 2)), id: 'label' };
    const lx = 318, ly = 1322;
    paper(c, 'label_yellow', lx, ly, o);
    onPaper(c, 'label_yellow', lx, ly, o, c => {
      let ring = 0;
      for (const r0 of [3.45, 4.05]) if (t > r0) ring += 0.4 * Math.sin((t - r0) * 40) * Math.exp(-(t - r0) * 7);
      c.fillStyle = C.ink; c.beginPath(); c.arc(-128, 2, 34, 0, Math.PI * 2); c.fill();
      c.save(); c.translate(-128, 2); c.rotate(ring); c.scale(2.1, 2.1); c.translate(-12, -12); c.fillStyle = C.yellow; c.fill(PHONE_ICON); c.restore();
      c.font = '64px BHS'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = C.ink;
      c.fillText('예약문의', -78, 6);
    });
  }

  // wavy white marker underline + little burst marks
  const up = E.outCubic(prog(tq, 3.62, 3.9));
  const pts = Array.from({ length: 60 }, (_, i) => { const u = i / 59, xx = lerp(95, 985, u); return [xx, RS.y + 118 + Math.sin(u * 18) * 6 + (xx - W / 2) * Math.tan(RS.rot)]; });
  markerPath(c, pts, up, '#FFFFFF', 9, 21);
  const bq = prog(tq, 3.7, 3.85);
  if (bq > 0) {
    c.save(); c.strokeStyle = C.yellow; c.lineWidth = 8; c.lineCap = 'round';
    for (const [ax, ay, a0] of [[1000, 1375, -0.6], [1030, 1420, -0.1], [1020, 1468, 0.4]]) {
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + Math.cos(a0) * 40 * bq, ay + Math.sin(a0) * 40 * bq); c.stroke();
    }
    c.restore();
  }
}

// doodles around the logo card
function drawDoodles(c, tq) {
  const q = prog(tq, 2.95, 3.12);
  if (q <= 0) return;
  c.save(); c.strokeStyle = C.marker; c.lineWidth = 7; c.lineCap = 'round';
  for (const [ax, ay, a0] of [[92, 150, -2.4], [70, 205, -2.95], [94, 260, 2.6]]) {
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + Math.cos(a0) * 34 * q, ay + Math.sin(a0) * 34 * q); c.stroke();
  }
  c.restore();
}

// ------------------------------------------------------------------- frame
function drawScene(c, t) {
  const tq = onTwos(t);
  BOIL = Math.floor(t * 12 + 1e-6);
  const cam = camera(t, tq);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.drawImage(IMG.paper_bg, 0, 0);
  c.save();
  c.translate(W / 2 + cam.sx, H / 2 + cam.sy); c.scale(cam.z, cam.z); c.translate(-W / 2, -H / 2);
  const layer = (depth, fn) => { c.save(); c.translate(0, cam.drift * depth); fn(); c.restore(); };
  layer(0.4, () => drawBackdrop(c, tq, t));
  layer(0.9, () => { drawTandem(c, tq); drawCrew(c, tq); drawCrewNotes(c, tq); });
  layer(1.1, () => { drawLogoCard(c, tq); drawDoodles(c, tq); });
  layer(1.2, () => drawBooking(c, tq, t));
  c.restore();
  // paper grain shimmer over everything
  c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.3;
  c.drawImage(IMG.grain, (BOIL % 3) * 3 - 3, ((BOIL >> 1) % 3) * 3 - 3, W + 6, H + 6);
  c.restore();
}

function renderFrame(t) { drawScene(ctx, clamp(t, 0, DUR)); }

const ready = Promise.all([
  ...Object.entries(SP).map(([k, v]) => loadImg(k, v.src)),
  document.fonts.load('64px BHS'), document.fonts.load('100px Pen'),
]).then(() => document.fonts.ready);
window.REEL = { W, H, DUR, FPS, ready, renderFrame, frames: Math.round(DUR * FPS) };

if (!new URLSearchParams(location.search).has('render')) {
  ready.then(() => {
    const t0 = performance.now();
    const loop = now => { const tt = ((now - t0) / 1000) % (DUR + 1); renderFrame(Math.min(tt, DUR)); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
} else {
  document.body.classList.add('render');
}
