// Her Hours Shorts — UI controller shared by both shells (A: sheet, B: rail).
// The shell supplies the markup and two hooks (window.hhOpen / window.hhClose); everything
// below is identical in both so the two designs cannot drift apart in behaviour.
import { W, H, FPS, MAX_SEC, loadFonts, fileToBitmap, drawFrame, decodeAudio, trimBuffer,
         encode, buildData, loadDemo, loadDemoHw, loadTemplate, canEncodeAudio, canEncodeVideo, ensureLyricFont, hangulReady, SONGS } from './core.js';
import { LOOKS, lookById } from './looks.js';
import { analyze, findChorus } from './beats.js';
import { isVideoFile, fileToClip, tickPreview, pausePreview, exportStepper, watchDraws, scanVisibility, mixClipSound, clipAudio, clipLevel, rms } from './media.js';
import { getDraft, putDraft, dropDraft, listMade, addMade, dropMade } from './store.js';

const $ = (id) => document.getElementById(id);
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const S = {
  tpl: null, images: [], photoFiles: [], demo: [], demoHw: [],
  useOurs: true, song: SONGS[0], audioFile: null,
  d: null, N: 960, seconds: MAX_SEC,
  vf: 0,            // virtual frame shown while the song is not playing
  started: false,   // has the user pressed play at least once
  busy: false, blob: null, every: 1,
  look: lookById(new URLSearchParams(location.search).get('look')), beat: null,
  clipGain: 0.35,
  userPhrases: [], tap: null,   // lyrics the user timed to their own song by tapping   // clip sound under the song: present, never on top of it
  // which part of the song becomes the short (영샘 10-03): length, start, and where the chorus is
  len: 32, offset: 0, songDur: MAX_SEC, fullBuf: null, chorusAt: null,
  photoBlobs: [],    // the chosen photos, shrunk, so the work survives closing the app (10-11)
  ready: false, restoring: false,
  // 10-11: the big button read "Make" from the first second, so people pressed it before choosing anything.
  // Until the four steps have been walked once it leads to the first step instead.
  flowDone: (() => { try { return !!localStorage.getItem('hh-flowed'); } catch { return false; } })(),
};
const LENGTHS = [15, 32, 60, 90, 180];
// ?debug exposes state for frame-by-frame checks (contact sheets) from the console
if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { hhS: S, hhRebuild: () => rebuild() });

const stage = $('stage');
const ctx = stage.getContext('2d', { alpha: false });
const seen = watchDraws(ctx);   // which video clips the look drew this frame
const pv = $('pv');

// ---------- data ----------
function rebuild() {
  const base = buildData({
    tpl: S.tpl,
    images: S.images.length ? S.images : demoFor(S.look),
    useOurs: S.useOurs,
    brand: $('brand').value, title1: $('t1').value, title2: $('t2').value,
    phrases: S.userPhrases,
  });
  base.N = S.N;
  // our own song's lyrics are timed from 0; a later start moves them with it
  if (S.useOurs && S.offset) base.phrases = shiftPhrases(base.phrases, -Math.round(S.offset * FPS), S.N);
  S.d = S.look.build(base, S.beat);
  saveSoon();
}
const demoFor = (look) => (look.id === 'halloween' && S.demoHw.length ? S.demoHw : S.demo);
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
  const base = buildData({ tpl: S.tpl, images: demoFor(look), useOurs: S.useOurs, brand: $('brand').value, title1: $('t1').value, title2: $('t2').value });
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
    // a real frame of the look, not a colour swatch — the choice is judged by what the video will look like (10-11)
    b.innerHTML = `<img class="lkimg" src="assets/looks/${l.id}.jpg" alt="" loading="lazy" decoding="async"><span>${l.name.replace(' · ', '<br>')}</span>`;
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
  const photo = S.photoFiles.length ? [np && T(`내 사진 ${np}장`, `${np} photos`), nv && T(`영상 ${nv}개`, `${nv} videos`)].filter(Boolean).join(' · ') : T('예시 사진 6장', '6 demo photos');
  const song = S.useOurs ? S.song.name : (S.audioFile?.name || T('내 음악', 'My song'));
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
    $('lhint').textContent = T('시작점이 바뀌어서 글을 다시 맞춰야 해요. 「눌러서 맞추기」를 눌러 주세요.', 'The start point moved, so the words need timing again. Press “Tap to time”.');
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
$('photos').onchange = (e) => {
  const files = [...e.target.files].filter((f) => f.type.startsWith('image/') || isVideoFile(f));
  if (files.length) usePhotos(files);
};

