// Her Hours Shorts — UI controller shared by both shells (A: sheet, B: rail).
// The shell supplies the markup and two hooks (window.hhOpen / window.hhClose); everything
// below is identical in both so the two designs cannot drift apart in behaviour.
import { W, H, FPS, MAX_SEC, loadFonts, fileToBitmap, drawFrame, decodeAudio, trimBuffer,
         encode, buildData, loadDemo, loadTemplate, canEncodeAudio, canEncodeVideo, ensureLyricFont } from './core.js';
import { LOOKS, lookById } from './looks.js';
import { analyze, findChorus } from './beats.js';
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
  // which part of the song becomes the short (영샘 10-03): length, start, and where the chorus is
  len: 32, offset: 0, songDur: MAX_SEC, fullBuf: null, chorusAt: null,
};
const LENGTHS = [15, 32, 60];

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
  base.N = S.N;
  // our own song's lyrics are timed from 0; a later start moves them with it
  if (S.useOurs && S.offset) base.phrases = shiftPhrases(base.phrases, -Math.round(S.offset * FPS), S.N);
  S.d = S.look.build(base, S.beat);
}
function shiftPhrases(ps, by, N) {
  return ps.map((p) => ({ ...p, start: p.start + by, end: p.end + by, words: p.words?.map((w) => ({ ...w, t: w.t + by })) }))
    .filter((p) => p.end > 0 && p.start < N);
}

// The song is read once when it is chosen; the part the short uses is measured again whenever
// the length or the start moves. Looks that cut on the music read S.beat.
async function listen(arrayBuffer) {
  try {
    S.fullBuf = await decodeAudio(arrayBuffer);
    S.songDur = S.fullBuf.duration;
    S.chorusAt = findChorus(S.fullBuf, Math.min(S.len, S.songDur));
  } catch (e) { console.warn('song read failed', e); S.fullBuf = null; }
  applyCut();
  measureCut();
}
function measureCut() {
  try {
    if (!S.fullBuf) throw new Error('no song');
    const seg = trimBuffer(S.fullBuf, S.seconds, S.offset);
    S.beat = analyze(seg, S.seconds);
    S.musicRms = rms(seg, 0, S.seconds);
  } catch (e) { console.warn('beat analysis failed', e); S.beat = null; }
  rebuild(); renderLooks();
}

// How many photos a look uses depends on the song (its length and beat), so the advice is
// worked out from the current song, not printed once.
function advice(look) {
  const base = buildData({ tpl: S.tpl, images: S.demo, useOurs: S.useOurs, brand: $('brand').value, title1: $('t1').value, title2: $('t2').value });
  base.N = S.N;
  const slots = look.photo.slots(look.build(base, S.beat), S.N);
  const min = Math.min(look.photo.min, slots);
  const wide = look.photo.shape === 'wide';
  const lines = [T(`사진 ${min}장 이상 추천 · ${slots}장까지 다 쓰여요 · ${wide ? '가로' : '세로'} 사진이 잘 맞아요`,
    `${min}+ photos recommended · up to ${slots} are used · ${wide ? 'landscape' : 'portrait'} photos fit best`)];
  const n = S.images.length;
  if (n) {
    let now = n < min ? T(`지금 ${n}장 — 같은 사진이 반복돼요`, `${n} now — some photos will repeat`)
      : n > slots ? T(`지금 ${n}장 — 앞 ${slots}장만 쓰여요`, `${n} now — only the first ${slots} are used`) : T(`지금 ${n}장 — 딱 좋아요`, `${n} now — just right`);
    const tall = S.images.filter((im) => im.height > im.width * 1.1).length;
    if (wide && tall > n / 2) now += T(' · 세로 사진은 위쪽 위주로 잘려요', ' · portrait photos are cropped to their upper part');
    if (!wide && tall < n / 2) now += T(' · 가로 사진은 양옆이 잘려요', ' · landscape photos lose their sides');
    lines.push(now);
  }
  return { slots, min, lines, ok: !n || (n >= min && n <= slots) };
}

