// Her Hours Shorts — UI controller shared by both shells (A: sheet, B: rail).
// The shell supplies the markup and two hooks (window.hhOpen / window.hhClose); everything
// below is identical in both so the two designs cannot drift apart in behaviour.
import { W, H, FPS, MAX_SEC, loadFonts, fileToBitmap, drawFrame, decodeAudio, trimBuffer,
         encode, buildData, loadDemo, loadTemplate, canEncodeAudio, canEncodeVideo, ensureLyricFont } from './core.js';
import { LOOKS, lookById } from './looks.js';
import { analyze } from './beats.js';
import { isVideoFile, fileToClip, tickPreview, pausePreview, exportStepper, watchDraws, scanVisibility, mixClipSound, clipAudio, clipLevel, rms } from './media.js';

const $ = (id) => document.getElementById(id);
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const S = {
  tpl: null, images: [], photoFiles: [], demo: [],
  useOurs: true, audioFile: null,
  d: null, N: 960, seconds: MAX_SEC,
  vf: 0,            // virtual frame shown while the song is not playing
  started: false,   // has the user pressed play at least once
  busy: false, blob: null, every: 1,
  look: lookById(new URLSearchParams(location.search).get('look')), beat: null,
  clipGain: 0.35,
  userPhrases: [], tap: null,   // lyrics the user timed to their own song by tapping   // clip sound under the song: present, never on top of it
};

const stage = $('stage');
const ctx = stage.getContext('2d', { alpha: false });
const seen = watchDraws(ctx);   // which video clips the look drew this frame
const pv = $('pv');

// ---------- data ----------
function rebuild() {
  const base = buildData({
    tpl: S.tpl,
    images: S.images.length ? S.images : S.demo,
    useOurs: S.useOurs,
    brand: $('brand').value, title1: $('t1').value, title2: $('t2').value,
    phrases: S.userPhrases,
  });
  S.d = S.look.build(base, S.beat);
}

// The song is read once when it is chosen; looks that cut on the music read S.beat.
async function listen(arrayBuffer) {
  try {
    const buf = await decodeAudio(arrayBuffer);
    S.beat = analyze(buf, Math.min(MAX_SEC, buf.duration));
    S.musicRms = rms(buf, 0, Math.min(MAX_SEC, buf.duration));
  } catch (e) { console.warn('beat analysis failed', e); S.beat = null; }
  rebuild(); renderLooks();
}

// How many photos a look uses depends on the song (its length and beat), so the advice is
// worked out from the current song, not printed once.
function advice(look) {
  const base = buildData({ tpl: S.tpl, images: S.demo, useOurs: S.useOurs, brand: $('brand').value, title1: $('t1').value, title2: $('t2').value });
  const slots = look.photo.slots(look.build(base, S.beat), S.N);
  const min = Math.min(look.photo.min, slots);
  const wide = look.photo.shape === 'wide';
  const lines = [`사진 ${min}장 이상 추천 · ${slots}장까지 다 쓰여요 · ${wide ? '가로' : '세로'} 사진이 잘 맞아요`];
  const n = S.images.length;
  if (n) {
    let now = n < min ? `지금 ${n}장 — 같은 사진이 반복돼요` : n > slots ? `지금 ${n}장 — 앞 ${slots}장만 쓰여요` : `지금 ${n}장 — 딱 좋아요`;
    const tall = S.images.filter((im) => im.height > im.width * 1.1).length;
    if (wide && tall > n / 2) now += ' · 세로 사진은 위쪽 위주로 잘려요';
    if (!wide && tall < n / 2) now += ' · 가로 사진은 양옆이 잘려요';
    lines.push(now);
  }
  return { slots, min, lines, ok: !n || (n >= min && n <= slots) };
}

