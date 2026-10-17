// Her Hours Shorts — the looks a user can pick.
// Each look is one approved channel short, redrawn for the phone canvas. The Remotion
// originals live in D:\_research\visual_playlist_pilot\shorts_clo\src\templates\ — layout,
// timings and colours are carried over from there; only the drawing code is new.
import { W, H, drawFrame as drawWindowBand, drawCover, grainPattern, F_LYRIC, F_CAPS, paintWord, LYRIC, krScale, titleCase } from './core.js';

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
    phrases: base.phrases.length ? base.phrases : titleAsLyrics(base, base.N ?? 960),
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
// CLOCKFACE — EP05 Veronica's Whole Day / EP06 Five Pages Left (09-19 승인).
// A whole day (or a whole night) in 32 seconds. The photo fills the frame and the hour
// recolours the world around her face. Two voices:
//   하루 — a sunk clock at the bottom counts the hours; cuts land on the beat.
//   밤 — the clock gives its place to the lyric; a header, the scene count and the next
//        scene in a small window give the frame structure (영샘 09-19 "단순했다").
// The ground is keyed to the hour of day, not to the photo: an average-colour ground gave
// ten shades of grey and no sense of time passing.
// =====================================================================================
const lerp = (a, b, t) => a + (b - a) * t;
const hexRgb = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mixHex = (a, b, t) => { const p = hexRgb(a), q = hexRgb(b); return `rgb(${p.map((v, i) => Math.round(lerp(v, q[i], t))).join(',')})`; };
// position 0 = 05:00, 1 = 04:00 next day
const SKY = [[0.0, '#1b2a5e'], [0.09, '#4a3a6b'], [0.17, '#a8742e'], [0.26, '#7d92a8'], [0.35, '#cfd6dc'], [0.48, '#c09a5e'],
  [0.57, '#d1622a'], [0.65, '#5b3b78'], [0.74, '#2b3b6b'], [0.87, '#141c36'], [1.0, '#1d1430']];
function skyAtMinute(minute) {
  const p = ((((minute / 60 - 5) / 24) % 1) + 1) % 1;
  for (let i = 1; i < SKY.length; i++) if (p <= SKY[i][0]) return mixHex(SKY[i - 1][1], SKY[i][1], (p - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0]));
  return SKY[SKY.length - 1][1];
}
const CLOCK_FOCUS = [0.5, 0.4, 0.6, 0.46, 0.55];
const DAY_MOVES = ['push', 'slideL', 'rise', 'pull', 'slideR', 'tilt'];
// the four turns of the day, each announced once in the title script as the clock passes it
const DAY_TURNS = [[6, 'Dawn', '06:00'], [12, 'Noon', '12:00'], [18, 'Dusk', '18:00'], [24, 'Midnight', '00:00']];
const F_TITLE = `"HHTitle",${KR},serif`;

