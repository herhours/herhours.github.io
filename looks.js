// Her Hours Shorts — the looks a user can pick.
// Each look is one approved channel short, redrawn for the phone canvas. The Remotion
// originals live in D:\_research\visual_playlist_pilot\shorts_clo\src\templates\ — layout,
// timings and colours are carried over from there; only the drawing code is new.
import { W, H, drawFrame as drawWindowBand, drawCover, grainPattern, F_LYRIC, F_CAPS, paintWord, LYRIC, krScale } from './core.js';

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const out = (t) => 1 - Math.pow(1 - clamp(t), 3);
const inOut = (t) => { const x = clamp(t); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const hash = (i, salt = 0) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };

const KR = '"HHKr","Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR"';
const F_DISPLAY = `"HHDisplay",${KR},sans-serif`;
const F_SANS = `"HHSans",${KR},sans-serif`;
const F_SERIF = `"HHSerif",${KR},serif`;

function fit(ctx, text, size, family, maxW) {
  ctx.font = `${size}px ${family}`;
  const w = ctx.measureText(text).width;
  if (w <= maxW) return size;
  const s = Math.max(12, size * maxW / w);
  ctx.font = `${s}px ${family}`;
  return s;
}

function wrap(ctx, words, maxW, gap) {
  const lines = []; let line = []; let lw = 0;
  for (const w of words) {
    const ww = ctx.measureText(w.w).width;
    if (line.length && lw + gap + ww > maxW) { lines.push({ words: line, width: lw }); line = []; lw = 0; }
    lw += (line.length ? gap : 0) + ww; line.push({ ...w, ww });
  }
  if (line.length) lines.push({ words: line, width: lw });
  return lines;
}

// ---------- sparks: pre-drawn glow dots, so 80 of them cost 80 drawImage calls, not 80 blurs ----------
const sprites = new Map();
function sprite(color) {
  if (sprites.has(color)) return sprites.get(color);
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(24, 24, 0, 24, 24, 24);
  rg.addColorStop(0, color); rg.addColorStop(0.22, color); rg.addColorStop(0.45, color + '55'); rg.addColorStop(1, color + '00');
  g.fillStyle = rg; g.fillRect(0, 0, 48, 48);
  sprites.set(color, c);
  return c;
}

// =====================================================================================
// TRIPTYCH STACK — EP02 Emberfall (조회 309, 채널 쇼츠 최고) / EP06 Footnote.
// Three landscape strips, each cutting on its own third of the beat grid, all cutting
// together on the hits, with a flash and embers rising through all three.
// =====================================================================================
const T_TOP = 120, T_STRIP = 540;

function triptychCuts(d, offset, N) {
  const set = new Set([0, ...d.hits]);
  for (let f = offset; f < N; f += d.period) set.add(Math.round(f));
  return [...set].filter((f) => f < N).sort((a, b) => a - b);
}

