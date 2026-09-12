// Her Hours Shorts — rendering + encoding engine.
// Extracted verbatim from app.v1.js (2026-09-12). drawFrame() is the approved WINDOW BAND look:
// do not change its coordinates, fonts or timings. The UI layer (ui.js) drives it.
import {Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, canEncodeAudio, canEncodeVideo} from 'mediabunny';
export {canEncodeAudio, canEncodeVideo};

export const W = 1080, H = 1920, FPS = 30, MAX_SEC = 32;
export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const out = (t) => 1 - Math.pow(1 - clamp(t), 3);
const inOut = (t) => { const x = clamp(t); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

// ---------- assets ----------
export async function loadFonts() {
  const faces = [
    ['HHTitle', 'assets/fonts/PinyonScript-Regular.ttf'],
    ['HHSans', 'assets/fonts/JosefinSans-SemiBold.ttf'],
    ['HHSerif', 'assets/fonts/Tinos-Regular.ttf'],
  ];
  for (const [name, url] of faces) {
    const f = new FontFace(name, `url(${url})`);
    await f.load();
    document.fonts.add(f);
  }
}
export const loadImage = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
export async function fileToBitmap(file) {
  // downscale on decode: the band is 1080x540, 1600px wide is plenty.
  // Some Android Chrome builds reject createImageBitmap on large camera JPEGs ("source image could not be decoded"),
  // so fall back to a plain <img> decode drawn onto a small canvas.
  try { return await createImageBitmap(file, { resizeWidth: 1600, resizeQuality: 'high' }); } catch {}
  try { return await createImageBitmap(file); } catch {}
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('decode')); im.src = url; });
    const s = Math.min(1, 1600 / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

// ---------- noise tile for grain ----------
const grain = document.createElement('canvas');
grain.width = 256; grain.height = 256;
{
  const g = grain.getContext('2d');
  const id = g.createImageData(256, 256);
  let s = 7;
  for (let i = 0; i < id.data.length; i += 4) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const v = (s >> 8) & 255;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
}

// ---------- type ----------
// Pinyon Script / Josefin Sans / Tinos carry no Hangul, so every canvas font names a
// Korean fallback after them. Those faces are already on the phone - nothing is downloaded.
const KR = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR"';
const F_TITLE = `"HHTitle",${KR},cursive`;
const F_SANS = `"HHSans",${KR},sans-serif`;
const F_SERIF = `"HHSerif",${KR},serif`;

// Josefin Sans reads smaller than Bahnschrift at the same px, so the small type went up ~20%.
const SZ = { brand: 62, kicker: 26, label: 28, lyric: 54, tag: 30, foot: 28 };

// Headline box: below the label, clear of the image band at 600.
const HEAD_TOP = 250, HEAD_BOTTOM = 574, HEAD_MAXW = W - 144, T1_BASE = 300, T2_RATIO = 0.79;

const MINOR = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into',
  'nor', 'of', 'on', 'or', 'over', 'the', 'to', 'up', 'via', 'with']);

// A script face set in all caps does not join up and stops being readable on a phone,
// so GREEN LIGHT becomes Green Light. Someone who typed mixed case meant it - leave theirs alone.
export function titleCase(s, capFirst) {
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) return s;
  let n = 0;
  return s.toLowerCase().replace(/[^\s]+/g, (w) => {
    const first = n++ === 0;
    if ((!first || !capFirst) && MINOR.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  });
}

// Any single line of small type that would run past the 72px margin simply gets smaller.
// Set letterSpacing before calling: Chrome measures it.
function fitText(ctx, text, size, family, maxW) {
  ctx.font = `${size}px ${family}`;
  const w = ctx.measureText(text).width;
  if (w <= maxW) return size;
  const s = Math.max(12, size * maxW / w);
  ctx.font = `${s}px ${family}`;
  return s;
}

