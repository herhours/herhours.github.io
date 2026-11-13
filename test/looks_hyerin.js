// Her Hours Shorts — 「for 혜린」 (11-13 영샘): three looks from the 2030 study (D:\_research\young_vibe_20261113) —
// what people in their 20s and 30s enjoy right now: hand-made on purpose, low-res on purpose, nostalgia, one line that says it.
//   · 디카 날짜 — a 2000s digicam: small sensor, blown highlights, colour fringes, orange date stamp, shutter cuts, playback index
//   · 한 줄 플리 — cream paper, the photos land as stickers and pile up, one big line typed in, a playlist player below
//   · 폴더폰 — a real 2005 flip phone (assets/hyerin/phone.jpg) with the photo on its 240x320 screen, karaoke lyrics on top
// Prototypes and the judged samples: design_room_20261022\digicam_20261113\ (digicam.py · oneline.py · foldphone3.py).
// Each has its own opening (11-13 영샘 3번); the shared ending (black + music fade) is core.js.
import { W, H } from './core.js';

const FPS = 30;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const out = (t, p = 3) => 1 - Math.pow(1 - clamp(t), p);
const hash = (i, salt = 0) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
const AL = (img) => { const a = img?.hhAlign || img?.hhSrc?.hhAlign; return a ? [a.x, a.y] : [0.5, img && img.height > img.width * 1.1 ? 0.3 : 0.5]; };
const KR = '"HHKrSans","Pretendard","Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
const PEN = `"Nanum Pen Script",${KR}`;
const MONO = 'ui-monospace,"SFMono-Regular",Menlo,Consolas,"Courier New",monospace';
const plain = (s) => `${s || ''}`.replace(/[^0-9A-Za-z가-힣]/g, '').toUpperCase();
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// beat grid (frames) — same rule as the other looks
function gridOf(beat, N) {
  if (beat?.beats?.length > 4) return Array.from(beat.beats);
  const g = []; for (let f = 0; f < N + 60; f += 20.45) g.push(f); return g;
}
// the user's own line, or the look's default when the title fields still hold our song's name
function ownLine(base, dflt) {
  const typed = [base.title1, base.title2].map((s) => `${s || ''}`.trim()).filter(Boolean);
  const isSong = base.useOurs && plain(typed.join(' ')) && plain(base.tag).includes(plain(typed.join(' ')));
  return !typed.length || isSong ? dflt : typed;
}
// cover-draw an image into (x,y,w,h) keeping its chosen point in view
function cover(g, img, x, y, w, h) {
  const iw = img.videoWidth || img.width, ih = img.videoHeight || img.height; if (!iw || !ih) return;
  const k = Math.max(w / iw, h / ih), sw = w / k, sh = h / k, [ax, ay] = AL(img);
  const sx = clamp(ax * iw - sw / 2, 0, iw - sw), sy = clamp(ay * ih - sh / 2, 0, ih - sh);
  g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
const pick = (d, i) => (d.images?.length ? d.images[i % d.images.length] : null);

// ======================= 디카 날짜 =======================
// "developing" a photo is done once per picture (WeakMap) - small sensor, exposure, colour fringe, grade, flash falloff
const DEV = new WeakMap();
function develop(img, flash) {
  if (!img) return null;
  const key = img.live ? null : img; if (key && DEV.has(key)) return DEV.get(key);
  const sm = mk(324, 576), g = sm.getContext('2d');
  g.filter = 'brightness(1.13) contrast(1.2) saturate(0.86)'; cover(g, img, 0, 0, 324, 576); g.filter = 'none';
  const big = mk(W, H), b = big.getContext('2d');
  // colour fringe: red channel 3px right, blue 3px left, green in place (channels split by multiply, added back)
  const chan = (col, dx) => { const c = mk(W, H), x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.drawImage(sm, dx, 0, W, H); x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, W, H); return c; };
  b.fillStyle = '#000'; b.fillRect(0, 0, W, H); b.globalCompositeOperation = 'lighter';
  b.drawImage(chan('#ff0000', 3), 0, 0); b.drawImage(chan('#00ff00', 0), 0, 0); b.drawImage(chan('#0000ff', -3), 0, 0);
  b.globalCompositeOperation = 'screen'; b.fillStyle = 'rgb(16,20,24)'; b.fillRect(0, 0, W, H);          // lifted blacks, a little teal
  b.globalCompositeOperation = 'multiply'; b.fillStyle = 'rgb(244,250,255)'; b.fillRect(0, 0, W, H);     // cool white balance
  if (flash) {   // built-in flash: bright middle, edges falling off fast
    const rg = b.createRadialGradient(W / 2, H * 0.44, 80, W / 2, H * 0.44, H * 0.62);
    rg.addColorStop(0, 'rgb(255,255,255)'); rg.addColorStop(0.55, 'rgb(205,205,210)'); rg.addColorStop(1, 'rgb(70,70,80)');
    b.fillStyle = rg; b.fillRect(0, 0, W, H);
  }
  b.globalCompositeOperation = 'source-over';
  if (key) DEV.set(key, big);
  return big;
}
let NOISE = null;
function noise() {   // four small grain frames, scaled up blocky
  if (NOISE) return NOISE;
  NOISE = [0, 1, 2, 3].map((s) => {
    const c = mk(270, 480), g = c.getContext('2d'), im = g.createImageData(270, 480);
    for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (hash(i, s) - 0.5) * 120; im.data[i] = v + (hash(i, s + 9) - 0.5) * 40; im.data[i + 1] = v; im.data[i + 2] = v + (hash(i, s + 5) - 0.5) * 40; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0); return c;
  });
  return NOISE;
}
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
function stamp(g, text, x, y, h) {   // orange 7-segment date stamp, right-aligned at x
  const w0 = h * 0.56, t = Math.max(4, h / 9), gap = h * 0.22, hh = h / 2;
  let wTot = 0; for (const c of text) wTot += c === "'" || c === ' ' ? t * 2 : w0 + gap;
  let cx = x - wTot;
  g.save(); g.strokeStyle = '#ff8a2a'; g.lineCap = 'round'; g.lineWidth = t; g.shadowColor = 'rgba(255,120,30,0.9)'; g.shadowBlur = 16;
  for (const c of text) {
    if (c === "'") { g.beginPath(); g.moveTo(cx + 2, y); g.lineTo(cx, y + h / 4); g.stroke(); cx += t * 2; continue; }
    if (c === ' ') { cx += t * 2; continue; }
    const P = { a: [cx + t, y, cx + w0 - t, y], b: [cx + w0, y + t, cx + w0, y + hh - t], c: [cx + w0, y + hh + t, cx + w0, y + h - t], d: [cx + t, y + h, cx + w0 - t, y + h], e: [cx, y + hh + t, cx, y + h - t], f: [cx, y + t, cx, y + hh - t], g: [cx + t, y + hh, cx + w0 - t, y + hh] };
    g.beginPath(); for (const s of SEG[c] || '') { const p = P[s]; g.moveTo(p[0], p[1]); g.lineTo(p[2], p[3]); } g.stroke();
    cx += w0 + gap;
  }
  g.restore();
}
function uiText(g, s, x, y, px, a = 0.92, align = 'left') {
  g.save(); g.globalAlpha = a; g.font = `700 ${px}px ${MONO}`; g.textAlign = align; g.textBaseline = 'top';
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(s, x + 2, y + 3); g.fillStyle = '#fff'; g.fillText(s, x, y); g.restore();
}
function buildDigicam(base, beat) {
  const N = base.N ?? 900, g = gridOf(beat, N), per = Math.max(8, (g[5] ?? 100) - (g[4] ?? 80));
  const idxLen = Math.min(60, Math.round(N * 0.12)), endAt = N - idxLen;
  const cuts = [0, ...g.filter((b, i) => i % 2 === 0 && b > 42 && b < endAt - 12).map(Math.round)];
  const now = new Date(), date = `'${String(now.getFullYear()).slice(2)} ${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}`;
  const line = ownLine(base, ['오늘의 기록']).join(' ');
  try { document.fonts?.load?.('80px "Nanum Pen Script"', line).catch(() => {}); } catch {}
  return { ...base, N, per, cuts, endAt, date, line, count: base.images?.length || 6 };
}
function drawDigicam(ctx, f, N, d) {
  ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const t = f / FPS, nz = noise();
  if (f < d.endAt) {
    let si = 0; for (let i = 0; i < d.cuts.length; i++) if (d.cuts[i] <= f) si = i;
    const u = (f - d.cuts[si]) / FPS, img = pick(d, si), dev = develop(img, si % 3 === 2);
    // digital zoom: every third shot, in hard steps (1.0 → 1.3 → 1.6), not smoothly
    const z = si % 3 === 2 && u > 0.45 ? 1 + 0.3 * Math.min(2, 1 + Math.floor((u - 0.45) / 0.25)) : 1;
    const dx = 7 * Math.sin(t * 2.1 + si) + 3 * Math.sin(t * 5.3 + si * 2), dy = 6 * Math.sin(t * 1.7 + si * 2) + 3 * Math.sin(t * 4.1 + si);
    if (dev) { ctx.save(); ctx.translate(W / 2 + dx, H / 2 + dy); ctx.rotate((0.35 * Math.PI / 180) * Math.sin(t * 1.3 + si)); ctx.scale(z, z); ctx.drawImage(dev, -W / 2, -H / 2); ctx.restore(); }
    ctx.save(); ctx.globalAlpha = 0.22; ctx.globalCompositeOperation = 'overlay'; ctx.imageSmoothingEnabled = false; ctx.drawImage(nz[f % 4], 0, 0, W, H); ctx.restore();
    if (si > 0 && u < 2 / FPS) { ctx.fillStyle = 'rgba(0,0,0,0.95)'; ctx.fillRect(0, 0, W, H); }
    else if (si > 0 && u < 0.22) { ctx.save(); ctx.globalAlpha = Math.pow(1 - (u - 2 / FPS) / 0.155, 2) * 0.6; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    // camera screen
    uiText(ctx, `▶ 100-${String(23 + si).padStart(4, '0')}`, 46, 66, 44);
    ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(W - 120, 74, 54, 26); ctx.fillStyle = '#fff'; ctx.fillRect(W - 66, 82, 6, 10); for (let k = 0; k < 3; k++) ctx.fillRect(W - 113 + k * 15, 80, 11, 14); ctx.restore();
    uiText(ctx, '8M  SQ', W - 300, 70, 36, 0.88);
    if (u < 0.55) {   // focus brackets close in, white → green
      const k = clamp(u / 0.25), s = 240 - 70 * k, cx = W / 2, cy = H * 0.46, L = s * 0.28;
      ctx.save(); ctx.strokeStyle = u > 0.25 ? '#78ff78' : '#fff'; ctx.lineWidth = 4;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const px = cx + sx * s, py = cy + sy * s * 0.75; ctx.beginPath(); ctx.moveTo(px - sx * L, py); ctx.lineTo(px, py); ctx.lineTo(px, py - sy * L); ctx.stroke(); }
      ctx.restore();
    }
    if (z > 1) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - 160, 150, 320, 12); ctx.fillRect(W / 2 - 160, 150, 320 * (z - 1) / 0.6, 12); ctx.restore(); uiText(ctx, `x${z.toFixed(1)}`, W / 2 + 176, 138, 30); }
    uiText(ctx, '1/60  F2.8', 46, H - 118, 32, 0.8);
    // opening (전용 오프닝): the line in pen, slammed in on frame 0, gone by 1.5s
    if (t < 1.5) {
      const k = out(t / (4 / FPS)), a = t < 1.2 ? 1 : 1 - (t - 1.2) / 0.3;
      ctx.save(); ctx.globalAlpha = clamp(a); ctx.translate(W / 2, H * 0.38); ctx.scale(1.12 - 0.12 * k, 1.12 - 0.12 * k);
      let px = 210; ctx.font = `${px}px ${PEN}`; const w = ctx.measureText(d.line).width; if (w > W * 0.86) { px *= (W * 0.86) / w; ctx.font = `${px}px ${PEN}`; }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(d.line, 5, 7); ctx.fillStyle = '#fff'; ctx.fillText(d.line, 0, 0);
      ctx.restore();
      uiText(ctx, `PHOTO 001 — ${String(d.cuts.length).padStart(3, '0')}`, W / 2, H * 0.38 + 120, 40, 0.9 * clamp(a), 'center');
    }
  } else {   // playback index, nine at a time, a yellow cursor walking through
    const u = (f - d.endAt) / FPS, cw = 320, ch = 426, sel = Math.min(8, Math.floor(u / 0.16));
    ctx.fillStyle = '#0e0e10'; ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 9; k++) {
      const r = Math.floor(k / 3), c = k % 3, x = 36 + c * (cw + 24), y = 330 + r * (ch + 30), dev = develop(pick(d, k), false);
      if (dev) { ctx.save(); ctx.globalAlpha = k === sel ? 1 : 0.55; ctx.drawImage(dev, x, y, cw, ch); ctx.restore(); }
      if (k === sel) { ctx.save(); ctx.strokeStyle = '#ffd23c'; ctx.lineWidth = 6; ctx.strokeRect(x - 6, y - 6, cw + 12, ch + 12); ctx.restore(); }
    }
    uiText(ctx, 'PLAY  ▦ INDEX', 46, 120, 36); uiText(ctx, `${String(sel + 1).padStart(2, '0')}/${String(Math.min(9, d.count)).padStart(2, '0')}`, W - 46, 122, 34, 0.95, 'right');
    if (u < 0.12) { ctx.save(); ctx.globalAlpha = (1 - u / 0.12) * 0.5; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  }
  stamp(ctx, d.date, W - 40, H - 170, 82);
  ctx.restore();
}