function renderLooks() {
  const box = $('looks'); if (!box) return;
  box.innerHTML = '';
  for (const l of LOOKS) {
    const a = advice(l);
    const b = document.createElement('button');
    b.className = 'opt' + (l.id === S.look.id ? ' on' : '');
    b.innerHTML = `<span class="sw sw-${l.id}"></span><span class="t"><b>${l.name}</b><span>${l.sub}</span>`
      + a.lines.map((x, i) => `<span class="adv${i && !a.ok ? ' warn' : ''}">${x}</span>`).join('') + `</span>`;
    b.onclick = () => { S.look = l; renderLooks(); rebuild(); chips(); };
    box.appendChild(b);
  }
  const pa = $('padv');
  if (pa) pa.textContent = `「${S.look.name}」 · ` + advice(S.look).lines.join(' · ');
}

function chips() {
  // Shell B has no menu pane, so every label is optional.
  const nv = S.photoFiles.filter(isVideoFile).length, np = S.photoFiles.length - nv;
  const photo = S.photoFiles.length ? [np && `내 사진 ${np}장`, nv && `영상 ${nv}개`].filter(Boolean).join(' · ') : '데모 사진 6장';
  const song = S.useOurs ? 'Green Light on the Window' : (S.audioFile?.name || '내 음악');
  const text = `${$('brand').value} · ${$('t1').value}`;
  const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  set('vPhoto', photo); set('vSong', song); set('vText', text); set('vLook', S.look.name);
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
  tickPreview(S.d.images);
  const t0 = performance.now();
  seen.clear();
  S.look.draw(ctx, S.vf, S.N, S.d);
  // a clip is heard only while it is on screen and the song is playing
  for (const c of S.d.images) if (c.live) { c.clip.video.muted = pv.paused || !seen.has(c); c.clip.video.volume = Math.min(1, clipLevel(c, S.musicRms || 0.1, S.clipGain)); }
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
  const files = [...e.target.files].filter((f) => f.type.startsWith('image/') || isVideoFile(f));
  if (!files.length) return;
  pausePreview(S.images);
  S.photoFiles = files;
  const th = $('thumbs'); th.innerHTML = '';
  for (const f of files.slice(0, 24)) {
    const v = isVideoFile(f);
    const el = document.createElement(v ? 'video' : 'img');
    el.src = URL.createObjectURL(f);
    if (v) { el.muted = true; el.playsInline = true; el.preload = 'metadata'; el.className = 'vid'; }
    th.appendChild(el);
  }
  chips();
  $('phint').textContent = '사진·영상 읽는 중…';
  const r = await Promise.allSettled(files.map((f) => (isVideoFile(f) ? fileToClip(f) : fileToBitmap(f))));
  const ok = r.filter((x) => x.status === 'fulfilled').map((x) => x.value);
  const bad = r.map((x, i) => (x.status === 'rejected' ? files[i].name : null)).filter(Boolean);
  if (ok.length) { S.images = ok; rebuild(); renderLooks(); }
  $('clipGainRow').hidden = !ok.some((x) => x.live);
  ok.filter((x) => x.live).forEach((c) => clipAudio(c));   // measure each clip's loudness now, not at export
  $('phint').textContent = bad.length
    ? `${ok.length}개 적용. 못 읽은 파일: ${bad.join(', ')} (HEIC면 갤러리에서 JPG로 저장해 주세요)`
    : `${ok.length}개 적용됐어요${ok.some((x) => x.live) ? ` (영상 ${ok.filter((x) => x.live).length}개 — 앞 12초까지 반복해서 써요)` : ''}. 위 미리보기에서 바로 돌아가요.`;
};

$('useDemo').onclick = () => {
  pausePreview(S.images);
  S.photoFiles = []; S.images = []; $('thumbs').innerHTML = ''; $('clipGainRow').hidden = true;
  $('photos').value = ''; $('phint').textContent = '데모 사진 6장으로 보여주는 중.';
  rebuild(); chips(); renderLooks();
};

