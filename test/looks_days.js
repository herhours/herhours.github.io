// Her Hours Shorts — 「기념일」 (11-16 아이폰 테스터 ④ "생일·졸업 등 기념일 템플릿", 영샘 "몇 가지 정해 만들어 보고 결정").
// 판 D 견본: three looks for a day worth keeping. Shown only with ?days=1 until 영샘 picks.
//   · 생일 촛불 — a warm room lit by three candles · "Happy Birthday" in script · gold confetti on the beat · blown out at the end
//   · 졸업 앨범 — a yearbook page · CLASS OF <year> · each photo turns in like a page · caps thrown at the end
//   · D+day — the photos with a big day count ticking up on the beat to the number in the words (100 when none)
// Each has its own opening inside its draw; the shared ending (black + music fade) is core.js.
import { W, H } from './core.js';

const FPS = 30;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const out = (t, p = 3) => 1 - Math.pow(1 - clamp(t), p);
const hash = (i, salt = 0) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
const AL = (img) => { const a = img?.hhAlign || img?.hhSrc?.hhAlign; return a ? [a.x, a.y] : [0.5, img && img.height > img.width * 1.1 ? 0.3 : 0.5]; };
const KR = '"HHKrSans","Pretendard","Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
const KRS = '"HHKr","MaruBuri","Malgun Gothic","Apple SD Gothic Neo","Noto Serif KR",serif';
const GOLD = '#f1cd86';
const plain = (s) => `${s || ''}`.replace(/[^0-9A-Za-z가-힣]/g, '').toUpperCase();
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const pick = (d, i) => (d.images?.length ? d.images[i % d.images.length] : null);

function gridOf(beat, N) {
  if (beat?.beats?.length > 4) return Array.from(beat.beats);
  const g = []; for (let f = 0; f < N + 60; f += 20.45) g.push(f); return g;
}
// the user's own words, or the look's line when the title boxes still hold our song's name
function ownLine(base, dflt) {
  const typed = [base.title1, base.title2].map((s) => `${s || ''}`.trim()).filter(Boolean);
  const isSong = base.useOurs && plain(typed.join(' ')) && plain(base.tag).includes(plain(typed.join(' ')));
  return !typed.length || isSong ? dflt : typed.join(' ');
}
// a cut every `every` beats; the cut index is the photo index (ui.js holdImages fills slots with fewer photos)
function cutsOf(g, N, every) {
  const s = [0, ...g.filter((b, i) => i % every === 0 && b > 14 && b < N - 20).map(Math.round)];
  return s.map((f0, k) => ({ f0, f1: s[k + 1] ?? N, k }));
}
const cutAt = (cuts, f) => { let c = cuts[0]; for (const x of cuts) { if (x.f0 > f) break; c = x; } return c; };
// cover-draw with a slow push (z ≥ 1) around the photo's chosen point
function cover(g, img, x, y, w, h, z = 1) {
  const iw = img?.videoWidth || img?.width, ih = img?.videoHeight || img?.height; if (!iw || !ih) return;
  const k = Math.max(w / iw, h / ih) * z, sw = w / k, sh = h / k, [ax, ay] = AL(img);
  const sx = clamp(ax * iw - sw / 2, 0, iw - sw), sy = clamp(ay * ih - sh / 2, 0, ih - sh);
  g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
function fitFont(ctx, text, px, face, maxW) {
  ctx.font = face(px); const w = ctx.measureText(text).width;
  if (w > maxW) { px *= maxW / w; ctx.font = face(px); }
  return px;
}
// letter-spaced capitals drawn by hand (canvas letterSpacing is not everywhere yet)
function spaced(ctx, text, x, y, gap) {
  const chars = [...text], ws = chars.map((c) => ctx.measureText(c).width), total = ws.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
  let cx = x - total / 2; const al = ctx.textAlign; ctx.textAlign = 'left';
  chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += ws[i] + gap; }); ctx.textAlign = al;
}
const brandTop = (ctx, d, y, col) => {
  if (!d.brand) return;
  ctx.save(); ctx.fillStyle = col; ctx.font = '600 28px "HHSans",sans-serif'; ctx.textBaseline = 'middle'; spaced(ctx, d.brand, W / 2, y, 9); ctx.restore();
};

