/*
 * 문경패러글라이딩 — 4.5s end reel (1080x1920, 60fps)
 *
 * Everything is a pure function of time t (seconds), so the same code drives the
 * live browser preview and the frame-exact offline render (see render.mjs).
 * Rhythm grid: 150 BPM -> one beat = 0.4s. Key hits land on the grid:
 *   0.0 burst | 0.4 sky wipe | 0.8 "문경" slam | 1.2-1.6 letters on 16ths
 *   2.0 wing lands | 2.4 booking tag | 2.8 number locks | 3.2+ breathing hold
 */
'use strict';

const W = 1080, H = 1920, DUR = 4.5, FPS = 60;
const C = {
  red: '#F70500', blue: '#004BC5', navy: '#0B2472', ink: '#061A55',
  wingA: '#14296F', wingB: '#0566AF', line: '#5E92E4',
  gold: '#FFC62E', slabA: '#0B3FBF', slabB: '#04175A',
};

// ---------------------------------------------------------------- utilities
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inOutExpo: x => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
  outCubic: x => 1 - Math.pow(1 - x, 3),
  inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  inQuart: x => x * x * x * x,
  outQuart: x => 1 - Math.pow(1 - x, 4),
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
const mk = (w = W, h = H) => Object.assign(document.createElement('canvas'), { width: w, height: h });
const bez = (p0, p1, p2, p3, u) => {
  const v = 1 - u;
  return [0, 1].map(i => v * v * v * p0[i] + 3 * v * v * u * p1[i] + 3 * v * u * u * p2[i] + u * u * u * p3[i]);
};

// ------------------------------------------------------------------- canvas
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const scene = mk(), sctx = scene.getContext('2d');
const logoL = mk(), lctx = logoL.getContext('2d');
const numL = mk(), nctx = numL.getContext('2d');

// --------------------------------------------------------------------- logo
const LOGO = window.LOGO;
const S = 3.3;                               // lockup scale (logo px -> screen px)
const LX = (W - LOGO.width * S) / 2, LY = 540;
const G = LOGO.glyphs.map(g => ({
  ...g, path: new Path2D(g.d),
  cx: (g.bbox[0] + g.bbox[2]) / 2, cy: (g.bbox[1] + g.bbox[3]) / 2,
}));
const MG = G.slice(0, 2);                    // 문 경
const PG = G.slice(2);                       // 패 러 글 라 이 딩
const MGC = { x: (MG[0].bbox[0] + MG[1].bbox[2]) / 2, y: (MG[0].bbox[1] + MG[1].bbox[3]) / 2 };
const WING = new Path2D(LOGO.wing.d);
const WCX = (LOGO.wing.bbox[0] + LOGO.wing.bbox[2]) / 2, WCY = (LOGO.wing.bbox[1] + LOGO.wing.bbox[3]) / 2;
const WING_FINAL = { x: LX + WCX * S, y: LY + WCY * S, s: S, r: 0 };
const TIP_L = [200.8, 27.2], TIP_R = [288.5, 44.5];
const toScreen = (x, y) => [LX + x * S, LY + y * S];
// Material "call" icon (Apache 2.0), 24x24 box
const PHONE_ICON = new Path2D('M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z');

let wingGrad = null;
function wingFill(c) {
  if (!wingGrad) {
    wingGrad = c.createLinearGradient(LOGO.wing.bbox[0], 0, LOGO.wing.bbox[2], 0);
    wingGrad.addColorStop(0, C.wingA);
    wingGrad.addColorStop(0.45, '#123E86');
    wingGrad.addColorStop(1, C.wingB);
  }
  return wingGrad;
}
function drawWing(c, T, fill) {
  c.save();
  c.translate(T.x, T.y); c.rotate(T.r); c.scale(T.s, T.s); c.translate(-WCX, -WCY);
  c.fillStyle = fill; c.fill(WING, 'evenodd');
  c.restore();
}
function wingPoint(T, p) {
  const dx = (p[0] - WCX) * T.s, dy = (p[1] - WCY) * T.s;
  const cs = Math.cos(T.r), sn = Math.sin(T.r);
  return [T.x + dx * cs - dy * sn, T.y + dx * sn + dy * cs];
}