let clockLayer = null;
function drawClockface(ctx, f, N, d) {
  const { images, phrases, shot, startMinute, spanMinutes, night } = d;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.letterSpacing = '0px'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H);

  const n = images.length, slots = Math.ceil(N / shot);
  const t = clamp(f / N);
  const minute = startMinute + t * spanMinutes;
  const hh = String(Math.floor(minute / 60) % 24).padStart(2, '0');
  const mm = String(Math.floor(minute) % 60).padStart(2, '0');
  const ground = skyAtMinute(minute);
  const master = out(clamp(f / 12)) * (1 - inOut(clamp((f - (N - 24)) / 24)));
  // the closing card takes 3.2s of a 32s short; at 15s that was a fifth of it, and it ran over Midnight
  const outroLen = Math.min(96, Math.round(N * 0.12));
  const outro = clamp((f - (N - outroLen)) / (outroLen * 0.42));

  const idx = Math.min(slots - 1, Math.floor(f / shot)), local = f - idx * shot, cross = 7;
  const still = (i) => {
    const a = i === idx ? (idx === 0 ? 1 : out(clamp(local / cross))) : 1 - out(clamp(local / cross));
    if (a <= 0) return;
    const k = clamp((f - i * shot) / shot), dir = i % 2 === 0 ? 1 : -1;
    const img = images[i % n];
    const fx = clamp(CLOCK_FOCUS[i % CLOCK_FOCUS.length] + dir * (0.5 - k) * 0.05);
    ctx.globalAlpha = master * a;
    if (night) {
      const sc = 1.06 + 0.07 * k;
      const s = Math.max(W / img.width, H / img.height) * sc, dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, (W - dw) * fx, (H - dh) * 0.42, dw, dh);
    } else {
      // 하루: every shot its own move, so the cuts do not all breathe the same way
      const mv = blackMove(DAY_MOVES[i % DAY_MOVES.length], k, dir);
      const ox = fx * W, oy = 0.42 * H;
      const s = Math.max(W / img.width, H / img.height), dw = img.width * s, dh = img.height * s;
      ctx.save();
      ctx.translate(ox, oy); ctx.scale(mv.scale, mv.scale);
      ctx.translate(mv.x / 100 * W, mv.y / 100 * H); ctx.rotate(mv.rot * Math.PI / 180); ctx.translate(-ox, -oy);
      ctx.drawImage(img, (W - dw) * fx, (H - dh) * 0.42, dw, dh);
      ctx.restore();
    }
  };
  if (idx > 0) still(idx - 1);
  still(idx);

  // the hour owns the world: 'color' swaps the hue and keeps the light. A full-strength pass
  // read as a purple filter on skin, so the strong pass is masked away from where the face sits.
  ctx.globalAlpha = master * 0.26; ctx.globalCompositeOperation = 'color';
  ctx.fillStyle = ground; ctx.fillRect(0, 0, W, H);
  if (!clockLayer) { clockLayer = document.createElement('canvas'); clockLayer.width = W; clockLayer.height = H; }
  const g = clockLayer.getContext('2d');
  g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
  g.fillStyle = ground; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-in';
  g.save(); g.translate(W * 0.5, H * 0.4); g.scale(W * 0.58, H * 0.34);
  const mk = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  mk.addColorStop(0, 'rgba(0,0,0,0)'); mk.addColorStop(0.55, 'rgba(0,0,0,0.35)'); mk.addColorStop(0.88, 'rgba(0,0,0,1)'); mk.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = mk; g.fillRect(-3, -3, 6, 6); g.restore();
  ctx.globalAlpha = master * 0.78; ctx.drawImage(clockLayer, 0, 0);
  ctx.globalAlpha = master * 0.45; ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = ground; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  // 하루 only: the sky itself moves. A sun crosses on an arc from 05 to 19, then a moon and stars.
  // 영샘 10-03 "하루는 단조롭다" — colour alone changed too slowly to be felt as a day passing.
  if (!night) {
    const hr = (minute / 60) % 24;
    if (hr >= 5 && hr < 19) {
      const p = (hr - 5) / 14, up = Math.sin(p * Math.PI);
      const sx = 120 + p * 840, sy = 560 - up * 380;
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = master * (0.18 + 0.32 * up);
      const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, 520);
      sun.addColorStop(0, p > 0.75 || p < 0.2 ? '#ffb070' : '#fff1cf'); sun.addColorStop(0.25, 'rgba(255,200,140,0.45)'); sun.addColorStop(1, 'rgba(255,200,140,0)');
      ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    } else {
      const night01 = hr >= 19 ? clamp((hr - 19) / 1.5) : clamp((5 - hr) / 1.5);
      const p = ((hr + 24 - 19) % 24) / 10, mx = 900 - p * 700, my = 300 + Math.abs(p - 0.5) * 160;
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = master * 0.28 * night01;
      const moon = ctx.createRadialGradient(mx, my, 0, mx, my, 300);
      moon.addColorStop(0, '#e6eeff'); moon.addColorStop(0.12, 'rgba(200,215,255,0.5)'); moon.addColorStop(1, 'rgba(200,215,255,0)');
      ctx.fillStyle = moon; ctx.fillRect(0, 0, W, H);
      const sec = f / 30;
      for (let i = 0; i < 70; i++) {
        const x = hash(i, 21) * W, y = hash(i, 22) * H * 0.48;
        const tw = 0.35 + 0.65 * Math.max(0, Math.sin(sec * (1.5 + hash(i, 23) * 3) + i * 1.7));
        const r = 3 + hash(i, 24) * 6;
        ctx.globalAlpha = master * night01 * tw * 0.9;
        ctx.drawImage(sprite('#eaf2ff'), x - r, y - r, r * 2, r * 2);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // the scrim flips end for end every shot, so nothing on screen is constant
  const flip = idx % 2 === 0;
  const sg = ctx.createLinearGradient(0, flip ? 0 : H, 0, flip ? H : 0);
  sg.addColorStop(0, 'rgba(0,0,0,0.10)'); sg.addColorStop(0.3, 'rgba(0,0,0,0)'); sg.addColorStop(0.46, 'rgba(0,0,0,0)');
  sg.addColorStop(1, `rgba(0,0,0,${0.52 + 0.16 * Math.sin(f / 37)})`);
  ctx.globalAlpha = master; ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);

  const line = [...phrases].reverse().find((p) => f >= p.start && f < p.end);
  if (!night) {
    // the clock. The original sank it into the bottom edge, but the Shorts feed lays its title and
    // channel over the bottom and its grid crops to 2:3 (safe y 170~1750) — 영샘 10-03 saw it cut.
    // It now stands whole, its foot at 1700.
    ctx.font = `380px ${F_DISPLAY}`; ctx.letterSpacing = '-14px'; ctx.textAlign = 'center';
    const clock = `${hh}:${mm}`;
    const clockTop = 1700 - ctx.measureText('00:00').actualBoundingBoxAscent;
    const y = 1700;
    ctx.globalAlpha = master * 0.9; ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = '#fff'; ctx.fillText(clock, W / 2, y);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = master; ctx.fillStyle = 'rgba(255,255,255,0.20)'; ctx.fillText(clock, W / 2, y);
    ctx.letterSpacing = '0px';
    // the user's own words, if any, sit above the clock in the lyric voice
    if (line) {
      const lo = out(Math.min(clamp((f - line.start) / 7), clamp((line.end - f) / 7)));
      const size = 62 * krScale(line.text);
      ctx.font = `${size}px ${F_LYRIC}`; ctx.textAlign = 'left';
      const lines = wrap(ctx, line.text.split(/\s+/).map((w) => ({ w })), W * 0.82, size * 0.28);
      ctx.globalAlpha = master * lo; ctx.fillStyle = LYRIC;
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 2;
      const top = clockTop - 56 - (lines.length - 1) * size * 1.2;
      lines.forEach((ln, li) => {
        let x = (W - ln.width) / 2;
        for (const w of ln.words) { ctx.fillText(w.w, x, top + li * size * 1.2 + (1 - lo) * 8); x += w.ww + size * 0.28; }
      });
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    }

    // the turns of the day: a flash of that hour's light, and its name in the title script
    for (const [hour, word, stamp] of DAY_TURNS) {
      const at = ((hour * 60 - startMinute) / spanMinutes) * N;
      const k = f - at;
      if (k < 0 || k > 60 || at > N - outroLen - 30) continue;   // no turn card under the closing card
      const flash = 0.55 * (1 - out(clamp(k / 14)));
      if (flash > 0.01) {
        ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = master * flash;
        const fg = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, H * 0.7);
        fg.addColorStop(0, '#fff6e2'); fg.addColorStop(0.5, skyAtMinute(hour * 60 + 30)); fg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
      }
      const a = out(clamp(k / 10)) * (1 - inOut(clamp((k - 44) / 16)));
      ctx.globalAlpha = master * a; ctx.textAlign = 'center'; ctx.letterSpacing = '0px';
      ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 4;
      // high in the frame: at 0.36 the word sat across her eyes
      ctx.save(); ctx.translate(W / 2, H * 0.22); const z = 0.94 + 0.06 * out(clamp(k / 18)); ctx.scale(z, z);
      ctx.font = `230px ${F_TITLE}`; ctx.fillStyle = '#fff8ec'; ctx.fillText(word, 0, 0);
      ctx.letterSpacing = '10px'; ctx.font = `30px ${F_SANS}`; ctx.fillStyle = 'rgba(255,240,215,0.9)';
      ctx.fillText(stamp, 0, 78);
      ctx.restore(); ctx.letterSpacing = '0px';
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    }
  } else {
    // header — says what this is the whole way through
    ctx.globalAlpha = master; ctx.textAlign = 'left'; ctx.letterSpacing = '2px';
    const bs = fit(ctx, d.brand, 46, F_DISPLAY, 560);
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#f6f2e8'; ctx.fillText(d.brand, 56, 96 + bs);
    ctx.fillStyle = '#ffc78a'; ctx.fillText('.', 56 + ctx.measureText(d.brand).width, 96 + bs);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.textAlign = 'right'; ctx.letterSpacing = '5px';
    fit(ctx, `${hh}:${mm}`, 24, F_SANS, 300);
    ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.fillText(`${hh}:${mm}`, W - 56, 96 + bs);

    // next scene in a small window
    if (idx + 1 < slots) {
      const bw = 214, bh = 300, bx = W - 56 - bw, by = H - 470 - bh + (1 - out(clamp(local / 14))) * 16;
      ctx.globalAlpha = master * 0.94;
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 44; ctx.shadowOffsetY = 14;
      ctx.fillStyle = '#000'; ctx.fillRect(bx, by, bw, bh);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
      drawCover(ctx, images[(idx + 1) % n], bx, by, bw, bh, 1, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx, by + bh - 30, bw, 30);
      ctx.textAlign = 'left'; ctx.letterSpacing = '3px'; ctx.font = `16px ${F_SANS}`;
      ctx.fillStyle = '#ffc78a'; ctx.fillText('NEXT', bx + 10, by + bh - 9);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.82)'; ctx.lineWidth = 3; ctx.strokeRect(bx + 1.5, by + 1.5, bw - 3, bh - 3);
    }

    // scene count
    ctx.globalAlpha = master; ctx.textAlign = 'left'; ctx.letterSpacing = '0px';
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 4;
    ctx.font = `90px ${F_DISPLAY}`; ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const num = String(idx + 1).padStart(2, '0');
    ctx.fillText(num, 56, H - 476);
    const nw = ctx.measureText(num).width;
    ctx.font = `30px ${F_DISPLAY}`; ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('/' + String(slots).padStart(2, '0'), 56 + nw + 4, H - 476);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // a line down the left edge fills as the night goes
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(30, 200, 3, H - 400);
    ctx.fillStyle = '#ffc78a'; ctx.fillRect(30, 200, 3, (H - 400) * t);

    // the lyric takes the clock's place; each word rises as it is sung
    if (line) {
      const lo = out(Math.min(clamp((f - line.start) / 8), clamp((line.end - f) / 8)));
      let size = 84 * krScale(line.text);
      ctx.letterSpacing = krScale(line.text) === 1 ? '4px' : '1px'; ctx.textAlign = 'left';
      const words = (line.words?.length ? line.words : line.text.split(/\s+/).map((w, i) => ({ t: line.start + i * 6, w })))
        .map((w) => ({ ...w, w: w.w.toUpperCase() }));
      // two lines at most: a third climbs into the scene count and the next-scene window
      let lines;
      for (;;) {
        ctx.font = `${size}px ${F_CAPS}`;
        lines = wrap(ctx, words, W - 120, size * 0.28);
        if (lines.length <= 2 || size < 48) break;
        size *= 0.9;
      }
      if (lines.length > 1 && lines[lines.length - 1].words.length === 1) {   // no word alone on the last line
        const total = lines.reduce((s, l) => s + l.width, 0) + size * 0.28 * (lines.length - 1);
        for (const k of [1.0, 1.08, 1.16, 1.24]) {
          const even = wrap(ctx, words, total / lines.length * k, size * 0.28);
          if (even.length === lines.length && even[even.length - 1].words.length > 1) { lines = even; break; }
        }
      }
      const lh = size * 1.06, bottom = H - 250;
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 6;
      lines.forEach((ln, li) => {
        let x = (W - ln.width) / 2;
        const y = bottom - (lines.length - 1 - li) * lh;
        for (const w of ln.words) {
          const k = out(clamp((f - w.t) / 10));
          ctx.globalAlpha = master * k * lo; ctx.fillStyle = LYRIC;
          ctx.save(); ctx.translate(x + w.ww / 2, y + (1 - k) * 34); ctx.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
          ctx.fillText(w.w, -w.ww / 2, 0); ctx.restore();
          x += w.ww + size * 0.28;
        }
      });
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    }
  }

  // how far through the day we are. 영샘 10-03: the 6px line on the very top edge went unseen —
  // it now runs inset on a faint track, thicker, with a glowing head and the day's turns marked.
  {
    // y 190: inside the safe area, below the player's own top icons
    const x0 = 56, x1 = W - 56, y = night ? 58 : 190, th = 9, x = x0 + (x1 - x0) * t;
    ctx.globalAlpha = master * 0.9;
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x0, y, x1 - x0, th);
    if (!night) for (const [hour] of DAY_TURNS) {
      const tx = x0 + (x1 - x0) * clamp((hour * 60 - startMinute) / spanMinutes);
      ctx.fillStyle = tx <= x ? 'rgba(255,241,207,0.95)' : 'rgba(255,255,255,0.45)'; ctx.fillRect(tx - 2, y - 7, 4, th + 14);
    }
    ctx.shadowColor = 'rgba(255,214,150,0.9)'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#fff1cf'; ctx.fillRect(x0, y, x - x0, th);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.globalAlpha = master; ctx.drawImage(sprite('#fff1cf'), x - 22, y + th / 2 - 22, 44, 44);
  }

  // close: title card over a dark veil
  if (outro > 0) {
    ctx.globalAlpha = master * outro;
    ctx.fillStyle = 'rgba(6,7,12,0.78)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.letterSpacing = '1px';
    const ts = fit(ctx, d.title, 106, F_DISPLAY, W - 120);
    ctx.fillStyle = '#f1eade'; ctx.fillText(d.title, W / 2, 780 + ts * 0.9);
    ctx.letterSpacing = '7px'; fit(ctx, d.tag, 30, F_SANS, W - 144);
    ctx.fillStyle = '#b9f0d8'; ctx.fillText(d.tag, W / 2, 780 + ts * 0.9 + 26 + 30);
    ctx.letterSpacing = '4px'; fit(ctx, d.footR, 26, F_SANS, W - 144);
    ctx.fillStyle = '#8f97a6'; ctx.fillText(d.footR, W / 2, 780 + ts * 0.9 + 26 + 30 + 54 + 26);
    ctx.letterSpacing = '0px';
  }

  // grain 0.07
  ctx.globalAlpha = 0.07; ctx.globalCompositeOperation = 'overlay';
  const shift = (f % 7) * 13;
  ctx.save(); ctx.translate(shift, -shift); ctx.fillStyle = grainPattern(ctx); ctx.fillRect(-shift, shift, W, H); ctx.restore();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}

