// Her Hours Shorts — UI controller shared by both shells (A: sheet, B: rail).
// The shell supplies the markup and two hooks (window.hhOpen / window.hhClose); everything
// below is identical in both so the two designs cannot drift apart in behaviour.
import { W, H, FPS, MAX_SEC, loadFonts, fileToBitmap, drawFrame, decodeAudio, trimBuffer,
         encode, buildData, loadDemo, loadTemplate, canEncodeAudio, canEncodeVideo } from './core.js';

const $ = (id) => document.getElementById(id);
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const S = {
  tpl: null, images: [], photoFiles: [], demo: [],
  useOurs: true, audioFile: null,
  d: null, N: 960, seconds: MAX_SEC,
  vf: 0,            // virtual frame shown while the song is not playing
  started: false,   // has the user pressed play at least once
  busy: false, blob: null, every: 1,
};

const stage = $('stage');
const ctx = stage.getContext('2d', { alpha: false });
const pv = $('pv');

// ---------- data ----------
function rebuild() {
  S.d = buildData({
    tpl: S.tpl,
    images: S.images.length ? S.images : S.demo,
    useOurs: S.useOurs,
    brand: $('brand').value, title1: $('t1').value, title2: $('t2').value,
  });
}

function chips() {
  // Shell B has no menu pane, so every label is optional.
  const photo = S.photoFiles.length ? `내 사진 ${S.photoFiles.length}장` : '데모 사진 6장';
  const song = S.useOurs ? 'Green Light on the Window' : (S.audioFile?.name || '내 음악');
  const text = `${$('brand').value} · ${$('t1').value}`;
  const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  set('vPhoto', photo); set('vSong', song); set('vText', text);
  set('vSum', `${photo} · ${song}`);
  document.querySelectorAll('[data-chip="photo"]').forEach((e) => e.classList.toggle('mine', !!S.photoFiles.length));
  document.querySelectorAll('[data-chip="song"]').forEach((e) => e.classList.toggle('mine', !S.useOurs));
}

// ---------- preview loop ----------
// The moving preview is content, not decoration — but a reader who asked for less motion
// gets a still frame until they press play.
const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
let last = performance.now(), acc = 0, tick = 0, drawMs = 16;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(100, now - last); last = now;
  if (document.hidden || document.body.classList.contains('is-making')) return;

  if (!pv.paused) S.vf = Math.round(pv.currentTime * FPS);
  else if (!S.started && !calm.matches) { acc += dt; while (acc >= 1000 / FPS) { acc -= 1000 / FPS; S.vf++; } }
  if (S.vf >= S.N) { S.vf = 0; if (!pv.paused) pv.currentTime = 0; }

  tick++;
  if (S.every > 1 && tick % S.every) return;
  if (!S.d) return;
  const t0 = performance.now();
  drawFrame(ctx, S.vf, S.N, S.d);
  drawMs = drawMs * 0.9 + (performance.now() - t0) * 0.1;
  // a cheap frame is worth 30fps; an expensive one is not worth dropping the whole phone
  S.every = drawMs > 26 ? 3 : drawMs > 17 ? 2 : 1;

  if (!seeking) $('seek').value = S.vf;
  $('tnow').textContent = mmss(S.vf / FPS);
}

let seeking = false;
$('seek').addEventListener('pointerdown', () => { seeking = true; });
$('seek').addEventListener('input', (e) => {
  S.vf = +e.target.value; S.started = true;
  if (!pv.paused) pv.currentTime = S.vf / FPS;
  $('tnow').textContent = mmss(S.vf / FPS);
});
$('seek').addEventListener('pointerup', () => { seeking = false; });
$('seek').addEventListener('change', () => { seeking = false; });

async function togglePlay() {
  if (document.body.classList.contains('is-making') || document.body.classList.contains('is-done')) return;
  if (pv.paused) {
    S.started = true;
    try { pv.currentTime = S.vf / FPS; await pv.play(); } catch { /* no audio: keep the silent loop running */ S.started = false; }
  } else pv.pause();
  syncPlay();
}
function syncPlay() { document.body.classList.toggle('is-playing', !pv.paused); }
pv.addEventListener('play', syncPlay);
pv.addEventListener('pause', syncPlay);
$('play').onclick = (e) => { e.stopPropagation(); togglePlay(); };
$('tap').onclick = togglePlay;

function setDuration(sec) {
  S.seconds = Math.min(MAX_SEC, sec || MAX_SEC);
  S.N = Math.round(S.seconds * FPS);
  $('seek').max = S.N - 1;
  $('tdur').textContent = mmss(S.seconds);
}

// ---------- inputs ----------
$('photos').onchange = async (e) => {
  const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  S.photoFiles = files;
  const th = $('thumbs'); th.innerHTML = '';
  for (const f of files.slice(0, 24)) { const im = document.createElement('img'); im.src = URL.createObjectURL(f); th.appendChild(im); }
  chips();
  $('phint').textContent = '사진 읽는 중…';
  const r = await Promise.allSettled(files.map(fileToBitmap));
  const ok = r.filter((x) => x.status === 'fulfilled').map((x) => x.value);
  const bad = r.map((x, i) => (x.status === 'rejected' ? files[i].name : null)).filter(Boolean);
  if (ok.length) { S.images = ok; rebuild(); }
  $('phint').textContent = bad.length
    ? `${ok.length}장 적용. 못 읽은 파일: ${bad.join(', ')} (HEIC면 갤러리에서 JPG로 저장해 주세요)`
    : `${ok.length}장 적용됐어요. 위 미리보기에서 바로 돌아가요.`;
};

