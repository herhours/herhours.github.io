// Her Hours Shorts — video clips as picture sources.
// A clip becomes a canvas the looks draw exactly like a photo; only what is painted into
// that canvas changes. Preview copies a muted, looping <video>; export decodes the file
// frame by frame (mediabunny CanvasSink) so every frame of the mp4 is the right one.
import { Input, BlobSource, ALL_FORMATS, CanvasSink } from 'mediabunny';

const LONG = 1280;      // looks never draw a source bigger than the 1080x1920 frame
const MAX_CLIP = 12;    // seconds of a clip that are used; longer clips loop their first 12s

export const isVideoFile = (f) => f.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(f.name);

export async function fileToClip(file) {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error('no video track');
  if (!(await track.canDecode())) throw new Error(T('이 브라우저가 못 여는 영상 형식', 'a video format this browser can’t open'));
  const start = await track.getFirstTimestamp();
  const dur = Math.min(MAX_CLIP, (await track.computeDuration()) - start);
  const w0 = track.displayWidth, h0 = track.displayHeight;
  const s = Math.min(1, LONG / Math.max(w0, h0));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(w0 * s)); canvas.height = Math.max(2, Math.round(h0 * s));
  canvas.live = true;

  const video = document.createElement('video');
  video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
  video.src = URL.createObjectURL(file);
  video.addEventListener('timeupdate', () => { if (video.currentTime > dur) video.currentTime = 0; });
  canvas.clip = { input, track, start, dur, video, file, audio: undefined, videoOk: null };
  // Android Chrome plays some phones' HEVC through its own player, and painting that <video> onto a canvas
  // taints it - every canvas it touches can then never become a VideoFrame, and the export fails (영샘's
  // phone, 10-04). So the <video> is painted only after a throwaway canvas proves it is clean; otherwise
  // the preview decodes the clip itself, the way the export already does.
  video.addEventListener('loadeddata', () => {
    try {
      const probe = document.createElement('canvas'); probe.width = probe.height = 2;
      const g = probe.getContext('2d'); g.drawImage(video, 0, 0, 2, 2); g.getImageData(0, 0, 1, 1);
      canvas.clip.videoOk = true;
    } catch { canvas.clip.videoOk = false; }
  }, { once: true });

  // paint the first frame now, so the clip is never an empty rectangle
  const first = await new CanvasSink(track, { width: canvas.width, height: canvas.height, fit: 'fill' }).getCanvas(start);
  if (first) canvas.getContext('2d').drawImage(first.canvas, 0, 0);
  video.play().catch(() => {});
  return canvas;
}

// preview: copy whatever each <video> is showing right now
export function tickPreview(sources) {
  for (const c of sources) {
    if (!c.live) continue;
    const v = c.clip.video;
    if (v.paused) v.play().catch(() => {});
    if (c.clip.videoOk === true) { if (v.readyState >= 2) c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); }
    else if (c.clip.videoOk === false) decodedTick(c);
  }
}

// preview for a clip whose <video> would taint the canvas: decode frames in step with the clock
function decodedTick(c) {
  const k = c.clip;
  if (k.busy) return;
  k.busy = true;
  const t = ((performance.now() - (k.t0 ??= performance.now())) / 1000) % k.dur;
  (async () => {
    if (!k.it || t < k.lastT) {
      await k.it?.return?.();
      k.it = new CanvasSink(k.track, { width: c.width, height: c.height, fit: 'fill', poolSize: 2 }).canvases(k.start, k.start + k.dur);
      k.nxt = (await k.it.next()).value ?? null;
    }
    let cur = null;
    while (k.nxt && k.nxt.timestamp - k.start <= t) { cur = k.nxt; k.nxt = (await k.it.next()).value ?? null; }
    if (cur) c.getContext('2d').drawImage(cur.canvas, 0, 0);
    k.lastT = t;
  })().catch(() => {}).finally(() => { k.busy = false; });
}

export function pausePreview(sources) { for (const c of sources) if (c.live) c.clip.video.pause(); }

// ---------- clip sound ----------
// A clip's own sound (snow under skis, wind, a street) plays only while that clip is on
// screen, under the song. Which clip is on screen is whatever the look actually drew, so
// every look gets this without knowing about it.

export async function clipAudio(c) {
  if (c.clip.audio !== undefined) return c.clip.audio;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
    try { c.clip.audio = await ac.decodeAudioData(await c.clip.file.arrayBuffer()); }
    finally { try { await ac.close(); } catch {} }
  } catch { c.clip.audio = null; }   // a clip with no sound track is fine
  if (c.clip.audio) c.clip.rms = rms(c.clip.audio, c.clip.start, c.clip.dur);
  return c.clip.audio;
}

export function rms(buf, from = 0, sec = Infinity) {
  let s = 0, n = 0;
  const a = Math.floor(from * buf.sampleRate), b = Math.min(buf.length, a + sec * buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = a; i < b; i += 4) { s += d[i] * d[i]; n++; } }
  return n ? Math.sqrt(s / n) : 0;
}

// Phone clips differ by 30dB+ (measured on 41 of 영샘's own: wind at song level, a quiet
// room 32dB under it). Each clip is first brought to the song's loudness, then the slider
// sets how far under the song it sits. A near-silent clip is lifted at most +18dB so its
// hiss does not become the sound.
export const MAX_LIFT = 8;
export function clipLevel(c, musicRms, gain) {
  if (!c.clip.rms) return 0;
  return gain * Math.min(MAX_LIFT, musicRms / c.clip.rms);
}