const clockface = (id, name, sub, v) => ({
  id, name, sub, draw: drawClockface,
  build: (base, beat) => ({
    ...base,
    phrases: v.night && !base.phrases.length ? titleAsLyrics(base, base.N ?? 960) : base.phrases,
    title: `${base.title1} ${base.title2}`.trim(),
    // on the beat, but never quicker than the approved cut: a whole day must not turn into flicker
    shot: (() => { const s = beatStep(beat, v.shot); return s < v.shot * 0.8 ? s * 2 : s; })(), startMinute: v.startMinute, spanMinutes: v.spanMinutes, night: v.night,
  }),
});

// =====================================================================================
// LYRIC BLOOM — EP05 Nobody's Waiting (09-09 승인).
// The lyric IS the picture. Every line lands in its own corner as a stack of words that slam
// in with an overshoot; the last of them is huge and cut out of the photograph; a coloured bar
// wipes the screen as each line arrives. (v1 was "just an image with BGM" — dim photo, quiet type.)
// In the app the words are the ones the user tapped in, so this is the look where their own
// lyric or 한마디 is the star.
// =====================================================================================
const BLOOM_GROUNDS = ['#0d1230', '#7a1338', '#0f2a1c', '#2a1348', '#0b1c2e', '#3a1410'];
const BLOOM_ACCENTS = ['#b9f0d8', '#ffd58a', '#8fb3ff', '#ff7ad9', '#b9f0d8', '#ffd58a'];
// v = where the stack sits top-to-bottom, h = which side it hugs; pads keep it inside the
// Shorts safe area (y 170~1750)
const BLOOM_PLACE = [
  { v: 'bottom', h: 'left', pad: 260 }, { v: 'top', h: 'right', pad: 230 }, { v: 'center', h: 'center', pad: 0 },
  { v: 'bottom', h: 'right', pad: 280 }, { v: 'top', h: 'left', pad: 240 }, { v: 'bottom', h: 'center', pad: 270 },
];
const F_BLOOM = `"HHDisplay","Gaegu","HHKrSans",${KR},sans-serif`;
let bloomLayer = null;
// Hangul lines (영샘 10-04 picked B over A): gold last word, bigger pieces, a shade under the stack
const HANGUL = /[가-힣]/;

function bloomChunks(p) {
  const words = p.words?.length ? p.words : p.text.split(/\s+/).map((w, i) => ({ t: p.start + i * 8, w }));
  if (words.length <= 4) return words.map((w) => ({ t: w.t, w: w.w }));
  // four stacked pieces at most, the original's shape: three that set it up, one that lands
  const out = [], per = Math.ceil((words.length - 1) / 3);
  for (let i = 0; i < words.length - 1; i += per) {
    const g = words.slice(i, Math.min(i + per, words.length - 1));
    out.push({ t: g[0].t, w: g.map((x) => x.w).join(' ') });
  }
  out.push({ t: words[words.length - 1].t, w: words[words.length - 1].w });
  return out;
}

// no words from the user: the song's own name, said four ways, so the look still has a voice
function bloomFallback(base, until) {
  const say = [base.title1, base.title2, `${base.title1} ${base.title2}`, base.brand].filter((s) => s && s.trim());
  const step = Math.floor((until - 20) / say.length);
  return say.map((text, i) => {
    const start = 20 + i * step, words = text.split(/\s+/);
    return { start, end: start + step, text, words: words.map((w, k) => ({ t: start + 6 + k * 9, w })) };
  });
}

