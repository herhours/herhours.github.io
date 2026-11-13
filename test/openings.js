// Her Hours Shorts — each look's own opening (11-13 영샘: "시작과 끝을 명확하게" → 3번 "템플릿마다 자기 시작 동작").
// Drawn over the look's own first frames (0.6~0.9s) after the look has drawn, so the looks themselves are unchanged and
// the opening still lands on frame 0 (쇼츠 0초 훅: never a black or empty first second - something moves at once).
// The ending is shared and lives in core.js (finishFrame + fadeTail).
const W = 1080, H = 1920, FPS = 30;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const out = (t, p = 3) => 1 - Math.pow(1 - clamp(t), p);
const back = (t) => { const x = clamp(t), c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const SANS = '"HHDisplay","HHKr","Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';

let snap = null;
function grab(ctx) {   // the look's frame, kept aside so the opening can reveal it through a shape
  if (!snap) { snap = document.createElement('canvas'); snap.width = W; snap.height = H; }
  const g = snap.getContext('2d'); g.clearRect(0, 0, W, H); g.drawImage(ctx.canvas, 0, 0, W, H); return snap;
}
const black = (ctx, a = 1) => { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); };
const flash = (ctx, a, col = '#fff') => { if (a <= 0) return; ctx.save(); ctx.globalAlpha = clamp(a); ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); ctx.restore(); };