// ======================= 생일 촛불 =======================
const flick = (f, k) => 0.86 + 0.14 * Math.sin(f * 0.93 + k * 2.1) * Math.sin(f * 0.41 + k * 0.7);
function flame(ctx, x, y, s, f, k, a = 1) {
  if (a <= 0.01) return;
  const fl = flick(f, k);
  ctx.save(); ctx.globalAlpha = clamp(a);
  const gl = ctx.createRadialGradient(x, y - 14 * s, 0, x, y - 14 * s, 120 * s * fl);
  gl.addColorStop(0, 'rgba(255,205,130,0.6)'); gl.addColorStop(1, 'rgba(255,160,70,0)');
  ctx.fillStyle = gl; ctx.fillRect(x - 130 * s, y - 140 * s, 260 * s, 260 * s);
  ctx.translate(x, y); ctx.rotate(0.06 * Math.sin(f * 0.5 + k)); ctx.scale(s * (0.92 + 0.08 * fl), s * fl);
  ctx.beginPath(); ctx.moveTo(0, -40); ctx.bezierCurveTo(13, -19, 15, -4, 0, 5); ctx.bezierCurveTo(-15, -4, -13, -19, 0, -40);
  const fg = ctx.createLinearGradient(0, -40, 0, 5); fg.addColorStop(0, '#fff7de'); fg.addColorStop(0.55, '#ffc65a'); fg.addColorStop(1, '#ff7b2c');
  ctx.fillStyle = fg; ctx.fill(); ctx.restore();
}
function smoke(ctx, x, y, u) {   // a thin grey wisp rising after a flame goes out
  if (u <= 0 || u >= 1) return;
  ctx.save(); ctx.globalAlpha = 0.5 * (1 - u); ctx.strokeStyle = '#d8d2c8'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y);
  for (let i = 1; i <= 12; i++) { const t = i / 12; ctx.lineTo(x + Math.sin(t * 7 + u * 5) * 18 * t, y - t * 240 * (0.3 + u)); }
  ctx.stroke(); ctx.restore();
}
const CANDLE = 1340;   // 견본 1차에 1196 은 얼굴(입) 위에 앉았다 — 아래 띠로
function buildBday(base, beat) {
  const N = base.N ?? 900, g = gridOf(beat, N);
  return { ...base, N, cuts: cutsOf(g, N, 2), pops: g.filter((b, i) => i % 8 === 4 && b > 40 && b < N - 70).map(Math.round), name: ownLine(base, 'TO YOU') };
}
function drawBday(ctx, f, N, d) {
  const c = cutAt(d.cuts, f), u = (f - c.f0) / Math.max(1, c.f1 - c.f0), img = pick(d, c.k);
  ctx.fillStyle = '#120a05'; ctx.fillRect(0, 0, W, H);
  if (img) cover(ctx, img, 0, 0, W, H, 1.04 + 0.06 * u);
  // candlelight: warm the photo, darken the edges, a little more light low and centre where the candles are
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(255,222,184)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  const v = ctx.createRadialGradient(W / 2, H * 0.6, H * 0.12, W / 2, H * 0.55, H * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(14,6,0,0.78)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  const low = ctx.createLinearGradient(0, H * 0.52, 0, H); low.addColorStop(0, 'rgba(12,5,0,0)'); low.addColorStop(1, 'rgba(12,5,0,0.82)'); ctx.fillStyle = low; ctx.fillRect(0, H * 0.52, W, H * 0.48);
  if (f - c.f0 < 4 && c.k) { ctx.fillStyle = `rgba(255,214,160,${0.22 * (1 - (f - c.f0) / 4)})`; ctx.fillRect(0, 0, W, H); }   // a warm blink on each cut
  // gold confetti on every eighth beat, falling for two seconds
  ctx.save();
  for (const p of d.pops) {
    const t = (f - p) / FPS; if (t < 0 || t > 2.2) continue;
    for (let i = 0; i < 46; i++) {
      const x = hash(i, p) * W + Math.sin(t * 3 + i) * 30, y = -40 + (hash(i, p + 1) * 0.5 + 0.6) * t * 900 + hash(i, p + 2) * 200 * out(t / 0.3);
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * (2 + hash(i, 5) * 5) + i); ctx.scale(1, Math.cos(t * 6 + i));
      ctx.globalAlpha = clamp(2.2 - t); ctx.fillStyle = ['#f1cd86', '#fff1d6', '#f4b7a8', '#e9b456'][i % 4]; ctx.fillRect(-9, -5, 18, 10); ctx.restore();
    }
  }
  ctx.restore();
  // three candles; they light one by one in the opening and are blown out near the end
  const blow = N - 78, cx = [W / 2 - 74, W / 2, W / 2 + 74];
  cx.forEach((x, i) => {
    const top = CANDLE + (i === 1 ? -16 : 0);
    ctx.save(); ctx.fillStyle = '#f6eadb'; ctx.fillRect(x - 9, top, 18, 104);
    ctx.fillStyle = GOLD; for (let s = 0; s < 4; s++) { ctx.save(); ctx.beginPath(); ctx.rect(x - 9, top, 18, 104); ctx.clip(); ctx.translate(x, top + 14 + s * 26); ctx.rotate(-0.5); ctx.fillRect(-20, -3, 40, 6); ctx.restore(); }
    ctx.fillStyle = '#2b1c10'; ctx.fillRect(x - 1.5, top - 12, 3, 12); ctx.restore();
    const on = clamp((f - i * 6) / 4), off = clamp((f - (blow + i * 3)) / 6);
    flame(ctx, x, top - 14, 1.15, f, i, on * (1 - off));
    smoke(ctx, x, top - 14, (f - (blow + i * 3)) / 42);
  });
  // the words: script line, then the name
  const at = clamp((f - 14) / 12);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = at;
  ctx.shadowColor = 'rgba(255,170,80,0.55)'; ctx.shadowBlur = 30; ctx.fillStyle = GOLD;
  fitFont(ctx, 'Happy Birthday', 168, (px) => `${px}px "HHTitle",serif`, W * 0.88); ctx.fillText('Happy Birthday', W / 2, 1600 + 20 * (1 - out(at)));
  ctx.shadowBlur = 0; ctx.fillStyle = '#fff3e2';
  if (d.name) { fitFont(ctx, d.name, 56, (px) => `600 ${px}px "HHSans",${KR}`, W * 0.8); spaced(ctx, d.name, W / 2, 1705, /^[\x00-\x7f]*$/.test(d.name) ? 10 : 4); }
  ctx.restore();
  brandTop(ctx, d, 118, 'rgba(255,240,220,0.85)');
  // opening: the room starts dark and comes up as the candles catch
  if (f < 24) { ctx.fillStyle = `rgba(10,4,0,${0.88 * (1 - out(f / 24, 2))})`; ctx.fillRect(0, 0, W, H); cx.forEach((x, i) => flame(ctx, x, CANDLE - (i === 1 ? 16 : 0) - 14, 1.15, f, i, clamp((f - i * 6) / 4))); }
  if (f > blow) { ctx.fillStyle = `rgba(8,3,0,${0.45 * clamp((f - blow) / 20)})`; ctx.fillRect(0, 0, W, H); }
}