// Records every live source a draw call paints. Wrap once; read `seen` after each draw.
export function watchDraws(ctx) {
  const seen = new Set();
  const orig = ctx.drawImage.bind(ctx);
  ctx.drawImage = (img, ...rest) => { if (img && img.live) seen.add(img); return orig(img, ...rest); };
  return seen;
}

// Dry run of the look: which clips are on screen in each frame.
export function scanVisibility(draw, ctx, seen, d, N) {
  const vis = [];
  for (let f = 0; f < N; f++) { seen.clear(); draw(ctx, f, N, d); vis.push(new Set(seen)); }
  return vis;
}

// song + each clip's sound where it is seen, at `gain`, with 25ms ramps and a soft ceiling
export async function mixClipSound(music, sources, vis, gain, fps) {
  const clips = sources.filter((c) => c.live);
  if (!clips.length || gain <= 0) return music;
  const sr = music.sampleRate, len = music.length, chs = music.numberOfChannels;
  const out = new AudioBuffer({ length: len, numberOfChannels: chs, sampleRate: sr });
  for (let ch = 0; ch < chs; ch++) out.getChannelData(ch).set(music.getChannelData(ch));
  const k = 1 - Math.exp(-1 / (0.025 * sr));
  const musicRms = rms(music);
  let any = false;
  for (const c of clips) {
    const a = await clipAudio(c);
    if (!a) continue;
    any = true;
    const loop = Math.min(c.clip.dur, a.duration);
    const off = Math.round(c.clip.start * sr);
    const srcs = [], dsts = [];
    for (let ch = 0; ch < chs; ch++) { srcs.push(a.getChannelData(Math.min(ch, a.numberOfChannels - 1))); dsts.push(out.getChannelData(ch)); }
    const loopN = Math.max(1, Math.floor(loop * sr));
    // Ride the clip under the song moment by moment: a clip set against the song's average
    // still drowned the quiet intro (measured -2dB in a 영샘 test). Each frame the clip's
    // own 0.5s loudness is set to `gain` times the song's 0.5s loudness. Lift is capped so
    // a silent gap is not pumped into hiss; the lowest target over ±3 frames is used so a
    // sudden loud moment (a gust, a shout) is turned down before it arrives.
    const NF = vis.length, half = Math.round(0.25 * sr);
    const win = (d, centre, map) => { let s = 0, n = 0; for (let i = centre - half; i < centre + half; i += 8) { const j = map(i); if (j >= 0 && j < d.length) { s += d[j] * d[j]; n++; } } return n ? Math.sqrt(s / n) : 0; };
    const md = music.getChannelData(0);
    const raw = new Float32Array(NF);
    for (let f = 0; f < NF; f++) {
      if (!vis[f].has(c)) continue;
      const i0 = Math.round(f / fps * sr);
      const mLoc = win(md, i0, (i) => i);
      const cLoc = win(srcs[0], i0, (i) => off + (((i % loopN) + loopN) % loopN));
      raw[f] = gain * Math.min(MAX_LIFT, mLoc / Math.max(cLoc, (c.clip.rms || 1e-4) * 0.25, 1e-5));
    }
    const target = new Float32Array(NF);
    for (let f = 0; f < NF; f++) {
      if (!vis[f].has(c)) continue;
      let lo = raw[f];
      for (let g = Math.max(0, f - 3); g <= Math.min(NF - 1, f + 3); g++) if (vis[g].has(c)) lo = Math.min(lo, raw[g]);
      target[f] = lo;
    }
    let env = 0;
    for (let i = 0; i < len; i++) {
      const f = Math.min(NF - 1, Math.floor(i / sr * fps));
      env += (target[f] - env) * k;
      if (env < 1e-4) continue;
      const j = off + (i % loopN);
      if (j >= a.length) continue;
      for (let ch = 0; ch < chs; ch++) dsts[ch][i] += srcs[ch][j] * env;
    }
  }
  if (!any) return music;
  // soft knee above 0.8 so a loud clip over a loud chorus bends instead of clipping
  for (let ch = 0; ch < chs; ch++) {
    const d = out.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const x = d[i], ax = Math.abs(x);
      if (ax > 0.8) d[i] = Math.sign(x) * (0.8 + 0.2 * Math.tanh((ax - 0.8) / 0.2));
    }
  }
  return out;
}

// export: returns an async function that paints every clip at video time t (seconds).
// Clips play continuously and loop, decoded in order — one pass, no seeking per frame.
export function exportStepper(sources) {
  const clips = sources.filter((c) => c.live);
  const state = clips.map((c) => ({ c, it: null, cur: null, nxt: null, loop: -1 }));
  const open = (st) => {
    const { track, start, dur } = st.c.clip;
    const sink = new CanvasSink(track, { width: st.c.width, height: st.c.height, fit: 'fill', poolSize: 3 });
    st.it = sink.canvases(start, start + dur);
  };
  const step = async (t) => {
    for (const st of state) {
      const { start, dur } = st.c.clip;
      const loop = Math.floor(t / dur);
      const local = start + (t - loop * dur);
      // close the previous pass, or its decoded frames are left for the garbage collector
      if (loop !== st.loop) { st.loop = loop; await st.it?.return?.(); open(st); st.cur = (await st.it.next()).value ?? null; st.nxt = (await st.it.next()).value ?? null; }
      while (st.nxt && st.nxt.timestamp <= local) { st.cur = st.nxt; st.nxt = (await st.it.next()).value ?? null; }
      if (st.cur) st.c.getContext('2d').drawImage(st.cur.canvas, 0, 0);
    }
  };
  step.close = async () => { for (const st of state) await st.it?.return?.(); };
  return step;
}
