// Her Hours Shorts — three looks carried over from the 현준샘 ski videos (11-06), redrawn for the phone canvas.
//   Red Run     = v11: black and white with the reds kept, RUN strips with a timer, GO stamps, a name card at the end
//   Beat Turns  = v12: own colours, the camera kicks on the beat, metal name, big stamps, burst stills
//   Paper World = v13: a paper picture stage, the person in a small window that opens to the whole frame on the hit
// Everything is cut on the song's beat grid (beats.js), so the same look works on any song and any length.
// The originals are one-off Python renders (D:\_research\ski_promo_clo\tools\mv11_edit.py, mv12_short.py, mv13_kids.py).
// What did not come over: optical-flow slow motion - a phone cannot afford it.
import { W, H, grainPattern, loadImage } from './core.js';

const FPS = 30;
const KR = '"HHKrSans","Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR"';
const F_ANTON = `"HHDisplay",${KR},sans-serif`;
const F_BHS = `"Black Han Sans","HHDisplay",${KR},sans-serif`;
const F_JUA = `"Jua","Black Han Sans",${KR},sans-serif`;
const F_SANS = `"HHSans",${KR},sans-serif`;
const F_SERIF = `"HHSerif","HHKr",${KR},serif`;
const F_ITALIC = `"HHItalic","HHKr",${KR},serif`;
const RED = '#e4102a';

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const easeOut = (t, p = 3) => 1 - Math.pow(1 - clamp(t), p);
const hash = (i, salt = 0) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
const AL = (img, fx, fy) => { const a = img?.hhAlign || img?.hhSrc?.hhAlign; return a ? [a.x, a.y] : [fx, fy]; };

// ---------- the beat grid ----------
// beats.js gives whole-song beats in frames; without a song the look still runs on a steady 88 bpm.
function gridOf(beat, N) {
  if (beat?.beats?.length > 4) return Array.from(beat.beats);
  const g = []; for (let f = 0; f < N + 60; f += 20.45) g.push(f);
  return g;
}
// frame of the first beat at or after f
const snap = (g, f) => { for (const b of g) if (b >= f) return Math.round(b); return Math.round(f); };
const beatIndex = (g, f) => { let lo = 0, hi = g.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (g[m] <= f) lo = m; else hi = m - 1; } return lo; };
// frame at beat k, also past the end of the grid
const bf = (g, k) => (k < g.length ? g[Math.max(0, k)] : g[g.length - 1] + (k - g.length + 1) * (g[g.length - 1] - g[g.length - 2]));

// Cuts over [from, to), `every` beats long, each with its own picture and move.
function cutList(g, from, to, every, moves, start = 0) {
  const out = []; let k = beatIndex(g, from), i = start, f0 = from;
  while (f0 < to) {
    const f1 = Math.min(to, Math.round(bf(g, k + every)));
    if (f1 > f0) out.push({ f0, f1, k, n: every, img: i, mv: moves[i % moves.length] });
    k += every; i++; f0 = Math.max(f1, f0 + 1);
  }
  return out;
}
const atCut = (cuts, f) => { for (const c of cuts) if (f >= c.f0 && f < c.f1) return c; return cuts[cuts.length - 1]; };