$('useOurs').onclick = () => {
  S.useOurs = true; S.audioFile = null; $('audio').value = '';
  document.body.classList.remove('mine-song');
  pv.pause(); pv.src = 'assets/green_light.mp3';
  setDuration(MAX_SEC);
  $('t1').value = S.tpl.title1; $('t2').value = S.tpl.title2;
  $('shint').textContent = '가사가 박자에 맞춰 켜져요.';
  rebuild(); chips(); syncPlay();
  fetch('assets/green_light.mp3').then((r) => r.arrayBuffer()).then(listen);
};

$('audio').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  S.useOurs = false; S.audioFile = f;
  document.body.classList.add('mine-song');
  pv.pause();
  pv.src = URL.createObjectURL(f);
  await new Promise((r) => { pv.onloadedmetadata = r; setTimeout(r, 3000); });
  setDuration(pv.duration);
  const base = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().toUpperCase().split(' ');
  $('t1').value = base.slice(0, Math.ceil(base.length / 2)).join(' ').slice(0, 14) || 'MY SONG';
  $('t2').value = base.slice(Math.ceil(base.length / 2)).join(' ').slice(0, 18) || 'ON MY PHONE';
  S.userPhrases = []; S.tap = null; lyricHint();
  $('shint').textContent = `앞 ${Math.round(S.seconds)}초를 써요. 「글 넣기」로 가사나 한마디를 넣을 수 있어요.`;
  rebuild(); chips(); syncPlay();
  listen(await f.arrayBuffer());
};

// ---------- lyrics by tapping ----------
// The user pastes the lines and taps as each one starts. Lines are what people can time on a
// phone; the words inside a line are spread by their length, so the karaoke looks still work.
const REACT = 0.12;   // a tap lands ~120ms after the singer starts the line
const lyricLines = () => $('lyrics').value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

function phrasesFromTaps(lines, taps, N) {
  const out = [];
  for (let i = 0; i < taps.length; i++) {
    const start = Math.round(taps[i] * FPS);
    const words = lines[i].split(/\s+/);
    const next = i + 1 < taps.length ? Math.round(taps[i + 1] * FPS) : Math.min(N, start + Math.round((words.length * 0.5 + 1.2) * FPS));
    const end = Math.max(start + 15, next);
    // words fill the first part of the line, by length, at most ~0.45s each
    const span = Math.min((end - start) * 0.85, words.length * 0.45 * FPS);
    const weight = words.map((w) => w.length + 2), total = weight.reduce((a, b) => a + b, 0);
    let acc = 0;
    out.push({ start, end, text: lines[i], words: words.map((w, k) => { const t = start + Math.round(span * acc / total); acc += weight[k]; return { t, w }; }) });
  }
  return out;
}

function lyricHint() {
  const n = S.userPhrases.length;
  $('lyricsBtnSub').textContent = n ? `${n}줄 맞춰짐 · 다시 맞추려면 눌러요` : '붙여넣고 톡톡 눌러 맞춰요';
}

function tapShow() {
  const { lines, taps } = S.tap;
  $('tapNow').textContent = lines[taps.length] ?? '다 맞췄어요 ✓';
  $('tapNext').textContent = lines[taps.length + 1] ? `다음: ${lines[taps.length + 1]}` : '';
  $('tapCount').textContent = `${taps.length} / ${lines.length}`;
  $('tapBtn').disabled = taps.length >= lines.length;
}

function tapApply() {
  ensureLyricFont(S.tap.lines.join(' '));
  S.userPhrases = phrasesFromTaps(S.tap.lines, S.tap.taps, S.N);
  rebuild(); lyricHint();
}