// Clockface · 하루 — the hands spin from midnight to the day's first hour and stop, then a soft flash
function clockDay(ctx, f) {
  const t = f / FPS; if (t >= 0.9) return;
  const k = out(t / 0.7, 4), fade = 1 - clamp((t - 0.62) / 0.2);
  black(ctx, 0.55 * fade);
  ctx.save(); ctx.translate(W / 2, H * 0.44); ctx.globalAlpha = fade; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
  ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 300, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.lineWidth = i % 3 ? 4 : 9; ctx.beginPath(); ctx.moveTo(Math.sin(a) * 255, -Math.cos(a) * 255); ctx.lineTo(Math.sin(a) * 290, -Math.cos(a) * 290); ctx.stroke(); }
  const minA = k * Math.PI * 2 * 3, hrA = k * Math.PI * 2 * 0.42;   // three turns of the minute hand ≈ midnight → 5am
  ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(hrA) * 160, -Math.cos(hrA) * 160); ctx.stroke();
  ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(minA) * 240, -Math.cos(minA) * 240); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  flash(ctx, (1 - Math.abs(t - 0.72) / 0.1) * 0.45);
}
// Clockface · 밤 — dark, then a lamp clicks on and its warm light opens the frame
function clockNight(ctx, f) {
  const t = f / FPS; if (t >= 0.85) return;
  const g = grab(ctx); black(ctx);
  const cx = W * 0.5, cy = H * 0.2;
  if (t < 0.1) { ctx.save(); ctx.fillStyle = '#ffcf8a'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return; }
  const r = 40 + out((t - 0.1) / 0.6, 3) * 2200;
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(g, 0, 0);
  const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  rg.addColorStop(0, 'rgba(255,214,150,0.35)'); rg.addColorStop(0.7, 'rgba(255,170,90,0.12)'); rg.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); ctx.restore();
}
// Window Band — blinds: ten slats open from the middle of each, top to bottom
function windowBand(ctx, f) {
  const t = f / FPS; if (t >= 0.7) return;
  const n = 10, sh = H / n; ctx.save(); ctx.fillStyle = '#050506';
  for (let i = 0; i < n; i++) {
    const o = out((t - i * 0.03) / 0.38, 3), hgt = sh * (1 - o);
    if (hgt > 0.5) ctx.fillRect(0, i * sh + (sh - hgt) / 2, W, hgt);
  }
  ctx.restore();
}
// Triptych — the three panels drop in one after another
function triptych(ctx, f) {
  const t = f / FPS; if (t >= 0.85) return;
  const g = grab(ctx); black(ctx);
  for (let i = 0; i < 3; i++) {
    const u = (t - 0.06 - i * 0.16) / 0.3; if (u <= 0) continue;
    const y = -H * 0.35 * (1 - back(u));
    ctx.save(); ctx.beginPath(); ctx.rect(0, (i * H) / 3, W, H / 3 + 1); ctx.clip(); ctx.drawImage(g, 0, y); ctx.restore();
  }
}
// Black Cut · 실내 — an old film leader, 3·2·1 in 0.9s
function leader(ctx, f, N, d) {
  const t = f / FPS; if (t >= 0.9) return;
  const g = grab(ctx);
  ctx.save(); ctx.filter = 'grayscale(1) brightness(0.45) contrast(1.2)'; ctx.drawImage(g, 0, 0); ctx.restore();
  const num = 3 - Math.floor(t / 0.3), u = (t % 0.3) / 0.3, cx = W / 2, cy = H * 0.46;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 420, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 7;
  for (const r of [330, 400]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx - 470, cy); ctx.lineTo(cx + 470, cy); ctx.moveTo(cx, cy - 470); ctx.lineTo(cx, cy + 470); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `700 360px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(num), cx, cy + 14);
  ctx.restore();
  flash(ctx, (t - 0.84) / 0.06 * 0.6);
}
// Black Cut · 길 위 — two headlights flare out of the dark, a white-out, the road
function headlights(ctx, f) {
  const t = f / FPS; if (t >= 0.8) return;
  const g = grab(ctx);
  if (t < 0.48) {
    black(ctx);
    const a = out(t / 0.45, 2);
    for (const x of [W * 0.32, W * 0.68]) {
      const rg = ctx.createRadialGradient(x, H * 0.56, 0, x, H * 0.56, 120 + 520 * a);
      rg.addColorStop(0, `rgba(255,250,235,${0.95 * a})`); rg.addColorStop(0.25, `rgba(255,226,170,${0.5 * a})`); rg.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }
    return;
  }
  ctx.drawImage(g, 0, 0); flash(ctx, 1 - (t - 0.48) / 0.3, '#fff8ea');
}
// Pulse — a ring bursts from the middle and the picture is inside it
function ring(ctx, f, N, d) {
  const t = f / FPS; if (t >= 0.7) return;
  const g = grab(ctx), r = 20 + out(t / 0.62, 3) * 1250, cx = W / 2, cy = H * 0.47;
  black(ctx);
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(g, 0, 0); ctx.restore();
  ctx.save(); ctx.strokeStyle = d?.accent || '#7ad7ff'; ctx.lineWidth = 16; ctx.shadowColor = d?.accent || '#7ad7ff'; ctx.shadowBlur = 40;
  ctx.globalAlpha = 1 - clamp((t - 0.45) / 0.25); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
// Lyric Bloom — the song's name slams in full-screen, then gets out of the way
function slam(ctx, f, N, d) {
  const t = f / FPS; if (t >= 0.65) return;
  const text = `${d?.title1 || ''}`.trim() || `${d?.title || ''}`.trim(); if (!text) return;
  const k = out(t / 0.14, 3), fade = 1 - clamp((t - 0.45) / 0.2);
  black(ctx, 0.5 * fade);
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(W / 2, H * 0.45); ctx.scale(1.25 - 0.25 * k, 1.25 - 0.25 * k);   // 1.55 는 0초에 글자가 화면 밖으로 잘림
  let s = 190; ctx.font = `800 ${s}px ${SANS}`; const w = ctx.measureText(text).width; if (w > W * 0.72) { s *= (W * 0.72) / w; ctx.font = `800 ${s}px ${SANS}`; }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30; ctx.fillText(text, 0, 0);
  ctx.restore();
}
// Halloween — a candle flares up from below, bats cross, the arch is there
function candle(ctx, f) {
  const t = f / FPS; if (t >= 0.95) return;
  const g = grab(ctx); black(ctx);
  const cx = W / 2, cy = H * 0.86, fl = 1 + 0.08 * Math.sin(t * 60), r = (60 + out((t - 0.08) / 0.7, 3) * 2300) * fl;
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(g, 0, 0);
  const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, 'rgba(255,150,60,0.35)'); rg.addColorStop(1, 'rgba(20,0,30,0.5)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); ctx.restore();
  ctx.save(); ctx.fillStyle = '#0a0410';
  for (let i = 0; i < 9; i++) {
    const u = (t - 0.15 - i * 0.04) / 0.6; if (u <= 0 || u >= 1) continue;
    const x = -120 + u * (W + 240), y = H * (0.18 + 0.06 * i) + Math.sin(u * 9 + i) * 30, s = 0.8 + (i % 3) * 0.35, flap = Math.sin(t * 40 + i * 2) * 0.6;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.beginPath();
    ctx.moveTo(0, 0); ctx.quadraticCurveTo(-30, -26 - flap * 26, -62, -6 + flap * 10); ctx.quadraticCurveTo(-40, -2, -28, 12); ctx.quadraticCurveTo(-14, 2, 0, 10);
    ctx.quadraticCurveTo(14, 2, 28, 12); ctx.quadraticCurveTo(40, -2, 62, -6 + flap * 10); ctx.quadraticCurveTo(30, -26 - flap * 26, 0, 0); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

// reveals out of the dark start a few frames in, so frame 0 already shows something (쇼츠 0초 — first check had six black frame-0s)
const lead = (fn, k = 4) => (ctx, f, N, d) => fn(ctx, f + k, N, d);
export const OPENINGS = {
  'clockface-day': clockDay, 'clockface-night': lead(clockNight), windowband: lead(windowBand), triptych: lead(triptych),
  'blackcut-room': leader, 'blackcut-road': lead(headlights), pulse: lead(ring), lyricbloom: slam, halloween: lead(candle),
};
// how long each one lasts (frames) - the look's draw is wrapped only for those frames
export const OPENING_LEN = 30;