// ------------------------------------------------------------ pre-rendered
function makeCloud(seed, w, h) {
  const c0 = mk(w, h), c = c0.getContext('2d'), R = rng(seed);
  c.filter = 'blur(5px)';
  for (let i = 0; i < 16; i++) {
    const x = w * (0.18 + R() * 0.64), y = h * (0.42 + R() * 0.22), r = h * (0.15 + R() * 0.2);
    const g = c.createRadialGradient(x, y - r * 0.35, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.72, 'rgba(255,255,255,0.96)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  c.filter = 'none';
  c.globalCompositeOperation = 'source-atop';
  const sh = c.createLinearGradient(0, 0, 0, h);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(0.55, 'rgba(210,230,250,0)');
  sh.addColorStop(1, 'rgba(150,190,235,0.7)');
  c.fillStyle = sh; c.fillRect(0, 0, w, h);
  return c0;
}
function makeMountains() {
  const h = 1250, c0 = mk(W, h), c = c0.getContext('2d');
  const layers = [
    { base: 150, amp: 120, top: '#C9DDF4', bot: '#E4EFFB', seed: 3 },
    { base: 250, amp: 120, top: '#9EC0EA', bot: '#C6DCF4', seed: 7 },
    { base: 360, amp: 100, top: '#6F9BD8', bot: '#A7C5EA', seed: 13 },
  ];
  for (const L of layers) {
    const R = rng(L.seed), f = [0.004 + R() * 0.002, 0.009 + R() * 0.004, 0.021 + R() * 0.01], ph = [R() * 9, R() * 9, R() * 9];
    c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= W; x += 4) {
      const n = 0.62 * Math.pow(1 - Math.abs(Math.sin(x * f[0] + ph[0])), 1.6)
              + 0.28 * Math.pow(1 - Math.abs(Math.sin(x * f[1] + ph[1])), 2)
              + 0.10 * Math.sin(x * f[2] + ph[2]);
      c.lineTo(x, L.base + L.amp * (1 - n));
    }
    c.lineTo(W, h); c.closePath();
    const g = c.createLinearGradient(0, L.base - L.amp, 0, L.base + 380);
    g.addColorStop(0, L.top); g.addColorStop(1, L.bot);
    c.fillStyle = g; c.fill();
  }
  return c0;
}
const CLOUDS = [
  { spr: makeCloud(11, 460, 210), x: 40, y: 170, s: 0.9, par: 0.35, dr: 14 },
  { spr: makeCloud(23, 520, 230), x: 560, y: 95, s: 1.05, par: 0.45, dr: -10 },
  { spr: makeCloud(37, 460, 210), x: 820, y: 470, s: 0.75, par: 0.5, dr: 12 },
  { spr: makeCloud(41, 520, 230), x: -120, y: 600, s: 0.8, par: 0.55, dr: 16 },
  { spr: makeCloud(53, 560, 250), x: 640, y: 980, s: 1.5, par: 1.1, dr: -18 },
  { spr: makeCloud(67, 560, 250), x: -200, y: 1250, s: 1.7, par: 1.25, dr: 22 },
];
const MOUNTAINS = makeMountains();
const GLIDERS = [
  { x: 150, y: 395, s: 0.5, col: C.red, vx: 26, ph: 0.3 },
  { x: 700, y: 285, s: 0.36, col: C.gold, vx: -18, ph: 1.7 },
  { x: 985, y: 430, s: 0.27, col: C.navy, vx: -12, ph: 2.9 },
];

// ------------------------------------------------------------------- camera
const HITS = [[0.80, 30, 8.5], [2.06, 9, 11], [2.93, 11, 12]];
function camera(t) {
  let sx = 0, sy = 0, rot = 0, z = 1;
  for (const [th, amp, dec] of HITS) {
    if (t < th) continue;
    const k = amp * Math.exp(-(t - th) * dec);
    sx += k * Math.sin(t * 97.3 + th * 13);
    sy += k * Math.cos(t * 73.1 + th * 7);
    rot += k * 0.0007 * Math.sin(t * 61.7 + th);
  }
  if (t >= 0.8) z += 0.055 * Math.exp(-(t - 0.8) * 7);
  if (t < 0.5) z += 0.04 * (1 - t / 0.5);
  z += 0.022 * E.inOutCubic(prog(t, 2.9, 4.5)); // slow push-in keeps the hold alive
  return { sx, sy, rot, z };
}
function applyCam(c, k) {
  c.translate(W / 2 + k.sx, H / 2 + k.sy); c.rotate(k.rot); c.scale(k.z, k.z); c.translate(-W / 2, -H / 2);
}

// -------------------------------------------------------------- intro scene
const SPEED = (() => { const R = rng(99); return Array.from({ length: 90 }, () => ({ a: R() * Math.PI * 2, ph: R(), sp: 1.4 + R() * 1.6, w: 1 + R() * 5 })); })();
function introWing(t) {
  const p = prog(t, 0.0, 0.46), u = E.outCubic(p);
  const [x, y] = bez([-700, 1900], [-100, 1200], [700, 700], [1850, -250], u);
  return { x, y, s: S * lerp(7.5, 4.2, u), r: lerp(-0.62, -0.22, u) };
}
function drawIntro(c, t) {
  const g = c.createRadialGradient(W / 2, H * 0.48, 50, W / 2, H * 0.48, 1250);
  g.addColorStop(0, '#1C5CF0'); g.addColorStop(0.55, '#0A3CC0'); g.addColorStop(1, '#051A66');
  c.fillStyle = g; c.fillRect(-200, -200, W + 400, H + 400);

  // giant scrolling outline type
  c.save();
  c.translate(W / 2, H / 2); c.rotate(-0.14); c.translate(-W / 2, -H / 2);
  c.font = '330px BHS'; c.textBaseline = 'alphabetic';
  c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,0.22)'; c.fillStyle = 'rgba(255,255,255,0.07)';
  const rows = [['PARAGLIDING  PARAGLIDING', 520, -1], ['문경 문경 문경 문경', 1010, 1], ['MUNGYEONG  MUNGYEONG', 1500, -1]];
  for (const [txt, y, dir] of rows) {
    const x = dir < 0 ? -200 - t * 2600 : -1400 + t * 2600;
    c.fillText(txt, x, y); c.strokeText(txt, x, y);
  }
  c.restore();

  // radial speed lines
  c.save(); c.lineCap = 'round';
  for (const s of SPEED) {
    const x = (t * s.sp + s.ph) % 1;
    const r1 = 80 + x * x * 1500, len = 30 + x * 480;
    const ca = Math.cos(s.a), sa = Math.sin(s.a);
    c.strokeStyle = `rgba(255,255,255,${(Math.min(1, x * 3) * 0.55).toFixed(3)})`;
    c.lineWidth = s.w * (0.4 + x);
    c.beginPath(); c.moveTo(W / 2 + ca * r1, H * 0.48 + sa * r1); c.lineTo(W / 2 + ca * (r1 + len), H * 0.48 + sa * (r1 + len)); c.stroke();
  }
  c.restore();

  // red slash
  const sp = E.outExpo(prog(t, 0.02, 0.3));
  if (sp > 0) {
    c.save(); c.translate(W / 2, H * 0.52); c.rotate(-0.42);
    c.fillStyle = C.red; c.fillRect(-1600, -85, 3200 * sp, 170);
    c.fillStyle = '#fff'; c.fillRect(-1600, 100, 3200 * E.outExpo(prog(t, 0.06, 0.34)), 22);
    c.restore();
  }

  // white wing tearing through, with wingtip contrails
  drawContrails(c, t, introWing, 0.0, 0.46, 0.14, 'rgba(255,255,255,', 1);
  drawWing(c, introWing(t), '#fff');
}