$('tapStart').onclick = async () => {
  const lines = lyricLines();
  if (!lines.length) { $('lhint').textContent = '먼저 글을 써 주세요. 한 줄에 한 마디씩.'; return; }
  S.tap = { lines, taps: [] };
  S.userPhrases = []; rebuild();
  document.body.classList.add('is-tapping');
  tapShow();
  S.started = true; pv.currentTime = 0; S.vf = 0;
  try { await pv.play(); } catch {}
};
$('tapBtn').onclick = () => {
  if (!S.tap || S.tap.taps.length >= S.tap.lines.length) return;
  S.tap.taps.push(Math.max(0, pv.currentTime - REACT));
  tapApply(); tapShow();
  if (S.tap.taps.length >= S.tap.lines.length) $('tapNow').textContent = '다 맞췄어요 ✓ 끝까지 들어보고 「끝」';
};
$('tapUndo').onclick = () => {
  if (!S.tap?.taps.length) return;
  const t = S.tap.taps.pop();
  pv.currentTime = Math.max(0, t - 1.5);   // back up a little so the line can be tapped again
  tapApply(); tapShow();
};
function tapEnd() {
  document.body.classList.remove('is-tapping');
  pv.pause();
  if (S.tap) $('lhint').textContent = S.userPhrases.length ? `${S.userPhrases.length}줄 맞췄어요. 위 영상에서 확인해 보세요.` : '맞춘 줄이 없어요.';
}
$('tapStop').onclick = tapEnd;
pv.addEventListener('timeupdate', () => { if (document.body.classList.contains('is-tapping') && pv.currentTime >= S.seconds) tapEnd(); });
$('lyrics').addEventListener('input', () => { if (S.userPhrases.length) { S.userPhrases = []; rebuild(); lyricHint(); $('lhint').textContent = '글을 고쳤어요. 「탭으로 맞추기」로 다시 맞춰 주세요.'; } });

$('clipGain').addEventListener('input', (e) => { S.clipGain = e.target.value / 100; $('clipGainV').textContent = `${e.target.value}%`; });

for (const id of ['brand', 't1', 't2']) $(id).addEventListener('input', () => { rebuild(); chips(); });

document.querySelectorAll('[data-open]').forEach((el) => { el.onclick = () => window.hhOpen(el.dataset.open); });
document.querySelectorAll('[data-close]').forEach((el) => { el.onclick = () => window.hhClose(); });

// ---------- make ----------
const status = (m, err = false) => { const e = $('status'); e.textContent = m; e.classList.toggle('err', err); };
const fill = (p) => { $('fill').style.width = `${Math.round(p * 100)}%`; $('pct').textContent = `${Math.round(p * 100)}%`; };

async function make() {
  if (S.busy) return; S.busy = true;
  pv.pause(); window.hhClose(); pausePreview(S.images);
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
    await ensureLyricFont(S.d.phrases.map((p) => p.text).join(' ') + ' ' + (S.d.boxText || ''));
    const stepper = exportStepper(S.d.images);
    let mixed = audioBuf;
    if (S.d.images.some((c) => c.live) && S.clipGain > 0) {
      status('영상 소리 맞추는 중…');
      const vis = scanVisibility(S.look.draw, ctx, seen, S.d, N);
      mixed = await mixClipSound(audioBuf, S.d.images, vis, S.clipGain, FPS);
    }
    status('만드는 중');
    const { blob, elapsed } = await encode({
      canvas: stage, d: S.d, N, audioBuf: mixed, draw: S.look.draw, beforeFrame: stepper,
      onProgress: (p, el) => { fill(p); status(`만드는 중 · ${el.toFixed(0)}초`); },
    });
    await stepper.close();
    S.blob = blob;
    status('파일 마무리 중…');
    const url = URL.createObjectURL(blob);
    $('out').src = url;
    $('out').muted = false; $('out').volume = 1;   // the finished short is always heard
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
    rebuild(); chips(); renderLooks();
    await listen(await (await fetch('assets/green_light.mp3')).arrayBuffer());
    document.body.classList.add('ready');
    S.vf = 120;                       // open on a frame where the look is fully on screen
    requestAnimationFrame(loop);
    caps();
  } catch (e) { status(`준비 실패: ${e.message}`, true); }
})();