// a few at a time: decoding every photo at once is what made picking slow and heavy on an iPhone (10-11)
async function pool(items, n, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try { out[i] = { status: 'fulfilled', value: await fn(items[i], i) }; } catch (e) { out[i] = { status: 'rejected', reason: e }; }
    }
  }));
  return out;
}
// the strip shows a small copy of the decoded photo, not the camera original
function thumbOf(src) {
  const c = document.createElement('canvas'); c.width = c.height = 148; c.className = 'th';
  const s = Math.min(src.width, src.height);
  c.getContext('2d').drawImage(src, (src.width - s) / 2, (src.height - s) / 2, s, s, 0, 0, 148, 148);
  return c;
}
async function shrinkAll(imgs) {
  const out = [];
  for (const im of imgs) {
    const k = Math.min(1, 1600 / Math.max(im.width, im.height));
    const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    if (b) out.push(b);
  }
  return out;
}

async function usePhotos(files) {
  pausePreview(S.images);
  S.photoFiles = files; S.photoBlobs = [];
  const th = $('thumbs'); th.innerHTML = '';
  const slots = files.map((f, i) => {
    if (i >= 24) return null;
    if (isVideoFile(f)) {
      const el = document.createElement('video');
      el.src = URL.createObjectURL(f); el.muted = true; el.playsInline = true; el.preload = 'metadata'; el.className = 'vid';
      th.appendChild(el); return null;
    }
    const d = document.createElement('div'); d.className = 'ph'; th.appendChild(d); return d;
  });
  chips();
  let n = 0;
  const say = () => { $('phint').textContent = T(`불러오는 중… ${n} / ${files.length}`, `Reading… ${n} / ${files.length}`); };
  say();
  const t0 = performance.now();
  const r = await pool(files, 2, async (f, i) => {
    const t = performance.now();
    const v = isVideoFile(f) ? await fileToClip(f) : await fileToBitmap(f);
    n++; say();
    if (slots[i]) slots[i].replaceWith(thumbOf(v));
    rlog(`photo ${i + 1}/${files.length} ${v.hhPath || 'clip'} ${Math.round(performance.now() - t)}ms ${(f.size / 1048576).toFixed(1)}MB ${f.type} → ${v.width}x${v.height}`);
    return v;
  });
  rlog(`photos ${files.length} in ${Math.round(performance.now() - t0)}ms`);
  const ok = r.filter((x) => x.status === 'fulfilled').map((x) => x.value);
  const bad = r.map((x, i) => (x.status === 'rejected' ? files[i].name : null)).filter(Boolean);
  if (ok.length) { S.images = ok; rebuild(); renderLooks(); }
  $('clipGainRow').hidden = !ok.some((x) => x.live);
  ok.filter((x) => x.live).forEach((c) => clipAudio(c));   // measure each clip's loudness now, not at export
  $('phint').textContent = bad.length
    ? T(`${ok.length}개 넣었어요. 못 불러온 파일: ${bad.join(', ')} (HEIC면 갤러리에서 JPG로 저장해 주세요)`,
        `${ok.length} added. Couldn’t read: ${bad.join(', ')} (if HEIC, save it as JPG from your gallery)`)
    : T(`${ok.length}개 넣었어요${ok.some((x) => x.live) ? ` (영상 ${ok.filter((x) => x.live).length}개 — 앞 12초까지 반복해서 써요)` : ''}. 위 미리보기에서 바로 돌아가요.`,
        `${ok.length} added${ok.some((x) => x.live) ? ` (${ok.filter((x) => x.live).length} videos — the first 12s loop)` : ''}. They’re playing in the preview above.`);
  S.photoBlobs = await shrinkAll(ok.filter((x) => !x.live));
  saveSoon();
}

$('useDemo').onclick = () => {
  pausePreview(S.images);
  S.photoFiles = []; S.images = []; S.photoBlobs = []; $('thumbs').innerHTML = ''; $('clipGainRow').hidden = true;
  $('photos').value = ''; $('phint').textContent = T('예시 사진 6장으로 보여주는 중이에요.', 'Showing the 6 demo photos.');
  rebuild(); chips(); renderLooks();
};