function drawTriptych(ctx, f, N, d) {
  const { images, phrases, brand, title, accent, gold, ink, cream, hits, introEnd, chorusFrom } = d;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.letterSpacing = '0px'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ink; ctx.fillRect(0, 0, W, H);

  const master = out(clamp(f / 16)) * (1 - inOut(clamp((f - (N - 34)) / 30)));
  const n = images.length;

  // three strips. Photos are dealt round-robin across them, the way the original pools interleave.
  for (let s = 0; s < 3; s++) {
    const cuts = triptychCuts(d, (d.period * s) / 3, N);
    let shot = 0;
    for (let i = 0; i < cuts.length; i++) if (f >= cuts[i]) shot = i;
    const from = cuts[shot], to = shot + 1 < cuts.length ? cuts[shot + 1] : N;
    const local = f - from;
    const t = clamp(local / Math.max(1, to - from));
    const dir = (shot + s) % 2 === 0 ? 1 : -1;
    const punch = 1 + 0.05 * (1 - out(clamp(local / 6)));
    const scale = (1.05 + 0.06 * t) * punch;
    const tx = dir * (1 - 2 * t) * 1.4;
    const y = T_TOP + s * T_STRIP;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y, W, T_STRIP); ctx.clip();
    ctx.globalAlpha = master;
    ctx.fillStyle = '#000'; ctx.fillRect(0, y, W, T_STRIP);
    drawCover(ctx, images[(shot * 3 + s) % n], 0, y, W, T_STRIP, scale, tx);
    const dark = f < introEnd ? 0.55 - 0.55 * out(clamp((f - (introEnd - 20)) / 20)) : 0;
    if (dark > 0) { ctx.fillStyle = `rgba(8,3,1,${dark})`; ctx.fillRect(0, y, W, T_STRIP); }
    ctx.fillStyle = ink; ctx.fillRect(0, y + T_STRIP - 3, W, 3);
    ctx.restore();
  }

  // embers
  const sec = f / 30, intensity = f >= chorusFrom ? 1 : 0.4;
  ctx.globalAlpha = master;
  for (let i = 0; i < 80; i++) {
    if (hash(i, 9) > intensity) continue;
    const speed = 90 + hash(i, 1) * 160;
    const y = 1980 - ((sec * speed + hash(i, 2) * 2200) % 2200);
    const x = hash(i, 0) * 1080 + Math.sin(sec * (1.2 + hash(i, 3)) + i) * 30;
    const size = 2.5 + hash(i, 4) * 5;
    const flick = 0.55 + 0.45 * Math.sin(sec * (6 + hash(i, 5) * 8) + i);
    ctx.globalAlpha = master * flick;
    const r = size * 2.5;
    ctx.drawImage(sprite(hash(i, 6) > 0.5 ? gold : accent), x + size / 2 - r, y + size / 2 - r, r * 2, r * 2);
  }
  ctx.globalAlpha = master;

  // top bar
  ctx.fillStyle = ink; ctx.fillRect(0, 0, W, T_TOP);
  ctx.letterSpacing = '5px'; ctx.textAlign = 'left';
  const bs = fit(ctx, brand, 46, F_DISPLAY, 520);
  ctx.fillStyle = cream; ctx.fillText(brand, 72, 34 + bs * 0.95);
  const bw = ctx.measureText(brand).width;
  ctx.fillStyle = accent; ctx.fillText('.', 72 + bw, 34 + bs * 0.95);
  ctx.letterSpacing = '4px'; ctx.textAlign = 'right';
  fit(ctx, 'VISUAL PLAYLIST / SHORTS', 20, F_SANS, W - 144 - bw - 60);
  ctx.globalAlpha = master * 0.85; ctx.fillStyle = cream;
  ctx.fillText('VISUAL PLAYLIST / SHORTS', W - 72, 34 + bs * 0.95);
  ctx.globalAlpha = master;

  // title card over the strips, until introEnd
  const introK = out(clamp(f / 18));
  const introGone = inOut(clamp((f - (introEnd - 10)) / 22));
  const ia = introK * (1 - introGone);
  if (ia > 0.001) {
    ctx.save();
    ctx.globalAlpha = master * ia;
    const sc = 0.92 + 0.08 * introK;
    ctx.translate(W / 2, 700 + (1 - introK) * 30); ctx.scale(sc, sc); ctx.translate(-W / 2, -700);
    ctx.textAlign = 'center';
    ctx.letterSpacing = '6px';
    fit(ctx, d.introLabel, 26, F_SANS, W - 144);
    ctx.fillStyle = gold; ctx.fillText(d.introLabel, W / 2, 560 + 26);
    ctx.letterSpacing = '0px';
    const ts = fit(ctx, title, 210, F_DISPLAY, W - 120);
    const ty = 560 + 26 + 18 + ts * 0.86;
    ctx.fillStyle = '#3a1406'; ctx.fillText(title, W / 2, ty + 8);
    ctx.shadowColor = accent + '8c'; ctx.shadowBlur = 60;
    ctx.fillStyle = cream; ctx.fillText(title, W / 2, ty);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    fit(ctx, d.introSub, 40, F_SERIF, W - 144);
    ctx.fillStyle = gold; ctx.fillText(d.introSub, W / 2, ty + ts * 0.14 + 14 + 40);
    ctx.restore();
  }

  // lyric box (left, under the second strip). A song with no timed lyrics shows its title instead.
  if (introGone > 0.001) {
    const phrase = [...phrases].reverse().find((p) => f >= p.start);
    const size = 58 * krScale(phrase ? phrase.text : d.boxText), padL = 28, padR = 34, maxW = 880 - padL - padR - 6;
    ctx.font = `${size}px ${F_LYRIC}`; ctx.letterSpacing = '0px';
    const words = phrase ? (phrase.words ?? [{ t: phrase.start, w: phrase.text }])
                         : d.boxText.split(/\s+/).map((w) => ({ t: -1, w }));
    const lines = wrap(ctx, words, maxW, size * 0.26);
    const bodyH = lines.length * size * 1.08;
    const boxW = Math.min(880, Math.max(...lines.map((l) => l.width), 300) + padL + padR + 6);
    const boxH = 18 + 20 + 8 + bodyH + 34;
    ctx.globalAlpha = master * introGone;
    ctx.fillStyle = 'rgba(20,9,4,0.86)'; ctx.fillRect(72, 1128, boxW, boxH);
    ctx.fillStyle = accent; ctx.fillRect(72, 1128, 6, boxH);
    ctx.textAlign = 'left'; ctx.letterSpacing = '5px';
    fit(ctx, d.boxLabel, 20, F_SANS, boxW - padL - padR);
    ctx.fillText(d.boxLabel, 72 + 6 + padL, 1128 + 18 + 18);
    ctx.font = `${size}px ${F_LYRIC}`; ctx.letterSpacing = '0px';
    let y = 1128 + 18 + 20 + 8 + size * 0.86;
    for (const ln of lines) {
      let x = 72 + 6 + padL;
      for (const w of ln.words) {
        paintWord(ctx, w.w, x, y, f, w.t, { color: LYRIC, dim: LYRIC + '4d', glow: LYRIC });
        x += w.ww + size * 0.26;
      }
      y += size * 1.08;
    }
    ctx.globalAlpha = master;
  }

  // bottom bar + footer
  const by = T_TOP + 3 * T_STRIP;
  ctx.fillStyle = ink; ctx.fillRect(0, by, W, H - by);
  ctx.letterSpacing = '3px'; ctx.fillStyle = '#b89b80';
  fit(ctx, d.footL, 22, F_SANS, 440); ctx.textAlign = 'left'; ctx.fillText(d.footL, 72, by + 40 + 20);
  fit(ctx, d.footR, 22, F_SANS, 440); ctx.textAlign = 'right'; ctx.fillText(d.footR, W - 72, by + 40 + 20);

  // flash on the hits
  const lastHit = [...hits].reverse().find((h) => f >= h);
  const flash = lastHit === undefined ? 0 : 0.75 * (1 - out(clamp((f - lastHit) / 9)));
  if (flash > 0.002) {
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = master * flash;
    const rg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
    rg.addColorStop(0, gold); rg.addColorStop(0.6, accent); rg.addColorStop(1, accent + '00');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }

  // grain 0.08
  ctx.globalAlpha = 0.08; ctx.globalCompositeOperation = 'overlay';
  const shift = (f % 7) * 13;
  ctx.save(); ctx.translate(shift, -shift); ctx.fillStyle = grainPattern(ctx); ctx.fillRect(-shift, shift, W, H); ctx.restore();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
}

