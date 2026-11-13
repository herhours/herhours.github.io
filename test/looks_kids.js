// Her Hours Shorts — 「종이 일기」: the children's look, rebuilt from the ground up (11-11, 영샘 "기초부터 새로 만든다 생각하고").
// What the first one (Paper World) got wrong, and what this one is built on:
//   · the child is the star from frame 0 - the photo is the biggest thing on screen, never an 11% window
//   · the paper world never leaves: every photo is stuck on coloured paper with tape, stickers pop on the cuts
//   · one world - one set of colours and shapes; nothing here is a picture file, it is all cut paper drawn on the canvas
//   · the child's name is in it: on the opening, in the cheer bubble, on the award at the end
//   · it works at any length: the cheer and the award are there at 15 seconds too
// Cut on the song's beat grid like the other looks. Shadows are costly on a phone, so every paper shape is drawn once
// into a small canvas and stamped from there.
import { W, H } from './core.js';

const FPS = 30;
const FONT = '"Jua","Black Han Sans","HHKrSans","Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
const INK = '#2b2350', CREAM = '#fff7e8', CORAL = '#ff7b6b', PINK = '#ff9fb8', SUN = '#ffd15c', MINT = '#8fe0c8', LILAC = '#b7a4f2', GRASS = '#4fbf97', AMBER = '#f0a51e';
const PALS = [['#6fc3f0', '#b9e6ff', '#ffe7c4'], ['#57c7b5', '#a9ead3', '#fff1c7'], ['#ff9fb0', '#ffc9a8', '#ffe9b8'], ['#8a7fe6', '#c3b0f5', '#ffd0d8']];
const MATS = [CORAL, MINT, LILAC, SUN, PINK];
const TAPES = [[SUN, MINT], [PINK, LILAC], [MINT, CORAL], [LILAC, SUN], [CORAL, MINT]];
const RAINBOW = [CORAL, SUN, MINT, LILAC];
const WARM = [CORAL, AMBER, GRASS, LILAC];

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const easeOut = (t, p = 3) => 1 - Math.pow(1 - clamp(t), p);
const hash = (i, salt = 0) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
const rnd = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
// a paper piece landing: from nothing, a little too big, then it settles
const pop = (u) => (u <= 0 ? 0 : 1 - Math.exp(-9 * u) * Math.cos(13 * u));
const AL = (img, fx, fy) => { const a = img?.hhAlign || img?.hhSrc?.hhAlign; return a ? [a.x, a.y] : [fx, fy]; };

// ---------- the beat grid (same rules as looks_hj.js) ----------
function gridOf(beat, N) {
  if (beat?.beats?.length > 4) return Array.from(beat.beats);
  const g = []; for (let f = 0; f < N + 60; f += 20.45) g.push(f);
  return g;
}
const snap = (g, f) => { for (const b of g) if (b >= f) return Math.round(b); return Math.round(f); };
const beatIndex = (g, f) => { let lo = 0, hi = g.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (g[m] <= f) lo = m; else hi = m - 1; } return lo; };
const bf = (g, k) => (k < g.length ? g[Math.max(0, k)] : g[g.length - 1] + (k - g.length + 1) * (g[g.length - 1] - g[g.length - 2]));