function drawLyricBloom(ctx, f, N, d) {
  const { images, lines, outroLen } = d;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.letterSpacing = '0px'; ctx.textBaseline = 'alphabetic';

  let idx = 0;
  for (let i = 0; i < lines.length; i++) if (f >= lines[i].from) idx = i;
  const line = lines[idx];
  const ground = BLOOM_GROUNDS[idx % BLOOM_GROUNDS.length], accent = BLOOM_ACCENTS[idx % BLOOM_ACCENTS.length];
  const place = BLOOM_PLACE[idx % BLOOM_PLACE.length];
  let since = f - line.from;
  const master = out(clamp(f / 10)) * (1 - inOut(clamp((f - (N - 18)) / 18)));
  const outro = clamp((f - (N - outroLen)) / (outroLen * 0.4));
  ctx.fillStyle = ground; ctx.fillRect(0, 0, W, H);

  // a line that holds long (an intro, a slow verse) cuts to a new photo on the bar once its
  // words have all landed, with its own smaller wipe — a held frame is what made the open flat
  const settle = line.chunks[line.chunks.length - 1].t - line.from + 18;
  let sub = 0, wipeK = 0.9;
  if (since > settle + d.period * 0.5) {
    sub = Math.floor((since - settle) / d.period);
    if (sub > 0) { since = (since - settle) % d.period; wipeK = 0.5; }
  }

  // the photograph: bright, full frame, slowly pushing in
  const src = images[(idx + sub) % images.length];
  const img = src.live ? src : gradedImage(src, 'brightness(1.10) contrast(1.06)');
  const push = 1.04 + 0.10 * out(clamp(since / 70)), drift = Math.sin(f / 52) * 10;
  const s = Math.max(W / img.width, H / img.height) * push, dw = img.width * s, dh = img.height * s;
  ctx.globalAlpha = master;
  if (src.live) ctx.filter = 'brightness(1.10) contrast(1.06)';
  ctx.drawImage(img, (W - dw) / 2, (H - dh) * 0.38 + drift, dw, dh);
  ctx.filter = 'none';
  // only enough of the line's colour to bind the frame — never enough to hide the picture
  ctx.globalCompositeOperation = 'color'; ctx.globalAlpha = master * 0.42;
  ctx.fillStyle = ground; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = master;
  const dark = ctx.createLinearGradient(idx % 2 ? W : 0, 0, idx % 2 ? 0 : W, H * 0.5);
  dark.addColorStop(0, 'rgba(0,0,0,0.46)'); dark.addColorStop(0.46, 'rgba(0,0,0,0)');
  ctx.fillStyle = dark; ctx.fillRect(0, 0, W, H);

  // the bar that wipes the screen as the line arrives
  const wipe = clamp(since / 9), wa = wipeK * (1 - clamp((since - 4) / 8));
  if (wa > 0.01 && wipe > 0) {
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = master * wa; ctx.fillStyle = accent;
    const h = H * wipe;
    ctx.fillRect(0, idx % 2 === 0 ? 0 : H - h, W, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  // the words, stacked in this line's corner
  const shown = line.chunks.map((c, i) => ({ ...c, i, key: i === line.chunks.length - 1 })).filter((c) => f >= c.t);
  if (shown.length && outro < 1) {
    const maxW = W - 84;
    // the original's 118/205px filled the frame only because its lines were long; a user's
    // two-word line sat small in a corner. The whole line now grows until its widest piece nearly
    // spans the frame (up to 2.6x), every piece keeping its proportion to the others.
    // 영샘 10-04: the title/brand cards speak in the Her Hours title script (Pinyon, Title Case —
    // script in capitals falls apart); the sung lines keep the condensed capitals.
    const intro = !!line.intro;
    const FONT = intro ? F_TITLE : F_BLOOM, SX = intro ? 1 : 0.84, LS = intro ? '0px' : '-5px', LH = intro ? 1.0 : 0.9;
    ctx.letterSpacing = LS;
    const meas = (text, size) => { ctx.font = `${size}px ${FONT}`; return ctx.measureText(text).width * SX; };
    const all = line.chunks.map((c, i) => {
      const text = intro ? titleCase(c.w, true) : c.w.toUpperCase();
      // a Hangul piece is one or two syllables where an English one is three words — at 118 it shrank to a speck
      const piece = HANGUL.test(text) ? 158 : 118;
      const base = (i === line.chunks.length - 1 ? 205 : piece) * krScale(text);
      return { text, base, w: meas(text, base) };
    });
    let grow = Math.max(1, Math.min(2.6, (maxW * 0.92) / Math.max(...all.map((a) => a.w))));
    const tall = all.reduce((s, a) => s + a.base * LH, 0) * grow;
    if (tall > H * 0.6) grow *= (H * 0.6) / tall;   // the stack stays inside the safe area
    grow *= 0.5;   // 영샘 10-04: half the full-frame size reads better — big, but the picture breathes
    for (const c of shown) {
      const a = all[c.i];
      let size = a.base * grow;
      const w0 = a.w * grow;
      if (w0 > maxW) size *= maxW / w0;
      c.size = size; c.text = a.text; c.w0 = meas(a.text, size);
    }
    const total = shown.reduce((a, c) => a + c.size * LH, 0);
    let y = place.v === 'top' ? place.pad : place.v === 'bottom' ? H - place.pad - total : (H - total) / 2;
    if (!intro) {
      // pale words on a bright photo (snow, sky) lost their edges; a soft shade under the stack keeps them
      const wMax = Math.max(...shown.map((c) => c.w0));
      const cx = place.h === 'left' ? 42 + wMax / 2 : place.h === 'right' ? W - 42 - wMax / 2 : W / 2, cy = y + total / 2;
      const r = Math.max(wMax, total) * 0.75;
      const bed = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
      bed.addColorStop(0, 'rgba(0,0,0,0.42)'); bed.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.globalAlpha = master * (1 - outro); ctx.fillStyle = bed;
      ctx.translate(cx, cy); ctx.scale(Math.max(1, wMax / total) * 0.9, 1); ctx.translate(-cx, -cy);
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2); ctx.restore();
    }
    for (const c of shown) {
      const e = clamp((f - c.t) / 11), k = back(e);
      const x = place.h === 'left' ? 42 : place.h === 'right' ? W - 42 - c.w0 : (W - c.w0) / 2;
      const ox = place.h === 'right' ? x + c.w0 : x;   // grow from the side it hugs
      const base = y + c.size * 0.78;
      ctx.save();
      ctx.globalAlpha = master * e * (1 - outro);
      ctx.translate(ox + (1 - e) * (c.i % 2 ? 60 : -60), base - c.size * 0.35);
      ctx.scale(0.86 + 0.14 * k, 0.86 + 0.14 * k); ctx.translate(-ox, -(base - c.size * 0.35));
      ctx.translate(x, base); ctx.scale(SX, 1);
      ctx.font = `${c.size}px ${FONT}`; ctx.letterSpacing = LS; ctx.textAlign = 'left';
      if (intro || (c.key && HANGUL.test(c.text))) {
        // script strokes are too thin to hold a photograph; the last word is lit in gold instead.
        // Gaegu's handwriting is just as thin, so a Hangul last word goes gold too.
        ctx.shadowColor = c.key ? accent : 'rgba(0,0,0,0.6)'; ctx.shadowBlur = c.key ? 30 : 40; ctx.shadowOffsetY = c.key ? 0 : 10;
        ctx.fillStyle = c.key ? LYRIC : '#fff8ec';
        ctx.fillText(c.text, 0, 0);
      } else if (c.key) {
        // the last word is cut out of the photograph, with a coloured edge
        ctx.lineJoin = 'round'; ctx.strokeStyle = accent; ctx.lineWidth = 8;
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 10;
        ctx.strokeText(c.text, 0, 0);
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        // wider than the frame: the word is drawn unsqueezed here and narrowed by 0.84 on the way in
        if (!bloomLayer) { bloomLayer = document.createElement('canvas'); bloomLayer.width = 1400; bloomLayer.height = 420; }
        const g = bloomLayer.getContext('2d');
        const lw = Math.min(1400, Math.ceil(c.w0 / 0.84) + 40);
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, 1400, 420);
        g.font = ctx.font; g.letterSpacing = '-5px'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
        g.fillText(c.text, 20, 330);
        g.globalCompositeOperation = 'source-in';
        const pic = src.live ? src : gradedImage(src, 'contrast(1.45) brightness(2.0) saturate(1.35)');
        if (src.live) g.filter = 'contrast(1.45) brightness(2.0) saturate(1.35)';
        const ps = Math.max(lw * 2.3 / pic.width, 420 / pic.height);
        g.drawImage(pic, (lw - pic.width * ps) / 2, (420 - pic.height * ps) * 0.34, pic.width * ps, pic.height * ps);
        g.filter = 'none';
        ctx.drawImage(bloomLayer, 0, 0, lw, 420, -20, -330, lw, 420);
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 10;
        ctx.fillStyle = c.i % 3 === 1 ? accent : LYRIC;
        ctx.fillText(c.text, 0, 0);
      }
      ctx.restore();
      y += c.size * LH;
    }
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.letterSpacing = '0px';
  }

  // close
  if (outro > 0) {
    ctx.globalAlpha = master * outro;
    ctx.fillStyle = 'rgba(8,8,14,0.82)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.letterSpacing = '0px';
    const ts = fit(ctx, d.title, 100, F_DISPLAY, W - 120);
    ctx.fillStyle = '#f1eade'; ctx.fillText(d.title, W / 2, 800 + ts * 0.9);
    ctx.letterSpacing = '7px'; fit(ctx, d.tag, 29, F_SANS, W - 144);
    ctx.fillStyle = '#b9f0d8'; ctx.fillText(d.tag, W / 2, 800 + ts * 0.9 + 24 + 29);
    ctx.letterSpacing = '4px'; fit(ctx, d.footR, 25, F_SANS, W - 144);
    ctx.fillStyle = '#8f97a6'; ctx.fillText(d.footR, W / 2, 800 + ts * 0.9 + 24 + 29 + 50 + 25);
    ctx.letterSpacing = '0px';
  }

  // grain 0.07
  ctx.globalAlpha = 0.07; ctx.globalCompositeOperation = 'overlay';
  const shift = (f % 7) * 13;
  ctx.save(); ctx.translate(shift, -shift); ctx.fillStyle = grainPattern(ctx); ctx.fillRect(-shift, shift, W, H); ctx.restore();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}