// ======================= 졸업 앨범 =======================
let PAGE = null;
function page() {
  if (PAGE) return PAGE;
  PAGE = mk(W, H); const g = PAGE.getContext('2d'); g.fillStyle = '#f3eee3'; g.fillRect(0, 0, W, H);
  const n = mk(270, 480), x = n.getContext('2d'), im = x.createImageData(270, 480);
  for (let i = 0; i < im.data.length; i += 4) { const v = (hash(i, 9) - 0.5) * 16; im.data[i] = 128 + v; im.data[i + 1] = 128 + v; im.data[i + 2] = 128 + v; im.data[i + 3] = 255; }
  x.putImageData(im, 0, 0); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.3; g.drawImage(n, 0, 0, W, H);
  return PAGE;
}
// graduations here fall in Jan-Feb: from August the class is next year's
const classYear = () => { const n = new Date(); return n.getMonth() >= 7 ? n.getFullYear() + 1 : n.getFullYear(); };
function buildGrad(base, beat) {
  const N = base.N ?? 900, g = gridOf(beat, N);
  return { ...base, N, cuts: cutsOf(g, N, 2), year: classYear(), line: ownLine(base, '졸업 축하해') };
}
const FR = { x: 120, y: 400, w: 840, h: 1040 };
function cap(ctx, x, y, s, rot, k) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = '#1c2236'; ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(92, -6); ctx.lineTo(0, 26); ctx.lineTo(-92, -6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#141a2b'; ctx.beginPath(); ctx.moveTo(-50, 6); ctx.lineTo(50, 6); ctx.lineTo(44, 46); ctx.quadraticCurveTo(0, 58, -44, 46); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -6); ctx.quadraticCurveTo(40 + 10 * Math.sin(k), 0, 58, 34); ctx.stroke();
  ctx.fillStyle = GOLD; ctx.fillRect(53, 34, 10, 24); ctx.restore();
}
function drawGrad(ctx, f, N, d) {
  const INK = '#1d2238';
  ctx.drawImage(page(), 0, 0);
  // header: CLASS OF <year> between two rules, the brand beneath
  ctx.save(); ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(120, 176); ctx.lineTo(W - 120, 176); ctx.moveTo(120, 300); ctx.lineTo(W - 120, 300); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(120, 186); ctx.lineTo(W - 120, 186); ctx.moveTo(120, 290); ctx.lineTo(W - 120, 290); ctx.stroke();
  ctx.font = '62px "HHSerif",serif'; spaced(ctx, `CLASS OF ${d.year}`, W / 2, 238, 14);
  ctx.restore();
  brandTop(ctx, d, 344, 'rgba(29,34,56,0.7)');
  // the photo on its mat; a new one turns in from the right like a page
  const c = cutAt(d.cuts, f), u = (f - c.f0) / Math.max(1, c.f1 - c.f0), turn = out((f - c.f0) / 8, 3);
  const prev = c.k ? d.cuts[c.k - 1] : null;
  ctx.save(); ctx.shadowColor = 'rgba(40,30,20,0.3)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12; ctx.fillStyle = '#fbf9f4';
  ctx.fillRect(FR.x - 22, FR.y - 22, FR.w + 44, FR.h + 44); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(FR.x, FR.y, FR.w, FR.h); ctx.clip();
  if (prev && turn < 1) { const pi = pick(d, prev.k); if (pi) cover(ctx, pi, FR.x, FR.y, FR.w, FR.h, 1.1); }
  const img = pick(d, c.k), rx = FR.x + FR.w * (1 - (prev ? turn : 1));
  ctx.beginPath(); ctx.rect(rx, FR.y, FR.x + FR.w - rx, FR.h); ctx.clip();
  if (img) cover(ctx, img, FR.x, FR.y, FR.w, FR.h, 1.03 + 0.07 * u);
  ctx.restore();
  if (prev && turn < 1) { const sg = ctx.createLinearGradient(rx - 40, 0, rx + 10, 0); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.28)'); ctx.fillStyle = sg; ctx.fillRect(rx - 40, FR.y, 50, FR.h); }
  // caption: the words, and a number per photo like a yearbook entry
  ctx.save(); ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  fitFont(ctx, d.line, 66, (px) => `${px}px ${KRS}`, W * 0.8); ctx.fillText(d.line, W / 2, 1590);
  ctx.font = 'italic 34px "HHItalic","HHSerif",serif'; ctx.fillStyle = 'rgba(29,34,56,0.65)'; ctx.fillText(`No. ${String(c.k + 1).padStart(2, '0')}  ·  ${d.year}`, W / 2, 1660);
  ctx.restore();
  // a gold seal stamped on the corner of the frame
  const st = clamp((f - 16) / 8), sc = 1 + 0.6 * (1 - out(st, 2));
  if (st > 0) {
    ctx.save(); ctx.translate(FR.x + FR.w - 30, FR.y + FR.h - 20); ctx.rotate(-0.18); ctx.scale(sc, sc); ctx.globalAlpha = st;
    const sg = ctx.createRadialGradient(-20, -20, 10, 0, 0, 96); sg.addColorStop(0, '#fbe3a6'); sg.addColorStop(1, '#c8973f');
    ctx.fillStyle = sg; ctx.beginPath(); for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 88 : 96; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(110,70,20,0.6)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#5a3a12'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `44px ${KR}`; ctx.fillText('졸업', 0, -8);
    ctx.font = '24px "HHSans",sans-serif'; ctx.fillText(String(d.year), 0, 30); ctx.restore();
  }
  // caps thrown up in the last seconds
  const T0 = N - 84;
  if (f > T0) for (let i = 0; i < 9; i++) {
    const t = (f - T0 - i * 3) / FPS; if (t < 0) continue;
    const x = 90 + hash(i, 21) * (W - 180), y = H + 120 - (1500 + hash(i, 22) * 500) * t + 900 * t * t;
    cap(ctx, x, y, 1 + hash(i, 23) * 0.5, t * (2 + hash(i, 24) * 4) * (i % 2 ? 1 : -1), f * 0.2 + i);
  }
  // opening: the album cover swings open from its spine
  if (f < 26) {
    const k = out((f - 4) / 20, 3), cw = W * (1 - k);
    if (cw > 2) {
      ctx.save(); ctx.fillStyle = '#1d2740'; ctx.fillRect(0, 0, cw, H);
      ctx.beginPath(); ctx.rect(0, 0, cw, H); ctx.clip(); ctx.scale(Math.max(0.01, 1 - k), 1);
      ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.strokeRect(70, 70, W - 140, H - 140); ctx.lineWidth = 1.5; ctx.strokeRect(84, 84, W - 168, H - 168);
      ctx.fillStyle = GOLD; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '70px "HHSerif",serif'; spaced(ctx, 'CLASS OF', W / 2, H * 0.44, 16);
      ctx.font = '150px "HHSerif",serif'; spaced(ctx, String(d.year), W / 2, H * 0.53, 12); ctx.restore();
      const sh = ctx.createLinearGradient(cw, 0, cw + 60, 0); sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sh; ctx.fillRect(cw, 0, 60, H);
    }
  }
}