// ---------- cut paper, drawn once ----------
const SP = new Map();
const fontOk = () => { try { return document.fonts.check('40px "Jua"') ? 1 : 0; } catch { return 1; } };
function sprite(key, w, h, paint) {
  let c = SP.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = Math.max(2, Math.ceil(w)); c.height = Math.max(2, Math.ceil(h));
    paint(c.getContext('2d'), c.width, c.height); SP.set(key, c);
    if (SP.size > 320) SP.delete(SP.keys().next().value);   // words typed and deleted do not pile up
  }
  return c;
}
const sh = (x, blur = 24, oy = 12, a = 0.3) => { x.shadowColor = `rgba(50,26,84,${a})`; x.shadowBlur = blur; x.shadowOffsetX = 0; x.shadowOffsetY = oy; };
const noSh = (x) => { x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetY = 0; };
function rr(x, l, t, w, h, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); }
let grainPat = null;
function grain(ctx) {
  if (!grainPat) {
    const g = document.createElement('canvas'); g.width = g.height = 256; const x = g.getContext('2d'), im = x.createImageData(256, 256), r = rnd(7);
    for (let i = 0; i < im.data.length; i += 4) { const v = 200 + r() * 55; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    x.putImageData(im, 0, 0);
    x.strokeStyle = 'rgba(120,100,90,.25)'; x.lineWidth = 1;
    for (let i = 0; i < 40; i++) { const a = r() * 6.28, px = r() * 256, py = r() * 256, l = 8 + r() * 18; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
    grainPat = ctx.createPattern(g, 'repeat');
  }
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.2; ctx.fillStyle = grainPat; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}

const sunSp = () => sprite('sun', 560, 560, (x) => { sh(x, 30, 10, 0.22); x.fillStyle = '#ffe9a6'; x.beginPath(); x.arc(280, 280, 244, 0, 7); x.fill(); x.fillStyle = SUN; x.beginPath(); x.arc(280, 280, 200, 0, 7); x.fill(); });
const cloudSp = () => sprite('cloud', 420, 250, (x) => {
  sh(x, 20, 10, 0.2); x.fillStyle = CREAM; x.beginPath();
  [[0, 0, 70], [70, -34, 86], [160, -8, 74], [230, 14, 56], [110, 30, 80], [30, 34, 60]].forEach(([dx, dy, r]) => { x.moveTo(90 + dx + r, 130 + dy); x.arc(90 + dx, 130 + dy, r, 0, 7); });
  x.fill();
});
function hillPath(x, w, base, amp, seed, bottom) {
  const r = rnd(seed), p1 = r() * 6, p2 = r() * 6, f1 = 1.2 + r() * 1.2, f2 = 2.4 + r() * 2;
  x.beginPath(); x.moveTo(0, bottom);
  for (let px = 0; px <= w; px += 20) { const t = px / 1080; x.lineTo(px, base - amp * (Math.sin(t * f1 * 3.14 + p1) * 0.7 + Math.sin(t * f2 * 3.14 + p2) * 0.3)); }
  x.lineTo(w, bottom); x.closePath();
}
function tree(x, px, py, s) {
  sh(x, 14, 8, 0.25);
  x.fillStyle = '#b98a5e'; x.fillRect(px - 9 * s, py - 20 * s, 18 * s, 40 * s);
  [[0, 150, GRASS], [-52, 126, '#63cfa6'], [-104, 100, GRASS]].forEach(([dy, w, col]) => { x.fillStyle = col; x.beginPath(); x.moveTo(px, py + (dy - 96) * s); x.lineTo(px + w / 2 * s, py + (dy - 14) * s); x.lineTo(px - w / 2 * s, py + (dy - 14) * s); x.closePath(); x.fill(); });
  noSh(x); x.fillStyle = CREAM; x.beginPath(); x.moveTo(px, py - 200 * s); x.lineTo(px + 22 * s, py - 162 * s); x.lineTo(px - 22 * s, py - 162 * s); x.closePath(); x.fill();
}
// the ground is two strips, the far hills with the trees and the near snow, so they can slide against each other
const GW = 1240;
const farSp = () => sprite('far', GW, 560, (x) => {
  sh(x, 26, -10, 0.16); x.fillStyle = '#dfe9ff'; hillPath(x, GW, 220, 70, 11, 560); x.fill();
  sh(x, 26, -10, 0.2); x.fillStyle = '#f1f6ff'; hillPath(x, GW, 310, 60, 23, 560); x.fill(); noSh(x);
  tree(x, 200, 300, 1.05); tree(x, 1060, 262, 0.9); tree(x, 325, 360, 0.7); tree(x, 900, 350, 0.6);
});
const nearSp = () => sprite('near', GW, 330, (x) => { sh(x, 26, -10, 0.22); x.fillStyle = '#ffffff'; hillPath(x, GW, 110, 46, 37, 330); x.fill(); });
const buntingSp = () => sprite('bunting', 1160, 240, (x) => {
  const cols = [CORAL, SUN, MINT, LILAC, PINK], n = 11, w = 1160, sag = 60, y0 = 30;
  x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath();
  for (let i = 0; i <= 40; i++) { const t = i / 40, px = t * w, py = y0 + sag * 4 * t * (1 - t); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, px = t * w, py = y0 + sag * 4 * t * (1 - t), sl = sag * 4 * (1 - 2 * t) / w; x.save(); x.translate(px, py); x.rotate(Math.atan(sl)); sh(x, 12, 8, 0.25); x.fillStyle = cols[i % cols.length]; x.beginPath(); x.moveTo(-44, 0); x.lineTo(44, 0); x.lineTo(0, 92); x.closePath(); x.fill(); x.restore(); }
});
const starSp = (col) => sprite('star' + col, 200, 200, (x) => {
  x.translate(100, 96); sh(x, 10, 6, 0.28); const pts = [];
  for (let k = 0; k < 10; k++) { const r = 160 * (k % 2 ? 0.22 : 0.5), a = -Math.PI / 2 + k * Math.PI / 5; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
  x.fillStyle = col; x.beginPath(); pts.forEach(([px, py], k) => (k ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.fill(); noSh(x);
  x.fillStyle = 'rgba(0,0,0,.12)'; for (let k = 0; k < 10; k += 2) { const a = pts[k], b = pts[(k + 1) % 10]; x.beginPath(); x.moveTo(0, 0); x.lineTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.closePath(); x.fill(); }
});
const heartSp = (col) => sprite('heart' + col, 200, 200, (x) => { x.translate(100, 104); x.scale(1.5, 1.5); sh(x, 10, 6, 0.28); x.fillStyle = col; x.beginPath(); x.moveTo(0, 30); x.bezierCurveTo(-60, -10, -30, -60, 0, -26); x.bezierCurveTo(30, -60, 60, -10, 0, 30); x.fill(); });
const flakeSp = () => sprite('flake', 200, 200, (x) => { x.translate(100, 98); sh(x, 8, 5, 0.25); x.strokeStyle = '#fff'; x.lineWidth = 14; x.lineCap = 'round'; for (let i = 0; i < 6; i++) { x.rotate(Math.PI / 3); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -80); x.moveTo(0, -48); x.lineTo(21, -67); x.moveTo(0, -48); x.lineTo(-21, -67); x.stroke(); } });
const tapeSp = (col) => sprite('tape' + col, 210, 70, (x) => { x.translate(105, 35); sh(x, 8, 4, 0.18); x.globalAlpha = 0.88; x.fillStyle = col; x.fillRect(-95, -26, 190, 52); noSh(x); x.globalAlpha = 0.35; x.fillStyle = '#fff'; for (let i = -85; i < 95; i += 26) x.fillRect(i, -26, 10, 52); });
function scallop(x, cx, cy, r, n, col) { sh(x, 22, 12, 0.3); x.fillStyle = col; x.beginPath(); for (let i = 0; i < n; i++) { const a = i * 2 * Math.PI / n; x.moveTo(cx + Math.cos(a) * r + r * 0.2, cy + Math.sin(a) * r); x.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.2, 0, 7); } x.moveTo(cx + r, cy); x.arc(cx, cy, r, 0, 7); x.fill(); noSh(x); }
const badgeSp = (text, col, tcol) => sprite(`badge|${text}|${col}|${tcol}|${fontOk()}`, 420, 420, (x) => {
  const r = 150; x.translate(210, 204); scallop(x, 0, 0, r, 18, col); x.fillStyle = CREAM; x.beginPath(); x.arc(0, 0, r * 0.82, 0, 7); x.fill();
  x.strokeStyle = col; x.lineWidth = 6; x.setLineDash([14, 12]); x.beginPath(); x.arc(0, 0, r * 0.72, 0, 7); x.stroke(); x.setLineDash([]);
  let size = r * 0.56; x.font = `${size}px ${FONT}`; const tw = x.measureText(text).width; if (tw > r * 1.26) { size *= r * 1.26 / tw; x.font = `${size}px ${FONT}`; }
  x.textAlign = 'center'; x.fillStyle = tcol; x.fillText(text, 0, size * 0.34);
});
const ribbonSp = (text, w, h, col, tcol) => sprite(`rib|${text}|${w}|${h}|${col}|${tcol}|${fontOk()}`, w + 60, h + 70, (x) => {
  x.translate((w + 60) / 2, h / 2 + 24); sh(x, 18, 10, 0.3); x.fillStyle = col; x.beginPath();
  x.moveTo(-w / 2, -h / 2); x.lineTo(w / 2, -h / 2); x.lineTo(w / 2 - h * 0.34, 0); x.lineTo(w / 2, h / 2); x.lineTo(-w / 2, h / 2); x.lineTo(-w / 2 + h * 0.34, 0); x.closePath(); x.fill(); noSh(x);
  let fs = h * 0.58; x.font = `${fs}px ${FONT}`; const tw = x.measureText(text).width, room = w - h * 1.1; if (tw > room) { fs *= room / tw; x.font = `${fs}px ${FONT}`; }
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = tcol; x.fillText(text, 0, 4);
});
const bubbleSp = () => sprite('bubble', 1000, 760, (x) => {
  sh(x, 26, 14, 0.3); x.fillStyle = CREAM; rr(x, 40, 30, 920, 560, 70); x.fill();
  x.beginPath(); x.moveTo(550, 584); x.lineTo(660, 584); x.lineTo(630, 686); x.closePath(); x.fill();
});
const medalSp = () => sprite('medal', 1000, 1560, (x) => {
  x.translate(500, 480); sh(x, 20, 12, 0.28);
  x.fillStyle = CORAL; x.beginPath(); x.moveTo(-170, 290); x.lineTo(-250, 900); x.lineTo(-130, 820); x.lineTo(-40, 920); x.lineTo(0, 340); x.closePath(); x.fill();
  x.fillStyle = LILAC; x.beginPath(); x.moveTo(170, 290); x.lineTo(250, 900); x.lineTo(130, 820); x.lineTo(40, 920); x.lineTo(0, 340); x.closePath(); x.fill(); noSh(x);
  scallop(x, 0, 0, 400, 22, CORAL); scallop(x, 0, 0, 340, 22, SUN); x.fillStyle = CREAM; x.beginPath(); x.arc(0, 0, 300, 0, 7); x.fill();
});

// Paper letters: each one cut out on its own (thick cream edge, a shadow), a little crooked, landing one after another.
const scratch = document.createElement('canvas').getContext('2d');
const LT = new Map();
function letters(text, size, fills, o = {}) {
  const maxW = o.maxW ?? 960;
  scratch.font = `${size}px ${FONT}`;
  const full = scratch.measureText(text).width;
  if (full > maxW) size = Math.floor(size * maxW / full);
  const key = `${text}|${size}|${fills.join()}|${o.edge || ''}|${o.seed || 0}|${fontOk()}`;
  let L = LT.get(key); if (L) return L;
  scratch.font = `${size}px ${FONT}`;
  const chars = [...text], ws = chars.map((ch) => scratch.measureText(ch).width), total = ws.reduce((a, b) => a + b, 0), r = rnd((o.seed ?? 1) * 97 + chars.length);
  const pad = Math.ceil(size * 0.34); let x0 = -total / 2, n = 0; const items = [];
  chars.forEach((ch, i) => {
    const rot = (r() - 0.5) * (o.wob ?? 0.14), dy = (r() - 0.5) * size * (o.jump ?? 0.08);
    if (ch !== ' ') {
      const c = document.createElement('canvas'); c.width = Math.ceil(ws[i] + pad * 2); c.height = Math.ceil(size * 1.5 + pad * 2); const x = c.getContext('2d');
      x.font = `${size}px ${FONT}`; x.textAlign = 'center'; x.lineJoin = 'round'; const bx = c.width / 2, by = pad + size * 1.08;
      sh(x, 18, 10, 0.34); x.strokeStyle = o.edge ?? CREAM; x.lineWidth = size * (o.sw ?? 0.19); x.strokeText(ch, bx, by); noSh(x);
      x.fillStyle = fills[n % fills.length]; x.fillText(ch, bx, by);
      items.push({ c, x: x0 + ws[i] / 2, dy, rot, by, n }); n++;
    }
    x0 += ws[i];
  });
  L = { items, size, width: total }; LT.set(key, L);
  if (LT.size > 80) LT.delete(LT.keys().next().value);
  return L;
}
function drawLetters(ctx, L, cx, y, f, f0, step = 3, out = 1) {
  for (const it of L.items) {
    const u = (f - f0 - it.n * step) / FPS; if (u <= 0) continue;
    const s = pop(u), bob = Math.sin(f / FPS * 2.6 + it.n * 0.9) * L.size * 0.018;
    ctx.save(); ctx.globalAlpha = out; ctx.translate(cx + it.x, y + it.dy + bob); ctx.rotate(it.rot); ctx.scale(s, s);
    ctx.drawImage(it.c, -it.c.width / 2, -it.by); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
// a sprite stamped with its centre at (x, y)
function stamp(ctx, c, x, y, k = 1, rot = 0, a = 1) {
  if (k <= 0 || a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.drawImage(c, -c.width * k / 2, -c.height * k / 2, c.width * k, c.height * k); ctx.restore(); ctx.globalAlpha = 1;
}

// ---------- the world behind everything ----------
function world(ctx, f, k, sun, cloudsAt = 'all') {
  const pal = PALS[k % PALS.length], t = f / FPS;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, pal[0]); g.addColorStop(0.55, pal[1]); g.addColorStop(1, pal[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // rays of light, turning slowly
  const sx = sun?.x ?? 540, sy = sun?.y ?? 520;
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(0.1 + t * 0.06); ctx.fillStyle = 'rgba(255,255,255,.16)';
  for (let i = 0; i < 14; i++) { const a = i * 2 * Math.PI / 14, w = Math.PI / 14 * 0.52; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - w) * 2600, Math.sin(a - w) * 2600); ctx.lineTo(Math.cos(a + w) * 2600, Math.sin(a + w) * 2600); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  if (sun) stamp(ctx, sunSp(), sx, sy, (sun.r ?? 150) / 200);
  clouds(ctx, t, cloudsAt);
  ground(ctx, t);
}
function clouds(ctx, t, at = 'all') {
  const c = cloudSp(), drift = (i) => Math.sin(t * 0.35 + i * 1.7) * 26;
  if (at !== 'low') { stamp(ctx, c, 190 + drift(0), 250, 1.05); stamp(ctx, c, 900 + drift(1), 185, 0.9); }
  stamp(ctx, c, 60 + drift(2), 700, 0.8); stamp(ctx, c, 980 + drift(3), 620, 0.7);
}
function ground(ctx, t, far = true) {
  if (far) ctx.drawImage(farSp(), -80 + Math.sin(t * 0.3) * 14, 1350);
  ctx.drawImage(nearSp(), -80 - Math.sin(t * 0.3) * 22, 1640);
}
function bunting(ctx, t, y = 66) { ctx.save(); ctx.translate(540, y - 30); ctx.rotate(Math.sin(t * 1.4) * 0.008); ctx.drawImage(buntingSp(), -580, Math.sin(t * 1.8) * 5); ctx.restore(); }
const CONF = [CORAL, SUN, MINT, LILAC, PINK, CREAM];
function confetti(ctx, f, f0, n, seed) {
  const t = Math.max(0, (f - f0) / FPS);
  for (let i = 0; i < n; i++) {
    const sp = 260 + hash(i, seed) * 420, x = hash(i, seed + 1) * W + Math.sin(t * 2 + i) * 40, y = ((hash(i, seed + 2) * (H + 300) + sp * t) % (H + 300)) - 150;
    const s = 14 + hash(i, seed + 3) * 26, k = i % 3;
    ctx.save(); ctx.translate(x, y); ctx.rotate(hash(i, seed + 4) * 6.28 + t * (2 + hash(i, seed + 5) * 4)); ctx.fillStyle = CONF[i % CONF.length];
    if (k === 0) ctx.fillRect(-s / 2, -s / 5, s, s / 2.5); else if (k === 1) { ctx.beginPath(); ctx.arc(0, 0, s / 3, 0, 7); ctx.fill(); } else { ctx.beginPath(); ctx.moveTo(0, -s / 2); ctx.lineTo(s / 2, s / 2); ctx.lineTo(-s / 2, s / 2); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
}
// little things that land around the photo: [kind, x, y, size, colour, tilt]
function deco(ctx, f, f0, list, gap = 3) {
  list.forEach(([kind, x, y, size, col, rot], i) => {
    const u = (f - f0 - i * gap) / FPS; if (u <= 0) return;
    const c = kind === 'heart' ? heartSp(col) : kind === 'flake' ? flakeSp() : starSp(col);
    stamp(ctx, c, x, y + Math.sin(f / FPS * 2 + i) * 6, pop(u) * size / 160, rot + Math.sin(f / FPS * 1.6 + i * 2) * 0.08);
  });
}

// ---------- a photo stuck on coloured paper ----------
function drawPhoto(ctx, img, l, t, w, h, z, fx = 0.5, fy = 0.4) {
  const [ax, ay] = AL(img, fx, fy), s = Math.max(w / img.width, h / img.height) * z, dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, l + (w - dw) * ax, t + (h - dh) * ay, dw, dh);
}
// The two sheets of paper under a photo, with their shadows, kept at 0.6 size (flat colour scales up cleanly) -
// drawing those shadows every frame was the heaviest thing in the look. Only a handful are kept at a time.
const CARDS = new Map(), CS = 0.6;
function cardSp(w, h, mat, backRot) {
  const key = `${w}|${h}|${mat}|${backRot}`; let c = CARDS.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = Math.ceil((w + 220) * CS); c.height = Math.ceil((h + 220) * CS); const x = c.getContext('2d');
  x.scale(CS, CS); x.translate((w + 220) / 2, (h + 220) / 2);
  x.save(); x.rotate(backRot); sh(x, 30 * CS, 16 * CS, 0.3); x.fillStyle = mat; rr(x, -w / 2 - 26, -h / 2 - 26, w + 52, h + 52, 44); x.fill(); x.restore();
  sh(x, 26 * CS, 14 * CS, 0.3); x.fillStyle = CREAM; rr(x, -w / 2, -h / 2, w, h, 36); x.fill();
  CARDS.set(key, c); if (CARDS.size > 14) CARDS.delete(CARDS.keys().next().value);
  return c;
}
const isWide = (img) => img.width > img.height * 1.15;
function card(ctx, img, cx, cy, w, h, rot, mat, tapes, z, k = 1, backRot = 0.05) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(k, k);
  ctx.drawImage(cardSp(w, h, mat, backRot), -(w + 220) / 2, -(h + 220) / 2, w + 220, h + 220);
  const b = 30;
  ctx.save(); rr(ctx, -w / 2 + b, -h / 2 + b, w - b * 2, h - b * 2, 20); ctx.clip(); drawPhoto(ctx, img, -w / 2 + b, -h / 2 + b, w - b * 2, h - b * 2, z); ctx.restore();
  stamp(ctx, tapeSp(tapes[0]), -w / 2 + 70, -h / 2 + 6, 1, -0.5); stamp(ctx, tapeSp(tapes[1]), w / 2 - 70, -h / 2 + 6, 1, 0.5);
  ctx.restore();
}
// lands a little crooked and too big, settles, then keeps swaying a touch - paper on a string, not a still
const landing = (f, f0) => { const u = (f - f0) / FPS; return { k: 0.8 + 0.2 * pop(u * 1.2), rot: 0.1 * Math.exp(-8 * Math.max(0, u)) * Math.cos(11 * u) + Math.sin(f / FPS * 1.7) * 0.009 }; };

// ---------- the timeline ----------
const pic = (d, i) => d.images[i % d.images.length];
function segAt(d, f) { for (const s of d.segs) if (f >= s.f0 && f < s.f1) return s; return d.segs[d.segs.length - 1]; }
const cutAt = (cuts, f) => { for (const c of cuts) if (f >= c.f0 && f < c.f1) return c; return cuts[cuts.length - 1]; };

function drawPaperDiary(ctx, f, N, d) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
  const s = segAt(d, f), t = f / FPS;
  if (s.type === 'intro') drawIntro(ctx, f, s, d);
  else if (s.type === 'cards') drawCards(ctx, f, s, d);
  else if (s.type === 'burst') drawBurst(ctx, f, s, d);
  else if (s.type === 'cheer') drawCheer(ctx, f, s, d);
  else drawAward(ctx, f, s, d, N);
  // a blink of light where one part hands over to the next
  const since = f - s.f0;
  if (s.type !== 'intro' && since < 6) { ctx.globalAlpha = 0.7 * (1 - since / 6); ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  grain(ctx);
}
function drawIntro(ctx, f, s, d) {
  const t = f / FPS, img = pic(d, s.img), L = landing(f, 0);
  world(ctx, f, 0, { x: 540, y: 760, r: 210 }); bunting(ctx, t);
  // a sideways photo gets a sideways sheet - in the tall one a person shrank to a dot
  const wide = isWide(img);
  if (wide) card(ctx, img, 540, 940, 920, 700, -0.03 + L.rot, CORAL, TAPES[0], 1.03 + 0.05 * (f / s.f1), L.k);
  else card(ctx, img, 540, 980, 800, 1060, -0.035 + L.rot, CORAL, TAPES[0], 1.04 + 0.05 * (f / s.f1), L.k);
  const drop = pop((f - 4) / FPS);
  stamp(ctx, ribbonSp(d.tHero, 560, 104, INK, SUN), 540, (wide ? 400 : 300) - 80 * (1 - Math.min(1, drop)), drop > 0 ? 1 : 0, -0.03);
  drawLetters(ctx, letters(d.big, 300, RAINBOW, { seed: 5, wob: 0.2, jump: 0.1, sw: 0.17, maxW: 900 }), 540, wide ? 1500 : 1560, f, 12, 4);
  deco(ctx, f, 18, [['star', 170, 470, 120, SUN, -0.3], ['star', 930, 430, 90, PINK, 0.4], ['star', 960, 1330, 110, MINT, 0.2], ['heart', 140, 1330, 150, PINK, -0.2]]);
}
function drawCards(ctx, f, s, d) {
  const t = f / FPS, c = cutAt(s.cuts, f), L = landing(f, c.f0), z = 1.04 + 0.07 * (f - c.f0) / (c.f1 - c.f0);
  world(ctx, f, c.pal, c.lay === 0 ? null : { x: 540, y: 330, r: 130 }); bunting(ctx, t);
  if (c.lay === 2) {
    const L2 = landing(f, c.f0 + 4);
    card(ctx, pic(d, c.img), 400, 780, 600, 760, -0.06 + L.rot, c.mat, c.tapes, z, L.k);
    card(ctx, pic(d, c.img + 1), 660, 1330, 640, 600, 0.05 - L2.rot, MATS[(c.i + 2) % MATS.length], TAPES[(c.i + 2) % TAPES.length], z, L2.k, -0.04);
    stamp(ctx, badgeSp(c.word, MINT, INK), 180, 1390, pop((f - c.f0 - 8) / FPS) * 0.86, -0.14);
    deco(ctx, f, c.f0 + 6, [['star', 930, 980, 90, CREAM, 0.3], ['heart', 160, 1680, 110, PINK, 0.2], ['star', 900, 600, 100, SUN, -0.2]]);
  } else if (c.lay === 3) {
    // two sideways photos, one above the other - a sideways photo alone leaves half the screen empty
    const L2 = landing(f, c.f0 + 4), flip = c.i % 2 ? 1 : -1;
    card(ctx, pic(d, c.img), 530, 700, 900, 610, 0.025 * flip + L.rot, c.mat, c.tapes, z, L.k, 0.04 * flip);
    card(ctx, pic(d, c.img + 1), 550, 1310, 900, 610, -0.03 * flip - L2.rot, MATS[(c.i + 2) % MATS.length], TAPES[(c.i + 2) % TAPES.length], z, L2.k, -0.04 * flip);
    stamp(ctx, badgeSp(c.word, c.i % 2 ? SUN : CORAL, c.i % 2 ? INK : CORAL), flip > 0 ? 200 : 880, 1005, pop((f - c.f0 - 8) / FPS) * 0.9, 0.14 * flip);
    deco(ctx, f, c.f0 + 6, [['star', flip > 0 ? 940 : 140, 1010, 96, SUN, 0.3], ['heart', 150, 1640, 110, PINK, 0.2], ['flake', 940, 1650, 84, '#fff', 0.2]]);
  } else {
    const left = c.lay === 1 || (c.lay === 4 && c.i % 2 === 1), im = pic(d, c.img), wide = c.lay === 4;
    if (wide) card(ctx, im, 540, 900, 930, 720, (left ? 0.025 : -0.025) + L.rot, c.mat, c.tapes, z, L.k, left ? -0.04 : 0.04);
    else card(ctx, im, left ? 520 : 550, 910, 840, 1100, (left ? 0.03 : -0.03) + L.rot, c.mat, c.tapes, z, L.k, left ? -0.05 : 0.05);
    stamp(ctx, badgeSp(c.word, c.i % 2 ? SUN : CORAL, c.i % 2 ? INK : CORAL), left ? 850 : 230, wide ? 1390 : 1430, pop((f - c.f0 - 6) / FPS) * (wide ? 1.2 : 1), left ? -0.16 : 0.14);
    deco(ctx, f, c.f0 + 5, left
      ? [['flake', 950, 620, 110, '#fff', 0.3], ['star', 150, 560, 84, SUN, 0.5], ['star', 930, 1700, 96, LILAC, -0.2], ['flake', 110, 1250, 80, '#fff', 0.1]]
      : [['star', 930, 560, 96, MINT, -0.3], ['heart', 930, 1290, 130, PINK, 0.2], ['star', 140, 380, 80, CREAM, 0.3], ['flake', 150, 1700, 84, '#fff', 0.2]]);
  }
  if (d.tTop) stamp(ctx, ribbonSp(d.tTop, 640, 100, CORAL, CREAM), 370, 262, 1, -0.035);
}
function drawBurst(ctx, f, s, d) {
  const t = f / FPS, c = cutAt(s.cuts, f), img = pic(d, c.img), u = (f - c.f0) / (c.f1 - c.f0);
  const z = 1.16 - 0.1 * easeOut((f - c.f0) / 12, 4) + 0.03 * u;
  drawPhoto(ctx, img, 0, 0, W, H, z, 0.5, 0.45);
  bunting(ctx, t); ground(ctx, t);   // no clouds here: at the top of a full photo they sat on people's heads
  confetti(ctx, f, s.f0, 70, 77);
  if (f - s.f0 < s.wordFor) {
    const out = clamp((s.f0 + s.wordFor - f) / 6);
    drawLetters(ctx, letters(d.tBurst, 240, [SUN, CORAL, MINT, PINK], { seed: 3, wob: 0.22, jump: 0.12, sw: 0.2, maxW: 940 }), 540, 1500, f, s.f0 + 2, 3, out);
  }
  deco(ctx, f, c.f0 + 3, [['star', 150, 1290, 110, SUN, -0.3], ['star', 940, 1250, 90, CREAM, 0.3]]);
}
function drawCheer(ctx, f, s, d) {
  const t = f / FPS, q = cutAt(s.says, f), L = landing(f, q.f0);
  world(ctx, f, 3, { x: 150, y: 150, r: 90 }, 'low');   // no clouds up here: cream on cream, they read as lumps on the bubble
  stamp(ctx, bubbleSp(), 540, 572, 0.86 + 0.14 * pop((f - q.f0) / FPS * 1.3));
  const edge = '#ffe3c9'; let y = q.lines.length > 2 ? 400 : 470;
  q.lines.forEach((ln, i) => {
    const big = i === q.lines.length - 1, size = ln.name ? 150 : big ? 190 : 170;
    drawLetters(ctx, letters(ln.t, size, ln.name ? [CORAL] : big ? [LILAC, CORAL, GRASS, AMBER] : [INK], { seed: 2 + i * 2, edge, sw: 0.15, wob: big ? 0.2 : 0.12, maxW: 800 }), 540, y, f, q.f0 + 3 + i * 7, 2);
    y += ln.name ? 160 : 180;
  });
  const im = pic(d, q.img), wide = isWide(im);
  card(ctx, im, wide ? 560 : 600, wide ? 1300 : 1330, wide ? 800 : 640, wide ? 580 : 760, (wide ? 0.03 : 0.045) + L.rot, SUN, [MINT, PINK], 1.06 + 0.06 * (f - q.f0) / (q.f1 - q.f0), L.k);
  deco(ctx, f, q.f0 + 6, [['heart', 170, 1050, 170, PINK, -0.25], ['star', 150, 1500, 100, SUN, 0.2], ['star', 960, 960, 80, MINT, 0.4], ['flake', 960, 1700, 90, '#fff', 0.2]]);
}
function drawAward(ctx, f, s, d, N) {
  const u = f - s.f0, t = f / FPS, img = pic(d, s.img);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ffe9a8'); g.addColorStop(0.55, '#fff3d1'); g.addColorStop(1, '#ffe1c4'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(540, 800); ctx.rotate(0.1 + t * 0.08); ctx.fillStyle = 'rgba(255,255,255,.5)';
  for (let i = 0; i < 16; i++) { const a = i * 2 * Math.PI / 16, w = Math.PI / 16 * 0.52; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - w) * 2600, Math.sin(a - w) * 2600); ctx.lineTo(Math.cos(a + w) * 2600, Math.sin(a + w) * 2600); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  confetti(ctx, f, s.f0 - 40, 90, 31);
  const k = pop(u / FPS * 1.1);
  if (k > 0) {
    ctx.save(); ctx.translate(540, 800); ctx.scale(k, k);
    ctx.drawImage(medalSp(), -500, -480);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 262, 0, 7); ctx.clip(); drawPhoto(ctx, img, -262, -262, 524, 524, 1.05 + 0.05 * u / Math.max(1, N - s.f0), 0.5, 0.3); ctx.restore();
    ctx.strokeStyle = SUN; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(0, 0, 268, 0, 7); ctx.stroke();
    ctx.restore();
  }
  drawLetters(ctx, letters(d.tAward, 170, WARM, { seed: 12, wob: 0.18, sw: 0.2, maxW: 940 }), 540, 340, f, s.f0 + 6, 3);
  if (d.name) drawLetters(ctx, letters(d.name, 260, [INK], { seed: 5, sw: 0.18, maxW: 860 }), 540, 1480, f, s.f0 + 14, 4);
  const rk = pop((u - 20) / FPS);
  stamp(ctx, ribbonSp(d.tFoot, 780, 100, INK, SUN), 540, d.name ? 1640 : 1500, rk);
  ctx.globalAlpha = clamp((u - 24) / 10) * 0.55; ctx.font = `34px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = INK; ctx.fillText('MADE WITH HER HOURS', 540, 1790); ctx.globalAlpha = 1; ctx.textAlign = 'left';
  deco(ctx, f, s.f0 + 10, [['star', 130, 560, 110, SUN, -0.3], ['star', 950, 520, 90, PINK, 0.3], ['star', 120, 1250, 80, MINT, 0.2], ['star', 960, 1300, 100, LILAC, -0.2]]);
  // the light that brought the award in
  if (u < 12) { ctx.globalAlpha = 1 - u / 12; ctx.fillStyle = '#fffdf6'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

// 받침이 있으면 「아」, 없으면 「야」 (서아야 · 민준아)
const callOf = (name) => { const ch = name.charCodeAt(name.length - 1); if (ch < 0xAC00 || ch > 0xD7A3) return `${name}!`; return `${name}${(ch - 0xAC00) % 28 ? '아' : '야'},`; };
const WORDS = () => [T('와~!', 'Wow!'), T('슝~!', 'Whee!'), T('최고!', 'Yes!'), T('야호!', 'Yay!'), T('멋져!', 'Cool!'), T('짱!', 'Top!')];

function buildPaperDiary(base, beat) {
  const N = base.N ?? 960, g = gridOf(beat, N), sec = N / FPS, per = Math.max(8, bf(g, 5) - bf(g, 4));
  // The name and title boxes start out holding the song's own ("VIOLET", "Green Light on the Window") - on a child's diary
  // that reads as nonsense, so a name that is only the singer's counts as no name, a title that is only the song's as no
  // title, and the diary names itself after the child.
  const plain = (s) => `${s || ''}`.toUpperCase().replace(/[^0-9A-Z가-힣]/g, '');
  const nobody = ['', 'HERHOURS', base.useOurs ? plain(`${base.label || ''}`.split('·')[0]) : ''];   // our songs' label opens with the singer
  const name = nobody.includes(plain(base.brand)) ? '' : `${base.brand}`.trim();
  const typed = [base.title1, base.title2].map((s) => `${s || ''}`.trim()).filter(Boolean).join(' ');
  const songs = [base.useOurs ? plain(base.tag) : '', 'MYSONGONMYPHONE'];   // with an own song the tag is made from the title itself
  const title = typed && !songs.includes(plain(typed)) ? typed : '';
  try { document.fonts?.load?.('80px "Jua"', `${name} ${title} ${(base.cheer || []).join(' ')} 오늘의 주인공 참 잘했어요 넘어져도 괜찮아 다시 일어나면 돼 신난다 와 슝 최고 야호 멋져 짱 0123456789.`).catch(() => {}); } catch { /* the look still draws in the next font down */ }

  const end = snap(g, N - clamp(N * 0.14, 60, 110));
  const intro = snap(g, clamp(N * 0.13, 50, 84));
  const hit = (beat?.hits ?? []).find((h) => h > N * 0.33 && h < N * 0.48) ?? snap(g, N * 0.4);
  const burstEnd = Math.min(end - 60, snap(g, hit + clamp(N * 0.17, 70, 200)));
  const long = sec >= 24;
  const cheerEnd = long ? Math.min(end, snap(g, burstEnd + clamp(N * 0.2, 110, 210))) : end;

  const wideAt = (i) => { const im = base.images?.length ? base.images[i % base.images.length] : null; return !!im && isWide(im); };
  let img = 0; const words = WORDS(), segs = [];
  const heroImg = img++;
  segs.push({ type: 'intro', f0: 0, f1: intro, img: heroImg });
  // photos on paper: one about every 1.8 seconds, each on its own colour
  const every = Math.max(2, Math.round(54 / per));
  const cardCuts = (from, to, i0, collage) => {
    const cuts = []; let k = beatIndex(g, from), f0 = from, i = i0;
    while (f0 < to) {
      let f1 = Math.min(to, Math.round(bf(g, k + every))); if (to - f1 < 20) f1 = to;
      // 0·1 = one tall photo (leaning either way) · 2 = two overlapping · 3 = two sideways photos stacked · 4 = one sideways photo
      let lay = collage && i % 3 === 2 ? 2 : i % 2;
      if (wideAt(img)) lay = wideAt(img + 1) ? 3 : 4;
      cuts.push({ f0, f1, i, img, lay, pal: (i + 1) % PALS.length, mat: MATS[(i + 1) % MATS.length], tapes: TAPES[(i + 1) % TAPES.length], word: words[i % words.length] });
      img += lay === 2 || lay === 3 ? 2 : 1; k += every; i++; f0 = Math.max(f1, f0 + 1);
    }
    return cuts;
  };
  const a = cardCuts(intro, hit, 0, false);
  if (a.length) segs.push({ type: 'cards', f0: intro, f1: hit, cuts: a });
  // the hit: the photo takes the whole frame, the paper stays round its edges
  const fast = Math.max(2, Math.round(40 / per)), bc = []; { let k = beatIndex(g, hit), f0 = hit; while (f0 < burstEnd) { let f1 = Math.min(burstEnd, Math.round(bf(g, k + fast))); if (burstEnd - f1 < 16) f1 = burstEnd; bc.push({ f0, f1, img: img++ }); k += fast; f0 = Math.max(f1, f0 + 1); } }
  segs.push({ type: 'burst', f0: hit, f1: burstEnd, cuts: bc, wordFor: Math.min(burstEnd - hit, 48) });
  // the cheer, with the child's name on it
  const call = name ? [{ t: callOf(name), name: true }] : [];
  // the two cheers can be the user's own words (the 응원 boxes); a long one breaks into two lines near its middle
  const own = (s) => {
    s = `${s || ''}`.trim(); if (!s) return null;
    const ws = s.split(/\s+/); if (ws.length < 2 || [...s].length <= 7) return [{ t: s }];
    let cut = 1, best = 1e9; for (let i = 1; i < ws.length; i++) { const a = ws.slice(0, i).join(' ').length, gap = Math.abs(a - (s.length - a)); if (gap < best) { best = gap; cut = i; } }
    return [{ t: ws.slice(0, cut).join(' ') }, { t: ws.slice(cut).join(' ') }];
  };
  const lines = [own(base.cheer?.[0]) || [{ t: T('넘어져도', 'Fall down?') }, { t: T('괜찮아!', "That's okay!") }], own(base.cheer?.[1]) || [{ t: T('다시', 'Get up,') }, { t: T('일어나면 돼!', 'go again!') }]];
  if (long && cheerEnd - burstEnd > 150) lines.push([{ t: T('넌 최고야!', "You're the best!") }]);
  const span = (cheerEnd - burstEnd) / lines.length, says = lines.map((ls, i) => ({ f0: Math.round(burstEnd + span * i), f1: Math.round(burstEnd + span * (i + 1)), lines: i === 0 || ls.length === 1 ? [...call, ...ls] : ls, img: img++ }));
  segs.push({ type: 'cheer', f0: burstEnd, f1: cheerEnd, says });
  if (cheerEnd < end - 20) segs.push({ type: 'cards', f0: cheerEnd, f1: end, cuts: cardCuts(cheerEnd, end, a.length, true) });
  segs.push({ type: 'award', f0: end, f1: N + 2, img: heroImg });

  const now = new Date(), date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  return {
    ...base, g, segs, slotCount: img, name,
    big: name || T('야호!', 'Yay!'),
    tHero: T('오늘의 주인공', "Today's star"),
    tTop: name && title ? T(`${name}의 ${title}`, `${name} · ${title}`) : title || (name ? T(`${name}의 하루`, `${name}'s day`) : ''),
    tBurst: T('신난다!', 'So fun!'),
    tAward: T('참 잘했어요!', 'Well done!'),
    tFoot: title ? `${title} · ${date}` : date,
  };
}

// which pictures are on screen in a frame - the export decodes only those clips
function onScreen(f, N, d) {
  const s = segAt(d, f), out = new Set(), add = (i) => { const im = d.images[i % d.images.length]; if (im?.live) out.add(im); };
  if (s.type === 'intro' || s.type === 'award') add(s.img);
  else if (s.type === 'cards') { const c = cutAt(s.cuts, f); add(c.img); if (c.lay === 2 || c.lay === 3) add(c.img + 1); }
  else if (s.type === 'burst') add(cutAt(s.cuts, f).img);
  else add(cutAt(s.says, f).img);
  return out;
}

export const KIDS_LOOKS = [
  { id: 'paper-diary', cat: '현준샘', kfont: true, cheer: true, name: T('종이 일기', 'Paper Diary'), sub: T('색종이에 붙인 사진 · 스티커와 깃발 · 이름이 들어간 응원 · 끝은 상장', 'photos stuck on coloured paper · stickers and flags · a cheer with your name · an award at the end'),
    draw: drawPaperDiary, build: buildPaperDiary, clipsAt: onScreen, photo: { min: 8, shape: 'tall', slots: (d) => d.slotCount } },
];