// =====================================================================================
// registry. `build` turns the shared inputs into what that look's draw() reads.
// Colours are fixed per look on purpose (영샘 09-13): presets, not a colour picker.
// =====================================================================================
// =====================================================================================
// HALLOWEEN — the October 2026 shorts (10-13 합격, halloween2026\shorts\hw_short2.py · Violet).
// A gothic arch window over a blurred, darkened copy of the same photo; the glow round the arch
// breathes with the bass and swaps candle-orange / the song's colour on each cut; ghost dust and
// embers rise, bats cross. Below: the mirrored pulse and a brass name plate. The lyric lives
// inside the arch and changes its manner every line (ghost · flicker · big · ghost · fairy).
// Opens on the whole photo with the HALLOWEEN SPECIAL sign, then folds into the window.
// =====================================================================================
const HW_CARD = { x: 120, y: 300, w: 840, h: 960 };
const HW_PLATE = { x0: 110, y0: 1380, x1: 970, y1: 1595 };
const HW_PULSE_Y = 1320;
const HW_KINDS = ['ghost', 'flicker', 'big', 'ghost', 'fairy'];
const HW_LYRIC_Y = [0.80, 0.71, 0.84, 0.75, 0.80];
const HW_MOVES = ['drift', 'push', 'pull', 'slideL', 'slideR', 'drift', 'push'];

// the backdrop is the photo itself, blurred: drawn tiny and stretched, so a phone never runs a blur filter
const hwSmall = new WeakMap();
function hwBackdrop(img) {
  if (img.live) return img;
  let c = hwSmall.get(img);
  if (!c) {
    c = document.createElement('canvas'); c.width = 54; c.height = 96;
    const g = c.getContext('2d');
    const iw = img.width, ih = img.height, s = Math.max(54 / iw, 96 / ih);
    g.drawImage(img, (54 - iw * s) / 2, (96 - ih * s) / 2, iw * s, ih * s);
    hwSmall.set(img, c);
  }
  return c;
}

function archPath(ctx, x, y, w, h) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, 0);
  ctx.lineTo(x + w, y + h); ctx.closePath();
}

function hwMove(m, u) {
  const e = inOut(u);
  switch (m) {
    case 'push': return { z: 1.0 + 0.12 * e, px: 0, py: 0 };
    case 'pull': return { z: 1.14 - 0.12 * e, px: 0, py: 0 };
    case 'slideL': return { z: 1.1, px: 0.04 - 0.08 * e, py: 0 };
    case 'slideR': return { z: 1.1, px: -0.04 + 0.08 * e, py: 0 };
    default: return { z: 1.1 + 0.03 * Math.sin(u * Math.PI), px: -0.03 + 0.06 * u, py: -0.02 + 0.04 * u };   // ghostly drift
  }
}

function hwPhoto(ctx, img, x, y, w, h, mv) {
  const iw = img.videoWidth || img.width, ih = img.videoHeight || img.height;
  const s = Math.max(w / iw, h / ih) * mv.z, dw = iw * s, dh = ih * s;
  const fy = ih > iw * 1.1 ? 0.3 : 0.45;   // faces sit high in a portrait
  ctx.drawImage(img, x + (w - dw) / 2 + mv.px * w, y + (h - dh) * fy + mv.py * h, dw, dh);
}

function hwBat(ctx, x, y, s, flap, color) {
  const up = Math.sin(flap) * 0.9;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (const dir of [1, -1]) {
    ctx.moveTo(0, -4);
    ctx.quadraticCurveTo(dir * 18, -10 - 26 * up, dir * 46, -8 - 30 * up);
    ctx.quadraticCurveTo(dir * 40, 2 - 12 * up, dir * 34, 6 - 6 * up);
    ctx.quadraticCurveTo(dir * 26, 2, dir * 20, 10);
    ctx.quadraticCurveTo(dir * 12, 4, 0, 10);
  }
  ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 2, 7, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-6, -7); ctx.lineTo(-4, -16); ctx.lineTo(-1, -8); ctx.moveTo(6, -7); ctx.lineTo(4, -16); ctx.lineTo(1, -8); ctx.fill();
  ctx.restore();
}

// the word the line leans on: the longest one (ties: the later)
const hwEmph = (words) => words.reduce((b, w, i) => (w.w.replace(/\W/g, '').length >= words[b].w.replace(/\W/g, '').length ? i : b), 0);