// Sizes both title lines to the margins, then to the available height, measuring the real ink
// box - Pinyon's ascenders and descenders run far past its em box.
let headCache = { key: null, val: null };
function fitHeadline(ctx, t1, t2) {
  // The fit only depends on the two strings, so it is solved once per title, not once per frame.
  const key = JSON.stringify([t1, t2]);
  if (headCache.key === key) return headCache.val;
  ctx.letterSpacing = '0px';
  const m = (t, size) => { ctx.font = `${size}px ${F_TITLE}`; return ctx.measureText(t); };
  // Pinyon's advance width is not its ink. Fit and align on the ink, or the margins only
  // look right on paper.
  const inkW = (mm) => mm.actualBoundingBoxLeft + mm.actualBoundingBoxRight;

  let s1 = T1_BASE;
  const w1 = inkW(m(t1, s1));
  if (w1 > 0) s1 = Math.min(s1, s1 * HEAD_MAXW / w1);
  let s2 = s1 * T2_RATIO;
  const w2 = inkW(m(t2, s2));
  if (w2 > 0) s2 = Math.min(s2, s2 * HEAD_MAXW / w2);

  const room = HEAD_BOTTOM - HEAD_TOP;
  for (let i = 0; i < 5; i++) {
    const a = m(t1, s1), b = m(t2, s2);
    const h = a.actualBoundingBoxAscent + a.actualBoundingBoxDescent + s1 * 0.06
            + b.actualBoundingBoxAscent + b.actualBoundingBoxDescent;
    if (h <= room) break;
    const k = room / h; s1 *= k; s2 *= k;
  }

  const a = m(t1, s1), b = m(t2, s2);
  const gap = s1 * 0.06;
  const h = a.actualBoundingBoxAscent + a.actualBoundingBoxDescent + gap
          + b.actualBoundingBoxAscent + b.actualBoundingBoxDescent;
  const top = HEAD_TOP + Math.max(0, (room - h) / 2);
  // Line 1 hangs off the left margin, line 2 off the right - the diagonal 영샘 picked.
  // A title with no second line stays left aligned.
  const x1 = 72 + a.actualBoundingBoxLeft;
  const x2 = t2 ? W - 72 - b.actualBoundingBoxRight : 72 + b.actualBoundingBoxLeft;
  const y1 = top + a.actualBoundingBoxAscent;
  const y2 = y1 + a.actualBoundingBoxDescent + gap + b.actualBoundingBoxAscent;
  headCache = { key, val: { s1, s2, x1, x2, y1, y2 } };
  return headCache.val;
}