function renderLooks() {
  const box = $('looks'); if (!box) return;
  const keep = box.scrollLeft;
  box.innerHTML = '';
  for (const l of LOOKS) {
    const b = document.createElement('button');
    b.className = 'tile' + (l.id === S.look.id ? ' on' : '');
    b.innerHTML = `<span class="sw sw-${l.id}"></span><span>${l.name.replace(' · ', '<br>')}</span>`;
    b.onclick = () => { S.look = l; renderLooks(); rebuild(); chips(); };
    box.appendChild(b);
  }
  box.scrollLeft = keep;
  const a = advice(S.look), info = $('lookInfo');
  if (info) info.innerHTML = `<b>${S.look.name}</b> · ${S.look.sub}`
    + a.lines.map((x, i) => `<span class="adv${i && !a.ok ? ' warn' : ''}">${x}</span>`).join('');
  // a mouse wheel scrolls the strip sideways on a computer
  if (!box.dataset.wheel) {
    box.dataset.wheel = '1';
    box.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { box.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  }
  const pa = $('padv');
  if (pa) pa.textContent = `「${S.look.name}」 · ` + advice(S.look).lines.join(' · ');
}

function chips() {
  // Shell B has no menu pane, so every label is optional.
  const nv = S.photoFiles.filter(isVideoFile).length, np = S.photoFiles.length - nv;
  const photo = S.photoFiles.length ? [np && T(`내 사진 ${np}장`, `${np} photos`), nv && T(`영상 ${nv}개`, `${nv} videos`)].filter(Boolean).join(' · ') : T('데모 사진 6장', '6 demo photos');
  const song = S.useOurs ? 'Green Light on the Window' : (S.audioFile?.name || T('내 음악', 'My song'));
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

  if (!pv.paused) S.vf = Math.max(0, Math.round((pv.currentTime - S.offset) * FPS));
  else if (!S.started && !calm.matches) { acc += dt; while (acc >= 1000 / FPS) { acc -= 1000 / FPS; S.vf++; } }
  if (S.vf >= S.N) { S.vf = 0; if (!pv.paused) pv.currentTime = S.offset; }

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
  if (!pv.paused) pv.currentTime = S.offset + S.vf / FPS;
  $('tnow').textContent = mmss(S.vf / FPS);
});
$('seek').addEventListener('pointerup', () => { seeking = false; });
$('seek').addEventListener('change', () => { seeking = false; });

async function togglePlay() {
  if (document.body.classList.contains('is-making') || document.body.classList.contains('is-done')) return;
  if (pv.paused) {
    S.started = true;
    try { pv.currentTime = S.offset + S.vf / FPS; await pv.play(); } catch { /* no audio: keep the silent loop running */ S.started = false; }
  } else pv.pause();
  syncPlay();
}
function syncPlay() { document.body.classList.toggle('is-playing', !pv.paused); }
pv.addEventListener('play', syncPlay);
pv.addEventListener('pause', syncPlay);
$('play').onclick = (e) => { e.stopPropagation(); togglePlay(); };
$('tap').onclick = togglePlay;