function hwLyric(ctx, f, line, k, d) {
  const { c1, c2 } = d;
  const kind = HW_KINDS[k % HW_KINDS.length];
  const words = (line.words ?? [{ t: line.start, w: line.text }]).map((w) => ({ ...w }));
  const em = hwEmph(words);
  const kr = krScale(line.text);
  const base = (kind === 'fairy' ? 74 : kind === 'big' ? 52 : 60) * kr;
  const fade = clamp((line.end - f) / 6);
  const age = f - line.start;
  const y0 = HW_CARD.y + HW_CARD.h * HW_LYRIC_Y[k % HW_LYRIC_Y.length];
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.letterSpacing = '0px';
  const sizeOf = (i) => (kind === 'big' && i === em ? base * 2.0 : base);
  const fontOf = (i) => `${sizeOf(i)}px ${F_LYRIC}`;
  for (const [i, w] of words.entries()) { ctx.font = fontOf(i); w.ww = ctx.measureText(w.w).width; }
  // wrap by measured widths, no word alone on the last line
  const gap = base * 0.3, maxW = HW_CARD.w - 110;
  const rows = []; let row = [], rw = 0;
  for (const [i, w] of words.entries()) {
    if (row.length && rw + gap + w.ww > maxW) { rows.push({ items: row, width: rw }); row = []; rw = 0; }
    rw += (row.length ? gap : 0) + w.ww; row.push(i);
  }
  if (row.length) rows.push({ items: row, width: rw });
  const lh = base * 1.22;
  const top = y0 - (rows.length - 1) * lh / 2 - (kind === 'ghost' ? (1 - out(clamp(age / 21))) * -40 : 0);
  // a soft dark pad under the words: a white dress or a bright sky must not swallow the line (10-14)
  {
    const padW = Math.max(...rows.map((r) => r.width)) + base * 1.6, padH = rows.length * lh + base * 1.1;
    const cy = top + (rows.length - 1) * lh / 2 - base * 0.3;
    ctx.save(); ctx.translate(W / 2, cy); ctx.scale(padW / 2, padH / 2);
    const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    pg.addColorStop(0, `rgba(6,3,10,${0.72 * fade})`); pg.addColorStop(0.6, `rgba(6,3,10,${0.5 * fade})`); pg.addColorStop(1, 'rgba(6,3,10,0)');
    ctx.fillStyle = pg; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
  }
  ctx.shadowColor = 'rgba(8,4,12,0.95)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 2;
  rows.forEach((r, ri) => {
    let x = W / 2 - r.width / 2;
    const y = top + ri * lh;
    for (const i of r.items) {
      const w = words[i];
      const on = f - w.t;
      let a = fade, col = i === em ? c1 : '#F2F2F2', sc = 1;
      if (kind === 'ghost') { a *= out(clamp(age / 18)); col = i === em ? c1 : '#EEE6FA'; }
      else if (kind === 'flicker') { a *= on < 0 ? 0 : on < 2 ? 0.9 : on < 4 ? 0.35 : 1; col = i === em ? c1 : '#FFE2B8'; }
      else if (kind === 'big') { a *= out(clamp(age / 5)); if (i === em) sc = 1 + 0.15 * (1 - out(clamp(age / 8))); }
      else { a *= out(clamp(age / 7)); sc = 0.88 + 0.12 * out(clamp(age / 13)); col = i === em ? c1 : '#FFE9A8'; }   // fairy
      if (a > 0.01) {
        ctx.globalAlpha = a; ctx.font = fontOf(i); ctx.fillStyle = col;
        if (sc !== 1) {
          ctx.save(); ctx.translate(x + w.ww / 2, y); ctx.scale(sc, sc); ctx.fillText(w.w, -w.ww / 2, 0); ctx.restore();
        } else ctx.fillText(w.w, x, y);
      }
      x += w.ww + gap;
    }
  });
  ctx.globalAlpha = 1; ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
}