const SONG_GROUPS = [
  ['halloween', () => T('🎃 핼러윈 · Her Hours 캐릭터가 불러요', '🎃 Halloween · sung by Her Hours characters')],
  ['lyrics', () => T('가사가 나오는 곡', 'Songs with lyrics')],
  ['vocal', () => T('Her Hours 노래 · 캐릭터가 불러요', 'Her Hours songs · sung by our characters')],
  ['upbeat', () => T('신나는', 'Upbeat')],
  ['bright', () => T('밝은', 'Bright')],
  ['tension', () => T('긴장감', 'Tension')],
];
function renderSongs() {
  $('ourSongs').innerHTML = SONG_GROUPS.map(([g, label]) => `<p class="song-group">${label()}</p>` + SONGS.filter((s) => s.group === g).map((s) => `<button class="opt${S.useOurs && s.id === S.song.id ? ' on' : ''}" data-song="${s.id}">
      ${s.group === 'lyrics' || s.group === 'vocal' || s.group === 'halloween'
        ? `<img class="cov" src="assets/covers/${s.id}.jpg" alt="" loading="lazy" decoding="async">`
        : `<span class="cov gr-${s.group}"><svg width="24" height="24"><use href="#i-music"/></svg></span>`}
      <span class="t"><b>${s.name}</b><span>${s.lyrics === false ? T('곡 제목이 글자로 나와요', 'the title becomes the type') : T('가사가 박자에 켜져요', 'lyrics light up on the beat')}</span></span></button>`).join('')).join('');
  $('ourSongs').querySelectorAll('[data-song]').forEach((b) => { b.onclick = () => pickSong(SONGS.find((s) => s.id === b.dataset.song)); });
}
async function pickSong(song) {
  S.useOurs = true; S.song = song; S.audioFile = null; S.fullBuf = null; $('audio').value = '';
  document.body.classList.remove('mine-song');
  renderSongs();
  pv.pause(); pv.src = song.file;
  S.tpl = await loadTemplate(song);
  await new Promise((r) => { pv.onloadedmetadata = r; setTimeout(r, 3000); });
  S.offset = 0; S.chorusAt = null; S.songDur = pv.duration || MAX_SEC; applyCut();
  $('brand').value = S.tpl.brand; $('t1').value = S.tpl.title1; $('t2').value = S.tpl.title2;
  $('shint').textContent = T('내 노래 파일을 골라요. 길이와 시작점은 아래에서.', 'Pick a song file. Length and start point below.');
  rebuild(); chips(); syncPlay();
  fetch(song.file).then((r) => r.arrayBuffer()).then(listen);
}

$('audio').onchange = (e) => { const f = e.target.files[0]; if (f) useAudioFile(f); };
async function useAudioFile(f) {
  S.useOurs = false; S.audioFile = f; S.fullBuf = null; renderSongs();
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
  await listen(await f.arrayBuffer());
}

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
$('lyrics').addEventListener('input', () => { if (S.userPhrases.length) { S.userPhrases = []; rebuild(); lyricHint(); $('lhint').textContent = T('글을 고쳤어요. 「눌러서 맞추기」로 다시 맞춰 주세요.', 'You changed the words. Time them again with “Tap to time”.'); } });

$('clipGain').addEventListener('input', (e) => { S.clipGain = e.target.value / 100; $('clipGainV').textContent = `${e.target.value}%`; });

for (const id of ['brand', 't1', 't2']) $(id).addEventListener('input', () => { rebuild(); chips(); });

$('lyrics').addEventListener('input', () => saveSoon());

document.querySelectorAll('[data-open]').forEach((el) => { el.onclick = () => window.hhOpen(el.dataset.open); });
document.querySelectorAll('[data-close]').forEach((el) => { el.onclick = () => window.hhClose(); });