// ---------- which part of the song (영샘 10-03: length + where it starts) ----------
function applyCut() {
  const dur = S.songDur || S.len;
  S.offset = Math.max(0, Math.min(S.offset, dur - Math.min(S.len, dur)));
  S.seconds = Math.min(S.len, dur - S.offset);
  S.N = Math.round(S.seconds * FPS);
  if (S.vf >= S.N) S.vf = 0;
  $('seek').max = S.N - 1;
  $('tdur').textContent = mmss(S.seconds);
  const off = $('offset'); if (!off) return;
  off.max = Math.max(0, dur - S.seconds); off.value = S.offset;
  off.disabled = +off.max === 0;
  $('offV').textContent = mmss(S.offset);
  $('offTo').textContent = `~ ${mmss(S.offset + S.seconds)} · ${T('곡', 'song')} ${mmss(dur)}`;
  document.querySelectorAll('#lenSeg [data-len]').forEach((b) => {
    b.classList.toggle('on', +b.dataset.len === S.len);
    b.disabled = +b.dataset.len > LENGTHS[0] && dur <= LENGTHS[LENGTHS.indexOf(+b.dataset.len) - 1];   // song too short for this length
  });
  $('offChorus').disabled = S.chorusAt == null || +off.max === 0;
  $('cutHint').textContent = +off.max === 0 ? T(`곡이 ${Math.round(dur)}초라 처음부터 끝까지 써요.`, `The song is ${Math.round(dur)}s, so all of it is used.`)
    : S.chorusAt != null && Math.abs(S.offset - S.chorusAt) < 0.6 ? T('후렴이 시작되는 곳부터예요.', 'Starts where the chorus kicks in.')
    : T('막대를 밀어 시작점을 골라요. 놓으면 그 부분을 들려줘요.', 'Slide to choose the start. Let go to hear that part.');
}
// lyrics tapped against the old start no longer line up; say so instead of showing them wrong
function cutMoved(startMoved) {
  if (startMoved && !S.useOurs && S.userPhrases.length) {
    S.userPhrases = []; lyricHint();
    $('lhint').textContent = T('시작점이 바뀌어서 글을 다시 맞춰야 해요. 「탭으로 맞추기」를 눌러 주세요.', 'The start point moved, so the words need timing again. Press “Tap to time”.');
  }
  S.vf = 0; S.started = true;
  pv.currentTime = S.offset;
  measureCut();
}
document.querySelectorAll('#lenSeg [data-len]').forEach((b) => {
  b.onclick = () => { if (b.disabled) return; S.len = +b.dataset.len; if (S.fullBuf) S.chorusAt = findChorus(S.fullBuf, Math.min(S.len, S.songDur)); applyCut(); cutMoved(false); };
});
if ($('offset')) {   // shell A (index.A.html) has no cut controls
  $('offset').addEventListener('input', (e) => { S.offset = +e.target.value; applyCut(); rebuild(); });
  $('offset').addEventListener('change', async () => { cutMoved(true); try { await pv.play(); } catch {} });
  $('offStart').onclick = () => { S.offset = 0; applyCut(); cutMoved(true); };
  $('offChorus').onclick = async () => { if (S.chorusAt == null) return; S.offset = S.chorusAt; applyCut(); cutMoved(true); try { await pv.play(); } catch {} };
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
  $('phint').textContent = T('사진·영상 읽는 중…', 'Reading photos·videos…');
  const r = await Promise.allSettled(files.map((f) => (isVideoFile(f) ? fileToClip(f) : fileToBitmap(f))));
  const ok = r.filter((x) => x.status === 'fulfilled').map((x) => x.value);
  const bad = r.map((x, i) => (x.status === 'rejected' ? files[i].name : null)).filter(Boolean);
  if (ok.length) { S.images = ok; rebuild(); renderLooks(); }
  $('clipGainRow').hidden = !ok.some((x) => x.live);
  ok.filter((x) => x.live).forEach((c) => clipAudio(c));   // measure each clip's loudness now, not at export
  $('phint').textContent = bad.length
    ? T(`${ok.length}개 적용. 못 읽은 파일: ${bad.join(', ')} (HEIC면 갤러리에서 JPG로 저장해 주세요)`,
        `${ok.length} added. Couldn’t read: ${bad.join(', ')} (if HEIC, save it as JPG from your gallery)`)
    : T(`${ok.length}개 적용됐어요${ok.some((x) => x.live) ? ` (영상 ${ok.filter((x) => x.live).length}개 — 앞 12초까지 반복해서 써요)` : ''}. 위 미리보기에서 바로 돌아가요.`,
        `${ok.length} added${ok.some((x) => x.live) ? ` (${ok.filter((x) => x.live).length} videos — the first 12s loop)` : ''}. They’re playing in the preview above.`);
};