function drawHalloween(ctx, f, N, d) {
  const { images, phrases, c1, c2, frame, step, spec, bands, intro, fold, outro } = d;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.letterSpacing = '0px'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#07050a'; ctx.fillRect(0, 0, W, H);

  const band = (i) => (spec ? spec[Math.min(f, spec.length / bands - 1) * bands + i] || 0 : 0);
  let drive = 0; for (let i = 0; i < 6; i++) drive += band(i); drive /= 6;
  if (!spec) drive = 0.04 + 0.03 * Math.sin(f * 0.21);

  // which photo: the first holds the opening, then one per step
  const cutAt = (j) => fold + (j - 1) * step;   // j >= 1
  const k = f < fold ? 0 : 1 + Math.floor((f - fold) / step);
  const img = images[k % images.length];
  const u = f < fold ? f / fold : ((f - fold) % step) / step;
  const mv = hwMove(HW_MOVES[k % HW_MOVES.length], u);
  const tint = k % 2 === 0 ? c1 : c2;

  // ---- the card scene (also what the opening folds into)
  const scene = () => {
    // blurred backdrop + a violet-black veil
    ctx.globalAlpha = 1;
    ctx.imageSmoothingQuality = 'high';
    const bd = hwBackdrop(img);
    if (bd === img) { ctx.filter = 'blur(28px)'; hwPhoto(ctx, img, -60, -60, W + 120, H + 120, { z: 1.2, px: 0, py: 0 }); ctx.filter = 'none'; }
    else ctx.drawImage(bd, -W, -H, W * 3, H * 3);   // wide, so the fold's zoom never shows an edge
    ctx.fillStyle = 'rgba(14,8,20,0.58)'; ctx.fillRect(0, 0, W, H);

    // dust and embers drifting up
    for (let i = 0; i < 56; i++) {
      const spark = i % 4 === 0;
      const v = spark ? 1.6 + hash(i, 3) * 1.6 : 0.6 + hash(i, 4) * 1.4;
      const y = ((hash(i, 1) * (H + 40) - v * f) % (H + 40) + H + 40) % (H + 40) - 20;
      const x = (hash(i, 2) * W + 30 * Math.sin(f / 60 + hash(i, 5) * 6.3) + W) % W;
      const s = spark ? 18 : 10 + hash(i, 6) * 16;
      ctx.globalAlpha = spark ? 0.85 : 0.22;
      ctx.drawImage(sprite(spark ? c1 : '#cfe9ff'), x - s / 2, y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    // the glow round the window, breathing with the bass
    const glow = Math.min(1, 0.55 + drive * 9);
    ctx.save();
    archPath(ctx, HW_CARD.x, HW_CARD.y, HW_CARD.w, HW_CARD.h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = tint; ctx.shadowBlur = 80 * glow;
    ctx.strokeStyle = tint; ctx.globalAlpha = 0.9 * glow; ctx.lineWidth = 22; ctx.stroke(); ctx.stroke();
    ctx.restore();

    // the photo inside the arch; a cut dips like a candle going out and back
    ctx.save();
    archPath(ctx, HW_CARD.x, HW_CARD.y, HW_CARD.w, HW_CARD.h); ctx.clip();
    hwPhoto(ctx, img, HW_CARD.x, HW_CARD.y, HW_CARD.w, HW_CARD.h, mv);
    let dip = 0;
    for (let j = 1; j <= k + 1; j++) {
      const dt = f - cutAt(j);
      if (dt > -8 && dt < 8) dip = Math.max(dip, Math.sin(((dt + 8) / 16) * Math.PI) * (0.88 + 0.12 * Math.sin(dt * 2.3)));
    }
    if (dip > 0) { ctx.fillStyle = `rgba(6,4,8,${dip})`; ctx.fillRect(HW_CARD.x, HW_CARD.y, HW_CARD.w, HW_CARD.h); }
    // thin window bars — faint, a thick one cuts the face
    ctx.globalAlpha = 0.32; ctx.strokeStyle = '#1a140f'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(HW_CARD.x + HW_CARD.w / 2, HW_CARD.y); ctx.lineTo(HW_CARD.x + HW_CARD.w / 2, HW_CARD.y + HW_CARD.h);
    ctx.moveTo(HW_CARD.x, HW_CARD.y + HW_CARD.h * 0.55); ctx.lineTo(HW_CARD.x + HW_CARD.w, HW_CARD.y + HW_CARD.h * 0.55);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // the lower part darkens so the lyric reads
    const lg = ctx.createLinearGradient(0, HW_CARD.y + HW_CARD.h * 0.45, 0, HW_CARD.y + HW_CARD.h);
    lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(6,3,10,0.74)');
    ctx.fillStyle = lg; ctx.fillRect(HW_CARD.x, HW_CARD.y, HW_CARD.w, HW_CARD.h);
    ctx.restore();
    archPath(ctx, HW_CARD.x - 7, HW_CARD.y - 7, HW_CARD.w + 14, HW_CARD.h + 14);
    ctx.strokeStyle = frame; ctx.lineWidth = 12; ctx.stroke();
    archPath(ctx, HW_CARD.x - 7, HW_CARD.y - 7, HW_CARD.w + 14, HW_CARD.h + 14);
    ctx.strokeStyle = 'rgba(255,240,210,0.35)'; ctx.lineWidth = 2; ctx.stroke();

    // the mirrored pulse
    const nb = 56;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineWidth = 7;
    for (let i = 0; i < nb; i++) {
      const bi = Math.round(((i < nb / 2 ? nb / 2 - 1 - i : i - nb / 2) / (nb / 2)) * (bands * 0.6));
      const v = spec ? band(bi) : 0.03 + 0.03 * Math.abs(Math.sin(f * 0.13 + i));
      const taper = 1 - 0.65 * Math.abs(i - (nb - 1) / 2) / (nb / 2);   // tall in the middle, like the approved shorts
      const hgt = 4 + Math.min(46, v * 300) * taper;
      const x = 150 + (i / (nb - 1)) * 780;
      ctx.globalAlpha = 0.45 + Math.min(0.5, v * 3);
      ctx.strokeStyle = i % 2 ? '#FFE2B0' : c1;
      ctx.beginPath(); ctx.moveTo(x, HW_PULSE_Y - hgt); ctx.lineTo(x, HW_PULSE_Y + hgt); ctx.stroke();
    }
    ctx.restore();

    // the brass plate: song name and who sings it
    const P = HW_PLATE;
    ctx.globalAlpha = 0.84; ctx.fillStyle = '#120f0d'; ctx.fillRect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0); ctx.globalAlpha = 1;
    ctx.strokeStyle = frame; ctx.lineWidth = 3; ctx.strokeRect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0);
    ctx.strokeStyle = 'rgba(201,161,90,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(P.x0 + 14, P.y0 + 14, P.x1 - P.x0 - 28, P.y1 - P.y0 - 28);
    for (const [rx, ry] of [[P.x0 + 26, P.y0 + 26], [P.x1 - 26, P.y0 + 26], [P.x0 + 26, P.y1 - 26], [P.x1 - 26, P.y1 - 26]]) {
      ctx.fillStyle = frame; ctx.beginPath(); ctx.arc(rx, ry, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff2cc'; ctx.beginPath(); ctx.arc(rx - 2, ry - 2, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.letterSpacing = '3px'; fit(ctx, d.title, 50, F_SERIF, P.x1 - P.x0 - 120);
    ctx.fillStyle = '#FFE2B0'; ctx.fillText(d.title, W / 2, P.y0 + 98);
    ctx.letterSpacing = '1px'; fit(ctx, d.role, 36, F_LYRIC, P.x1 - P.x0 - 140);
    ctx.fillStyle = 'rgba(255,255,255,0.86)'; ctx.fillText(d.role, W / 2, P.y0 + 160);
    ctx.letterSpacing = '0px'; ctx.textAlign = 'left';

    // the sign above the window
    ctx.textAlign = 'center'; ctx.letterSpacing = '6px';
    fit(ctx, d.sign, 34, F_SANS, 720);
    ctx.shadowColor = c1; ctx.shadowBlur = 16; ctx.fillStyle = '#ffffff'; ctx.fillText(d.sign, 470, 200);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
  };

  // ---- opening: the whole photo, the sign drops in and flickers
  const opening = () => {
    hwPhoto(ctx, images[0], 0, 0, W, H, { z: 1.0 + 0.06 * (f / fold), px: 0, py: 0 });
    const g = ctx.createLinearGradient(0, H * 0.45, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(8,4,12,0.82)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const by = 1250, drop = out(clamp((f - 8) / 10));
    ctx.textAlign = 'center';
    ctx.globalAlpha = out(clamp((f - 4) / 9)); ctx.letterSpacing = '12px'; ctx.font = `36px ${F_SANS}`;
    ctx.fillStyle = '#ffffff'; ctx.fillText(d.brand, W / 2, by - 128);
    const flick = f < 18 ? 0 : f < 20 ? 1 : f < 22 ? 0.25 : f < 24 ? 1 : f < 27 ? 0.45 : 1;
    ctx.globalAlpha = drop * flick; ctx.letterSpacing = '4px';
    const s = 1 + 0.25 * (1 - drop);
    ctx.save(); ctx.translate(W / 2, by - 140 * (1 - drop)); ctx.scale(s, s);
    fit(ctx, 'HALLOWEEN SPECIAL', 104, F_DISPLAY, 940);
    ctx.shadowColor = c1; ctx.shadowBlur = 44; ctx.fillStyle = c1; ctx.fillText('HALLOWEEN SPECIAL', 0, 0);
    ctx.shadowBlur = 12; ctx.fillStyle = '#FFE9C8'; ctx.fillText('HALLOWEEN SPECIAL', 0, 0);
    ctx.restore();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.globalAlpha = out(clamp((f - 26) / 10)); ctx.letterSpacing = '1px';
    fit(ctx, d.promise, 58, F_LYRIC, 900);
    ctx.fillStyle = '#F2E8FF'; ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 16;
    ctx.fillText(d.promise, W / 2, by + 100);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
  };

  if (f < intro) opening();
  else if (f < fold) {
    // fold: the card arrives from close up, with a flash of candlelight
    const a = inOut((f - intro) / (fold - intro)), z = 1.9 - 0.9 * a;
    const bd0 = hwBackdrop(img); if (bd0 !== img) ctx.drawImage(bd0, -40, -40, W + 80, H + 80);
    const fx = HW_CARD.x + HW_CARD.w / 2, fy = HW_CARD.y + HW_CARD.h * 0.3;
    ctx.save(); ctx.translate(fx, fy + (H / 2 - fy) * a); ctx.scale(z, z); ctx.translate(-fx, -fy);
    scene(); ctx.restore();
    const b = Math.sin(clamp((f - intro) / 8) * Math.PI) * 0.5;
    if (b > 0) { ctx.globalAlpha = b; ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  } else scene();

  // bats cross the top now and then
  for (let i = 0; i < 3; i++) {
    const per = 170 + i * 37, t0 = ((f + i * 61) % per) / per;
    if (t0 > 0.55) continue;
    const p = t0 / 0.55, dir = i % 2 ? -1 : 1;
    const x = dir > 0 ? -80 + p * (W + 160) : W + 80 - p * (W + 160);
    const y = 230 + i * 120 + Math.sin(p * Math.PI * 2 + i) * 40 - p * 60;
    hwBat(ctx, x, y, 1.1 + 0.3 * i, f * 0.55 + i, 'rgba(10,6,14,0.92)');
  }

  // the lyric, inside the arch
  if (f >= fold - 6 && f < N - outro) {
    const idx = phrases.findIndex((p) => f >= p.start && f < p.end);
    if (idx >= 0) hwLyric(ctx, f, phrases[idx], idx, d);
  }

  // the ending card
  if (f >= N - outro) {
    const a = clamp((f - (N - outro)) / 16);
    ctx.globalAlpha = 0.74 * a; ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    const pop = (t) => 1 + 0.28 * (1 - out(clamp(t / 8)));
    const e0 = f - (N - outro) - 6, e1 = e0 - 14;
    ctx.textAlign = 'center';
    if (e0 >= 0) {
      ctx.save(); ctx.translate(W / 2, 780); ctx.scale(pop(e0), pop(e0));
      fit(ctx, d.end1, 116, F_LYRIC, 960);
      ctx.shadowColor = c2; ctx.shadowBlur = 30; ctx.fillStyle = '#FFD58A'; ctx.fillText(d.end1, 0, 0);
      ctx.restore();
    }
    if (e1 >= 0) {
      ctx.save(); ctx.translate(W / 2, 960); ctx.scale(pop(e1), pop(e1));
      ctx.letterSpacing = '6px'; fit(ctx, d.end2, 92, F_DISPLAY, 900);
      ctx.shadowColor = c1; ctx.shadowBlur = 36; ctx.fillStyle = '#FFE9C8'; ctx.fillText(d.end2, 0, 0);
      ctx.restore();
    }
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
  }

  // grain
  ctx.globalAlpha = 0.06; ctx.globalCompositeOperation = 'overlay';
  const shift = (f % 7) * 13;
  ctx.save(); ctx.translate(shift, -shift); ctx.fillStyle = grainPattern(ctx); ctx.fillRect(-shift, shift, W, H); ctx.restore();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}

export const LOOKS = [
  {
    id: 'halloween', name: 'Halloween', sub: T('아치 창문 · 박쥐와 불티 · 줄마다 다른 가사', 'a gothic arch window · bats and embers · every line sung differently'),
    draw: drawHalloween,
    build: (base, beat) => {
      const N = base.N ?? 960;
      const name = base.singer || '';   // only our character songs name a singer
      const title = `${base.title1} ${base.title2}`.trim();
      return {
        ...base,
        phrases: base.phrases.length ? base.phrases : titleAsLyrics(base, N),
        c1: '#FFB04A', c2: base.accent && base.accent.toUpperCase() !== '#FFB04A' ? base.accent : '#7FE0D8', frame: '#C9A15A',
        step: beatStep(beat, 90), spec: beat?.spec ?? null, bands: 128,
        intro: Math.min(66, Math.round(N * 0.08)), fold: Math.min(86, Math.round(N * 0.1)), outro: Math.min(66, Math.round(N * 0.08)),
        title: title.toUpperCase(),
        role: name ? `sung by ${name}` : base.brand,
        sign: name ? `HALLOWEEN SPECIAL  ·  ${name.toUpperCase()}` : 'HALLOWEEN SPECIAL',
        promise: title.toLowerCase(),
        end1: base.useOurs ? 'The full song —' : `♪ ${title}`,
        end2: base.useOurs ? `ON ${base.brand}` : base.footL.toUpperCase(),
      };
    },
  },
  {
    id: 'windowband', name: 'Window Band', sub: T('창문 띠 · 가사가 박자에 켜짐', 'window band · lyrics light on the beat'),
    draw: drawWindowBand,
    build: (base) => base,
  },
  {
    id: 'triptych', name: 'Triptych', sub: T('3단 컷 · 박자마다 따로 끊김 · 불티', 'three panels · each cuts on its own beat · embers'),
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
  blackCut('blackcut-room', T('Black Cut · 실내', 'Black Cut · Indoors'), T('검은 컷 · 화면 전체가 움직임 · 가사 아래', 'black cuts · the whole frame moves · lyrics below'), {
    accent: '#ffb063', grade: 'saturate(0.92) contrast(1.06) brightness(0.97)',
    motions: ['push', 'tilt', 'hold-snap', 'pull', 'rise', 'slideL'], lyricPos: 'lower', lyricWords: false, lyricFont: 'italic', lyricSize: 72,
  }),
  blackCut('blackcut-road', T('Black Cut · 길 위', 'Black Cut · On the Road'), T('검은 컷 · 낱말이 하나씩 · 가사 위', 'black cuts · one word at a time · lyrics above'), {
    accent: '#ffd58a', grade: 'saturate(1.02) contrast(1.05) brightness(1.02)',
    motions: ['slideR', 'rise', 'slideL', 'push', 'tilt', 'slideR', 'pull'], lyricPos: 'upper', lyricWords: true, lyricFont: 'caps', lyricSize: 50,
  }),
  {
    id: 'pulse', name: 'Pulse', sub: T('음악에 반응하는 링 · 4번 모양이 바뀜', 'a ring that moves with the music · changes shape 4 times'),
    draw: drawPulse,
    build: (base, beat) => ({
      ...base,
      phrases: base.phrases.length ? base.phrases : titleAsLyrics(base, base.N ?? 960),
      accent: '#7ad7ff', accent2: '#ffd58a', grade: 'saturate(1.05) contrast(1.08)',
      step: beatStep(beat, 122), spec: beat?.spec ?? null, bands: 128,
    }),
  },
  clockface('clockface-day', T('Clockface · 하루', 'Clockface · Day'), T('영상 한 편에 하루 · 시간 따라 색이 바뀜 · 큰 시계', 'a whole day in one video · colour follows the hour · big clock'),
    { shot: 24, startMinute: 300, spanMinutes: 1380, night: false }),
  clockface('clockface-night', T('Clockface · 밤', 'Clockface · Night'), T('밤 열 시간 · 가사가 시계 자리에 · 다음 장면이 작은 창으로', 'ten hours of night · lyrics where the clock was · the next scene in a small window'),
    { shot: 57, startMinute: 1200, spanMinutes: 600, night: true }),
  {
    id: 'lyricbloom', name: 'Lyric Bloom', sub: T('가사가 화면을 채움 · 마지막 낱말에 사진이 · 줄마다 다른 모서리', 'lyrics fill the screen · the last word holds a photo · a new corner each line'),
    draw: drawLyricBloom,
    build: (base, beat) => {
      const N = base.N ?? 960, outroLen = Math.min(80, Math.round(N * 0.1));
      // 10-14 phone: a Halloween line is 10-12 words, and one stack of them came out small and overlapping.
      // A long line blooms in two halves, each on its own photo.
      const halve = (p) => {
        const ws = p.words;
        if (!ws || ws.length <= 6) return [p];
        const k = Math.ceil(ws.length / 2), a = ws.slice(0, k), b = ws.slice(k);
        return [{ ...p, end: b[0].t, text: a.map((w) => w.w).join(' '), words: a },
          { ...p, start: b[0].t, text: b.map((w) => w.w).join(' '), words: b }];
      };
      const ps = base.phrases.length ? base.phrases.flatMap(halve) : bloomFallback(base, N - outroLen);
      // with no words from the user the cards are the song's own name, so they take the title script too
      const lines = ps.filter((p) => p.start < N - outroLen).map((p) => ({ from: p.start, intro: !base.phrases.length, chunks: bloomChunks(p) }));
      // 영샘 10-04: before the first sung line the frame was just a photo — flat. The song's name
      // opens in the same grammar (stacked, last word cut from the photo), and a long intro gets
      // a second card with the brand, so the look speaks from the first second.
      const first = lines.length ? lines[0].from : N;
      if (first > 45) {
        const intro = [];
        const say = (start, text) => {
          const words = text.split(/\s+/).filter(Boolean);
          intro.push({ from: start, intro: true, chunks: bloomChunks({ start, text, words: words.map((w, k) => ({ t: start + 4 + k * 7, w })) }) });
        };
        say(6, `${base.title1} ${base.title2}`.trim());
        if (first > 210) say(Math.round(first / 2), base.brand);
        lines.unshift(...intro);
      }
      return { ...base, outroLen, title: `${base.title1} ${base.title2}`.trim(), lines, period: beatStep(beat, 60) };   // ~2s, on the beat
    },
  },
];
// How many photos each look actually shows for this song, and which shape suits it.
// slots = distinct picture places in N frames; fewer photos than `min` and the repeats show.
const PHOTO = {
  halloween: { min: 5, shape: 'tall', slots: (d, N) => 1 + Math.ceil(Math.max(0, N - d.fold) / d.step) },
  windowband: { min: 4, shape: 'wide', slots: (d, N) => Math.ceil(N / d.shot) },
  triptych: { min: 9, shape: 'wide', slots: (d, N) => [0, 1, 2].reduce((s, i) => s + triptychCuts(d, (d.period * i) / 3, N).length, 0) },
  'blackcut-room': { min: 6, shape: 'tall', slots: (d, N) => Math.ceil(N / d.step) },
  'blackcut-road': { min: 6, shape: 'tall', slots: (d, N) => Math.ceil(N / d.step) },
  pulse: { min: 4, shape: 'tall', slots: (d, N) => Math.ceil(N / d.step) },
  'clockface-day': { min: 10, shape: 'tall', slots: (d, N) => Math.ceil(N / d.shot) },
  'clockface-night': { min: 6, shape: 'tall', slots: (d, N) => Math.ceil(N / d.shot) },
  lyricbloom: { min: 4, shape: 'tall', slots: (d) => Math.max(1, d.lines.length) },
};
for (const l of LOOKS) l.photo = PHOTO[l.id];

export const lookById = (id) => LOOKS.find((l) => l.id === id) ?? LOOKS[0];