// ======================= 한 줄 플리 =======================
let PAPER = null;
function paper() {
  if (PAPER) return PAPER;
  PAPER = mk(W, H); const g = PAPER.getContext('2d'); g.fillStyle = '#f4f0e8'; g.fillRect(0, 0, W, H);
  const n = mk(270, 480), x = n.getContext('2d'), im = x.createImageData(270, 480);
  for (let i = 0; i < im.data.length; i += 4) { const v = (hash(i, 3) - 0.5) * 18; im.data[i] = 128 + v; im.data[i + 1] = 128 + v; im.data[i + 2] = 128 + v; im.data[i + 3] = 255; }
  x.putImageData(im, 0, 0); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.35; g.drawImage(n, 0, 0, W, H);
  return PAPER;
}
const STK = new WeakMap();
function sticker(img) {   // photo with a white border and round corners, made once
  if (!img) return null;
  if (!img.live && STK.has(img)) return STK.get(img);
  const sw = 620, sh = 800, b = 18, c = mk(sw + 2 * b, sh + 2 * b), g = c.getContext('2d');
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  rr(0, 0, c.width, c.height, 26); g.fillStyle = '#fcfbf8'; g.fill();
  g.save(); g.beginPath(); g.rect(b, b, sw, sh); g.clip(); cover(g, img, b, b, sw, sh); g.restore();
  if (!img.live) STK.set(img, c);
  return c;
}
function buildOneLine(base, beat) {
  const N = base.N ?? 900, g = gridOf(beat, N);
  const cuts = [21, ...g.filter((b, i) => i % 2 === 0 && b > 48 && b < N - 54).map(Math.round)];
  const plan = cuts.map((f0, k) => ({ f0, k, x: W / 2 + (hash(k, 1) - 0.5) * 140, y: 1040 + (hash(k, 2) - 0.6) * 90, a: (hash(k, 3) - 0.5) * 14 }));
  const lines = ownLine(base, ['오늘도 대충', '잘 살았다']).slice(0, 2);
  const song = `${base.tag || ''}`.replace(/^♪\s*/, '').trim() || `${base.title1} ${base.title2}`.trim();
  return { ...base, N, plan, lines, song: song.length > 28 ? song.slice(0, 27) + '…' : song, chars: lines.join('').length };
}
function drawOneLine(ctx, f, N, d) {
  const t = f / FPS, INK = '#181614';
  ctx.drawImage(paper(), 0, 0);
  ctx.save(); ctx.fillStyle = INK; ctx.font = `700 30px ${KR}`; ctx.textAlign = 'center'; ctx.fillText('● playlist', W / 2, 150); ctx.restore();
  // the line types itself in over 0.6s from frame 0 (전용 오프닝), then stays
  const n = t < 0.6 ? Math.floor((d.chars * t) / 0.6) + 1 : d.chars;
  ctx.save(); ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  let px = 128; ctx.font = `900 ${px}px ${KR}`; const widest = Math.max(...d.lines.map((l) => ctx.measureText(l).width)); if (widest > W * 0.88) { px *= (W * 0.88) / widest; ctx.font = `900 ${px}px ${KR}`; }
  let used = 0;
  d.lines.forEach((l, i) => {
    const k = Math.max(0, Math.min(l.length, n - used)); used += l.length;
    const full = ctx.measureText(l).width; ctx.textAlign = 'left'; ctx.fillText(l.slice(0, k), (W - full) / 2, 230 + i * px * 1.25);
  });
  ctx.restore();
  // stickers: the one landing now (from 1.18x, settles in 0.12s) and the two beneath it; all of them at the end
  const placed = d.plan.filter((p) => p.f0 <= f), ending = f > N - 45;
  placed.forEach((p, idx) => {
    if (!ending && idx < placed.length - 3) return;
    const st = sticker(pick(d, p.k)); if (!st) return;
    const u = (f - p.f0) / FPS, sc = 0.86 * (1 + 0.18 * Math.pow(Math.max(0, 1 - u / 0.12), 2)), bob = 4 * Math.sin(t * 1.6 + p.k);
    ctx.save(); ctx.translate(p.x, p.y + bob); ctx.rotate(((p.a + 0.4 * Math.sin(t * 1.1 + p.k)) * Math.PI) / 180); ctx.scale(sc, sc);
    ctx.shadowColor = 'rgba(40,30,20,0.28)'; ctx.shadowBlur = 34; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 16;
    ctx.drawImage(st, -st.width / 2, -st.height / 2); ctx.restore();
  });
  // the player
  const by = 1660, p = clamp(f / Math.max(1, N - 1)), mm = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  ctx.save(); ctx.fillStyle = INK; ctx.font = `500 34px ${KR}`; ctx.textAlign = 'left'; ctx.fillText(`♪  ${d.song}`, 100, by - 30);
  ctx.strokeStyle = '#c8c4bc'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(100, by + 10); ctx.lineTo(W - 100, by + 10); ctx.stroke();
  ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(100, by + 10); ctx.lineTo(100 + (W - 200) * p, by + 10); ctx.stroke();
  ctx.beginPath(); ctx.arc(100 + (W - 200) * p, by + 10, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6e6a64'; ctx.font = `500 32px ${KR}`; ctx.fillText(mm(t), 100, by + 64); ctx.textAlign = 'right'; ctx.fillText(mm(N / FPS), W - 100, by + 64);
  const cx = W / 2, cy = by + 150; ctx.fillStyle = INK;
  ctx.fillRect(cx - 22, cy - 26, 14, 52); ctx.fillRect(cx + 8, cy - 26, 14, 52);
  for (const s of [-1, 1]) { const x = cx + s * 170; ctx.beginPath(); ctx.moveTo(x - s * 18, cy - 22); ctx.lineTo(x - s * 18, cy + 22); ctx.lineTo(x + s * 14, cy); ctx.closePath(); ctx.fill(); ctx.fillRect(s > 0 ? x + 14 : x - 20, cy - 22, 6, 44); }
  ctx.restore();
}

// ======================= 폴더폰 =======================
let PHONE = null, PHONE_META = { screen: [224, 568, 627, 768], keys: [[538, 1638, 58], [539, 1787, 84], [278, 1818, 111], [799, 1819, 105], [658, 1895, 64], [420, 1895, 63]] };
const phoneReady = () => (PHONE ??= new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'assets/hyerin/phone.jpg'; }));
let phoneImg = null; phoneReady().then((im) => { phoneImg = im; });
const LCD = new WeakMap();
function lcdPhoto(img) {   // the photo at the phone's own 240x280, colours stepped like a 16-bit screen - once per picture
  if (!img) return null;
  if (!img.live && LCD.has(img)) return LCD.get(img);
  const c = mk(240, 280), g = c.getContext('2d'); cover(g, img, 0, 0, 240, 280);
  try { const im = g.getImageData(0, 0, 240, 280), p = im.data; for (let i = 0; i < p.length; i += 4) { p[i] = Math.min(255, (p[i] & 0xf8) + 5); p[i + 1] = Math.min(255, (p[i + 1] & 0xf8) + 6); p[i + 2] = Math.min(255, (p[i + 2] & 0xf8) * 1.07 + 6); } g.putImageData(im, 0, 0); } catch {}
  if (!img.live) LCD.set(img, c);
  return c;
}
const HEART = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
let SCR = null;
function buildFoldPhone(base, beat) {
  const N = base.N ?? 900, g = gridOf(beat, N);
  const cuts = [0, ...g.filter((b, i) => i % 6 === 0 && b > 45).map(Math.round)];
  const beats = g.filter((b) => b < N).map(Math.round);
  const hearts = beats.filter((_, i) => i % 4 === 2).map((b, k) => ({ f0: b, x: 20 + hash(k, 7) * 170, y: 40 + hash(k, 8) * 210 }));
  const own = ownLine(base, null);
  const lines = base.phrases?.length ? base.phrases.map((p) => ({ s: p.start, e: p.end, text: p.text, words: (p.words || []).map((w) => ({ t: w.t, w: w.w })) }))
    : [{ s: 0, e: N, text: (own || [base.title1, base.title2]).join(' ').trim(), words: [] }];
  const song = `${base.tag || ''}`.replace(/^♪\s*/, '').trim();
  return { ...base, N, cuts, beats, hearts, lines, song };
}
function drawFoldPhone(ctx, f, N, d) {
  const t = f / FPS, [sx, sy, sw, sh] = PHONE_META.screen;
  ctx.save();
  if (phoneImg) ctx.drawImage(phoneImg, 0, 0, W, H); else { ctx.fillStyle = '#26272d'; ctx.fillRect(0, 0, W, H); }
  // the phone's screen, drawn at 240x320 and enlarged without smoothing (the pixels show, like the real thing)
  SCR ??= mk(240, 320); const s = SCR.getContext('2d');
  let k = 0; for (let i = 0; i < d.cuts.length; i++) if (d.cuts[i] <= f) k = i;
  const u = (f - d.cuts[k]) / FPS, ph = lcdPhoto(pick(d, k));
  s.fillStyle = '#000'; s.fillRect(0, 0, 240, 320);
  if (ph) {
    const mos = u > 0.3 ? 1 : [12, 8, 5, 3, 2, 1][Math.min(5, Math.floor(u / 0.05))];
    s.imageSmoothingEnabled = mos === 1;
    if (mos > 1) { const tw = Math.max(1, Math.round(240 / mos)), th = Math.max(1, Math.round(280 / mos)); s.drawImage(ph, 0, 0, tw, th); s.drawImage(SCR, 0, 0, tw, th, 0, 20, 240, 280); }
    else s.drawImage(ph, 0, 20);
  }
  s.imageSmoothingEnabled = true;
  s.fillStyle = '#1c2a5c'; s.fillRect(0, 0, 240, 20); s.fillStyle = '#ced2de'; s.fillRect(0, 300, 240, 20);
  s.fillStyle = '#fff'; for (let b = 0; b < 4; b++) s.fillRect(5 + b * 4, 14 - b * 3, 3, 3 + b * 3);
  s.strokeStyle = '#fff'; s.lineWidth = 1; s.strokeRect(214.5, 5.5, 19, 9); for (let b = 0; b < 3; b++) s.fillRect(216 + b * 6, 7, 4, 6);
  s.font = '700 12px "Malgun Gothic","Apple SD Gothic Neo",sans-serif'; s.textBaseline = 'top'; s.textAlign = 'center';
  const now = new Date(); s.fillText(`${now.getHours() < 12 ? 'AM' : 'PM'} ${((now.getHours() + 11) % 12) + 1}:${String(now.getMinutes()).padStart(2, '0')}`, 120, 3);
  s.fillStyle = '#14141e'; s.textAlign = 'left'; s.fillText('메뉴', 6, 303); s.textAlign = 'right'; s.fillText('확인', 234, 303); s.textAlign = 'center'; s.fillText('◀ ▶', 120, 303);
  for (const h of d.hearts) {
    const v = (f - h.f0) / FPS; if (v < 0 || v >= 0.6) continue;
    const a = 1 - v / 0.6, px = v < 0.3 ? 3 : 4; s.fillStyle = `rgba(255,90,165,${a})`;
    HEART.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch === '1') s.fillRect(h.x + rx * px, h.y + ry * px, px, px); }));
  }
  ctx.imageSmoothingEnabled = false; ctx.drawImage(SCR, sx - 2, sy - 2, sw + 4, sh + 4); ctx.imageSmoothingEnabled = true;
  ctx.save(); ctx.globalAlpha = 0.1; ctx.filter = 'blur(6px)'; ctx.drawImage(SCR, sx, sy, sw, sh); ctx.restore();   // a little LCD glow
  // keypad light: the blue keys breathe on every beat and one key lights up as if pressed
  let lb = -1; for (const b of d.beats) if (b <= f) lb = b;
  const p = lb >= 0 && f - lb < 18 ? Math.exp(-(f - lb) / 5.5) : 0;
  if (p > 0.02) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const keys = PHONE_META.keys, kk = keys[Math.floor(hash(lb, 4) * keys.length)];
    for (const [x, y, r] of keys) {
      const big = [x, y, r] === kk || (x === kk[0] && y === kk[1]), rad = r * (big ? 1.3 : 0.9);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, rad); rg.addColorStop(0, `rgba(120,170,255,${(big ? 0.75 : 0.25) * p})`); rg.addColorStop(1, 'rgba(60,110,255,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    ctx.restore();
  }
  // karaoke line above the phone: white with a heavy outline, sung words painted pink
  const L = d.lines.find((l) => f >= l.s - 9 && f <= l.e);
  if (L && L.text) {
    ctx.save(); let px = 56; ctx.font = `800 ${px}px ${KR}`; let w = ctx.measureText(L.text).width; if (w > W * 0.9) { px *= (W * 0.9) / w; ctx.font = `800 ${px}px ${KR}`; w = ctx.measureText(L.text).width; }
    const x0 = (W - w) / 2, y0 = 190; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = 14; ctx.strokeStyle = '#0a0a14'; ctx.strokeText(L.text, x0, y0); ctx.fillStyle = '#fff'; ctx.fillText(L.text, x0, y0);
    const sung = L.words.filter((wd) => wd.t <= f);
    if (sung.length) { const part = L.words.slice(0, sung.length).map((wd) => wd.w).join(' '), pw = ctx.measureText(part).width; ctx.save(); ctx.beginPath(); ctx.rect(x0 - 10, y0 - px, pw + 10, px * 2); ctx.clip(); ctx.fillStyle = '#ff5caa'; ctx.fillText(L.text, x0, y0); ctx.restore(); }
    ctx.restore();
  }
  if (d.song) { ctx.save(); ctx.fillStyle = 'rgba(176,182,200,0.9)'; ctx.font = `600 30px ${KR}`; ctx.textAlign = 'center'; ctx.fillText(`♪ ${d.song}`, W / 2, 110); ctx.restore(); }
  if (t < 0.12) { ctx.fillStyle = `rgba(0,0,0,${0.6 * (1 - t / 0.12)})`; ctx.fillRect(0, 0, W, H); }   // 전용 오프닝: the flip opening - the first frames come up from dark
  ctx.restore();
}