// stripes wipe (intro -> sky), angled bands sweeping bottom-left -> top-right
const WIPE_A = 1.08; // radians of sweep direction above horizontal
function bandClip(c, L) {
  const dx = Math.cos(WIPE_A), dy = -Math.sin(WIPE_A), px = -dy, py = dx;
  const ox = -200, oy = H + 200, big = 6000;
  const P = (u, v) => [ox + u * dx + v * px, oy + u * dy + v * py];
  const pts = [P(-big, -big), P(L, -big), P(L, big), P(-big, big)];
  c.beginPath(); c.moveTo(...pts[0]); for (const q of pts.slice(1)) c.lineTo(...q); c.closePath(); c.clip();
}
function drawWipe(c, t) {
  const p = prog(t, 0.2, 0.5);
  if (p <= 0) return;
  const L = lerp(-420, 2750, E.inOutCubic(p));
  const bands = [[L + 250, C.ink], [L + 210, C.red], [L + 70, '#fff']];
  for (const [edge, col] of bands) { c.save(); bandClip(c, edge); c.fillStyle = col; c.fillRect(-300, -300, W + 600, H + 600); c.restore(); }
  c.save(); bandClip(c, L); drawSky(c, t); c.restore();
}

// ----------------------------------------------------------------- sky scene
function drawSky(c, t) {
  const cam = -950 * (1 - E.outExpo(prog(t, 0.22, 1.9)));
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3E9AF4'); g.addColorStop(0.2, '#8FCBFF'); g.addColorStop(0.4, '#D9EEFF'); g.addColorStop(0.6, '#F3FAFF');
  c.fillStyle = g; c.fillRect(-200, -200, W + 400, H + 400);

  // sun + slow rays
  const sx = 900, sy = 210 + cam * 0.15;
  c.save(); c.globalCompositeOperation = 'lighter';
  c.translate(sx, sy); c.rotate(t * 0.12);
  for (let i = 0; i < 14; i++) {
    c.rotate(Math.PI * 2 / 14);
    c.fillStyle = 'rgba(255,255,255,0.045)';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(1800, -70); c.lineTo(1800, 70); c.closePath(); c.fill();
  }
  c.restore();
  const sg = c.createRadialGradient(sx, sy, 0, sx, sy, 560);
  sg.addColorStop(0, 'rgba(255,255,255,0.95)'); sg.addColorStop(0.18, 'rgba(255,252,235,0.6)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = sg; c.fillRect(sx - 560, sy - 560, 1120, 1120);

  for (const k of CLOUDS.slice(0, 4)) drawCloud(c, k, t, cam);
  c.drawImage(MOUNTAINS, 0, 760 + cam * 0.22);
  for (const gl of GLIDERS) drawGlider(c, gl, t, cam);
  for (const k of CLOUDS.slice(4)) drawCloud(c, k, t, cam);
}
function drawCloud(c, k, t, cam) {
  const w = k.spr.width * k.s, h = k.spr.height * k.s;
  c.drawImage(k.spr, k.x + t * k.dr * k.par * 3, k.y + cam * k.par, w, h);
}
function drawGlider(c, gl, t, cam) {
  const T = { x: gl.x + gl.vx * t, y: gl.y + cam * 0.5 + Math.sin(t * 2 + gl.ph) * 6, s: gl.s, r: Math.sin(t * 1.3 + gl.ph) * 0.07 };
  const pilot = wingPoint(T, [WCX + 4, WCY + 58]);
  c.save(); c.strokeStyle = 'rgba(20,40,90,0.55)'; c.lineWidth = 1.2;
  for (const tip of [TIP_L, TIP_R, [WCX - 18, WCY + 6], [WCX + 22, WCY + 8]]) {
    const a = wingPoint(T, tip); c.beginPath(); c.moveTo(...a); c.lineTo(...pilot); c.stroke();
  }
  c.fillStyle = '#16244F'; c.beginPath(); c.arc(pilot[0], pilot[1], 5 * gl.s * 2, 0, Math.PI * 2); c.fill();
  c.restore();
  drawWing(c, T, gl.col);
}

// -------------------------------------------------------------- the lockup
function mgState(t) {
  if (t < 0.4) return null;
  const BIG = 11.2, bx = W / 2, by = 930, br = -0.075;
  const fx = LX + MGC.x * S, fy = LY + MGC.y * S;
  if (t < 0.8) {
    const p = E.inQuart(prog(t, 0.4, 0.8));
    return { x: bx, y: by, s: BIG * lerp(4.4, 1, p), r: lerp(-0.4, br, p), a: clamp((t - 0.4) / 0.025), ex: 1 };
  }
  if (t < 1.02) {
    const q = t - 0.8;
    const bounce = 1 - 0.075 * Math.exp(-q * 9) * Math.cos(q * 30);
    return { x: bx, y: by, s: BIG * bounce * (1 + 0.1 * q), r: br, a: 1, ex: 1 };
  }
  const q = E.inOutExpo(prog(t, 1.02, 1.4));
  return { x: lerp(bx, fx, q), y: lerp(by, fy, q), s: lerp(BIG * 1.022, S, q), r: lerp(br, 0, q), a: 1, ex: 1 - q };
}
function drawMG(c, st) {
  c.save();
  c.globalAlpha = st.a;
  c.translate(st.x, st.y); c.rotate(st.r);
  const px = 1 / st.s; // one screen pixel in logo units
  // hard extrusion
  if (st.ex > 0.01) {
    for (let k = 16; k >= 1; k--) {
      c.save(); c.translate(k * 1.6 * st.ex, k * 1.9 * st.ex); c.scale(st.s, st.s); c.translate(-MGC.x, -MGC.y);
      c.fillStyle = k === 16 ? 'rgba(4,20,80,0.35)' : C.ink;
      for (const g of MG) c.fill(g.path, 'evenodd');
      c.restore();
    }
  }
  c.scale(st.s, st.s); c.translate(-MGC.x, -MGC.y);
  if (st.ex > 0.01) {
    c.lineJoin = 'round'; c.lineWidth = 16 * px * st.ex; c.strokeStyle = '#fff';
    for (const g of MG) c.stroke(g.path);
  }
  c.fillStyle = C.red;
  for (const g of MG) c.fill(g.path, 'evenodd');
  c.restore();
}
const LETTER_T0 = 1.18, LETTER_STEP = 0.1;
function letterState(i, t) {
  const st = LETTER_T0 + i * LETTER_STEP;
  const p = prog(t, st, st + 0.36);
  if (p <= 0) return null;
  const b = E.outBack(p, 2.4);
  return { dy: lerp(210, 0, b), s: lerp(0.15, 1, E.outBack(p, 2.8)), r: lerp(i % 2 ? 0.55 : -0.55, 0, E.outCubic(p)), a: clamp(p * 5) };
}
function drawLetter(c, g, st) {
  c.save(); c.globalAlpha = st.a;
  c.translate(LX + g.cx * S, LY + g.cy * S + st.dy); c.rotate(st.r); c.scale(S * st.s, S * st.s); c.translate(-g.cx, -g.cy);
  c.fillStyle = C.blue; c.fill(g.path, 'evenodd');
  c.restore();
}

const WING_T0 = 1.42, WING_T1 = 2.06;
function wingState(t) {
  if (t < WING_T0) return null;
  const F = WING_FINAL;
  if (t < WING_T1) {
    const p = prog(t, WING_T0, WING_T1), u = E.outQuart(p);
    const [x, y] = bez([1500, 1750], [-420, 1550], [-160, 150], [F.x, F.y], u);
    return { x, y, s: S * lerp(3.2, 1, E.outCubic(p)), r: lerp(-0.95, 0, E.outBack(p, 1.4)) };
  }
  const q = t - WING_T1;
  const settle = Math.exp(-q * 7) * Math.sin(q * 22);
  return { x: F.x, y: F.y - settle * 10 + Math.sin(q * 3.1) * 4 * clamp(q * 2), s: S, r: settle * 0.035 + Math.sin(q * 2.3 + 0.6) * 0.012 * clamp(q * 2) };
}
function drawContrails(c, t, stateFn, t0, t1, span, rgba, alphaMul) {
  if (t < t0) return;
  const fade = 1 - prog(t, t1, t1 + 0.3);
  if (fade <= 0) return;
  const N = 22, pts = [];
  for (let k = 0; k <= N; k++) {
    const tk = clamp(t - span * (k / N), t0, t1);
    const T = stateFn(tk);
    pts.push([wingPoint(T, TIP_L), wingPoint(T, TIP_R)]);
  }
  c.save(); c.lineCap = 'round';
  for (const side of [0, 1]) {
    for (let k = 0; k < N; k++) {
      const a = (1 - k / N);
      c.strokeStyle = rgba + (a * 0.85 * fade * alphaMul).toFixed(3) + ')';
      c.lineWidth = lerp(1, 9, a);
      c.beginPath(); c.moveTo(...pts[k][side]); c.lineTo(...pts[k + 1][side]); c.stroke();
    }
  }
  c.restore();
}

function glint(c, t, t0, t1, alpha) {
  const p = prog(t, t0, t1);
  if (p <= 0 || p >= 1) return;
  const x = lerp(-500, W + 500, E.inOutCubic(p));
  c.save();
  c.globalCompositeOperation = 'source-atop';
  c.translate(x, H / 2); c.rotate(0.38);
  const g = c.createLinearGradient(-130, 0, 130, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${alpha})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(-130, -2000, 260, 4000);
  c.restore();
}

function buildLogo(t) {
  const c = lctx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
  const ms = mgState(t);
  if (ms) drawMG(c, ms);
  PG.forEach((g, i) => { const st = letterState(i, t); if (st) drawLetter(c, g, st); });
  const ws = wingState(t);
  if (ws) {
    // riser lines draw on once the wing has landed
    c.save(); c.strokeStyle = C.line; c.lineWidth = 0.5 * S; c.lineCap = 'round';
    LOGO.lines.forEach((ln, i) => {
      const p = E.outCubic(prog(t, 1.96 + i * 0.05, 2.24 + i * 0.05));
      if (p <= 0) return;
      const a = wingPoint(ws, [ln[0], ln[1]]), b = toScreen(ln[2], ln[3]);
      c.beginPath(); c.moveTo(...a); c.lineTo(lerp(a[0], b[0], p), lerp(a[1], b[1], p)); c.stroke();
    });
    c.restore();
    drawWing(c, ws, wingFill(c));
  }
  glint(c, t, 2.1, 2.55, 0.9);
  glint(c, t, 3.95, 4.4, 0.7);
}

// ------------------------------------------------------------- impact FX
const SHARDS = (() => {
  const R = rng(7);
  return Array.from({ length: 46 }, () => {
    const a = R() * Math.PI * 2, v = 700 + R() * 2100;
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 400, sz: 10 + R() * 34, spin: (R() - 0.5) * 24, rot: R() * 6,
             col: [C.red, C.red, C.ink, '#fff', C.gold][Math.floor(R() * 5)], life: 0.4 + R() * 0.5 };
  });
})();
function drawImpact(c, t) {
  const t0 = 0.8, ox = W / 2, oy = 930;
  if (t < t0 || t > t0 + 1.5) return;
  const q = t - t0;
  // burst rays
  const rp = prog(t, t0, t0 + 0.22);
  if (rp < 1) {
    c.save(); c.translate(ox, oy); c.fillStyle = `rgba(255,255,255,${(1 - rp) * 0.9})`;
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2 + 0.1, r0 = 330 + rp * 200, r1 = r0 + 180 + E.outCubic(rp) * 900, w = 0.05;
      c.beginPath(); c.moveTo(Math.cos(a - w) * r0, Math.sin(a - w) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.lineTo(Math.cos(a + w) * r0, Math.sin(a + w) * r0); c.fill();
    }
    c.restore();
  }
  // shockwave rings
  for (const [d, col, wmax] of [[0, 'rgba(255,255,255,', 70], [0.07, 'rgba(247,5,0,', 34]]) {
    const p = prog(t, t0 + d, t0 + d + 0.42);
    if (p <= 0 || p >= 1) continue;
    c.save(); c.strokeStyle = col + (1 - p) + ')'; c.lineWidth = lerp(wmax, 2, p);
    c.beginPath(); c.arc(ox, oy, lerp(120, 1000, E.outCubic(p)), 0, Math.PI * 2); c.stroke(); c.restore();
  }
  // shards
  for (const s of SHARDS) {
    if (q > s.life) continue;
    const drag = (1 - Math.exp(-q * 3.2)) / 3.2;
    const x = ox + s.vx * drag, y = oy + s.vy * drag + 900 * q * q;
    const a = 1 - q / s.life;
    c.save(); c.globalAlpha = a; c.translate(x, y); c.rotate(s.rot + s.spin * q); c.fillStyle = s.col;
    c.beginPath(); c.moveTo(0, -s.sz); c.lineTo(s.sz * 0.7, s.sz * 0.6); c.lineTo(-s.sz * 0.5, s.sz * 0.4); c.closePath(); c.fill();
    c.restore();
  }
}
function drawLetterPops(c, t) {
  PG.forEach((g, i) => {
    const st = LETTER_T0 + i * LETTER_STEP + 0.08, p = prog(t, st, st + 0.3);
    if (p <= 0 || p >= 1) return;
    const [x, y] = toScreen(g.cx, g.cy);
    c.save(); c.strokeStyle = `rgba(0,75,197,${(1 - p) * 0.8})`; c.lineWidth = lerp(10, 1, p);
    c.beginPath(); c.arc(x, y, lerp(20, 120, E.outCubic(p)), 0, Math.PI * 2); c.stroke();
    c.fillStyle = i % 2 ? `rgba(247,5,0,${1 - p})` : `rgba(255,198,46,${1 - p})`;
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 + i, r = lerp(40, 150, E.outCubic(p));
      c.beginPath(); c.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, lerp(7, 1, p), 0, Math.PI * 2); c.fill();
    }
    c.restore();
  });
}
function star(c, x, y, r, a) {
  c.save(); c.translate(x, y); c.globalAlpha = a; c.fillStyle = '#fff';
  c.beginPath();
  for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.16 : r, an = k * Math.PI / 4; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
  c.closePath(); c.fill(); c.restore();
}
function drawSparkles(c, t) {
  const S0 = [[TIP_R, 2.1, 70], [[6, 36], 2.18, 54], [[200, 20], 2.26, 46], [[150, 70], 2.34, 40]];
  for (const [pt, t0, r] of S0) {
    const p = prog(t, t0, t0 + 0.4);
    if (p <= 0 || p >= 1) continue;
    const [x, y] = toScreen(pt[0], pt[1]);
    star(c, x, y, r * Math.sin(p * Math.PI), 1);
  }
}