// ======================= D+day =======================
function buildDday(base, beat) {
  const N = base.N ?? 900, g = gridOf(beat, N);
  const line = ownLine(base, '함께한 날들');
  const m = `${line}`.match(/\d{1,5}/), target = m ? Math.max(1, +m[0]) : 100;
  const land = Math.round(N * 0.78), ticks = g.filter((b) => b < land).map(Math.round);
  return { ...base, N, cuts: cutsOf(g, N, 2), line, target, land, ticks, beats: g.map(Math.round) };
}
function drawDday(ctx, f, N, d) {
  const c = cutAt(d.cuts, f), u = (f - c.f0) / Math.max(1, c.f1 - c.f0), img = pick(d, c.k);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (img) cover(ctx, img, 0, 0, W, H, 1.03 + 0.06 * u);
  const top = ctx.createLinearGradient(0, 0, 0, 300); top.addColorStop(0, 'rgba(0,0,0,0.45)'); top.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = top; ctx.fillRect(0, 0, W, 300);
  const low = ctx.createLinearGradient(0, H * 0.55, 0, H); low.addColorStop(0, 'rgba(0,0,0,0)'); low.addColorStop(1, 'rgba(0,0,0,0.7)'); ctx.fillStyle = low; ctx.fillRect(0, H * 0.55, W, H * 0.45);
  // the count steps up on each beat and lands on the number in the words at ~78% of the video
  let n = 0, lastTick = 0;
  for (const b of d.ticks) { if (b > f) break; n++; lastTick = b; }
  const landed = f >= d.land, val = landed ? d.target : Math.max(1, Math.round(1 + (d.target - 1) * out(Math.max(0, n - 1) / Math.max(1, d.ticks.length - 1), 1.7)));   // 첫 박은 D+1
  const beatAgo = landed ? (f - (d.beats.filter((b) => b <= f).at(-1) ?? f)) : f - lastTick;
  const pop = 1 + 0.07 * Math.max(0, 1 - beatAgo / 6) + (f < 10 ? 0.5 * (1 - f / 10) : 0);
  const gl = clamp((f - d.land) / 10);
  ctx.save(); ctx.translate(W / 2, 1420); ctx.scale(pop, pop); ctx.textBaseline = 'alphabetic';
  ctx.font = '300px "HHDisplay",sans-serif'; const num = String(val), nw = ctx.measureText(num).width;
  ctx.font = '120px "HHDisplay",sans-serif'; const dw = ctx.measureText('D+').width, total = dw + 16 + nw;
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 24;
  ctx.fillStyle = gl > 0 ? GOLD : '#fff'; ctx.textAlign = 'left';
  ctx.fillText('D+', -total / 2, -14); ctx.font = '300px "HHDisplay",sans-serif'; ctx.fillText(num, -total / 2 + dw + 16, 0);
  if (gl > 0) { ctx.shadowBlur = 0; ctx.fillRect(-total / 2, 30, total * out(gl), 8); }
  ctx.restore();
  ctx.save(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16;
  fitFont(ctx, d.line, 58, (px) => `${px}px ${KR}`, W * 0.84); ctx.fillText(d.line, W / 2, 1580); ctx.restore();
  brandTop(ctx, d, 118, 'rgba(255,255,255,0.85)');
  if (f < 6) { ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - f / 6)})`; ctx.fillRect(0, 0, W, H); }   // opening: a flash as the count slams in
}

const CAT = T('기념일', 'Special days');
export const DAYS_LOOKS = [
  { id: 'bday-candle', cat: CAT, name: T('생일 촛불', 'Birthday Candles'), sub: T('촛불 세 개가 켜지며 시작 · 박자에 금빛 종이 가루 · 끝에 촛불을 끔', 'three candles light up · gold confetti on the beat · blown out at the end'),
    draw: drawBday, build: buildBday, photo: { min: 5, shape: 'tall', slots: (d) => d.cuts.length } },
  { id: 'grad-yearbook', cat: CAT, name: T('졸업 앨범', 'Yearbook'), sub: T('졸업 앨범 표지가 열림 · 사진이 책장처럼 넘어감 · 끝에 학사모를 던짐', 'the album cover opens · photos turn like pages · caps thrown at the end'),
    draw: drawGrad, build: buildGrad, photo: { min: 5, shape: 'tall', slots: (d) => d.cuts.length } },
  { id: 'dday-count', cat: CAT, name: 'D+day', sub: T('박자마다 날짜가 올라감 · 글자 속 숫자에 금빛으로 멈춤', 'the day count climbs on the beat · stops in gold on the number you type'),
    draw: drawDday, build: buildDday, photo: { min: 5, shape: 'tall', slots: (d) => d.cuts.length } },
];