$('useDemo').onclick = () => {
  pausePreview(S.images);
  S.photoFiles = []; S.images = []; $('thumbs').innerHTML = ''; $('clipGainRow').hidden = true;
  $('photos').value = ''; $('phint').textContent = T('데모 사진 6장으로 보여주는 중.', 'Showing the 6 demo photos.');
  rebuild(); chips(); renderLooks();
};

$('useOurs').onclick = () => {
  S.useOurs = true; S.audioFile = null; $('audio').value = '';
  document.body.classList.remove('mine-song');
  pv.pause(); pv.src = 'assets/green_light.mp3';
  S.offset = 0; S.chorusAt = null; S.songDur = MAX_SEC; applyCut();
  $('t1').value = S.tpl.title1; $('t2').value = S.tpl.title2;
  $('shint').textContent = T('내 노래 파일을 골라요. 길이와 시작점은 아래에서.', 'Pick a song file. Length and start point below.');
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
  S.offset = 0; S.chorusAt = null; S.songDur = pv.duration || S.len; applyCut();
  const base = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().toUpperCase().split(' ');
  $('t1').value = base.slice(0, Math.ceil(base.length / 2)).join(' ').slice(0, 14) || 'MY SONG';
  $('t2').value = base.slice(Math.ceil(base.length / 2)).join(' ').slice(0, 18) || 'ON MY PHONE';
  S.userPhrases = []; S.tap = null; lyricHint();
  $('shint').textContent = T('아래에서 길이와 시작점을 골라요. 「글 넣기」로 가사나 한마디도 넣어요.', 'Choose length and start below. “Add words” puts in lyrics or a line.');
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
  $('lyricsBtnSub').textContent = n ? T(`${n}줄 맞춰짐 · 다시 맞추려면 눌러요`, `${n} lines timed · tap to redo`) : T('붙여넣고 톡톡 눌러 맞춰요', 'Paste, then tap along to time them');
}