// ------------------------------------------------------------------ tagline
function drawTagline(c, t) {
  const p = prog(t, 2.12, 2.62);
  if (p <= 0) return;
  c.save();
  c.font = '900 34px NotoKR'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.letterSpacing = lerp(30, 13, E.outExpo(p)) + 'px';
  c.globalAlpha = clamp(p * 3);
  c.fillStyle = C.navy;
  c.fillText('MUNGYEONG PARAGLIDING', W / 2 + 6, LY + LOGO.height * S + 66);
  c.restore();
}

// --------------------------------------------------------- booking slab
const SL0 = 996, SL1 = 918;                 // slab top edge at x=0 / x=W
const edgeY = x => SL0 + (SL1 - SL0) * x / W;
function slabOffset(t, t0, t1) { return (1 - E.outExpo(prog(t, t0, t1))) * 1250; }
function slabPoly(c, dy, top) {
  c.beginPath(); c.moveTo(-200, edgeY(-200) + dy + top); c.lineTo(W + 200, edgeY(W + 200) + dy + top);
  c.lineTo(W + 200, H + 300); c.lineTo(-200, H + 300); c.closePath();
}
function drawSlab(c, t) {
  if (t < 1.98) return;
  const dStripe = slabOffset(t, 1.98, 2.4), dy = slabOffset(t, 2.04, 2.5);
  // red stripe riding just above the slab
  c.save(); slabPoly(c, dStripe, -34); c.fillStyle = C.red; c.fill(); c.restore();
  c.save(); slabPoly(c, dy, -10); c.fillStyle = '#fff'; c.fill(); c.restore();
  c.save();
  slabPoly(c, dy, 0); c.clip();
  const g = c.createLinearGradient(0, SL1 + dy, 0, H);
  g.addColorStop(0, C.slabA); g.addColorStop(1, C.slabB);
  c.fillStyle = g; c.fillRect(-200, SL1 - 100 + dy, W + 400, H + 400);
  // moving diagonal pinstripes
  c.fillStyle = 'rgba(255,255,255,0.045)';
  const off = (t * 60) % 90;
  for (let x = -1200; x < W + 200; x += 90) {
    c.beginPath(); c.moveTo(x + off, H + 100); c.lineTo(x + off + 34, H + 100); c.lineTo(x + off + 34 + 1300, -100); c.lineTo(x + off + 1300, -100); c.closePath(); c.fill();
  }
  // big ghost wing
  drawWing(c, { x: 800, y: 1660 + dy * 1.1, s: S * 2.4, r: -0.16 + Math.sin(t * 0.8) * 0.02 }, 'rgba(255,255,255,0.07)');
  c.restore();
  return dy;
}