// ---------- the four steps in order (10-11: 1 and 2) ----------
// Each sheet's button goes on to the next one: style → photos → song → text → back to the video, ready to make.
const STEPS = ['look', 'photo', 'song', 'text'];
const seenSteps = new Set();
const shellOpen = window.hhOpen;
window.hhOpen = (name) => {
  shellOpen(name);
  if (STEPS.includes(name)) { seenSteps.add(name); if (seenSteps.size === STEPS.length) flowDone(); }
};
function flowDone() {
  if (S.flowDone) return;
  S.flowDone = true; setMake();
  try { localStorage.setItem('hh-flowed', '1'); } catch {}
}
function setMake() {
  $('make').textContent = S.flowDone ? T('쇼츠 만들기', 'Make my Short') : T('① 스타일부터 고르기', '① Start with a style');
  $('make').classList.toggle('first', !S.flowDone);
}
document.querySelectorAll('[data-next]').forEach((el) => { el.onclick = () => window.hhOpen(el.dataset.next); });
document.querySelectorAll('[data-finish]').forEach((el) => {
  el.onclick = () => { window.hhClose(); flowDone(); $('make').classList.add('nudge'); setTimeout(() => $('make').classList.remove('nudge'), 2400); };
});

// ---------- keep the work on this phone (10-11: 5 and 6) ----------
function snapshot() {
  return {
    v: 1, at: Date.now(), look: S.look.id,
    song: S.useOurs ? S.song.id : null, audio: S.useOurs ? null : S.audioFile,
    len: S.len, offset: S.offset,
    brand: $('brand').value, t1: $('t1').value, t2: $('t2').value,
    lyrics: $('lyrics').value, phrases: S.userPhrases,
    photos: S.photoBlobs, clips: S.photoFiles.filter(isVideoFile).length,
  };
}
let saveT = 0;
function saveSoon() {
  if (!S.ready || S.restoring || S.busy) return;
  clearTimeout(saveT); saveT = setTimeout(() => putDraft(snapshot()), 800);
}
// worth offering back only if it holds something the person put in
const worthKeeping = (w) => w && (w.photos?.length || w.audio || w.phrases?.length || w.lyrics?.trim());
const describe = (w) => {
  const song = w.audio ? (w.audio.name || T('내 음악', 'My song')) : (SONGS.find((s) => s.id === w.song)?.name || '');
  const len = w.len % 60 === 0 && w.len >= 60 ? T(`${w.len / 60}분`, `${w.len / 60} min`) : T(`${w.len}초`, `${w.len}s`);
  return [lookById(w.look).name, w.photos?.length ? T(`사진 ${w.photos.length}장`, `${w.photos.length} photos`) : '', song, len].filter(Boolean).join(' · ');
};
const when = (t) => new Date(t).toLocaleString(HH_LANG === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

async function restore(w) {
  S.restoring = true;
  try {
    S.look = lookById(w.look); rebuild();   // the preview draws every frame; a look must never meet another look's data
    if (w.audio) await useAudioFile(w.audio);
    else { const s = SONGS.find((x) => x.id === w.song); if (s && s.id !== S.song.id) await pickSong(s); }
    S.len = w.len || S.len; S.offset = w.offset || 0;
    if (S.fullBuf) S.chorusAt = findChorus(S.fullBuf, Math.min(S.len, S.songDur));
    applyCut();
    $('brand').value = w.brand ?? $('brand').value; $('t1').value = w.t1 ?? $('t1').value; $('t2').value = w.t2 ?? $('t2').value;
    $('lyrics').value = w.lyrics || ''; S.userPhrases = w.phrases || []; lyricHint();
    if (w.photos?.length) await usePhotos(w.photos.map((b, i) => new File([b], `photo_${i + 1}.jpg`, { type: 'image/jpeg' })));
    if (w.clips) $('phint').textContent += ' ' + T(`영상 ${w.clips}개는 다시 골라 주세요.`, `Please pick the ${w.clips} video clip(s) again.`);
    measureCut(); chips(); renderLooks(); renderSongs();
  } finally { S.restoring = false; }
  flowDone(); saveSoon();
}

async function offerResume() {
  const w = await getDraft();
  if (!worthKeeping(w)) return;
  $('resumeInfo').textContent = `${when(w.at)} · ${describe(w)}`;
  $('resumeGo').onclick = async () => { window.hhClose(); await restore(w); };
  $('resumeNew').onclick = () => { dropDraft(); window.hhClose(); };
  window.hhOpen('resume');
}

// a small picture of the finished short for the list
async function thumbBlob(N) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  try { S.look.draw(c.getContext('2d'), Math.round(N * 0.35), N, S.d); } catch {}
  const s = document.createElement('canvas'); s.width = 216; s.height = 384;
  s.getContext('2d').drawImage(c, 0, 0, 216, 384);
  return new Promise((r) => s.toBlob(r, 'image/jpeg', 0.8));
}
async function keepMade(seconds, N) {
  const w = snapshot();
  await addMade({ ...w, id: w.at, seconds, thumb: await thumbBlob(N) });
  dropDraft();
}
async function renderMade() {
  const list = await listMade(), box = $('madeList');
  box.innerHTML = list.length ? '' : `<p class="hint">${T('아직 없어요. 하나 만들면 여기에 남아요.', 'Nothing yet. Each short you make shows up here.')}</p>`;
  for (const w of list) {
    const row = document.createElement('div'); row.className = 'made';
    const url = w.thumb ? URL.createObjectURL(w.thumb) : '';
    row.innerHTML = `${url ? `<img src="${url}" alt="">` : '<span class="noimg"></span>'}
      <span class="t"><b>${when(w.at)}</b><span>${describe(w)}</span>
      <span class="acts"><button class="pill ghost sm go">${T('다시 열기', 'Open again')}</button><button class="again sm del">${T('지우기', 'Delete')}</button></span></span>`;
    row.querySelector('.go').onclick = async () => { window.hhClose(); await restore(w); };
    // 영샘 10-11: one tap deleted at once - the first tap now only asks, the second (within a few seconds) deletes
    const del = row.querySelector('.del');
    del.onclick = async () => {
      if (!del.classList.contains('sure')) {
        del.classList.add('sure'); del.textContent = T('정말 지울까요?', 'Delete it?');
        setTimeout(() => { del.classList.remove('sure'); del.textContent = T('지우기', 'Delete'); }, 4000);
        return;
      }
      await dropMade(w.id); renderMade();
    };
    box.appendChild(row);
  }
}
document.querySelectorAll('[data-open="made"]').forEach((el) => { el.onclick = () => { renderMade(); window.hhOpen('made'); }; });

