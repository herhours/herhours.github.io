// Her Hours Shorts — reads a song once and finds where the looks should cut.
// Looks that cut on the music (Triptych, later Black Cut / Pulse) need a beat and a few
// "hits" — the moments the song opens up. A user's own song arrives with neither, so they
// are measured here instead of typed in. Everything is in frames at 30fps.
const FPS = 30;

export function analyze(buf, seconds) {
  const sr = buf.sampleRate;
  const N = Math.min(Math.floor(seconds * FPS), Math.floor(buf.length / sr * FPS));
  const hop = sr / FPS;
  const chs = Math.min(2, buf.numberOfChannels);
  const data = [];
  for (let c = 0; c < chs; c++) data.push(buf.getChannelData(c));

  // loudness per video frame
  const energy = new Float32Array(N);
  for (let f = 0; f < N; f++) {
    const a = Math.floor(f * hop), b = Math.min(buf.length, Math.floor((f + 1) * hop));
    let s = 0;
    for (let c = 0; c < chs; c++) { const d = data[c]; for (let i = a; i < b; i += 4) s += d[i] * d[i]; }
    energy[f] = Math.sqrt(s / Math.max(1, (b - a) / 4 * chs));
  }

  // onset strength: how much louder this frame is than the one before (log scale, rises only)
  const onset = new Float32Array(N);
  for (let f = 1; f < N; f++) onset[f] = Math.max(0, Math.log1p(energy[f] * 50) - Math.log1p(energy[f - 1] * 50));

  // beat length: autocorrelation of the onsets over 60..180 bpm
  let best = 15, bestV = -1;
  for (let lag = 10; lag <= 30; lag++) {
    let v = 0;
    for (let f = lag; f < N; f++) v += onset[f] * onset[f - lag];
    v /= (N - lag);
    if (v > bestV) { bestV = v; best = lag; }
  }
  const beat = best;

  // a cut period of 2, 4 or 8 beats that lands near the 3.3s the approved Triptych used
  let period = beat;
  while (period < 66) period *= 2;
  if (period > 132) period /= 2;

  // hits: where the 2-second loudness jumps the most — the song "opening up".
  // At most three, at least 6s apart, none in the first 3s (the title owns that).
  const avg = (from, to) => { let s = 0, n = 0; for (let f = Math.max(0, from); f < Math.min(N, to); f++) { s += energy[f]; n++; } return n ? s / n : 0; };
  const jumps = [];
  for (let f = 90; f < N - 30; f += 3) jumps.push({ f, v: avg(f, f + 60) - avg(f - 60, f) });
  jumps.sort((a, b) => b.v - a.v);
  const hits = [];
  for (const j of jumps) {
    if (j.v <= 0 || hits.length >= 3) break;
    if (hits.every((h) => Math.abs(h - j.f) >= 180)) hits.push(snapToOnset(onset, j.f, 12));
  }
  hits.sort((a, b) => a - b);

  // the loudest stretch decides when the look turns up (sparks go to full)
  const chorusFrom = hits.length ? hits[Math.min(1, hits.length - 1)] : Math.round(N / 2);

  return { beat, period, hits, chorusFrom, energy, spec: spectrum(data, sr, N, hop) };
}

// ---------- per-frame spectrum, for the looks that draw the music (Pulse) ----------
// 128 log-spaced bands from 40Hz to 16kHz, scaled so the song's loud moments sit near 0.25 —
// the range the approved Pulse (Remotion visualizeAudio) was tuned on (0.2 reads closest by eye).
export const BANDS = 128;
const FFT = 2048;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

function spectrum(data, sr, N, hop) {
  const out = new Float32Array(N * BANDS);
  const win = new Float32Array(FFT);
  for (let i = 0; i < FFT; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FFT - 1));
  // band edges in FFT bins
  const edge = [];
  for (let b = 0; b <= BANDS; b++) edge.push(Math.max(1, Math.round(40 * Math.pow(16000 / 40, b / BANDS) * FFT / sr)));
  const re = new Float32Array(FFT), im = new Float32Array(FFT);
  for (let f = 0; f < N; f++) {
    const c = Math.floor((f + 0.5) * hop) - FFT / 2;
    for (let i = 0; i < FFT; i++) {
      const k = c + i;
      let v = 0;
      if (k >= 0 && k < data[0].length) { for (const d of data) v += d[k]; v /= data.length; }
      re[i] = v * win[i]; im[i] = 0;
    }
    fft(re, im);
    for (let b = 0; b < BANDS; b++) {
      let m = 0;
      const hi = Math.max(edge[b] + 1, edge[b + 1]);
      for (let k = edge[b]; k < hi; k++) m = Math.max(m, Math.hypot(re[k], im[k]));
      // tilt up the highs a little, or the top half of the ring never moves
      out[f * BANDS + b] = m * (1 + 2 * b / BANDS);
    }
  }
  // normalise on the song itself: its 98th percentile becomes 0.2
  const sorted = Float32Array.from(out).sort();
  const p98 = sorted[Math.floor(sorted.length * 0.98)] || 1;
  for (let i = 0; i < out.length; i++) out[i] = out[i] / p98 * 0.2;
  return out;
}

// move a hit onto the strongest attack nearby, so the flash lands on the drum, not before it
function snapToOnset(onset, f, r) {
  let bf = f, bv = -1;
  for (let i = Math.max(0, f - r); i < Math.min(onset.length, f + r); i++) if (onset[i] > bv) { bv = onset[i]; bf = i; }
  return bf;
}