// ---------- drawing ----------
function drawCover(ctx, img, x, y, w, h, scale, txPct, dir) {
  const iw = img.width, ih = img.height;
  const s = Math.max(w / iw, h / ih) * scale;
  const dw = iw * s, dh = ih * s;
  const dx = x + (w - dw) / 2 + (txPct / 100) * w;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function wrapWords(ctx, words, maxW, gap) {
  const lines = []; let line = []; let lw = 0;
  for (const w of words) {
    const ww = ctx.measureText(w.w).width;
    if (line.length && lw + gap + ww > maxW) { lines.push({ words: line, width: lw }); line = []; lw = 0; }
    lw += (line.length ? gap : 0) + ww; line.push({ ...w, ww });
  }
  if (line.length) lines.push({ words: line, width: lw });
  return lines;
}

export function drawFrame(ctx, f, N, d) {
  const { images, phrases, brand, label, title1, title2, tag, accent, ink, cream, shot, crossfade, footL, footR } = d;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = ink; ctx.fillRect(0, 0, W, H);

  // aurora glow (radial ellipse, blurred in the original; the gradient is soft enough without the blur)
  const glow = 0.35 + 0.25 * Math.sin(f / 45);
  ctx.save();
  ctx.translate(550, 150); ctx.scale(1, 0.6);
  const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 750);
  const a0 = Math.round(glow * 0.35 * 255).toString(16).padStart(2, '0');
  rg.addColorStop(0, accent + a0); rg.addColorStop(0.35, 'rgba(80,200,160,0.08)'); rg.addColorStop(0.65, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(-900, -900, 1800, 1800);
  ctx.restore();

  const fadeIn = out(clamp(f / 20));
  const fadeOut = 1 - inOut(clamp((f - (N - 40)) / 34));
  const master = fadeIn * fadeOut;
  const rise = (delay) => { const k = out(clamp((f - delay) / 22)); return { a: k, y: (1 - k) * 40 }; };

  ctx.globalAlpha = master;

  // brand row (top 96)
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 2;
  ctx.letterSpacing = '5px';
  const bs = fitText(ctx, brand + '.', SZ.brand, F_SANS, 560);
  ctx.fillStyle = '#f5f1ea'; ctx.textAlign = 'left';
  const by = 96 + SZ.brand * 0.86;
  ctx.fillText(brand, 72, by);
  const bw = ctx.measureText(brand).width;
  ctx.fillStyle = accent; ctx.fillText('.', 72 + bw, by);
  ctx.letterSpacing = '4px';
  fitText(ctx, 'VISUAL PLAYLIST / SHORTS', SZ.kicker, F_SANS, W - 144 - bw - 48);
  ctx.fillStyle = '#f5f1ea'; ctx.textAlign = 'right';
  ctx.fillText('VISUAL PLAYLIST / SHORTS', W - 72, by);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // headline block (top 196)
  ctx.textAlign = 'left';
  let r = rise(0);
  ctx.globalAlpha = master * r.a;
  ctx.letterSpacing = '5px';
  const lsz = fitText(ctx, label, SZ.label, F_SANS, W - 144);
  ctx.fillStyle = '#aeb8c9';
  ctx.fillText(label, 72, 196 + lsz * 0.95 + r.y);
  const fit = fitHeadline(ctx, title1, title2);
  r = rise(6);
  ctx.globalAlpha = master * r.a;
  ctx.font = `${fit.s1}px ${F_TITLE}`; ctx.letterSpacing = '0px'; ctx.fillStyle = cream;
  ctx.fillText(title1, fit.x1, fit.y1 + r.y);
  r = rise(12);
  ctx.globalAlpha = master * r.a;
  ctx.font = `${fit.s2}px ${F_TITLE}`; ctx.fillStyle = accent;
  ctx.shadowColor = accent + '59'; ctx.shadowBlur = 40;
  ctx.fillText(title2, fit.x2, fit.y2 + r.y);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  ctx.globalAlpha = master;

  // window band (top 600, h 540)
  const bandTop = 600, bandH = 540;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, bandTop, W, bandH); ctx.clip();
  ctx.fillStyle = '#000'; ctx.fillRect(0, bandTop, W, bandH);
  const n = images.length;
  const shotsNeeded = Math.ceil(N / shot);
  for (let i = 0; i < shotsNeeded; i++) {
    const from = i * shot - (i === 0 ? 0 : crossfade);
    const dur = shot + crossfade;
    const local = f - from;
    if (local < 0 || local > dur) continue;
    const a = i === 0 ? 1 : out(clamp(local / crossfade));
    const t = clamp(local / Math.max(1, dur));
    const dir = i % 2 === 0 ? 1 : -1;
    const scale = 1.04 + 0.07 * t;
    const tx = dir * (1 - 2 * t) * 1.6;
    ctx.globalAlpha = master * a;
    drawCover(ctx, images[i % n], 0, bandTop, W, bandH, scale, tx, dir);
  }
  ctx.globalAlpha = master * 0.55; ctx.fillStyle = accent;
  ctx.fillRect(0, bandTop, W, 2); ctx.fillRect(0, bandTop + bandH - 2, W, 2);
  ctx.restore();
  ctx.globalAlpha = master;

  // karaoke line (top 1210, centered, wraps in 936px)
  const phrase = [...phrases].reverse().find((p) => f >= p.start);
  if (phrase) {
    const size = SZ.lyric;
    ctx.font = `${size}px ${F_SERIF}`; ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
    const words = phrase.words ?? [{ t: phrase.start, w: phrase.text }];
    const gap = size * 0.28;
    const lines = wrapWords(ctx, words, W - 144, gap);
    let y = bandTop + bandH + 70 + size * 0.85;
    for (const ln of lines) {
      let x = (W - ln.width) / 2;
      for (const w of ln.words) {
        const on = f >= w.t;
        const k = out(clamp((f - w.t) / 8));
        ctx.fillStyle = on ? cream : cream + '52';
        ctx.fillText(w.w, x, y + (1 - k) * 6);
        x += w.ww + gap;
      }
      y += size * 1.15;
    }
  }

  // tag (top 1510) + footer (top 1600)
  ctx.textAlign = 'center'; ctx.letterSpacing = '5px';
  fitText(ctx, tag, SZ.tag, F_SANS, W - 144);
  ctx.globalAlpha = master * 0.9; ctx.fillStyle = accent;
  ctx.fillText(tag, W / 2, bandTop + bandH + 300 + SZ.tag * 0.9);
  ctx.globalAlpha = master;
  ctx.letterSpacing = '3px'; ctx.fillStyle = '#aeb8c9';
  const fy = 1600 + SZ.foot * 0.9;
  fitText(ctx, footL, SZ.foot, F_SANS, 440);
  ctx.textAlign = 'left'; ctx.fillText(footL, 72, fy);
  fitText(ctx, footR, SZ.foot, F_SANS, 440);
  ctx.textAlign = 'right'; ctx.fillText(footR, W - 72, fy);

  // grain (overlay, 0.07)
  ctx.globalAlpha = 0.07; ctx.globalCompositeOperation = 'overlay';
  const shift = (f % 7) * 13;
  const pat = ctx.createPattern(grain, 'repeat');
  ctx.save(); ctx.translate(shift, -shift); ctx.fillStyle = pat; ctx.fillRect(-shift, shift, W, H); ctx.restore();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
}