// =====================================================================================
// BLACK CUT — EP06 Coffee Gone Cold / EP07 The Crossing (09-19 승인).
// Full-frame stills cut apart by hard black, each cut with its own move, small lyric.
// Two episodes from this family must differ in motion order and lyric style (영샘 09-19:
// "coffee랑 crossing이 똑같음"), so each variant carries its own sequence.
// New in the app: the cut length snaps to the song's beat, so the black lands on the drum.
// =====================================================================================
const F_LIGHT = `"HHLight",${KR},sans-serif`;
const back = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

function blackMove(m, t, dir) {
  const e = inOut(t);
  switch (m) {
    case 'push': return { scale: 1.06 + 0.22 * e, x: 0, y: 0, rot: 0.4 * dir * (t - 0.5) };
    case 'pull': return { scale: 1.32 - 0.22 * e, x: 0, y: 0, rot: -0.4 * dir * (t - 0.5) };
    case 'slideL': return { scale: 1.24, x: 5 - 10 * e, y: 0, rot: 0 };
    case 'slideR': return { scale: 1.24, x: -5 + 10 * e, y: 0, rot: 0 };
    case 'tilt': return { scale: 1.2, x: 0, y: 0, rot: -2.2 + 4.4 * e };
    case 'rise': return { scale: 1.22, x: 0, y: 4 - 8 * e, rot: 0 };
    case 'hold-snap': return { scale: t < 0.62 ? 1.08 : 1.08 + 0.2 * out(clamp((t - 0.62) / 0.38)), x: 0, y: 0, rot: 0 };
    default: return { scale: 1.1, x: 0, y: 0, rot: 0 };
  }
}
const FOCUS = [[0.5, 0.45], [0.42, 0.4], [0.58, 0.5], [0.5, 0.42]];