// ---------- opened inside another app's browser (10-11: 3) ----------
// A link tapped in KakaoTalk (and Instagram, Naver, ...) opens in that app's own browser, which cannot hand a video
// to Instagram. Say so on arrival, with the way out, instead of at the very end.
function inAppBrowser() {
  const ua = navigator.userAgent;
  if (/KAKAOTALK/i.test(ua)) return 'kakao';
  if (/Instagram|FBAN|FBAV|NAVER\(inapp|Line\/|DaumApps|everytimeApp|; wv\)/i.test(ua)) return 'other';
  return '';
}
function warnInApp() {
  const kind = inAppBrowser(); if (!kind) return;
  const ios = /iPhone|iPad/.test(navigator.userAgent);
  const box = $('inapp'), go = $('inappGo');
  $('inappMsg').textContent = T('앱 안에서 열려서 인스타로 바로 보내기가 안 돼요.', 'This opened inside another app, so sharing to Instagram won’t work here.');
  if (kind === 'kakao') {
    go.textContent = ios ? T('사파리로 열기', 'Open in Safari') : T('크롬으로 열기', 'Open in Chrome');
    go.onclick = () => { location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(location.href)}`; };
  } else if (!ios) {
    go.textContent = T('크롬으로 열기', 'Open in Chrome');
    go.onclick = () => { location.href = `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`; };
  } else {
    go.hidden = true;
    $('inappMsg').textContent += ' ' + T('오른쪽 위 메뉴 → 「Safari로 열기」를 눌러 주세요.', 'Use the menu → “Open in Safari”.');
  }
  $('inappX').onclick = () => { box.hidden = true; };
  box.hidden = false;
  rlog(`in-app browser: ${kind}`);
}

// ---------- make ----------
// Phone tests run through a temporary tunnel; there each step and error is also sent to the PC, which
// cannot see the phone's console. Nothing is sent from the real site.
const REMOTE_LOG = location.hostname.endsWith('.trycloudflare.com');
// The test build (herhours.github.io/test/) sends the same step/error lines to a Google Sheet, so tests are
// visible with the PC off. Only device string, version, a random session id and step text - never photos, songs or file names.
const SHEET_LOG = location.hostname === 'herhours.github.io' && location.pathname.startsWith('/test/');
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbyqtLZmTaCfgtkU3UKY_xOnIspwRhsPtxFKOvi-xAvsBgXYFBArOjS5-wu7-F8tlkyI/exec';
const SID = Math.random().toString(36).slice(2, 10);
const sheetQ = [];
const sheetFlush = () => {
  if (!sheetQ.length) return;
  const body = JSON.stringify({ app: 'hh-shorts-test', sid: SID, ua: navigator.userAgent.slice(0, 140), ver: self.HH_VERSION, lines: sheetQ.splice(0, 60) });
  if (!(navigator.sendBeacon && navigator.sendBeacon(SHEET_URL, new Blob([body], { type: 'text/plain' })))) fetch(SHEET_URL, { method: 'POST', mode: 'no-cors', body }).catch(() => {});
};
if (SHEET_LOG) { setInterval(sheetFlush, 4000); addEventListener('visibilitychange', () => { if (document.hidden) sheetFlush(); }); addEventListener('pagehide', sheetFlush); }
const rlog = (m) => {
  if (REMOTE_LOG) fetch('/log', { method: 'POST', body: `${new Date().toISOString().slice(11, 19)} ${navigator.userAgent.slice(0, 80)} | ${m}`.slice(0, 1500) }).catch(() => {});
  if (SHEET_LOG) { sheetQ.push({ t: new Date().toTimeString().slice(0, 8), m: String(m).slice(0, 600) }); if (sheetQ.length >= 20) sheetFlush(); }
};
if (SHEET_LOG) { rlog(`open ${innerWidth}x${innerHeight} dpr${devicePixelRatio} ${navigator.language}`); const n = document.getElementById('testnote'); if (n) n.hidden = false; }
// 10-17 시험 실측: 아이폰 사진 선택 뒤 대기는 iCloud 원본 내려받기(방금 찍은 사진은 빠름) — 앱이 못 줄이니 미리 알린다
if (/iPhone|iPad/.test(navigator.userAgent)) { const tip = document.getElementById('iosTip'); if (tip) tip.hidden = false; }
addEventListener('error', (e) => rlog(`error ${e.message} @${e.filename}:${e.lineno}`));
addEventListener('unhandledrejection', (e) => rlog(`rejection ${e.reason?.message || e.reason}`));
const status = (m, err = false) => { const e = $('status'); e.textContent = m; e.classList.toggle('err', err); if (m && !/· \d/.test(m)) rlog(`status ${m}`); };
const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
const fill = (p) => { $('fill').style.width = `${Math.round(p * 100)}%`; $('pct').textContent = `${Math.round(p * 100)}%`; };

async function make() {
  if (S.busy) return; S.busy = true;
  pv.pause(); window.hhClose(); pausePreview(S.images);
  document.body.classList.remove('is-done'); document.body.classList.add('is-making');
  S.blob = null; S.logQ = -1; fill(0); $('failMsg').textContent = ''; status(T('준비 중…', 'Getting ready…'));
  try {
    status(T('노래 불러오는 중…', 'Reading the song…'));
    // the song was already decoded when it was chosen; decoding it a second time is what stalled on a phone
    const decoded = S.fullBuf || await decodeAudio(S.useOurs ? await (await fetch(S.song.file)).arrayBuffer() : await S.audioFile.arrayBuffer());
    rlog(`song ${decoded.duration.toFixed(1)}s ${decoded.sampleRate}Hz reused=${decoded === S.fullBuf}`);
    const seconds = Math.min(S.seconds, decoded.duration - S.offset);
    const audioBuf = trimBuffer(decoded, seconds, S.offset);
    const N = Math.round(seconds * FPS);
    // 영샘 10-10: on a phone the wait looked frozen - say roughly how long, measured on 영샘's phones
    // (Android with video clips: 180s took 203s with the constant-rate encoder, 127s took 334s before it; iPhone with photos:
    // 32s took 30s ≈ 1x) + ~40s to get ready
    const live = S.images.some((c) => c.live), estSec = 40 + seconds * (live ? 1.5 : 1.2), est = Math.ceil(estSec / 60);
    $('eta').textContent = T(`예상 ${est <= 1 ? '1분 안쪽' : `약 ${est}분`} · 화면을 켜 둔 채 기다려 주세요. 처음 한 번은 글꼴을 받느라 조금 더 걸려요.`,
      `About ${est <= 1 ? 'a minute' : `${est} minutes`} · keep the screen on. The first time takes a little longer while fonts download.`);
    // A clip's <video> can pass the clean-probe and then turn protected while it plays (Android, HEVC through the
    // system player) - the same file worked on 10-04 and failed on 10-10. A tainted canvas stays tainted, so swap in
    // fresh ones; the export decodes the file itself and never needs the <video>.
    const tainted = (c) => { try { c.getContext('2d').getImageData(0, 0, 1, 1); return false; } catch { return true; } };
    S.images = S.images.map((c) => {
      if (!c.live || !tainted(c)) return c;
      const n = document.createElement('canvas'); n.width = c.width; n.height = c.height; n.live = true; n.clip = c.clip;
      n.clip.videoOk = false; rlog('clip canvas tainted - swapped for a clean one');
      return n;
    });
    const canvas = tainted(stage) ? Object.assign(document.createElement('canvas'), { width: stage.width, height: stage.height }) : stage;
    if (canvas !== stage) rlog('stage tainted - exporting on a clean canvas');
    rebuild();
    status(T('글꼴 준비 중… 멈춘 게 아니에요', 'Loading fonts… it hasn’t stopped'));
    await within(Promise.all([hangulReady(), ensureLyricFont([...S.d.phrases.map((p) => p.text), S.d.boxText, $('brand').value, $('t1').value, $('t2').value].filter(Boolean).join(' '))]), 8000);
    const stepper = exportStepper(S.d.images);
    let mixed = audioBuf;
    if (S.d.images.some((c) => c.live) && S.clipGain > 0) {
      status(T('영상 소리 맞추는 중… 멈춘 게 아니에요 (1분쯤)', 'Mixing video sound… it hasn’t stopped (about a minute)'));
      const vis = scanVisibility(S.look.draw, ctx, seen, S.d, N);
      mixed = await mixClipSound(audioBuf, S.d.images, vis, S.clipGain, FPS);
    }
    status(T('만드는 중', 'Making'));
    const { blob, elapsed } = await encode({
      canvas, d: S.d, N, audioBuf: mixed, draw: S.look.draw, beforeFrame: stepper,
      onProgress: (p, el) => { fill(p); status(T(`만드는 중 · ${el.toFixed(0)}초`, `Making · ${el.toFixed(0)}s`)); const q = Math.floor(p * 4); if (q > (S.logQ ?? -1)) { S.logQ = q; rlog(`progress ${q * 25}% ${el.toFixed(1)}s`); } },
    });
    await stepper.close();
    S.blob = blob;
    status(T('파일 마무리 중…', 'Finishing the file…'));
    const url = URL.createObjectURL(blob);
    $('out').src = url;
    $('out').muted = false; $('out').volume = 1;   // the finished short is always heard
    $('save').href = url; $('save').download = `herhours_${Date.now()}.mp4`;
    $('doneMeta').textContent = T(`${seconds.toFixed(0)}초 · ${(blob.size / 1048576).toFixed(0)}MB · ${elapsed.toFixed(0)}초 만에 완성`, `${seconds.toFixed(0)}s · ${(blob.size / 1048576).toFixed(0)}MB · made in ${elapsed.toFixed(0)}s`);
    // an iPhone saves a download to Files, not Photos — the share sheet's 'Save Video' is the way to Photos
    $('credit').textContent = S.useOurs ? `Music: Her Hours — ${S.song.name}` : '';
    if (/iPhone|iPad/.test(navigator.userAgent)) $('doneMeta').textContent += T(' · 사진 앱에 넣으려면 「인스타에 올리기」 → 「동영상 저장」', ' · For Photos: “Share to Instagram” → “Save Video”');
    document.body.classList.remove('is-making'); document.body.classList.add('is-done'); $('eta').textContent = '';
    $('out').play?.().catch(() => {});
    status('');
    flowDone();
    keepMade(seconds, N).catch((e) => rlog(`keepMade ${e}`));
  } catch (e) {
    console.error(e); rlog(`make failed ${e.stack || e}`);
    document.body.classList.remove('is-making');
    status(`${T('실패', 'Failed')}: ${e.message || e}`, true);
    $('failMsg').textContent = T(`만들기에 실패했어요. 다시 눌러 주세요. (${e.message || e})`, `Couldn’t make it. Please try again. (${e.message || e})`);
  } finally { S.busy = false; }
}
$('make').onclick = () => (S.flowDone ? make() : window.hhOpen('look'));

$('again').onclick = () => {
  document.body.classList.remove('is-done');
  $('out').pause(); S.vf = 0; S.started = false;
};

$('share').onclick = async () => {
  if (!S.blob) return;
  const file = new File([S.blob], `herhours_${Date.now()}.mp4`, { type: 'video/mp4' });
  rlog(`share ${(S.blob.size / 1048576).toFixed(1)}MB`);
  // canShare() says yes to any size, but Chrome then refuses files over 50MB
  if (S.blob.size > 49 * 1048576) {
    $('doneMeta').textContent = T('영상이 커서 바로 공유가 안 돼요. 「저장」으로 받아서 인스타에서 올려주세요.', 'The video is too large to share directly. Tap “Save”, then post it from Instagram.');
  } else if (navigator.canShare && navigator.canShare({ files: [file] })) {
    // Instagram refused a share that carried text alongside the video (영샘's Android 10-10: "can't ..."), so the
    // video goes alone, as on 10-04, and the music credit rides the clipboard into the caption instead.
    const credit = S.useOurs ? `Music: Her Hours — ${S.song.name}` : '';
    if (credit) {
      try { await navigator.clipboard.writeText(credit); $('credit').textContent = T(`「${credit}」 복사했어요 · 인스타 설명에 붙여 넣어 주세요`, `Copied “${credit}” · paste it into the caption`); } catch {}
    }
    // 영샘 10-10: the first hand-off to Instagram showed "can't ...", the same tap again opened the post screen
    try {
      await navigator.share({ files: [file], title: 'Her Hours Shorts' });
      // 10-11 (4): sending to Instagram does not keep a copy on the phone - people assumed it did
      $('doneMeta').textContent = /iPhone|iPad/.test(navigator.userAgent)
        ? T('보냈어요. 폰 사진 앱에는 아직 없어요 — 한 번 더 눌러 「동영상 저장」을 골라 두세요.', 'Sent. It isn’t in Photos yet — tap again and choose “Save Video”.')
        : T('보냈어요. 폰에는 아직 저장 안 됐어요 — 아래 「저장」도 눌러 두세요.', 'Sent. It isn’t saved on the phone yet — tap “Save” below too.');
      $('doneMeta').textContent += ' ' + T('인스타에서 「할 수 없습니다」가 뜨면 한 번 더 눌러 주세요.', 'If Instagram says it can’t, tap share once more.');
      $('save').classList.add('nudge');
    }
    catch (e) { rlog(`share failed ${e.name} ${e.message}`); if (e.name !== 'AbortError') $('doneMeta').textContent = `${T('공유 실패', 'Share failed')}: ${e.message}`; }
  } else {
    $('doneMeta').textContent = inAppBrowser()
      ? T('앱 안 브라우저라 바로 공유가 안 돼요. 크롬·사파리로 열어서 다시 만들거나, 「저장」으로 받아서 인스타에서 올려주세요.', 'This in-app browser can’t share. Open the page in Chrome or Safari, or tap “Save” and post it from Instagram.')
      : T('이 브라우저는 바로 공유가 안 돼요. 「저장」으로 받아서 인스타에서 올려주세요.', 'This browser can’t share directly. Tap “Save”, then post it from Instagram.');
  }
};
$('save').addEventListener('click', () => $('save').classList.remove('nudge'));

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
    loadDemoHw().then((ims) => { S.demoHw = ims; if (!S.images.length) rebuild(); }).catch(() => {});
    pv.src = S.song.file;
    renderSongs();
    applyCut();
    rebuild(); chips(); renderLooks();
    await listen(await (await fetch(S.song.file)).arrayBuffer());
    document.body.classList.add('ready');
    S.vf = 120;                       // open on a frame where the look is fully on screen
    requestAnimationFrame(loop);
    caps();
    setMake(); warnInApp();
    S.ready = true;
    if (!document.body.classList.contains('panel-open')) await offerResume();
  } catch (e) {
    status(`${T('준비 실패', 'Setup failed')}: ${e.message}`, true);
    // the loading card would otherwise spin forever over a blank stage
    document.querySelector('.boot span').textContent = `${T('준비 실패', 'Setup failed')}: ${e.message}`;
    document.querySelector('.boot i').hidden = true;
  }
})();