// ------------------------------------------------------- booking content
const PHONE = '1688-6707';
let NUM = null;
function numLayout(c) {
  if (NUM) return NUM;
  c.save(); c.font = '100px BHS';
  const w100 = c.measureText(PHONE).width;
  const size = Math.min(238, 930 / w100 * 100);
  c.font = `${size}px BHS`;
  const total = c.measureText(PHONE).width, x0 = (W - total) / 2;
  const xs = [...PHONE].map((ch, i) => {
    const pre = c.measureText(PHONE.slice(0, i)).width, w = c.measureText(ch).width;
    return { ch, x: x0 + pre + w / 2, w };
  });
  const m = c.measureText('0');
  c.restore();
  NUM = { size, total, x0, xs, cap: m.actualBoundingBoxAscent };
  return NUM;
}
function drawBooking(c, t) {
  if (t < 2.2) return;
  const dy = slabOffset(t, 2.04, 2.5);

  // --- tag: [phone icon] 예약문의
  const tp = prog(t, 2.3, 2.58);
  if (tp > 0) {
    c.save();
    c.font = '66px BHS';
    const tw = c.measureText('예약문의').width, d = 78, bw = 26 + d + 22 + tw + 44, bh = 104;
    c.translate(W / 2, 1082 + dy);
    const s = lerp(0.3, 1, E.outBack(tp, 2.6));
    c.scale(s, s); c.globalAlpha = clamp(tp * 5);
    c.save(); c.transform(1, 0, -0.22, 1, 0, 0);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(-bw / 2 + 8, -bh / 2 + 10, bw, bh);
    c.fillStyle = C.red; c.fillRect(-bw / 2, -bh / 2, bw, bh);
    c.restore();
    const ix = -bw / 2 + 26 + d / 2;
    // ringing icon
    let ring = 0;
    for (const r0 of [3.0, 3.85]) if (t > r0) ring += 0.38 * Math.sin((t - r0) * 42) * Math.exp(-(t - r0) * 7);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ix, 0, d / 2, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(ix, 0); c.rotate(ring); c.scale(2.3, 2.3); c.translate(-12, -12); c.fillStyle = C.red; c.fill(PHONE_ICON); c.restore();
    // sound waves when ringing
    for (const r0 of [3.0, 3.85]) {
      const wp = prog(t, r0, r0 + 0.5);
      if (wp <= 0 || wp >= 1) continue;
      c.save(); c.strokeStyle = `rgba(255,255,255,${1 - wp})`; c.lineWidth = 5; c.lineCap = 'round';
      for (const k of [0, 1]) { c.beginPath(); c.arc(ix, 0, d / 2 + 14 + k * 16 + wp * 20, -0.9, -0.1); c.stroke(); c.beginPath(); c.arc(ix, 0, d / 2 + 14 + k * 16 + wp * 20, Math.PI + 0.1, Math.PI + 0.9); c.stroke(); }
      c.restore();
    }
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText('예약문의', ix + d / 2 + 22, 4);
    c.restore();
  }

  // --- phone number: slot-machine roll into place (rendered to its own layer for the glint)
  const L = numLayout(c);
  const base = 1336 + dy;
  const nc = nctx;
  nc.setTransform(1, 0, 0, 1, 0, 0); nc.clearRect(0, 0, W, H);
  nc.font = `${L.size}px BHS`; nc.textAlign = 'center'; nc.textBaseline = 'alphabetic';
  const pulse = 1 + 0.045 * Math.exp(-Math.max(0, t - 3.2) * 9) * (t >= 3.2 ? 1 : 0);
  nc.translate(W / 2, base - L.cap / 2); nc.scale(pulse, pulse); nc.translate(-W / 2, -(base - L.cap / 2));
  const stepH = L.size * 1.05, R = rng(5);
  L.xs.forEach((g, i) => {
    const r0 = 2.36 + i * 0.028, lock = 2.56 + i * 0.045;
    const p = prog(t, r0, lock);
    if (p <= 0) return;
    if (g.ch === '-') {
      const hp = E.outBack(prog(t, r0 + 0.08, lock + 0.05), 2);
      nc.save(); nc.translate(g.x, base - L.cap * 0.42); nc.scale(Math.max(0, hp), 1);
      nc.fillStyle = C.red; nc.fillRect(-g.w * 0.38, -L.size * 0.055, g.w * 0.76, L.size * 0.11); nc.restore();
      return;
    }
    const N = 7, seq = Array.from({ length: N }, () => String(Math.floor(R() * 10)));
    seq.push(g.ch);
    const pos = E.outBack(p, 1.3) * N;
    nc.save();
    nc.beginPath(); nc.rect(g.x - g.w, base - L.cap - L.size * 0.2, g.w * 2, L.cap + L.size * 0.34); nc.clip();
    nc.fillStyle = '#fff';
    for (let j = 0; j <= N; j++) {
      const y = base + (pos - j) * stepH;
      if (y < base - L.cap - stepH || y > base + stepH + L.cap) continue;
      nc.fillText(seq[j], g.x, y);
    }
    nc.restore();
  });
  glint(nc, t, 3.3, 3.75, 0.85);
  c.save(); c.shadowColor = 'rgba(0,10,50,0.45)'; c.shadowOffsetY = 10; c.shadowBlur = 18;
  c.drawImage(numL, 0, 0); c.restore();

  // underline swipe
  const up = prog(t, 2.9, 3.2);
  if (up > 0) {
    const w = L.total * E.outExpo(up), x = W / 2 - L.total / 2;
    c.save(); c.fillStyle = C.red; c.fillRect(x, base + 34, w, 12);
    c.fillStyle = '#fff'; c.fillRect(x + w - 60 * (1 - up), base + 34, 60 * (1 - up), 12);
    c.restore();
  }
}