// ---------- drawing a picture ----------
function cover(ctx, img, x0, y0, w, h, z, px, py, fx = 0.5, fy = 0.45) {
  const [ax, ay] = AL(img, fx, fy);
  const s = Math.max(w / img.width, h / img.height) * z;
  const dw = img.width * s, dh = img.height * s;
  const x = clamp((w - dw) * ax + px, w - dw, 0), y = clamp((h - dh) * ay + py, h - dh, 0);
  ctx.drawImage(img, x0 + x, y0 + y, dw, dh);
}
// The camera kicks forward on each beat of the cut and settles, instead of gliding.
function kickProgress(g, c, f) {
  let p = 0;
  for (let i = 0; i < c.n; i++) { const b = bf(g, c.k + i); if (f >= b) p = i + easeOut((f - b) / Math.max(6, bf(g, c.k + i + 1) - b), 6); }
  return p / c.n;
}
const MOVES = {
  R: { z: [1.34, 1.34], x: [150, -150], y: [0, 0] }, L: { z: [1.34, 1.34], x: [-150, 150], y: [0, 0] },
  U: { z: [1.3, 1.3], x: [0, 0], y: [-190, 190] }, D: { z: [1.3, 1.3], x: [0, 0], y: [190, -190] },
  IN: { z: [1.08, 1.5], x: [0, 0], y: [0, 0] }, OUT: { z: [1.5, 1.08], x: [0, 0], y: [0, 0] },
  SLOW: { z: [1.06, 1.16], x: [0, 0], y: [0, 0] },
};
function camera(ctx, img, mv, p, x0 = 0, y0 = 0, w = W, h = H, zk = 1) {
  const m = MOVES[mv] || MOVES.IN;
  const z = m.z[0] * Math.pow(m.z[1] / m.z[0], p) * zk;
  cover(ctx, img, x0, y0, w, h, z, m.x[0] + (m.x[1] - m.x[0]) * p, m.y[0] + (m.y[1] - m.y[0]) * p);
}
function resetCtx(ctx) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.letterSpacing = '0px'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
}
function grain(ctx, f, a = 0.06) {
  ctx.globalAlpha = a; ctx.globalCompositeOperation = 'overlay';
  const shift = (f % 7) * 13;
  ctx.save(); ctx.translate(shift, -shift); ctx.fillStyle = grainPattern(ctx); ctx.fillRect(-shift, shift, W, H); ctx.restore();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
function flash(ctx, a, col = '#fff') { if (a <= 0) return; ctx.globalAlpha = clamp(a); ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
function fitSize(ctx, text, size, family, maxW, weight = '') {
  ctx.font = `${weight}${size}px ${family}`;
  const w = ctx.measureText(text).width;
  if (w > maxW) { size = Math.floor(size * maxW / w); ctx.font = `${weight}${size}px ${family}`; }
  return size;
}
// A short colour split on a hit: two tinted, shifted copies of what is already on screen.
let splitR, splitC;
function rgbHit(ctx, amt, a) {
  if (a <= 0) return;
  if (!splitR) { for (const k of [0, 1]) { const c = document.createElement('canvas'); c.width = W / 3; c.height = H / 3; if (k) splitC = c; else splitR = c; } }
  [[splitR, '#ff2030'], [splitC, '#10e0ff']].forEach(([c, col]) => {
    const g = c.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.drawImage(ctx.canvas, 0, 0, c.width, c.height);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  });
  ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = a;
  ctx.drawImage(splitR, -amt, 0, W, H); ctx.drawImage(splitC, amt, 0, W, H);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
function bottomShade(ctx, from = 1180, a = 0.72) {
  const g = ctx.createLinearGradient(0, from, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, from, W, H - from);
}
function snow(ctx, f, n, alpha, long = 0) {
  ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const sp = 5 + hash(i, 1) * 9, sz = 1.6 + hash(i, 2) * 3;
    const x = ((hash(i, 3) * (W + 300) - f * sp * 0.34) % (W + 300) + W + 300) % (W + 300) - 150;
    const y = ((hash(i, 4) * (H + 200) + f * sp) % (H + 200)) - 100;
    ctx.globalAlpha = alpha * (0.4 + 0.6 * hash(i, 5));
    ctx.lineWidth = sz; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - (long ? sp * 0.8 : 0.1), y - (long ? sp * 2.6 : 0.1)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
// a live clip that is graded through WebGL is not drawn on this ctx; a 1px draw off screen tells the sound mix it is on screen
const mark = (ctx, src) => { if (src?.live) ctx.drawImage(src, -4, -4, 1, 1); };

// ---------- black and white, the reds kept ----------
// One small shader. Photos are graded once and kept; a clip goes through it every frame.
let glc, gl, uTex;
function initGL() {
  if (gl !== undefined) return gl;
  try {
    glc = document.createElement('canvas');
    gl = glc.getContext('webgl', { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true }) || null;
    if (!gl) return gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;v.y=1.-v.y;gl_Position=vec4(a,0.,1.);}'));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, `precision mediump float;varying vec2 v;uniform sampler2D t;
      void main(){vec3 c=texture2D(t,v).rgb;float l=dot(c,vec3(.3,.59,.11));l=clamp((l-.5)*1.16+.5,0.,1.);
      float r=smoothstep(.1,.28,c.r-max(c.g,c.b))*smoothstep(.16,.32,c.r);
      gl_FragColor=vec4(mix(vec3(l),c*vec3(1.1,.92,.92),r),1.);}`));
    gl.linkProgram(p); gl.useProgram(p);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(p, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    uTex = gl.getUniformLocation(p, 't');
  } catch { gl = null; }
  return gl;
}
function shade(src) {
  if (glc.width !== src.width || glc.height !== src.height) { glc.width = src.width; glc.height = src.height; gl.viewport(0, 0, src.width, src.height); }
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.uniform1i(uTex, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return glc;
}
const redCache = new WeakMap();
function redGraded(src) {
  if (!initGL()) return null;
  if (src.live) return shade(src);
  let c = redCache.get(src);
  if (!c) {
    c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.hhSrc = src;
    c.getContext('2d').drawImage(shade(src), 0, 0);
    redCache.set(src, c);
  }
  return c;
}
function redPicture(ctx, src) {
  mark(ctx, src);
  const g = redGraded(src);
  if (g) { g.hhSrc = src; return g; }
  ctx.filter = 'grayscale(1) contrast(1.12)';   // no WebGL: plain black and white (ctx.filter is ignored where unsupported)
  return src;
}

// ---------- Red Run ----------
function skewText(ctx, text, x, y, size, col, opt = {}) {
  ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, -0.18, 1, 0, 0);
  ctx.font = `${size}px ${F_ANTON}`; ctx.textAlign = opt.align || 'left';
  if (opt.shadow !== false) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5; }
  ctx.fillStyle = col; ctx.fillText(text, 0, 0); ctx.restore();
}
function drawRedRun(ctx, f, N, d) {
  resetCtx(ctx);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const { images, g, open, end, runs, hits, cuts, stacks } = d;
  const pic = (c) => images[c.img % images.length];
  const run = runs.find((r) => f >= r.f0 && f < r.f1);

  if (f >= end) { drawRedEnd(ctx, f, N, d); return; }

  if (run) {
    // RUN strip: one long take in a wide band, a timer that starts at zero
    const src = images[run.img % images.length], p = (f - run.f0) / (run.f1 - run.f0);
    const img = redPicture(ctx, src);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 610, W, 640); ctx.clip();
    // a still has to walk: it drifts along whichever side the wide band leaves room on, and creeps in
    cover(ctx, img, 0, 610, W, 640, 1.16 + 0.34 * p, 150 - 300 * p, 240 - 480 * p, 0.5, 0.5);
    ctx.restore(); ctx.filter = 'none';
    const inA = easeOut((f - run.f0) / 7);
    ctx.globalAlpha = inA;
    skewText(ctx, `RUN ${String(run.i + 1).padStart(2, '0')}`, 80, 540, 104, '#fff', { shadow: false });
    ctx.fillStyle = RED; ctx.fillRect(72, 568, 936 * inA, 6);
    const t = (f - run.f0) / FPS, ss = Math.floor(t), cc = Math.floor((t - ss) * 100);
    skewText(ctx, `00:${String(ss).padStart(2, '0')}.${String(cc).padStart(2, '0')}`, 80, 1370, 84, '#fff', { shadow: false });
    ctx.font = `30px ${F_SANS}`; ctx.letterSpacing = '6px'; ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.fillText(d.brand, 80, 1440); ctx.letterSpacing = '0px'; ctx.globalAlpha = 1;
    flash(ctx, 1 - (f - run.f0) / 6);
    flash(ctx, 1 - (run.f1 - f) / 8);
    grain(ctx, f, 0.05);
    return;
  }

  const c = atCut(cuts, f), src = pic(c);
  const hold = hits.find((h) => f >= h - 7 && f < h);   // a moment of stillness before the drop
  const ff = hold !== undefined ? hold - 7 : f;
  const p = c.slow ? (ff - c.f0) / (c.f1 - c.f0) : kickProgress(g, c, ff);
  const img = redPicture(ctx, src);
  camera(ctx, img, c.mv, p);
  ctx.filter = 'none';
  snow(ctx, f, 26, 0.5, 1);

  // the opening words, one at a time, in a quiet serif
  if (f < open) {
    const lines = [d.t1, d.t2].filter(Boolean); let n = 0;
    lines.forEach((ln, li) => {
      const size = fitSize(ctx, ln, li ? 136 : 96, F_SERIF, 900);
      ctx.font = `${size}px ${F_SERIF}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
      ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 22;
      let x = 90; const y = 340 + li * 146;
      for (const w of ln.split(/\s+/)) {
        const u = (f - 8 - n * 9) / 12; n++;
        if (u > 0) { ctx.globalAlpha = easeOut(u); ctx.fillText(w, x, y + (1 - easeOut(u)) * 14); }
        x += ctx.measureText(w + ' ').width;
      }
      if (li === lines.length - 1 && f - 8 - n * 9 > 6) { ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(x - ctx.measureText(' ').width + 14, y - 3, 8, 0, 7); ctx.fill(); }
    });
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  } else if ((f - open) % 150 < 90) {
    // the name, small, while the run is on
    ctx.fillStyle = RED; ctx.fillRect(72, 1642, 8, 30);
    ctx.font = `30px ${F_SANS}`; ctx.letterSpacing = '5px'; ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 10; ctx.fillText(d.brand, 94, 1668);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.letterSpacing = '0px';
  }

  // GO stacks on the hits, READY near the end
  for (const s of stacks) {
    if (f < s.f0 || f >= s.f1) continue;
    s.words.forEach((w, i) => {
      if (f < w.f) return;
      const u = (f - w.f) / 5, k = 1 + 0.5 * (1 - easeOut(u, 4));
      ctx.save(); ctx.translate(w.x, w.y); ctx.scale(k, k); ctx.translate(-w.x, -w.y);
      const size = fitSize(ctx, w.t, w.size, F_ANTON, 900);
      skewText(ctx, w.t, w.x, w.y, size, w.col, { align: 'center' });
      ctx.restore();
    });
  }

  const hit = hits.find((h) => f >= h && f < h + 9);
  if (hit !== undefined) { const a = 1 - (f - hit) / 9; rgbHit(ctx, 26 * a, 0.8 * a); flash(ctx, a * 0.45); }
  grain(ctx, f, 0.05);
}
function drawRedEnd(ctx, f, N, d) {
  const u = f - d.end;
  const src = d.images[d.lastImg % d.images.length];
  const img = redPicture(ctx, src);
  ctx.globalAlpha = easeOut(u / 10);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 760, W, 480); ctx.clip();
  cover(ctx, img, 0, 760, W, 480, 1.12 + 0.1 * (u / (N - d.end)), 0, 0, 0.5, 0.55);
  ctx.restore(); ctx.filter = 'none'; ctx.globalAlpha = 1;
  const parts = d.brand.split(/\s+/), big = parts.pop(), small = parts.join(' ');
  const rise = (from, y) => { const k = easeOut((u - from) / 12, 4); ctx.globalAlpha = k; return y + (1 - k) * 34; };
  if (small) skewText(ctx, small, 96, rise(6, 590), 78, '#fff', { shadow: false });
  const sz = fitSize(ctx, big || d.brand, 190, F_ANTON, 860);
  skewText(ctx, big || d.brand, 96, rise(10, 730), sz, '#fff', { shadow: false });
  ctx.globalAlpha = easeOut((u - 14) / 10);
  ctx.fillStyle = RED; ctx.fillRect(72, 1262, 936 * easeOut((u - 14) / 14), 6);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
  if (d.t1) { fitSize(ctx, d.t1, 52, F_SERIF, 900); ctx.fillText(d.t1, 80, 1340); }
  if (d.t2) { fitSize(ctx, d.t2, 52, F_SERIF, 900); ctx.fillText(d.t2, 80, 1404); }
  ctx.font = `24px ${F_SANS}`; ctx.letterSpacing = '6px'; ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillText('MADE WITH HER HOURS', 80, 1500);
  ctx.letterSpacing = '0px'; ctx.globalAlpha = 1;
  grain(ctx, f, 0.05);
}
function buildRedRun(base, beat) {
  const N = base.N ?? 960, g = gridOf(beat, N), sec = N / FPS;
  const open = snap(g, Math.min(180, Math.max(90, N * 0.1)));
  const end = snap(g, N - clamp(N * 0.09, 78, 180));
  const barF = (bf(g, 4) - bf(g, 0));
  const runAt = sec >= 24 ? [0.4, 0.7] : sec >= 14 ? [0.55] : [];
  // a RUN strip wants moving footage or a wide picture; a clip holds it for two bars, a still for one
  const pool = base.images.map((im, k) => ({ k, live: !!im.live, wide: im.width / im.height })).sort((a, b) => (b.live - a.live) || (b.wide - a.wide));
  const runs = runAt.map((a, i) => {
    const pick = pool[i % Math.max(1, pool.length)], len = pick?.live ? barF * 2 : barF;
    const f0 = snap(g, N * a); return { i, f0, f1: snap(g, f0 + clamp(len, 75, 170)), img: pick ? pick.k : 0 };
  });
  const hits = [open, ...(beat?.hits ?? []).filter((h) => h > open + 90 && h < end - 90 && !runs.some((r) => h > r.f0 - 30 && h < r.f1 + 30))].slice(0, 3);
  // cuts between the strips: long while it opens, then on every other beat
  const moves = ['R', 'IN', 'L', 'U', 'OUT', 'D', 'IN', 'R'];
  const cuts = []; let img = 0, from = open;
  const open1 = cutList(g, 0, open, 4, ['SLOW']);
  open1.forEach((c) => { c.img = img++; c.slow = true; cuts.push(c); });
  for (const r of [...runs, { f0: end, f1: end }]) {
    const seg = cutList(g, from, r.f0, 2, moves);
    seg.forEach((c) => { c.img = img++; cuts.push(c); });
    from = r.f1;
  }
  const lastImg = img;
  // GO: a stack of three on the first hit (two on the others); READY at about 85%
  const stack = (f0) => { const k = beatIndex(g, f0); const n = 3; return { f0, f1: Math.round(bf(g, k + 7)), words: [...Array(n)].map((_, i) => ({ t: 'GO', f: Math.round(bf(g, k + i * 2)), size: 290, x: 290 + i * 250, y: 760 + i * 250, col: i === 1 ? RED : '#fff' })) }; };
  const stacks = hits.map(stack);
  const rf = snap(g, N * 0.84);
  if (rf < end - 60 && !runs.some((r) => rf > r.f0 - 40 && rf < r.f1)) {
    stacks.push({ f0: rf, f1: Math.min(end, rf + 90), words: [{ t: 'READY', f: rf, size: 210, x: 540, y: 1180, col: '#fff' }, { t: 'TO RUN AGAIN?', f: rf + 10, size: 62, x: 540, y: 1262, col: '#fff' }] });
  }
  return { ...base, g, open, end, runs, hits, cuts, stacks, lastImg, t1: `${base.title1}`.trim(), t2: `${base.title2}`.trim(), brand: base.brand };
}