// The grade is a CSS filter; running it on every drawImage costs a phone dearly, so each photo
// is graded once and kept.
const graded = new WeakMap();
function gradedImage(img, grade) {
  let m = graded.get(img);
  if (!m) { m = new Map(); graded.set(img, m); }
  if (m.has(grade)) return m.get(grade);
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.filter = grade; g.drawImage(img, 0, 0);
  m.set(grade, c);
  return c;
}

function drawBlackCut(ctx, f, N, d) {
  const { images, phrases, accent, grade, motions, step, gap, openHold } = d;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.letterSpacing = '0px'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

  const i = Math.floor(f / step), from = i * step, hold = step - gap;
  if (f < from + hold) {
    const t = clamp((f - from) / hold);
    const dir = i % 2 === 0 ? 1 : -1;
    const [fx, fy] = FOCUS[i % FOCUS.length];
    const mv = blackMove(motions[i % motions.length], t, dir);
    const inEdge = from === 0 ? 1 : clamp((f - from) / 2);   // frame 0 is already a picture
    const edge = Math.min(inEdge, clamp((from + hold - f) / 2));
    // a video clip changes every frame, so it is graded as it is drawn instead of cached
    const src = images[i % images.length];
    const img = src.live ? src : gradedImage(src, grade);
    const ox = fx * W, oy = fy * H;
    ctx.save();
    ctx.globalAlpha = edge;
    ctx.translate(ox, oy); ctx.scale(mv.scale, mv.scale);
    ctx.translate(mv.x / 100 * W, mv.y / 100 * H); ctx.rotate(mv.rot * Math.PI / 180);
    ctx.translate(-ox, -oy);
    const s = Math.max(W / img.width, H / img.height);
    const dw = img.width * s, dh = img.height * s;
    if (src.live) ctx.filter = grade;
    ctx.drawImage(img, (W - dw) * fx, (H - dh) * fy, dw, dh);
    ctx.filter = 'none';
    ctx.restore();
    ctx.globalAlpha = edge * 0.22; ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = accent; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = edge;
    ctx.save(); ctx.translate(W / 2, H * 0.44); ctx.scale(1.2 * W, 0.78 * H);
    const vg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    vg.addColorStop(0.4, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // grain 0.06
  ctx.globalAlpha = 0.06; ctx.globalCompositeOperation = 'overlay';
  const shift = (f % 7) * 13;
  ctx.save(); ctx.translate(shift, -shift); ctx.fillStyle = grainPattern(ctx); ctx.fillRect(-shift, shift, W, H); ctx.restore();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

  // lyric
  const line = phrases.find((p) => f >= p.start && f < p.end);
  if (line && f >= openHold) {
    const size = d.lyricSize * krScale(line.text), maxW = W * d.lyricWidth;
    const lin = clamp((f - line.start) / 7), lout = clamp((line.end - f) / 7);
    const lo = out(Math.min(lin, lout));
    // two voices, so the two Black Cut variants never read alike: an italic line, or spaced capitals
    const caps = d.lyricFont === 'caps';
    ctx.font = `${size}px ${caps ? F_CAPS : F_LYRIC}`; // wide tracking is for Latin capitals; handwritten Hangul spaced out falls apart
    ctx.letterSpacing = caps && krScale(line.text) === 1 ? '8px' : caps ? '2px' : '0px'; ctx.textAlign = 'left';
    const up = (s) => (caps ? s.toUpperCase() : s);
    const words = (d.lyricWords && line.words?.length ? line.words : line.text.split(/\s+/).map((w) => ({ t: line.start, w })))
      .map((w) => ({ ...w, w: up(w.w) }));
    let lines = wrap(ctx, words, maxW, size * 0.3);
    // never leave one word alone on the last line - rebalance the break
    if (lines.length > 1 && lines[lines.length - 1].words.length === 1) {
      const total = lines.reduce((s, l) => s + l.width, 0);
      const even = wrap(ctx, words, total / lines.length * 1.12, size * 0.3);
      if (even.length === lines.length) lines = even;
      // still one word alone, and the whole line fits the margins: keep it on one line
      if (lines[lines.length - 1].words.length === 1) { const one = wrap(ctx, words, W - 144, size * 0.3); if (one.length === 1) lines = one; }
    }
    const lh = size * 1.32, blockH = lines.length * lh;
    const top = d.lyricPos === 'lower' ? H - 430 - blockH : d.lyricPos === 'upper' ? 390 : (H - blockH) / 2;
    // a soft dark pool behind the words: white type on snow or sky disappears without it
    const pool = (a) => {
      ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = 'transparent';
      ctx.translate(W / 2, top + blockH / 2); ctx.scale(Math.max(...lines.map((l) => l.width)) * 0.75 + 80, blockH * 0.9 + 60);
      const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      bg.addColorStop(0, 'rgba(0,0,0,0.85)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
    };
    ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 2;
    ctx.fillStyle = LYRIC;
    if (d.lyricWords) {
      pool(lo * 0.55);
      lines.forEach((ln, li) => {
        let x = (W - ln.width) / 2;
        for (const w of ln.words) {
          const k = out(clamp((f - w.t) / 9));
          ctx.globalAlpha = k * lo;
          // the word just sung glows for a beat, then settles
          const fresh = clamp(1 - (f - w.t) / 18);
          ctx.fillStyle = fresh > 0 ? '#fff4d6' : LYRIC;
          ctx.shadowColor = fresh > 0 ? LYRIC : 'rgba(0,0,0,0.95)'; ctx.shadowBlur = fresh > 0 ? 18 + 14 * fresh : 18;
          ctx.fillText(w.w, x, top + li * lh + size * 0.95 + (1 - k) * 14);
          x += w.ww + size * 0.3;
        }
      });
    } else {
      const sc = 0.985 + 0.015 * back(clamp(lin));
      ctx.save(); ctx.translate(W / 2, top + blockH / 2 + (1 - lo) * 8); ctx.scale(sc, sc); ctx.translate(-W / 2, -(top + blockH / 2));
      pool(lo * 0.55);
      ctx.globalAlpha = lo; ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.fillStyle = LYRIC;
      lines.forEach((ln, li) => {
        let x = (W - ln.width) / 2;
        for (const w of ln.words) { ctx.fillText(w.w, x, top + li * lh + size * 0.95); x += w.ww + size * 0.3; }
      });
      ctx.restore();
    }
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.globalAlpha = 1;
  }

  // brand, bottom 132
  ctx.textAlign = 'center'; ctx.letterSpacing = '7px';
  fit(ctx, d.brand, 22, F_SANS, W - 144);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(d.brand, W / 2, H - 132 - 6);
  ctx.letterSpacing = '0px';
}

// A song with no timed lyrics still gets type — this channel's shorts never go without it
// (09-09 MATCH CUT 폐기). The title comes in after the open and again at the close.
function titleAsLyrics(base, N) {
  const text = `${base.title1} ${base.title2}`.trim();
  const words = text.split(/\s+/);
  const mk = (start, end) => ({ start, end, text, words: words.map((w, i) => ({ t: start + i * 8, w })) });
  return [mk(24, 150), mk(Math.max(160, N - 120), N)];
}

// cut + black ≈ 2.2s, but a whole number of beats, so the black falls on the beat
function beatStep(beat, target = 66) {
  if (!beat?.beat) return target;
  let k = Math.max(1, Math.round(target / beat.beat));
  return k * beat.beat;
}

const blackCut = (id, name, sub, v) => ({
  id, name, sub, draw: drawBlackCut,
  build: (base, beat) => ({
    ...base,
    phrases: base.phrases.length ? base.phrases : titleAsLyrics(base, 960),
    accent: v.accent, grade: v.grade, motions: v.motions,
    step: beatStep(beat), gap: 4, openHold: 24,
    lyricSize: v.lyricSize, lyricWidth: 0.8, lyricPos: v.lyricPos, lyricWords: v.lyricWords, lyricFont: v.lyricFont,
  }),
});

// =====================================================================================
// PULSE — EP07 Two Days From Anywhere (09-19 승인).
// The song drawn as a ring over our own photograph: the phonk templates this borrows from
// float the ring on empty space, which is why a hundred thousand of them look alike.
// Four phases so 32s never holds one shape: ring → flat wave → double ring → turning ring.
// =====================================================================================
let ringLayer = null;
function drawPulse(ctx, f, N, d) {
  const { images, phrases, accent, accent2, grade, step, spec, bands } = d;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.letterSpacing = '0px'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#04040a'; ctx.fillRect(0, 0, W, H);

  const band = (i) => (spec ? spec[Math.min(f, spec.length / bands - 1) * bands + i] || 0 : 0);
  const nLow = Math.max(2, Math.floor(bands / 8));
  let drive = 0; for (let i = 0; i < nLow; i++) drive += band(i); drive /= nLow;
  const breathe = 1 + Math.min(0.26, drive * 3.2);

  // the picture sits back, slowly pushing in, so the ring can live in front
  const idx = Math.floor(f / step), local = (f % step) / step;
  const src = images[idx % images.length];
  const img = src.live ? src : gradedImage(src, grade);
  const sc = 1.1 + 0.07 * local + drive * 0.05;
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2);
  const s = Math.max(W / img.width, H / img.height), dw = img.width * s, dh = img.height * s;
  if (src.live) ctx.filter = grade;
  ctx.drawImage(img, (W - dw) * 0.5, (H - dh) * 0.45, dw, dh);
  ctx.filter = 'none';
  ctx.restore();
  ctx.globalAlpha = 1;
  const ell = (rx, ry, stops) => {
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(rx * W, ry * H);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    ctx.fillStyle = g; ctx.fillRect(-1 / rx, -1 / ry, 2 / rx, 2 / ry); ctx.restore();
  };
  ell(0.58, 0.38, [[0, 'rgba(0,0,0,0.42)'], [0.62, 'rgba(2,2,8,0.30)'], [1, 'rgba(2,2,8,0.72)']]);
  ell(0.26, 0.15, [[0, 'rgba(0,0,0,0.62)'], [1, 'rgba(0,0,0,0)']]);

  const cx = 540, cy = 960, R = 300;
  const phase = Math.min(3, Math.floor((f / N) * 4));
  const pt = ((f / N) * 4) % 1;
  const swap = out(clamp(pt / 0.12));
  const played = f / N;

  // bars on their own layer, so the glow is one blur of the whole ring, not 128 shadows
  if (!ringLayer) { ringLayer = document.createElement('canvas'); ringLayer.width = W; ringLayer.height = H; }
  const g = ringLayer.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.lineCap = 'round'; g.lineWidth = 5;
  for (let i = 0; i < bands; i++) {
    const v = band(i);
    const len = 14 + Math.min(150, v * 620) * (0.7 + 0.5 * swap);
    const t = i / bands;
    let x1, y1, x2, y2;
    if (phase === 1) {
      const x = 80 + t * 920; x1 = x2 = x; y1 = cy - len * 0.5; y2 = cy + len * 0.5;
    } else if (phase === 2) {
      const a = t * Math.PI * 2 - Math.PI / 2, inner = i % 2 === 0;
      const r0 = (inner ? R * 0.58 : R * 1.02) * breathe, dirOut = inner ? -1 : 1;
      // inner bars point inward; past half the radius they pile up into a star over the face
      const l = inner ? Math.min(len, r0 * 0.5) : len;
      x1 = cx + Math.cos(a) * r0; y1 = cy + Math.sin(a) * r0;
      x2 = cx + Math.cos(a) * (r0 + l * dirOut); y2 = cy + Math.sin(a) * (r0 + l * dirOut);
    } else {
      const a = t * Math.PI * 2 - Math.PI / 2 + (phase === 3 ? f * 0.004 : 0), r0 = R * breathe;
      x1 = cx + Math.cos(a) * r0; y1 = cy + Math.sin(a) * r0;
      x2 = cx + Math.cos(a) * (r0 + len); y2 = cy + Math.sin(a) * (r0 + len);
    }
    g.globalAlpha = (0.55 + Math.min(0.45, v * 4)) * (0.45 + 0.55 * swap);
    g.strokeStyle = i % 3 === 0 ? accent2 : accent;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }
  if (phase !== 1) {
    g.globalAlpha = 0.7 * swap; g.strokeStyle = accent; g.lineWidth = 2.5;
    g.beginPath(); g.arc(cx, cy, R * breathe * (phase === 2 ? 0.8 : 1), 0, Math.PI * 2); g.stroke();
  }
  g.globalAlpha = 1;
  ctx.filter = 'blur(12px)'; ctx.drawImage(ringLayer, 0, 0); ctx.filter = 'none';
  ctx.drawImage(ringLayer, 0, 0);

  // progress: a closing ring, or a filling line while the wave is flat
  ctx.globalAlpha = 0.85; ctx.strokeStyle = accent2; ctx.lineCap = 'round';
  if (phase === 1) {
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(80, cy + 240); ctx.lineTo(80 + 920 * played, cy + 240); ctx.stroke();
  } else {
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R * breathe - 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * played); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // grain 0.07
  ctx.globalAlpha = 0.07; ctx.globalCompositeOperation = 'overlay';
  const shift = (f % 7) * 13;
  ctx.save(); ctx.translate(shift, -shift); ctx.fillStyle = grainPattern(ctx); ctx.fillRect(-shift, shift, W, H); ctx.restore();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

  // name inside the ring, first phase only — the ring is the subject, not the type
  if (phase === 0) {
    const k = 1 + drive * 0.12;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
    ctx.textAlign = 'left'; ctx.letterSpacing = '4px';
    const bs = fit(ctx, d.brand, 62, F_DISPLAY, 440);
    const bw = ctx.measureText(d.brand + '.').width;
    ctx.shadowColor = accent; ctx.shadowBlur = 26;
    ctx.fillStyle = '#fff'; ctx.fillText(d.brand, -bw / 2, bs * 0.35);
    ctx.fillStyle = accent; ctx.fillText('.', -bw / 2 + ctx.measureText(d.brand).width, bs * 0.35);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.restore();
    ctx.textAlign = 'center'; ctx.letterSpacing = '6px';
    fit(ctx, d.tag, 20, F_SANS, 2 * R * 0.8);
    ctx.fillStyle = 'rgba(255,255,255,0.62)'; ctx.fillText(d.tag, cx, cy + 62 * 0.35 + 10 + 24);
  }

  // lyric, top 300
  const line = phrases.find((p) => f >= p.start && f < p.end);
  if (line) {
    const lo = out(Math.min(clamp((f - line.start) / 7), clamp((line.end - f) / 7)));
    const size = 54 * krScale(line.text);   // 40 read too small over a phone video (영샘 10-02)
    ctx.font = `${size}px ${F_CAPS}`; ctx.letterSpacing = krScale(line.text) === 1 ? '7px' : '2px'; ctx.textAlign = 'left';
    const pw = line.text.toUpperCase().split(/\s+/).map((w) => ({ w }));
    let lines = wrap(ctx, pw, W * 0.84, size * 0.32);
    if (lines.length > 1 && lines[lines.length - 1].words.length === 1) {   // no word alone on the last line
      const even = wrap(ctx, pw, lines.reduce((s, l) => s + l.width, 0) / lines.length * 1.15, size * 0.32);
      if (even.length === lines.length) lines = even;
    }
    ctx.globalAlpha = lo; ctx.fillStyle = LYRIC;
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 2;
    lines.forEach((ln, li) => {
      let x = (W - ln.width) / 2;
      for (const w of ln.words) { ctx.fillText(w.w, x, 280 + li * size * 1.35 + size + (1 - lo) * 8); x += w.ww + size * 0.32; }
    });
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.globalAlpha = 1;
  }

  // clock, bottom 210
  const secs = Math.floor(f / 30);
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  ctx.textAlign = 'center'; ctx.letterSpacing = '6px';
  ctx.font = `28px ${F_SANS}`; ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillText(clock, W / 2, H - 210 - 6);
  ctx.letterSpacing = '0px';
}

// =====================================================================================
// registry. `build` turns the shared inputs into what that look's draw() reads.
// Colours are fixed per look on purpose (영샘 09-13): presets, not a colour picker.
// =====================================================================================
export const LOOKS = [
  {
    id: 'windowband', name: 'Window Band', sub: '창문 띠 · 가사가 박자에 켜짐 · EP01',
    draw: drawWindowBand,
    build: (base) => base,
  },
  {
    id: 'triptych', name: 'Triptych', sub: '3단 컷 · 박자마다 따로 끊김 · 불티 · EP02',
    draw: drawTriptych,
    build: (base, beat) => {
      const title = `${base.title1} ${base.title2}`.trim();
      return {
        ...base,
        // Anton is a capitals face — the approved card reads FOOTNOTE, not Footnote
        title: base.title1.toUpperCase(),
        accent: '#ffb063', gold: '#ffe0b8', ink: '#0b0a0c', cream: '#f4efe8',
        introLabel: `${base.brand} / VISUAL PLAYLIST`,
        introSub: base.title2.toLowerCase(),
        boxLabel: `${base.brand} / NOW PLAYING`,
        boxText: title,
        hits: beat?.hits ?? [], period: beat?.period ?? 99, chorusFrom: beat?.chorusFrom ?? 480,
        introEnd: 110,
      };
    },
  },
  blackCut('blackcut-room', 'Black Cut · 실내', '검은 컷 · 화면 전체가 움직임 · 가사 아래 · EP06', {
    accent: '#ffb063', grade: 'saturate(0.92) contrast(1.06) brightness(0.97)',
    motions: ['push', 'tilt', 'hold-snap', 'pull', 'rise', 'slideL'], lyricPos: 'lower', lyricWords: false, lyricFont: 'italic', lyricSize: 72,
  }),
  blackCut('blackcut-road', 'Black Cut · 길 위', '검은 컷 · 낱말이 하나씩 · 가사 위 · EP07', {
    accent: '#ffd58a', grade: 'saturate(1.02) contrast(1.05) brightness(1.02)',
    motions: ['slideR', 'rise', 'slideL', 'push', 'tilt', 'slideR', 'pull'], lyricPos: 'upper', lyricWords: true, lyricFont: 'caps', lyricSize: 50,
  }),
  {
    id: 'pulse', name: 'Pulse', sub: '음악에 반응하는 링 · 4번 모양이 바뀜 · EP07',
    draw: drawPulse,
    build: (base, beat) => ({
      ...base,
      phrases: base.phrases.length ? base.phrases : titleAsLyrics(base, 960),
      accent: '#7ad7ff', accent2: '#ffd58a', grade: 'saturate(1.05) contrast(1.08)',
      step: beatStep(beat, 122), spec: beat?.spec ?? null, bands: 128,
    }),
  },
];
// How many photos each look actually shows for this song, and which shape suits it.
// slots = distinct picture places in N frames; fewer photos than `min` and the repeats show.
const PHOTO = {
  windowband: { min: 4, shape: 'wide', slots: (d, N) => Math.ceil(N / d.shot) },
  triptych: { min: 9, shape: 'wide', slots: (d, N) => [0, 1, 2].reduce((s, i) => s + triptychCuts(d, (d.period * i) / 3, N).length, 0) },
  'blackcut-room': { min: 6, shape: 'tall', slots: (d, N) => Math.ceil(N / d.step) },
  'blackcut-road': { min: 6, shape: 'tall', slots: (d, N) => Math.ceil(N / d.step) },
  pulse: { min: 4, shape: 'tall', slots: (d, N) => Math.ceil(N / d.step) },
};
for (const l of LOOKS) l.photo = PHOTO[l.id];

export const lookById = (id) => LOOKS.find((l) => l.id === id) ?? LOOKS[0];