// ---------------------------------------------------------------- frame
function drawScene(c, t) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  c.save();
  applyCam(c, camera(t));
  if (t < 0.5) { drawIntro(c, t); drawWipe(c, t); } else drawSky(c, t);
  drawSlab(c, t);
  drawImpact(c, t);
  drawContrails(c, t, wingState, WING_T0, WING_T1, 0.2, 'rgba(255,255,255,', 1);
  drawLetterPops(c, t);
  buildLogo(t);
  c.drawImage(logoL, 0, 0);
  drawTagline(c, t);
  drawSparkles(c, t);
  drawBooking(c, t);
  c.restore();

  // impact flash
  const fp = prog(t, 0.8, 0.97);
  if (t >= 0.8 && fp < 1) { c.fillStyle = `rgba(255,255,255,${0.7 * (1 - fp)})`; c.fillRect(0, 0, W, H); }
  // gentle vignette
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
  v.addColorStop(0, 'rgba(0,15,60,0)'); v.addColorStop(1, 'rgba(0,15,60,0.22)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
}

// Motion blur: average several sub-frame samples across a 270° shutter.
function renderFrame(t, samples = 6, shutter = 0.75 / FPS) {
  if (samples <= 1) { drawScene(ctx, t); return; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let k = 0; k < samples; k++) {
    const tk = clamp(t - shutter / 2 + shutter * (k + 0.5) / samples, 0, DUR);
    drawScene(sctx, tk);
    ctx.globalAlpha = 1 / (k + 1);
    ctx.drawImage(scene, 0, 0);
  }
  ctx.globalAlpha = 1;
}

const ready = Promise.all([document.fonts.load('66px BHS'), document.fonts.load('900 34px NotoKR')]).then(() => document.fonts.ready);
window.REEL = { W, H, DUR, FPS, ready, renderFrame, frames: Math.round(DUR * FPS) };

if (!new URLSearchParams(location.search).has('render')) {
  ready.then(() => {
    const t0 = performance.now();
    const loop = now => { renderFrame(((now - t0) / 1000) % (DUR + 0.8) > DUR ? DUR : ((now - t0) / 1000) % (DUR + 0.8), 1); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
} else {
  document.body.classList.add('render');
}