const CAT = 'for 혜린';
export const HYERIN_LOOKS = [
  { id: 'digicam', cat: CAT, name: T('디카 날짜', 'Digicam Date'), sub: T('2000년대 디카 · 주황 날짜 도장 · 셔터 컷 · 끝은 재생 목록', 'a 2000s digicam · orange date stamp · shutter cuts · ends on the playback index'),
    draw: drawDigicam, build: buildDigicam, ready: () => document.fonts?.load?.('80px "Nanum Pen Script"', '오늘의 기록').catch(() => {}),
    photo: { min: 6, shape: 'tall', slots: (d) => d.cuts.length } },
  { id: 'oneline', cat: CAT, name: T('한 줄 플리', 'One-line Playlist'), sub: T('미색 종이 · 사진이 스티커처럼 쌓임 · 큰 한 줄 · 플리 재생 줄', 'cream paper · photos pile up like stickers · one big line · a playlist player'),
    draw: drawOneLine, build: buildOneLine, photo: { min: 5, shape: 'tall', slots: (d) => d.plan.length } },
  { id: 'foldphone', cat: CAT, name: T('폴더폰', 'Flip Phone'), sub: T('2005년 폴더폰 화면 · 노래방 자막 · 박자마다 키 불빛', 'a 2005 flip phone screen · karaoke lyrics · keys light up on the beat'),
    draw: drawFoldPhone, build: buildFoldPhone, ready: phoneReady, photo: { min: 5, shape: 'tall', slots: (d) => d.cuts.length } },
];