// ---------- audio ----------
export async function decodeAudio(arrayBuffer) {
  const ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
  try { return await ac.decodeAudioData(arrayBuffer); } finally { try { await ac.close(); } catch {} }
}
export function trimBuffer(buf, seconds) {
  const frames = Math.min(buf.length, Math.round(seconds * buf.sampleRate));
  const ch = Math.min(2, buf.numberOfChannels);
  const outB = new AudioBuffer({ length: frames, numberOfChannels: ch, sampleRate: buf.sampleRate });
  for (let c = 0; c < ch; c++) {
    const src = buf.getChannelData(c).subarray(0, frames);
    const dst = outB.getChannelData(c);
    dst.set(src);
    // 1s fade-out at the end so a cut song does not click
    const fade = Math.min(frames, buf.sampleRate);
    for (let i = 0; i < fade; i++) dst[frames - fade + i] *= 1 - i / fade;
  }
  return outB;
}

// ---------- encode ----------
// Draws N frames of `d` onto `canvas` (1080x1920) and muxes them with `audioBuf` into an mp4 Blob.
export async function encode({ canvas, d, N, audioBuf, onProgress }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!(await canEncodeVideo('avc'))) throw new Error('이 브라우저는 H.264 인코딩을 지원하지 않아요. 크롬으로 열어주세요.');
  if (!(await canEncodeAudio('aac'))) {
    const m = await import('./vendor/mediabunny-aac-encoder.min.mjs');
    m.registerAacEncoder();
  }
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const vsrc = new CanvasSource(canvas, { codec: 'avc', bitrate: 9_000_000, keyFrameInterval: 2 });
  const asrc = new AudioBufferSource({ codec: 'aac', bitrate: 192_000 });
  output.addVideoTrack(vsrc, { frameRate: FPS });
  output.addAudioTrack(asrc);
  await output.start();
  await asrc.add(audioBuf);
  asrc.close();
  const t0 = performance.now();
  for (let f = 0; f < N; f++) {
    drawFrame(ctx, f, N, d);
    await vsrc.add(f / FPS, 1 / FPS);
    if (f % 15 === 0) {
      onProgress?.(f / N, (performance.now() - t0) / 1000);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  vsrc.close();
  onProgress?.(1, (performance.now() - t0) / 1000);
  await output.finalize();
  return { blob: new Blob([output.target.buffer], { type: 'video/mp4' }), elapsed: (performance.now() - t0) / 1000 };
}

// ---------- frame data ----------
// One place builds the object drawFrame reads, so the live preview and the exported file cannot drift.
export function buildData({ tpl, images, useOurs, brand, title1, title2 }) {
  const B = (brand || 'HER HOURS').toUpperCase();
  const t1 = titleCase(title1 || tpl.title1, true);
  const t2 = titleCase(title2 || tpl.title2, false);   // line 2 reads as a continuation
  return {
    images, phrases: useOurs ? tpl.phrases : [],
    brand: B,
    label: useOurs ? tpl.label : `${B} · MY OWN PLAYLIST`,
    title1: t1, title2: t2,
    tag: useOurs ? tpl.tag : `♪ ${(t1 + ' ' + t2).trim().toUpperCase()}`,
    accent: tpl.accent, ink: tpl.ink, cream: tpl.cream, shot: tpl.shot, crossfade: tpl.crossfade,
    footL: '@' + B.toLowerCase().replace(/[^a-z0-9]/g, ''), footR: 'MADE WITH HER HOURS',
  };
}

export const DEMO = ['L11', 'L03', 'L02', 'L07', 'L06', 'L13'];
export const loadDemo = () => Promise.all(DEMO.map((id) => loadImage(`assets/demo/${id}.jpg`)));
export const loadTemplate = async () => (await fetch('assets/green_light.json')).json();