$('useDemo').onclick = () => {
  S.photoFiles = []; S.images = []; $('thumbs').innerHTML = '';
  $('photos').value = ''; $('phint').textContent = '데모 사진 6장으로 보여주는 중.';
  rebuild(); chips();
};

$('useOurs').onclick = () => {
  S.useOurs = true; S.audioFile = null; $('audio').value = '';
  pv.pause(); pv.src = 'assets/green_light.mp3';
  setDuration(MAX_SEC);
  $('t1').value = S.tpl.title1; $('t2').value = S.tpl.title2;
  $('shint').textContent = '가사가 박자에 맞춰 켜져요.';
  rebuild(); chips(); syncPlay();
};

$('audio').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  S.useOurs = false; S.audioFile = f;
  pv.pause();
  pv.src = URL.createObjectURL(f);
  await new Promise((r) => { pv.onloadedmetadata = r; setTimeout(r, 3000); });
  setDuration(pv.duration);
  const base = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().toUpperCase().split(' ');
  $('t1').value = base.slice(0, Math.ceil(base.length / 2)).join(' ').slice(0, 14) || 'MY SONG';
  $('t2').value = base.slice(Math.ceil(base.length / 2)).join(' ').slice(0, 18) || 'ON MY PHONE';
  $('shint').textContent = `앞 ${Math.round(S.seconds)}초를 써요. 내 음악에는 가사가 안 나와요.`;
  rebuild(); chips(); syncPlay();
};

for (const id of ['brand', 't1', 't2']) $(id).addEventListener('input', () => { rebuild(); chips(); });

document.querySelectorAll('[data-open]').forEach((el) => { el.onclick = () => window.hhOpen(el.dataset.open); });
document.querySelectorAll('[data-close]').forEach((el) => { el.onclick = () => window.hhClose(); });

// ---------- make ----------
const status = (m, err = false) => { const e = $('status'); e.textContent = m; e.classList.toggle('err', err); };
const fill = (p) => { $('fill').style.width = `${Math.round(p * 100)}%`; $('pct').textContent = `${Math.round(p * 100)}%`; };

async function make() {
  if (S.busy) return; S.busy = true;
  pv.pause(); window.hhClose();
  document.body.classList.remove('is-done'); document.body.classList.add('is-making');
  S.blob = null; fill(0); status('준비 중…');
  try {
    status('노래 읽는 중…');
    const ab = S.useOurs ? await (await fetch('assets/green_light.mp3')).arrayBuffer() : await S.audioFile.arrayBuffer();
    const decoded = await decodeAudio(ab);
    const seconds = Math.min(MAX_SEC, decoded.duration);
    const audioBuf = trimBuffer(decoded, seconds);
    const N = Math.round(seconds * FPS);
    rebuild();
    status('만드는 중');
    const { blob, elapsed } = await encode({
      canvas: stage, d: S.d, N, audioBuf,
      onProgress: (p, el) => { fill(p); status(`만드는 중 · ${el.toFixed(0)}초`); },
    });
    S.blob = blob;
    status('파일 마무리 중…');
    const url = URL.createObjectURL(blob);
    $('out').src = url;
    $('save').href = url; $('save').download = `herhours_${Date.now()}.mp4`;
    $('doneMeta').textContent = `${seconds.toFixed(0)}초 · ${(blob.size / 1048576).toFixed(0)}MB · ${elapsed.toFixed(0)}초 만에 완성`;
    document.body.classList.remove('is-making'); document.body.classList.add('is-done');
    $('out').play?.().catch(() => {});
    status('');
  } catch (e) {
    console.error(e);
    document.body.classList.remove('is-making');
    status(`실패: ${e.message || e}`, true);
    window.hhOpen?.('status');
  } finally { S.busy = false; }
}
$('make').onclick = make;

$('again').onclick = () => {
  document.body.classList.remove('is-done');
  $('out').pause(); S.vf = 0; S.started = false;
};

$('share').onclick = async () => {
  if (!S.blob) return;
  const file = new File([S.blob], `herhours_${Date.now()}.mp4`, { type: 'video/mp4' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Her Hours Shorts' }); }
    catch (e) { if (e.name !== 'AbortError') $('doneMeta').textContent = `공유 실패: ${e.message}`; }
  } else {
    $('doneMeta').textContent = '이 브라우저는 바로 공유가 안 돼요. 「저장」으로 받아서 인스타에서 올려주세요.';
  }
};

// ---------- boot ----------
async function caps() {
  const l = [];
  l.push(`WebCodecs: ${'VideoEncoder' in window ? 'yes' : 'NO'}`);
  try { l.push(`H.264: ${await canEncodeVideo('avc') ? 'yes' : 'NO'}`); } catch (e) { l.push(`H.264: ${e.message}`); }
  try { l.push(`AAC(native): ${await canEncodeAudio('aac') ? 'yes' : 'no → wasm'}`); } catch (e) { l.push(`AAC: ${e.message}`); }
  l.push(`Share files: ${navigator.canShare ? 'yes' : 'NO'}`);
  l.push(`Secure context: ${window.isSecureContext}`);
  l.push(navigator.userAgent);
  $('caps').textContent = l.join('\n');
}

(async () => {
  try {
    S.tpl = await loadTemplate();
    $('brand').value = S.tpl.brand; $('t1').value = S.tpl.title1; $('t2').value = S.tpl.title2;
    await loadFonts();
    S.demo = await loadDemo();
    pv.src = 'assets/green_light.mp3';
    setDuration(MAX_SEC);
    rebuild(); chips();
    document.body.classList.add('ready');
    S.vf = 120;                       // open on a frame where the look is fully on screen
    requestAnimationFrame(loop);
    caps();
  } catch (e) { status(`준비 실패: ${e.message}`, true); }
})();