// ---------- Beat Turns ----------
// Metal letters: the gradient itself carries a moving band of light.
function metal(ctx, text, cx, y, size, stops, light, family = F_BHS) {
  ctx.font = `${size}px ${family}`; ctx.textAlign = 'center';
  const w = ctx.measureText(text).width, x0 = cx - w / 2 - 20, x1 = cx + w / 2 + 20;
  const grad = ctx.createLinearGradient(x0, y - size, x1, y);
  stops.forEach(([p, c]) => grad.addColorStop(p, c));
  if (light !== null && light >= 0 && light <= 1) { const a = Math.max(0, light - 0.06), b = Math.min(1, light + 0.06); grad.addColorStop(a, stops[Math.floor(a * (stops.length - 1))][1]); grad.addColorStop(light, '#fff'); grad.addColorStop(b, stops[Math.floor(b * (stops.length - 1))][1]); }
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(4, size * 0.06); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(text, cx, y);
  ctx.fillStyle = grad; ctx.fillText(text, cx, y);
}
const SILVER = [[0, '#f4f6f8'], [0.45, '#aab2ba'], [0.55, '#dfe4e8'], [1, '#8a929a']];
const GOLD = [[0, '#ffe7a8'], [0.45, '#c9963c'], [0.55, '#f6d27a'], [1, '#a9782a']];
function lockup(ctx, d, cx, y, k, light) {
  const size1 = fitSize(ctx, d.brand, 190 * k, F_BHS, 860 * k);
  metal(ctx, d.brand, cx, y, size1, SILVER, light);
  if (d.t1) { const size2 = fitSize(ctx, d.t1, 150 * k, F_BHS, 760 * k); metal(ctx, d.t1, cx, y + size2 * 1.2, size2, GOLD, light); }
}
function beatWave(ctx, d, f) {
  if (!d.spec) return;
  const n = 48, cy = 1668, step = 936 / n;
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < n; i++) {
    const b = Math.floor(6 + (i / n) * 80), v = d.spec[Math.min(d.spec.length - 1, f * 128 + b)] || 0;
    const h = 8 + clamp(v * 5) * 110;
    ctx.fillRect(72 + i * step, cy - h / 2, step * 0.56, h);
  }
}
function drawBeatTurns(ctx, f, N, d) {
  resetCtx(ctx);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const { images, g, open, end, cuts, bursts, stamps, phrases, count0 } = d;

  if (f < open) {
    // black, the name in metal, then the frame opens
    const c0 = cuts[0];
    if (f >= open - 12) {
      const u = easeOut((f - (open - 12)) / 12);
      ctx.save(); ctx.beginPath(); ctx.rect(0, H / 2 - (H / 2) * u, W, H * u); ctx.clip();
      camera(ctx, images[c0.img % images.length], c0.mv, 0); ctx.restore();
      mark(ctx, images[c0.img % images.length]);
    }
    const a = clamp((f - 4) / 10) * (f >= open - 12 ? 1 - (f - (open - 12)) / 12 : 1);
    ctx.globalAlpha = a; lockup(ctx, d, W / 2, 900, 1, (f - 8) / 34); ctx.globalAlpha = 1;
    return;
  }

  const burst = bursts.find((b) => f >= b.f0 && f < b.f1);
  const c = burst ? atCut(burst.cuts, f) : atCut(cuts, f);
  const src = images[c.img % images.length];
  // past the end card's start the last picture keeps drifting behind it
  const p = burst ? (f - c.f0) / Math.max(1, c.f1 - c.f0) : c.slow ? (f - c.f0) / (c.f1 - c.f0) : kickProgress(g, c, f);
  const k = beatIndex(g, f), kick = Math.exp(-7 * (f - g[k]) / FPS) * (k % 2 === 1 ? 0.028 : 0.012);
  camera(ctx, src, burst ? 'SLOW' : c.mv, p, 0, 0, W, H, 1 + kick);
  snow(ctx, f, 34, 0.75);
  bottomShade(ctx);

  if (f >= end) {
    const u = f - end;
    ctx.globalAlpha = clamp(u / 16) * 0.62; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = easeOut(u / 12);
    lockup(ctx, d, W / 2, 900, 1, (u - 6) / 30);
    if (d.t2) { ctx.font = `46px ${F_ITALIC}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; fitSize(ctx, d.t2, 46, F_ITALIC, 860); ctx.fillText(d.t2, W / 2, 1160); }
    ctx.font = `24px ${F_SANS}`; ctx.letterSpacing = '6px'; ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.fillText('MADE WITH HER HOURS', W / 2, 1240); ctx.letterSpacing = '0px';
    ctx.globalAlpha = 1;
    return;
  }

  // small name and a counter, top left - counted on every other beat, like the original's turns
  ctx.save(); lockup(ctx, d, 236, 262, 0.4, null); ctx.restore();
  const count = Math.max(1, Math.floor((k - count0) / 2) + 1);
  ctx.textAlign = 'left'; ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 10;
  ctx.font = `92px ${F_ANTON}`; ctx.fillStyle = '#fff'; ctx.fillText(String(count).padStart(3, '0'), 72, 440);
  ctx.font = `26px ${F_SANS}`; ctx.letterSpacing = '4px'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText('BEATS', 232, 440); ctx.letterSpacing = '0px';

  // words sung one by one, small; the one being sung in gold
  const line = phrases.find((q) => f >= q.start && f < q.end);
  if (line) {
    const words = line.words?.length ? line.words : line.text.split(/\s+/).map((w) => ({ t: line.start, w }));
    ctx.font = `64px ${F_ITALIC}`;
    let x = 72, y = 1500; const gap = 16;
    words.forEach((w, i) => {
      if (f < w.t) return;
      const ww = ctx.measureText(w.w).width;
      if (x + ww > 1008) { x = 72; y += 76; }
      const now = i === words.length - 1 || f < words[i + 1].t;
      ctx.fillStyle = now ? '#f6d27a' : '#fff'; ctx.globalAlpha = easeOut((f - w.t) / 4);
      ctx.fillText(w.w, x, y); x += ww + gap;
    });
    ctx.globalAlpha = 1;
  }
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;

  // the big stamp
  const st = stamps.find((s) => f >= s.f0 && f < s.f1);
  if (st) {
    const u = (f - st.f0) / 4, sc = 1 + 0.38 * (1 - easeOut(u, 4));
    ctx.save(); ctx.translate(W / 2, 1290); ctx.scale(sc, sc);
    const size = fitSize(ctx, st.t, 190, F_ANTON, 960);
    ctx.font = `${size}px ${F_ANTON}`; ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,.75)'; ctx.shadowBlur = 18; ctx.fillStyle = st.gold ? '#f6d27a' : '#fff'; ctx.fillText(st.t, 0, 0);
    ctx.restore();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  }

  beatWave(ctx, d, f);
  if (burst) flash(ctx, 0.75 - (f - c.f0) / 3);   // a shutter on every still
  const hit = d.hits.find((h) => f >= h && f < h + 8);
  if (hit !== undefined) { const a = 1 - (f - hit) / 8; rgbHit(ctx, 18 * a, 0.55 * a); }
}
function buildBeatTurns(base, beat) {
  const N = base.N ?? 960, g = gridOf(beat, N), sec = N / FPS;
  const open = snap(g, Math.min(84, N * 0.07));
  const end = snap(g, N - clamp(N * 0.1, 80, 150));
  const moves = ['R', 'IN', 'U', 'L', 'OUT', 'D', 'IN', 'L', 'U', 'R'];
  // stills near the middle: half a beat each, then a quarter
  const bursts = [];
  if (sec >= 14) {
    const b0 = snap(g, N * 0.5), k = beatIndex(g, b0);
    const per = (bf(g, k + 1) - bf(g, k));
    const cs = []; let f0 = b0, i = 0;
    for (let j = 0; j < 8; j++, i++) { const f1 = Math.round(f0 + per / 2); cs.push({ f0, f1, img: i }); f0 = f1; }
    for (let j = 0; j < 8; j++, i++) { const f1 = Math.round(f0 + per / 4); cs.push({ f0, f1, img: i }); f0 = f1; }
    bursts.push({ f0: b0, f1: f0, cuts: cs });
  }
  const cuts = []; let img = 0, from = open;
  const firstLoud = (beat?.hits ?? []).find((h) => h > open + 30) ?? snap(g, N * 0.2);
  for (const b of [...bursts, { f0: end, f1: N }]) {
    // four beats while it opens, two once the song is up: this look lives on density
    const quiet = Math.min(b.f0, Math.max(from, firstLoud));
    cutList(g, from, quiet, 4, moves).forEach((c) => { c.img = img++; cuts.push(c); });
    cutList(g, quiet, b.f0, 2, moves, img).forEach((c) => { c.img = img++; cuts.push(c); });
    if (b.cuts) { b.cuts.forEach((c) => { c.img = img++; }); }
    from = b.f1;
  }
  // the end card sits on one last, slow picture
  cuts.push({ f0: end, f1: N, k: beatIndex(g, end), n: 1, img: img++, mv: 'SLOW', slow: true });
  const count0 = beatIndex(g, open);
  // stamps: the song's own lines when it has them (the loud ones, every other line), else its title on the hits
  const hits = (beat?.hits ?? []).filter((h) => h > open + 30 && h < end - 30);
  const stamps = [];
  const words = (p) => p.text.toUpperCase().split(/\s+/).filter(Boolean).slice(-3).join(' ');
  if (base.phrases.length) {
    const from0 = hits[0] ?? N * 0.25; let n = 0;
    base.phrases.filter((p) => p.start >= from0 && p.start < end - 30).forEach((p, i) => {
      if (i % 2) return;
      const f1 = Math.min(end, Math.round(bf(g, beatIndex(g, p.start) + 4)));
      stamps.push({ f0: p.start, f1, t: words(p), gold: n++ % 2 === 1 });
    });
  } else {
    const say = [base.title1, base.title2].filter(Boolean).map((s) => s.toUpperCase());
    (hits.length ? hits : [snap(g, N * 0.3), snap(g, N * 0.65)]).forEach((h, i) => { if (say.length) stamps.push({ f0: h, f1: Math.min(end, Math.round(bf(g, beatIndex(g, h) + 6))), t: say[i % say.length], gold: i % 2 === 1 }); });
  }
  return { ...base, g, open, end, cuts, bursts, stamps, hits, count0, spec: beat?.spec ?? null, t1: `${base.title1}`.trim(), t2: `${base.title2}`.trim() };
}

// ---------- Paper World ----------
const PAPER = ['k1_boat_top', 'k2_stars_village', 'k3_jump_clouds', 'k4_star_sky'];
let paperImgs = null, paperLoad = null;
const paperReady = () => (paperLoad ??= Promise.all(PAPER.map((n) => loadImage(`assets/paper/${n}.jpg`))).then((a) => { paperImgs = a; }).catch(() => { paperLoad = null; }));
const STAR_COLS = ['#ffd278', '#ff96aa', '#ffbe5a', '#ffffff', '#ffe196'];
const starSprites = [];
function starSprite(i) {
  if (starSprites[i]) return starSprites[i];
  const S = 96, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), m = S / 2, pts = [];
  for (let k = 0; k < 10; k++) { const r = S * (k % 2 ? 0.2 : 0.46), a = -Math.PI / 2 + k * Math.PI / 5; pts.push([m + r * Math.cos(a), m + r * Math.sin(a)]); }
  g.fillStyle = STAR_COLS[i]; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,.14)';   // the folded faces
  for (let k = 0; k < 10; k += 2) { const a = pts[k], b = pts[(k + 1) % 10]; g.beginPath(); g.moveTo(m, m); g.lineTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.closePath(); g.fill(); }
  return (starSprites[i] = c);
}
function putStar(ctx, i, x, y, size, rot, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot);
  ctx.shadowColor = 'rgba(60,20,60,.3)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 6;
  ctx.drawImage(starSprite(i % STAR_COLS.length), -size / 2, -size / 2, size, size); ctx.restore();
}
function fallingStars(ctx, f, n = 34) {
  for (let i = 0; i < n; i++) {
    const t = f / FPS, y = ((hash(i, 1) * (H + 400) + (60 + hash(i, 2) * 130) * t) % (H + 400)) - 200;
    const x = hash(i, 3) * W + (10 + hash(i, 4) * 40) * Math.sin(t * 1.3 + hash(i, 5) * 6.28);
    putStar(ctx, i, x, y, 26 + hash(i, 6) * 66, hash(i, 7) * 6.28 + (hash(i, 8) - 0.5) * 2.8 * t);
  }
}
function starBurst(ctx, f, f0, n = 40, power = 1) {
  const u = (f - f0) / FPS;
  if (u < 0 || u > 1.3) return;
  for (let i = 0; i < n; i++) {
    const a = hash(i, f0) * 6.28, sp = (500 + hash(i, f0 + 1) * 1200) * power, r = sp * (1 - Math.exp(-2.6 * u)) / 2.6;
    putStar(ctx, i, W / 2 + Math.cos(a) * r, H * 0.55 + Math.sin(a) * r + 260 * u * u, 30 + hash(i, f0 + 2) * 80, hash(i, f0 + 3) * 6.28 + 5 * u, Math.min(1, (1.3 - u) * 2));
  }
}
const PIP = { x: 672, y: 1120, w: 356, h: 633 };
// Letters drop in one at a time and bounce; rounded type with a dark paper edge.
function bounceText(ctx, lines, f, f0, f1, col, startY = 600) {
  const out = clamp((f1 - f) / 6);
  let size = 220;
  ctx.font = `${size}px ${F_JUA}`;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
  if (widest > 940) size = Math.floor(size * 940 / widest);
  ctx.font = `${size}px ${F_JUA}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  const total = lines.reduce((s, l) => s + [...l.replace(/\s/g, '')].length, 0);
  const each = Math.min(5, 50 / Math.max(1, total)); let n = 0;
  lines.forEach((ln, li) => {
    const tw = ctx.measureText(ln).width; let x = (W - tw) / 2; const y0 = startY + li * size * 1.22;
    for (const ch of ln) {
      const adv = ctx.measureText(ch).width;
      if (ch !== ' ') {
        const u = (f - f0 - n * each) / FPS; n++;
        if (u >= 0) {
          const s = 1 + 0.55 * Math.exp(-7 * u) * Math.cos(16 * u), cx = x + adv / 2, y = y0 + 22 * Math.sin((f / FPS) * 2.2 + n);
          ctx.save(); ctx.globalAlpha = out; ctx.translate(cx, y); ctx.scale(s, s);
          ctx.lineWidth = Math.max(12, size * 0.14); ctx.strokeStyle = '#2a1a50'; ctx.strokeText(ch, 0, 0);
          ctx.fillStyle = col; ctx.fillText(ch, 0, 0); ctx.restore();
        }
      }
      x += adv;
    }
  });
  ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}
function drawPaperWorld(ctx, f, N, d) {
  resetCtx(ctx);
  const { images, g, swaps, stage, hero, cheers, end } = d;
  // 0 = the small window, 1 = the whole frame
  let open = 0;
  for (const s of swaps) { const u = (f - s.f + 1) / 10; if (u > 0) { const e = easeOut(u); open = s.open ? e : 1 - e; } }

  const c = atCut(hero, Math.min(f, end - 1)), src = images[c.img % images.length];
  const p = c.slow ? (f - c.f0) / (c.f1 - c.f0) : kickProgress(g, c, f);

  if (open < 0.999) {
    const st = atCut(stage, f), u = (f - st.f0) / (st.f1 - st.f0), a = st.a, b = st.b;
    if (paperImgs) {
      const im = paperImgs[st.img];
      const z = a[2] + (b[2] - a[2]) * u, s = Math.max(W / im.width, H / im.height) * z;
      const dw = im.width * s, dh = im.height * s;
      const cx = im.width * s * (a[0] + (b[0] - a[0]) * u), cy = im.height * s * (a[1] + (b[1] - a[1]) * u);
      ctx.drawImage(im, clamp(W / 2 - cx, W - dw, 0), clamp(H / 2 - cy, H - dh, 0), dw, dh);
    } else { ctx.fillStyle = '#3a2a6a'; ctx.fillRect(0, 0, W, H); }
    fallingStars(ctx, f);
    const x = PIP.x * (1 - open), y = PIP.y * (1 - open), w = PIP.w + (W - PIP.w) * open, h = PIP.h + (H - PIP.h) * open, bd = 14 * (1 - open);
    ctx.fillStyle = 'rgba(40,20,60,.28)'; ctx.fillRect(x + 12, y + 14, w + bd, h + bd);
    ctx.fillStyle = '#fbfaf5'; ctx.fillRect(x - bd, y - bd, w + bd * 2, h + bd * 2);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    camera(ctx, src, c.mv, p, x, y, w, h);
    ctx.restore();
  } else {
    camera(ctx, src, c.mv, p);
  }
  for (const s of swaps) if (s.open) {
    starBurst(ctx, f, s.f);
    const dd = f - s.f; if (dd >= 0 && dd < 5) flash(ctx, 0.55 * (1 - dd / 5));
  }
  if (open < 0.5) {
    if (d.titleTo && f < d.titleTo && d.titleLines.length) bounceText(ctx, d.titleLines, f, 2, d.titleTo, '#fff', 860);
    for (const q of cheers) if (f >= q.f0 && f < q.f1) bounceText(ctx, q.lines, f, q.f0, q.f1, q.col);
  }
  // the end is not a fade to black: light gathers, then the whole frame goes off
  const u = f - end;
  if (u >= -14) {
    if (u < 0) {
      const k = (u + 14) / 14, gr = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 1100);
      gr.addColorStop(0, `rgba(255,250,235,${0.9 * k * k})`); gr.addColorStop(1, 'rgba(255,250,235,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    } else {
      const r = easeOut(u / 8) * 1700, gr = ctx.createRadialGradient(W / 2, H / 2, r * 0.7, W / 2, H / 2, Math.max(1, r));
      gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, 'rgba(255,250,240,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      starBurst(ctx, f, end, 60, 1.2);
      flash(ctx, (u - 8) / 18, '#fffdf8');
      if (u > 12 && d.brandShown) {
        ctx.globalAlpha = easeOut((u - 12) / 10); ctx.textAlign = 'center';
        const sz = fitSize(ctx, d.brandShown, 120, F_JUA, 900); ctx.font = `${sz}px ${F_JUA}`; ctx.fillStyle = '#4a2a70'; ctx.fillText(d.brandShown, W / 2, H / 2);
        ctx.font = `24px ${F_SANS}`; ctx.letterSpacing = '6px'; ctx.fillStyle = 'rgba(74,42,112,.7)'; ctx.fillText('MADE WITH HER HOURS', W / 2, H / 2 + 80); ctx.letterSpacing = '0px'; ctx.globalAlpha = 1;
      }
    }
  }
}
function buildPaperWorld(base, beat) {
  paperReady();
  document.fonts?.load?.('80px "Jua"', `${base.brand} ${base.title1} ${base.title2} 넘어져도 괜찮아 다시 일어나면 돼 넌 최고야`).catch(() => {});
  const N = base.N ?? 960, g = gridOf(beat, N), sec = N / FPS;
  const end = snap(g, N - Math.min(66, N * 0.08));
  const firstHit = (beat?.hits ?? []).find((h) => h > N * 0.1 && h < N * 0.45) ?? snap(g, N * 0.2);
  const long = sec >= 28;
  const closeF = long ? snap(g, N * 0.55) : N + 1, reopen = long ? snap(g, N * 0.77) : N + 1;
  const swaps = [{ f: firstHit, open: true }];
  if (long) swaps.push({ f: closeF, open: false }, { f: reopen, open: true });
  const stage = [
    { f0: 0, f1: Math.round(firstHit / 2), img: 0, a: [0.5, 0.22, 1.35], b: [0.5, 0.62, 1.12] },
    { f0: Math.round(firstHit / 2), f1: firstHit, img: 2, a: [0.5, 0.55, 1.0], b: [0.5, 0.42, 1.5] },
    { f0: firstHit, f1: closeF, img: 2, a: [0.5, 0.42, 1.5], b: [0.5, 0.42, 1.55] },
  ];
  if (long) {
    const mid = Math.round((closeF + reopen) / 2);
    stage.push({ f0: closeF, f1: mid, img: 1, a: [0.5, 0.3, 1.5], b: [0.5, 0.62, 1.08] }, { f0: mid, f1: N + 1, img: 3, a: [0.5, 0.78, 1.45], b: [0.5, 0.45, 1.02] });
  }
  const moves = ['IN', 'L', 'U', 'OUT', 'R', 'IN', 'D'];
  const hero = []; let img = 0;
  const add = (from, to, every, mv, slow) => cutList(g, from, to, every, mv).forEach((c) => { c.img = img++; c.slow = slow; hero.push(c); });
  add(0, firstHit, 8, ['SLOW'], true);
  add(firstHit, Math.min(closeF, end), 2, moves);
  if (long) { add(closeF, reopen, 8, ['SLOW'], true); add(reopen, end, 2, moves); }
  hero.push({ f0: end, f1: N + 1, k: beatIndex(g, end), n: 1, img: img++, mv: 'SLOW', slow: true });
  const cheers = [];
  if (long) {
    const span = reopen - closeF, say = [[T('넘어져도', 'Fall down?'), T('괜찮아!', "That's okay!")], [T('다시', 'Get up'), T('일어나면 돼', 'and go again')], [T('넌 최고야!', "You're the best!")]];
    say.forEach((lines, i) => cheers.push({ f0: closeF + 10 + Math.round((span * i) / 3), f1: closeF + Math.round((span * (i + 1)) / 3), lines, col: i === 2 ? '#ffd278' : '#fff' }));
  }
  const hasBrand = base.brand && base.brand !== 'HER HOURS';
  return {
    ...base, g, end, swaps, stage, hero, cheers,
    titleTo: firstHit, titleLines: [base.title1, base.title2].map((s) => `${s}`.trim()).filter(Boolean),
    brandShown: hasBrand ? base.brand : `${base.title1}`.trim(),
  };
}

const slotsOf = (d) => { let m = 0; for (const c of d.cuts || d.hero) m = Math.max(m, c.img + 1); return m; };

export const HJ_LOOKS = [
  { id: 'red-run', lab: true, name: 'Red Run', sub: T('흑백에 빨강만 · RUN 띠와 초시계 · GO 도장 · 끝에 이름 카드', 'black and white, the reds kept · RUN strips with a timer · GO stamps · a name card'),
    draw: drawRedRun, build: buildRedRun, photo: { min: 10, shape: 'tall', slots: slotsOf } },
  { id: 'beat-turns', lab: true, kfont: true, name: 'Beat Turns', sub: T('박자마다 튀는 카메라 · 금속 이름 · 큰 글자 도장 · 연사 스틸', 'the camera kicks on the beat · a metal name · big stamps · burst stills'),
    draw: drawBeatTurns, build: buildBeatTurns, photo: { min: 12, shape: 'tall', slots: slotsOf } },
  { id: 'paper-world', lab: true, kfont: true, name: T('종이 세계', 'Paper World'), sub: T('종이 그림 무대 · 작은 화면이 터짐에 전체로 · 응원 문구 · 끝은 빛 폭발', 'a paper stage · a small window opens on the hit · cheers · a burst of light'),
    draw: drawPaperWorld, build: buildPaperWorld, ready: paperReady, photo: { min: 10, shape: 'tall', slots: slotsOf } },
];