function tapShow() {
  const { lines, taps } = S.tap;
  $('tapNow').textContent = lines[taps.length] ?? T('다 맞췄어요 ✓', 'All timed ✓');
  $('tapNext').textContent = lines[taps.length + 1] ? `${T('다음', 'Next')}: ${lines[taps.length + 1]}` : '';
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
  if (!lines.length) { $('lhint').textContent = T('먼저 글을 써 주세요. 한 줄에 한 마디씩.', 'Write something first. One phrase per line.'); return; }
  S.tap = { lines, taps: [] };
  S.userPhrases = []; rebuild();
  document.body.classList.add('is-tapping');
  document.activeElement?.blur();   // a focused button would take the Space key as a second tap
  tapShow();
  S.started = true; pv.currentTime = S.offset; S.vf = 0;
  try { await pv.play(); } catch {}
};
$('tapBtn').onclick = () => {
  if (!S.tap || S.tap.taps.length >= S.tap.lines.length) return;
  S.tap.taps.push(Math.max(0, pv.currentTime - S.offset - REACT));   // taps count from the short's start
  tapApply(); tapShow();
  if (S.tap.taps.length >= S.tap.lines.length) $('tapNow').textContent = T('다 맞췄어요 ✓ 끝까지 들어보고 「끝」', 'All timed ✓ Listen to the end, then “Finish”');
};
$('tapUndo').onclick = () => {
  if (!S.tap?.taps.length) return;
  const t = S.tap.taps.pop();
  pv.currentTime = S.offset + Math.max(0, t - 1.5);   // back up a little so the line can be tapped again
  tapApply(); tapShow();
};
function tapEnd() {
  document.body.classList.remove('is-tapping');
  pv.pause();
  if (S.tap) $('lhint').textContent = S.userPhrases.length ? T(`${S.userPhrases.length}줄 맞췄어요. 위 영상에서 확인해 보세요.`, `${S.userPhrases.length} lines timed. Check them in the video above.`) : T('맞춘 줄이 없어요.', 'No lines timed.');
}
$('tapStop').onclick = tapEnd;
// on a computer the big button is a mouse trip away from the video; Space (or Enter) taps instead
document.addEventListener('keydown', (e) => {
  if (!document.body.classList.contains('is-tapping') || e.repeat) return;
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); $('tapBtn').click(); }
  else if (e.code === 'Backspace') { e.preventDefault(); $('tapUndo').click(); }
});
pv.addEventListener('timeupdate', () => { if (document.body.classList.contains('is-tapping') && pv.currentTime >= S.offset + S.seconds) tapEnd(); });
$('lyrics').addEventListener('input', () => { if (S.userPhrases.length) { S.userPhrases = []; rebuild(); lyricHint(); $('lhint').textContent = T('글을 고쳤어요. 「탭으로 맞추기」로 다시 맞춰 주세요.', 'You changed the words. Time them again with “Tap to time”.'); } });

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
  S.blob = null; fill(0); status(T('준비 중…', 'Getting ready…'));
  try {
    status(T('노래 읽는 중…', 'Reading the song…'));
    const ab = S.useOurs ? await (await fetch('assets/green_light.mp3')).arrayBuffer() : await S.audioFile.arrayBuffer();
    const decoded = await decodeAudio(ab);
    const seconds = Math.min(S.seconds, decoded.duration - S.offset);
    const audioBuf = trimBuffer(decoded, seconds, S.offset);
    const N = Math.round(seconds * FPS);
    rebuild();
    await ensureLyricFont(S.d.phrases.map((p) => p.text).join(' ') + ' ' + (S.d.boxText || ''));
    const stepper = exportStepper(S.d.images);
    let mixed = audioBuf;
    if (S.d.images.some((c) => c.live) && S.clipGain > 0) {
      status(T('영상 소리 맞추는 중…', 'Mixing video sound…'));
      const vis = scanVisibility(S.look.draw, ctx, seen, S.d, N);
      mixed = await mixClipSound(audioBuf, S.d.images, vis, S.clipGain, FPS);
    }
    status(T('만드는 중', 'Making'));
    const { blob, elapsed } = await encode({
      canvas: stage, d: S.d, N, audioBuf: mixed, draw: S.look.draw, beforeFrame: stepper,
      onProgress: (p, el) => { fill(p); status(T(`만드는 중 · ${el.toFixed(0)}초`, `Making · ${el.toFixed(0)}s`)); },
    });
    await stepper.close();
    S.blob = blob;
    status(T('파일 마무리 중…', 'Finishing the file…'));
    const url = URL.createObjectURL(blob);
    $('out').src = url;
    $('out').muted = false; $('out').volume = 1;   // the finished short is always heard
    $('save').href = url; $('save').download = `herhours_${Date.now()}.mp4`;
    $('doneMeta').textContent = T(`${seconds.toFixed(0)}초 · ${(blob.size / 1048576).toFixed(0)}MB · ${elapsed.toFixed(0)}초 만에 완성`, `${seconds.toFixed(0)}s · ${(blob.size / 1048576).toFixed(0)}MB · made in ${elapsed.toFixed(0)}s`);
    document.body.classList.remove('is-making'); document.body.classList.add('is-done');
    $('out').play?.().catch(() => {});
    status('');
  } catch (e) {
    console.error(e);
    document.body.classList.remove('is-making');
    status(`${T('실패', 'Failed')}: ${e.message || e}`, true);
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
    catch (e) { if (e.name !== 'AbortError') $('doneMeta').textContent = `${T('공유 실패', 'Share failed')}: ${e.message}`; }
  } else {
    $('doneMeta').textContent = T('이 브라우저는 바로 공유가 안 돼요. 「저장」으로 받아서 인스타에서 올려주세요.', 'This browser can’t share directly. Tap “Save”, then post it from Instagram.');
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
    applyCut();
    rebuild(); chips(); renderLooks();
    await listen(await (await fetch('assets/green_light.mp3')).arrayBuffer());
    document.body.classList.add('ready');
    S.vf = 120;                       // open on a frame where the look is fully on screen
    requestAnimationFrame(loop);
    caps();
  } catch (e) { status(`${T('준비 실패', 'Setup failed')}: ${e.message}`, true); }
})();
