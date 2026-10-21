// Her Hours Shorts — UI controller shared by both shells (A: sheet, B: rail).
// The shell supplies the markup and two hooks (window.hhOpen / window.hhClose); everything
// below is identical in both so the two designs cannot drift apart in behaviour.
import { W, H, FPS, MAX_SEC, loadFonts, fileToBitmap, drawFrame, decodeAudio, trimBuffer,
         encode, buildData, loadDemo, loadDemoHw, loadDemoKids, loadTemplate, canEncodeAudio, canEncodeVideo, ensureLyricFont, hangulReady, SONGS, KIDS_SONGS } from './core.js';
import { LOOKS, lookById } from './looks.js';
import { analyze, findChorus } from './beats.js';
import { isVideoFile, fileToClip, tickPreview, pausePreview, exportStepper, watchDraws, scanVisibility, mixClipSound, clipAudio, clipLevel, rms } from './media.js';
import { getDraft, putDraft, dropDraft, listMade, addMade, dropMade } from './store.js';

const $ = (id) => document.getElementById(id);
// 10-18 class link: herhours.github.io/test/kids/ → ?class=kids. 민정샘's primary-school class gets the 「민정샘」 look first,
// only the kids' songs, picture-book demo pictures, and its own words kept when a song is picked.
const KIDS = ['kids', 'minjeong'].includes(new URLSearchParams(location.search).get('class'));
const QLOOK = new URLSearchParams(location.search).get('look');
// each class template opens with its own words; switching templates swaps them only if the class has not changed them
const KIDS_TEXT = { 'minjeong-hw': { brand: '민정샘 반', t1: 'HALLOWEEN', t2: 'NIGHT PARTY' }, minjeong: { brand: '민정샘 반', t1: 'OUR CLASS', t2: 'BEST DAY EVER' } };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const S = {
  tpl: null, images: [], photoFiles: [], demo: [], demoHw: [], demoKids: { halloween: [], everyday: [] },
  useOurs: true, song: KIDS ? SONGS.find((s) => s.id === KIDS_SONGS[0]) : SONGS[0], audioFile: null,
  d: null, N: 960, seconds: MAX_SEC,
  vf: 0,            // virtual frame shown while the song is not playing
  started: false,   // has the user pressed play at least once
  busy: false, blob: null, every: 1,
  look: lookById(QLOOK || (KIDS ? 'minjeong-hw' : null)), beat: null,
  clipGain: 0.35,
  songLyrics: !KIDS,            // 10-20: on the class link our song's lyric captions are off until 「가사 자막」 is ticked
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
    phrases: S.userPhrases, blank: KIDS, songLyrics: S.songLyrics,
  });
  base.N = S.N;
  // our own song's lyrics are timed from 0; a later start moves them with it
  if (S.useOurs && S.offset) base.phrases = shiftPhrases(base.phrases, -Math.round(S.offset * FPS), S.N);
  S.d = S.look.build(base, S.beat);
  // 10-18 (영샘, Galaxy test): on the class link the making/done screens wear the chosen template's type too
  document.body.classList.toggle('th-halloween', KIDS && S.look.theme === 'halloween');
  document.body.classList.toggle('th-everyday', KIDS && S.look.theme === 'everyday');
  document.querySelectorAll('.row .cnt').forEach((c) => {   // 10-20: how many letters are left, so a title is not cut off mid-word
    const i = $(c.dataset.for), n = [...i.value].length, max = +i.maxLength;
    c.textContent = `${n}/${max}`; c.classList.toggle('full', n >= max);
  });
  saveSoon();
}
const demoFor = (look) => (KIDS && S.demoKids[look.theme || 'everyday']?.length ? S.demoKids[look.theme || 'everyday'] : look.id === 'halloween' && S.demoHw.length ? S.demoHw : S.demo);
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
  const base = buildData({ tpl: S.tpl, images: demoFor(look), useOurs: S.useOurs, brand: $('brand').value, title1: $('t1').value, title2: $('t2').value, blank: KIDS, songLyrics: S.songLyrics });
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
  const shown = KIDS ? [...LOOKS.filter((l) => l.kids), ...LOOKS.filter((l) => !l.kids)] : LOOKS.filter((l) => !l.kids);
  for (const l of shown) {
    const b = document.createElement('button');
    b.className = 'tile' + (l.id === S.look.id ? ' on' : '');
    // a real frame of the look, not a colour swatch — the choice is judged by what the video will look like (10-11)
    b.innerHTML = `<img class="lkimg" src="assets/looks/${l.id}.jpg" alt="" loading="lazy" decoding="async"><span>${l.name.replace(' · ', '<br>')}</span>`;
    b.onclick = () => {
      const now = KIDS_TEXT[l.id];
      if (KIDS && now) kidsExamples(now);   // 10-20: the class fields start empty - only the faint examples follow the look
      S.look = l; renderLooks(); rebuild(); chips();
    };
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
  makeSum();
}
// 10-20 PT 리뷰 4: the choices live in four sheets, so before 「쇼츠 만들기」 one line says what will be made - each part
// opens its sheet, and the demo photos are marked so an example is not taken for one's own
function makeSum() {
  const el = $('makeSum'); if (!el) return;
  const on = !!S.flowDone && !!(S.images.length || S.demoChosen);
  el.hidden = !on; document.body.classList.toggle('has-sum', on);
  if (!on) return;
  const nv = S.photoFiles.filter(isVideoFile).length, np = S.photoFiles.length - nv;
  const photo = S.photoFiles.length ? [np && T(`내 사진 ${np}장`, `${np} photos`), nv && T(`영상 ${nv}개`, `${nv} videos`)].filter(Boolean).join(' · ')
    : T('예시 사진으로', 'demo photos');
  const song = S.useOurs ? S.song.name : (S.audioFile?.name || T('내 음악', 'My song'));
  el.textContent = '';
  [[S.look.name, 'look'], [photo, 'photo', !S.photoFiles.length], [song, 'song'], [`${Math.round(S.seconds || S.len)}${T('초', 's')}`, 'song']]
    .forEach(([t, pane, demo], i) => {
      if (i) el.append(' · ');
      const b = document.createElement('button'); b.type = 'button'; b.textContent = t;
      if (demo) b.className = 'demo';
      b.onclick = () => window.hhOpen(pane); el.append(b);
    });
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
  makeSum();
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
// 10-20 영샘 아이폰(사파리, 반 링크): "사진 골랐는데 안 됨" — a pick whose files all failed the type check did nothing
// and said nothing. A phone can hand over a file with an empty type, so the extension counts too, and every pick is logged.
const IMG_EXT = /\.(jpe?g|png|heic|heif|webp|gif|avif|bmp)$/i;
$('photos').onchange = (e) => {
  const all = [...e.target.files];
  rlog(`pick ${all.length}: ${all.slice(0, 6).map((f) => `${f.type || '(no type)'} ${(f.size / 1048576).toFixed(1)}MB`).join(', ')}`);
  const files = all.filter((f) => f.type.startsWith('image/') || isVideoFile(f) || (!f.type && IMG_EXT.test(f.name)));
  if (files.length) usePhotos(files);
  else if (all.length) $('phint').textContent = T(`이 파일은 못 넣어요 (${all[0].type || all[0].name}). 사진 앱에서 다른 사진으로 골라 주세요.`, `Can’t use this file (${all[0].type || all[0].name}). Pick another photo.`);
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
      el.muted = true; el.playsInline = true; el.preload = 'metadata'; el.className = 'vid';   // src only after the one read (below)
      th.appendChild(el); return el;          // kept (not replaced) - its tap opens the position picker once the clip is read
    }
    const d = document.createElement('div'); d.className = 'ph'; th.appendChild(d); return d;
  });
  chips();
  let n = 0;
  const say = () => { $('phint').textContent = T(`불러오는 중… ${n} / ${files.length}`, `Reading… ${n} / ${files.length}`); };
  say();
  const t0 = performance.now();
  // 10-19 영샘 S20+ (2026.10.19-8 log): two clips failed with "network error" - a read of the picked file that failed,
  // not the internet - and the same sizes had read fine 6 minutes before. So a failed read is tried twice more, and
  // clips are read one at a time (the gallery hands over one file at a time more reliably than two).
  // -9 log: the first clip still failed all three reads while later ones read at once. The thumbnail <video> started
  // reading the gallery file the moment it was picked, at the same time as our own read - so a clip is now read ONCE
  // into memory, and the thumbnail, the decoder and the preview all use that copy.
  const readOne = async (f, i) => {
    for (let k = 0; ; k++) {
      try {
        if (!isVideoFile(f)) return await fileToBitmap(f);
        // a 269MB camera file showed up in the -9 log - copying that whole into a phone's memory could crash the tab;
        // big files are read in place (the thumbnail still waits until after our read)
        const mem = f.size > 100 * 1048576 ? f : new File([await f.arrayBuffer()], f.name, { type: f.type || 'video/mp4' });
        const v = await fileToClip(mem);
        if (slots[i]?.tagName === 'VIDEO') slots[i].src = URL.createObjectURL(mem);
        return v;
      }
      catch (e) {
        if (k >= 2 || !/network|NotReadable|could not be read|NotFound/i.test(`${e?.name} ${e?.message}`)) throw e;
        rlog(`photo retry ${i + 1} #${k + 1} ${e?.message}`);
        await new Promise((res) => setTimeout(res, 600 * (k + 1)));
      }
    }
  };
  const r = await pool(files, files.some(isVideoFile) ? 1 : 2, async (f, i) => {
    const t = performance.now();
    const v = await readOne(f, i);
    n++; say();
    if (slots[i]?.tagName === 'VIDEO') { const el = slots[i]; el.onclick = () => openFocus(v, el); v.hhThumb = el; }   // clips too: their canvas holds the current frame
    else if (slots[i]) { const th = thumbOf(v); th.onclick = () => openFocus(v, th); slots[i].replaceWith(th); v.hhThumb = th; }
    rlog(`photo ${i + 1}/${files.length} ${v.hhPath || 'clip'} ${Math.round(performance.now() - t)}ms ${(f.size / 1048576).toFixed(1)}MB ${f.type} → ${v.width}x${v.height}`);
    return v;
  });
  rlog(`photos ${files.length} in ${Math.round(performance.now() - t0)}ms`);
  const ok = r.filter((x) => x.status === 'fulfilled').map((x) => x.value);
  // 10-19 영샘 S20+: several videos failed in ~0.1s and nothing said why - log the reason (type, size, codec) and show it
  r.forEach((x, i) => { if (x.status === 'rejected') rlog(`photo fail ${i + 1}/${files.length} ${files[i].type || '?'} ${(files[i].size / 1048576).toFixed(1)}MB ${x.reason?.message || x.reason}`); });
  const bad = r.map((x, i) => (x.status === 'rejected' ? `${files[i].name}${x.reason?.message ? ` (${x.reason.message})` : ''}` : null)).filter(Boolean);
  if (ok.length) { S.images = ok; S.demoChosen = false; renderOrder(); setMake(); rebuild(); renderLooks(); }
  $('focusTip').hidden = !ok.length;
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

// ---------- photo order (10-20 영샘: "사진 나오는 순서 정할 수 있도록") ----------
// Each picture in the strip gets its number and ◀ ▶ under it - one tap moves it one place. Buttons rather than dragging:
// the class is children on phones, and a drag in a sideways-scrolling strip fights the scroll.
function renderOrder() {
  const th = $('thumbs'); th.innerHTML = '';
  const n = S.images.length;
  S.images.forEach((v, i) => {
    if (!v.hhThumb) return;
    const w = document.createElement('div'); w.className = 'tw';
    const no = document.createElement('span'); no.className = 'no'; no.textContent = String(i + 1);
    const mv = document.createElement('div'); mv.className = 'mv';
    const btn = (label, aria, to) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('aria-label', aria);
      b.disabled = to < 0 || to >= n; b.onclick = () => movePhoto(i, to); return b;
    };
    mv.append(btn('◀', T('앞으로', 'Earlier'), i - 1), btn('▶', T('뒤로', 'Later'), i + 1));
    w.append(v.hhThumb, no, mv); th.appendChild(w);
  });
}
async function movePhoto(from, to) {
  if (to < 0 || to >= S.images.length || S.busy) return;
  const [v] = S.images.splice(from, 1); S.images.splice(to, 0, v);
  rlog(`photo order ${from + 1} → ${to + 1}`);
  renderOrder(); rebuild();
  S.photoBlobs = await shrinkAll(S.images.filter((x) => !x.live));   // the draft keeps the new order
  saveSoon();
}

// ---------- photo position (10-19 테스터 의견: "사진 프레임 안에서 띄우고 싶은 부분이 보이도록") ----------
// The whole photo with one ring: the spot under the ring stays in view in every look (looks.js AL / core drawCover read
// img.hhAlign). A spot, not a crop box, because each look frames differently - an arch, a band, three panels.
let focusImg = null, focusTh = null, focusDown = false;
const autoAlign = (img) => ({ x: 0.5, y: img.height > img.width * 1.1 ? 0.3 : 0.5 });
const placeRing = () => {
  const a = focusImg.hhAlign || autoAlign(focusImg);
  $('focusRing').style.left = `${a.x * 100}%`; $('focusRing').style.top = `${a.y * 100}%`;
};
function openFocus(img, th) {
  focusImg = img; focusTh = th;
  const cv = $('focusCv'), k = Math.min(1, 900 / Math.max(img.width, img.height));
  cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  placeRing(); window.hhOpen('focus');
}
const focusAt = (e) => {
  const r = $('focusCv').getBoundingClientRect();
  const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  focusImg.hhAlign = { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
  placeRing(); focusTh?.classList.add('aligned');
};
$('focusBox').addEventListener('pointerdown', (e) => { if (!focusImg) return; focusDown = true; $('focusBox').setPointerCapture(e.pointerId); focusAt(e); });
$('focusBox').addEventListener('pointermove', (e) => { if (focusDown) focusAt(e); });
const focusUp = () => { if (!focusDown) return; focusDown = false; rlog(`photo focus ${focusImg.hhAlign?.x},${focusImg.hhAlign?.y}`); rebuild(); };   // rebuild: a look may lay out per photo in build(); it also saves the draft
$('focusBox').addEventListener('pointerup', focusUp); $('focusBox').addEventListener('pointercancel', focusUp);
$('focusReset').onclick = () => { if (!focusImg) return; delete focusImg.hhAlign; placeRing(); focusTh?.classList.remove('aligned'); saveSoon(); };
$('focusDone').onclick = () => window.hhOpen('photo');

$('useDemo').onclick = () => {
  pausePreview(S.images);
  S.photoFiles = []; S.images = []; S.photoBlobs = []; $('thumbs').innerHTML = ''; $('clipGainRow').hidden = true;
  $('photos').value = ''; $('phint').textContent = T('예시 사진 6장으로 보여주는 중이에요.', 'Showing the 6 demo photos.');
  S.demoChosen = true; setMake();
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
// the class sees shelves of its own: its own Korean songs, then other songs with words, then the bright instrumentals
const KIDS_GROUPS = [
  [(s) => s.group === 'kids', () => T('🎤 민정샘 반 노래 · 우리말 가사', '🎤 Our class songs · in Korean')],
  [(s) => KIDS_SONGS.includes(s.id) && s.group !== 'kids' && s.lyrics !== false, () => T('🎃 영어 가사 노래', '🎃 Songs with English lyrics')],
  [(s) => KIDS_SONGS.includes(s.id) && s.lyrics === false, () => T('✨ 신나는 연주곡', '✨ Upbeat instrumentals')],
];
// 10-20 영샘: "이미지 아이콘 없는 노래도 이미지 넣어서 아이콘 만들자" - the instrumentals and class songs got scene covers
// (no singer, so no face). The class link still keeps our characters' faces off its list: only the scene covers show there.
const hasCover = (s) => (KIDS ? /^(kids|app)_/.test(s.id) : true);
function renderSongs() {
  const groups = KIDS ? KIDS_GROUPS.map(([pick, label]) => [SONGS.filter(pick).sort((a, b) => KIDS_SONGS.indexOf(a.id) - KIDS_SONGS.indexOf(b.id)), label])
    : SONG_GROUPS.map(([g, label]) => [SONGS.filter((s) => s.group === g), label]);
  $('ourSongs').innerHTML = groups.map(([list, label]) => `<p class="song-group">${label()}</p>` + list.map((s) => `<button class="opt${S.useOurs && s.id === S.song.id ? ' on' : ''}" data-song="${s.id}">
      ${hasCover(s)
        ? `<img class="cov" src="assets/covers/${s.id}.jpg" alt="" loading="lazy" decoding="async">`
        : `<span class="cov gr-${KIDS ? 'bright' : s.group}"><svg width="24" height="24"><use href="#i-music"/></svg></span>`}
      <span class="t"><b>${s.name}</b><span>${s.lyrics === false ? T('곡 제목이 글자로 나와요', 'the title becomes the type') : T('가사가 박자에 켜져요', 'lyrics light up on the beat')}</span></span>${S.useOurs && s.id === S.song.id ? EQ_HTML : ''}</button>`).join('')).join('');
  $('ourSongs').querySelectorAll('[data-song]').forEach((b) => { b.onclick = () => pickSong(SONGS.find((s) => s.id === b.dataset.song), true); });
}
// 21st 28201 (10-21 영샘 "막대 좋아"): 지금 고른 노래 줄에 소리 막대. 원본은 가짜 막대라, 이미 받아 둔 노래(S.fullBuf)를 재생 위치에서
// 주파수 7칸으로 읽는다(Goertzel). 소리 길(pv)은 건드리지 않는다 — 아이폰에서 소리가 끊길 위험이 없다.
const EQ_N = 7, EQ_HTML = `<span class="sbars" aria-hidden="true">${'<i></i>'.repeat(EQ_N)}</span>`;
const EQ_HZ = Array.from({ length: EQ_N }, (_, i) => 90 * Math.pow(6000 / 90, i / (EQ_N - 1)));
const eqLvl = new Float32Array(EQ_N), EQ_WIN = 1024;
// 노래마다·구간마다 크기가 달라서 칸마다 최근 위·아래를 따라가며 맞춘다(조용한 인트로에서도 막대가 산다)
const eqLo = new Float32Array(EQ_N).fill(-70), eqHi = new Float32Array(EQ_N).fill(-25);
function eqDb(d, i0, f, sr) {
  const c = 2 * Math.cos((2 * Math.PI * f) / sr);
  let s1 = 0, s2 = 0;
  for (let n = 0; n < EQ_WIN; n++) { const s0 = (d[i0 + n] || 0) * eqHann[n] + c * s1 - s2; s2 = s1; s1 = s0; }
  return 20 * Math.log10(Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2)) / (EQ_WIN / 4) + 1e-6);
}
const eqHann = Float32Array.from({ length: EQ_WIN }, (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (EQ_WIN - 1)));
function eqTick() {
  requestAnimationFrame(eqTick);
  const box = document.querySelector('#ourSongs .opt.on .sbars');
  if (!box || !box.offsetParent) return;
  const bars = box.children, buf = S.fullBuf;
  const on = !pv.paused && buf && !calm.matches;
  for (let k = 0; k < EQ_N; k++) {
    let target = [0.35, 0.55, 0.75, 0.5, 0.65, 0.4, 0.25][k];   // 멈춰 있을 땐 흐린 막대 모양으로 서 있다(10-21 영샘 "뭔지 모르겠다")
    if (on) {
      const d = buf.getChannelData(0), sr = buf.sampleRate, i0 = Math.max(0, Math.floor(pv.currentTime * sr) - EQ_WIN);
      // 한 칸 = 주파수 셋(칸 폭 안에서 아래·가운데·위)의 평균
      const db = (eqDb(d, i0, EQ_HZ[k] * 0.8, sr) + eqDb(d, i0, EQ_HZ[k], sr) + eqDb(d, i0, EQ_HZ[k] * 1.25, sr)) / 3;
      eqHi[k] = Math.max(db, eqHi[k] - 0.04); eqLo[k] = Math.min(db, eqLo[k] + 0.04);
      target = 0.12 + 0.88 * Math.min(1, Math.max(0, (db - eqLo[k]) / Math.max(14, eqHi[k] - eqLo[k])));
    }
    // 올라갈 땐 빨리, 내려갈 땐 천천히 — 원본의 0.15초 따라가기 느낌
    eqLvl[k] += (target - eqLvl[k]) * (target > eqLvl[k] ? 0.55 : 0.18);
    bars[k].style.height = `${Math.round(eqLvl[k] * 100)}%`;
  }
  box.classList.toggle('lit', on);
}
requestAnimationFrame(eqTick);
// 10-20 tester (halloween, Android): "노래를 바꾸면 멈춰서 재생을 다시 눌러야 새 노래가 나와요" - a tapped song plays at once.
// play() goes in before the first await so it still counts as the tap (Safari drops it after a fetch). Restoring a draft doesn't play.
async function pickSong(song, play = false) {
  S.useOurs = true; S.song = song; S.audioFile = null; S.fullBuf = null; $('audio').value = '';
  document.body.classList.remove('mine-song');
  renderSongs();
  pv.pause(); pv.src = song.file;
  if (play) { S.started = true; S.vf = 0; pv.play().catch(() => {}); }
  S.tpl = await loadTemplate(song);
  await new Promise((r) => { pv.onloadedmetadata = r; setTimeout(r, 3000); });
  S.offset = 0; S.chorusAt = null; S.songDur = pv.duration || MAX_SEC; applyCut();
  if (!KIDS) { $('brand').value = S.tpl.brand; $('t1').value = S.tpl.title1; $('t2').value = S.tpl.title2; }
  $('shint').textContent = T('내 노래 파일을 골라요. 길이와 시작점은 아래에서.', 'Pick a song file. Length and start point below.');
  rebuild(); chips(); syncPlay();
  // 10-20 log: one "rejection Failed to fetch" right after opening - this read had no catch; now it says what failed
  fetch(song.file).then((r) => r.arrayBuffer()).then(listen).catch((e) => rlog(`song read fail ${song.id} ${e?.message || e}`));
}

$('audio').onchange = (e) => { const f = e.target.files[0]; if (f) useAudioFile(f, true); };
async function useAudioFile(f, play = false) {
  S.useOurs = false; S.audioFile = f; S.fullBuf = null; renderSongs();
  document.body.classList.add('mine-song');
  pv.pause();
  pv.src = URL.createObjectURL(f);
  await new Promise((r) => { pv.onloadedmetadata = r; setTimeout(r, 3000); });
  S.offset = 0; S.chorusAt = null; S.songDur = pv.duration || S.len; applyCut();
  if (play) { S.started = true; S.vf = 0; pv.play().catch(() => {}); }   // after the file picker this may be refused; then the play button still works
  const base = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().toUpperCase().split(' ');
  const g1 = base.slice(0, Math.ceil(base.length / 2)).join(' ').slice(0, 14) || 'MY SONG';
  const g2 = base.slice(Math.ceil(base.length / 2)).join(' ').slice(0, 18) || 'ON MY PHONE';
  if (KIDS) { $('t1').placeholder = g1; $('t2').placeholder = g2; }   // 10-20: the class link fills nothing in for them
  else { $('t1').value = g1; $('t2').value = g2; }
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
// 10-20 class link: the class words become faint examples in the empty boxes, never text in the video
function kidsExamples(txt) { $('brand').placeholder = txt.brand; $('t1').placeholder = txt.t1; $('t2').placeholder = txt.t2; }
$('songLyrics').addEventListener('change', (e) => { S.songLyrics = e.target.checked; rlog(`song lyrics ${S.songLyrics ? 'on' : 'off'}`); rebuild(); });

$('lyrics').addEventListener('input', () => saveSoon());

document.querySelectorAll('[data-open]').forEach((el) => { el.onclick = () => window.hhOpen(el.dataset.open); });
document.querySelectorAll('[data-close]').forEach((el) => { el.onclick = () => window.hhClose(); });
// 10-20 시험자 의견: "글자 창이 열려 있을 때 위 칸에서 영상 일시정지가 가능했으면" - with a sheet open the video sits above
// it, under the see-through scrim. A tap on the video now plays / pauses it; a tap beside it still closes the sheet.
document.querySelector('.scrim').onclick = (e) => {
  const f = document.querySelector('.frame').getBoundingClientRect();
  if (e.clientX >= f.left && e.clientX <= f.right && e.clientY >= f.top && e.clientY <= f.bottom) { togglePlay(); return; }
  window.hhClose();
};
// 10-19 영샘: "사진 고르고 다음 음악 갔다가 다시 뒤로 사진" - each step has 「← 이전」
document.querySelectorAll('[data-prev]').forEach((el) => { el.onclick = () => window.hhOpen(el.dataset.prev); });

// ---------- the four steps in order (10-11: 1 and 2) ----------
// Each sheet's button goes on to the next one: style → photos → song → text → back to the video, ready to make.
const STEPS = ['look', 'photo', 'song', 'text'];
const seenSteps = new Set();
const shellOpen = window.hhOpen;
window.hhOpen = (name) => {
  // 10-20 시험자 의견: someone who starts with the photos had to go back to reach the styles - until the style step has
  // been seen, the photo step's button leads there, then on to the song as before
  if (name === 'photo') {
    const nx = document.querySelector('.pane-photo .stepnav [data-next]'), toLook = !seenSteps.has('look');
    nx.dataset.next = toLook ? 'look' : 'song'; nx.textContent = toLook ? T('다음 · 스타일', 'Next · Style') : T('다음 · 노래', 'Next · Song');
  }
  shellOpen(name);
  if (STEPS.includes(name)) { seenSteps.add(name); if (seenSteps.size === STEPS.length) flowDone(); }
};
// The phone's back button (and the installed app's) steps back one sheet instead of leaving the page: one history
// entry while a sheet is open; back = the previous step, or close.
{
  const PREV = { photo: 'look', song: 'photo', text: 'song', focus: 'photo', lyrics: 'song' };
  let pushed = false;
  const stepOpen = window.hhOpen, shellClose = window.hhClose;
  window.hhOpen = (name) => { stepOpen(name); if (!pushed) { history.pushState({ hhSheet: 1 }, ''); pushed = true; } };
  window.hhClose = () => { shellClose(); if (pushed) { pushed = false; history.back(); } };
  addEventListener('popstate', () => {
    if (!pushed) return;                                  // our own history.back() after a close
    pushed = false;
    if (!document.body.classList.contains('panel-open')) return;
    const prev = PREV[document.body.dataset.pane];
    if (prev) window.hhOpen(prev); else shellClose();
  });
}
function flowDone() {
  if (S.flowDone) return;
  S.flowDone = true; setMake();
  try { localStorage.setItem('hh-flowed', '1'); } catch {}
}
// 10-19 랩코 점검 A2: in class mode a child who skipped the photo step got a finished video of the demo pictures and
// thought it was theirs. The button asks for their photos first; the demo still works if 「예시로」 was tapped.
// Same evening 영샘: the same in the regular app - 「쇼츠 만들기」 on the first screen made the example straight away.
const needPhotos = () => !S.images.length && !S.demoChosen;
function setMake() {
  $('make').textContent = !S.flowDone ? T('① 스타일부터 고르기', '① Start with a style')
    : needPhotos() ? T('② 내 사진부터 골라요', '② Pick your photos first') : T('쇼츠 만들기', 'Make my Short');
  $('make').classList.toggle('first', !S.flowDone || needPhotos());
  makeSum();
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
    lyrics: $('lyrics').value, phrases: S.userPhrases, songLyrics: S.songLyrics,
    photos: S.photoBlobs, clips: S.photoFiles.filter(isVideoFile).length,
    aligns: S.images.filter((x) => !x.live).map((x) => x.hhAlign || null),   // same order as photos (shrinkAll of the non-clips)
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
    if (typeof w.songLyrics === 'boolean') { S.songLyrics = w.songLyrics; $('songLyrics').checked = w.songLyrics; }
    if (w.photos?.length) {
      await usePhotos(w.photos.map((b, i) => new File([b], `photo_${i + 1}.jpg`, { type: 'image/jpeg' })));
      if (w.aligns) S.images.filter((x) => !x.live).forEach((x, i) => { if (w.aligns[i]) x.hhAlign = w.aligns[i]; });
      [...$('thumbs').querySelectorAll('.th')].forEach((th, i) => th.classList.toggle('aligned', !!w.aligns?.[i]));
    }
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
// iPadOS Safari calls itself a Mac, so 'iPad' never shows up in the agent - a touch screen gives it away
// (10-17: a primary school wants to run a class on tablets or phones)
function isIOS() { const ua = navigator.userAgent; return /iPhone|iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); }
function warnInApp() {
  const kind = inAppBrowser(); if (!kind) return;
  $('helpInApp').hidden = false;
  const ios = isIOS();
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
// 10-19: a classroom phone that drops off the wifi used to lose its lines (and a sent feedback) - keep them on the phone
// until it is online again. Same content as before, only held back; capped so storage can't fill.
const LQ = 'hh-logq';
const sheetHold = () => { try { localStorage.setItem(LQ, JSON.stringify(JSON.parse(localStorage.getItem(LQ) || '[]').concat(sheetQ.splice(0)).slice(-300))); } catch (e) { sheetQ.length = 0; } };
const sheetRestore = () => {
  try {
    const old = JSON.parse(localStorage.getItem(LQ) || '[]');
    if (old.length && navigator.onLine) { localStorage.removeItem(LQ); sheetQ.unshift(...old.map((l) => ({ ...l, m: `[offline] ${l.m}` }))); sheetFlush(); }
  } catch (e) {}
};
const sheetFlush = () => {
  if (!sheetQ.length) return;
  if (!navigator.onLine) { sheetHold(); return; }
  const body = JSON.stringify({ app: 'hh-shorts-test', sid: SID, ua: navigator.userAgent.slice(0, 140), ver: self.HH_VERSION, lines: sheetQ.splice(0, 60) });
  if (!(navigator.sendBeacon && navigator.sendBeacon(SHEET_URL, new Blob([body], { type: 'text/plain' })))) fetch(SHEET_URL, { method: 'POST', mode: 'no-cors', body }).catch(() => {});
};
if (SHEET_LOG) {
  setInterval(sheetFlush, 4000); addEventListener('visibilitychange', () => { if (document.hidden) sheetFlush(); }); addEventListener('pagehide', sheetFlush);
  addEventListener('online', sheetRestore); setTimeout(sheetRestore, 1500);
}
const rlog = (m) => {
  if (REMOTE_LOG) fetch('/log', { method: 'POST', body: `${new Date().toISOString().slice(11, 19)} ${navigator.userAgent.slice(0, 80)} | ${m}`.slice(0, 1500) }).catch(() => {});
  if (SHEET_LOG) { sheetQ.push({ t: new Date().toTimeString().slice(0, 8), m: String(m).slice(0, 600) }); if (sheetQ.length >= 20) sheetFlush(); }
};
if (SHEET_LOG) { rlog(`open ${innerWidth}x${innerHeight} dpr${devicePixelRatio} ${navigator.language}`); const n = document.getElementById('testnote'); if (n) n.hidden = false; }
// 10-17 시험 실측: 아이폰 사진 선택 뒤 대기는 iCloud 원본 내려받기(방금 찍은 사진은 빠름) — 앱이 못 줄이니 미리 알린다
if (isIOS()) { const tip = document.getElementById('iosTip'); if (tip) tip.hidden = false; }
// 10-18 feedback (영샘: 앱 안 의견 버튼 — a teacher collecting it by hand is too much). One emoji and one line go to
// the same sheet as the step log; no name is asked (the class is under 14) and the line says not to write one.
if (SHEET_LOG || REMOTE_LOG || KIDS) {
  $('fbOpen').hidden = false;
  let emo = '';
  $('fbOpen').onclick = () => { $('fbHint').textContent = T('이모지만 눌러도 돼요. 이름이나 사진은 보내지 않아요.', 'An emoji alone is fine. No names or photos are sent.'); window.hhOpen('fb'); };
  $('fbEmo').querySelectorAll('button').forEach((b) => {
    b.onclick = () => { emo = b.dataset.emo; $('fbEmo').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
  });
  $('fbSend').onclick = () => {
    const text = $('fbText').value.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!emo && !text) { $('fbHint').textContent = T('이모지를 하나 골라 주세요 😊', 'Pick an emoji first 😊'); return; }
    rlog(`FEEDBACK ${emo || '-'} ${KIDS ? '[kids] ' : ''}${S.look.id} | ${text}`);
    if (SHEET_LOG) sheetFlush();
    $('fbText').value = ''; emo = ''; $('fbEmo').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    $('fbHint').textContent = T('고마워요! 잘 받았어요 💌', 'Thank you! Got it 💌');
    setTimeout(() => window.hhClose(), 1400);
  };
}
// 10-19 PWA install (영샘 목표 = 스토어 앱, 첫 계단). Android Chrome offers its own prompt - we keep it for the 「정보」 button so it
// never pops over a video being made. iOS has no prompt: say where Safari hides it. Already installed → nothing shown.
{
  $('updToast').textContent = T('새 버전이 나왔어요 · 눌러서 새로 고침', 'A new version is ready · tap to reload');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let deferred = null;
  // 10-20: 「정보」 holds the install button's place on the rail - one of the two shows, never both (the install sheet is 정보)
  const hideInstall = () => { $('installBtn').hidden = true; $('railInstall').hidden = true; $('railInfo').hidden = false; };
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('installBtn').hidden = false; $('railInstall').hidden = false; $('railInfo').hidden = true; rlog('installable'); });
  $('railInfo').querySelector('.l').textContent = T('정보', 'Info');
  $('railInstall').querySelector('.l').textContent = T('앱 설치', 'Install');
  $('installBtn').textContent = T('앱으로 설치', 'Install as an app');
  // 10-19 영샘 폰: tapping showed nothing and said nothing. Now every outcome is logged, and whenever the browser's own
  // sheet does not come up (or is closed), the menu route is written under the button - it always works.
  const samsung = /SamsungBrowser/i.test(navigator.userAgent);      // 갤럭시 기본 브라우저 — 메뉴가 아래 ≡ 에 있다
  // 10-20 영샘 아이폰(사파리 26): the Android button showed there too and tapping it wrote the Chrome ⋮ route over the
  // iPhone steps - "눌러도 반응이 없다". iPhones get their own steps; Safari 26 keeps Share inside the ··· button.
  const iosWay = () => {
    const h = $('installHint'); h.classList.add('ios');
    $('caps').before(h);   // the steps first, above the device details
    h.textContent = T('아이폰에서 앱처럼 쓰기\n① 사파리 아래 「···」(또는 공유 버튼 □↑)\n② 「공유」 → 아래로 내려 「홈 화면에 추가」\n③ 오른쪽 위 「추가」 → 홈 화면에 생긴 아이콘으로 열어요',
      'Use it like an app on iPhone\n① Safari’s “···” button (or Share □↑)\n② “Share” → scroll to “Add to Home Screen”\n③ “Add” → open it from the new home-screen icon');
    h.style.whiteSpace = 'pre-line'; h.hidden = false;
  };
  const menuWay = () => {
    if (isIOS()) { iosWay(); return; }
    $('installHint').textContent = samsung
      ? T('설치 창이 안 뜨면: 삼성 인터넷 아래 ≡ 메뉴 → 「현재 페이지 추가」 → 「홈 화면」을 눌러 주세요.', 'If no install window opens: Samsung Internet menu ≡ → “Add page to” → “Home screen”.')
      : T('설치 창이 안 뜨면: 크롬 오른쪽 위 ⋮ 메뉴 → 「앱 설치」 또는 「홈 화면에 추가」를 눌러 주세요.', 'If no install window opens: Chrome menu ⋮ → “Install app” or “Add to Home screen”.');
    $('installHint').hidden = false;
  };
  $('installBtn').onclick = async () => {
    rlog(`install tap deferred=${!!deferred}`);
    if (!deferred) { menuWay(); return; }
    const ev = deferred; deferred = null;
    try {
      await ev.prompt();
      const r = await ev.userChoice;
      rlog(`install prompt ${r?.outcome || '?'}`);
      if (r?.outcome === 'accepted') { hideInstall(); return; }
    } catch (e) { rlog(`install prompt error ${e?.name || ''} ${e?.message || e}`); }
    menuWay(); window.hhOpen('info');
  };
  // rail button: Android → the browser's install window straight away (same handler); otherwise the info sheet with the steps
  $('railInstall').onclick = () => { rlog('install rail tap'); if (deferred) $('installBtn').onclick(); else { menuWay(); window.hhOpen('info'); } };
  addEventListener('appinstalled', () => { hideInstall(); rlog('appinstalled'); });
  if (!standalone && isIOS()) { $('railInstall').hidden = false; $('railInfo').hidden = true; $('installBtn').hidden = true; iosWay(); }
  if (standalone) rlog('opened as installed app');
}
// 10-20: in the test build an error also shows on the phone itself, so a tester (or 영샘 by remote) can read it off the screen
const showErr = (m) => {
  if (!SHEET_LOG && !REMOTE_LOG) return;
  // harmless media/layout noise, and Safari's detail-less "Script error." from another origin (10-20 log ×2) - log only
  if (/AbortError|NotAllowedError|play\(\)|interrupted|ResizeObserver|^Script error\.?\s*@?:?0?$/i.test(String(m).trim())) return;
  let b = document.getElementById('errBar');
  if (!b) { b = document.createElement('div'); b.id = 'errBar'; b.style.cssText = 'position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top) + 8px);z-index:9999;background:#b3261e;color:#fff;font:600 14px/1.35 system-ui,sans-serif;padding:10px 12px;border-radius:12px;white-space:pre-wrap;word-break:break-all'; b.onclick = () => b.remove(); document.body.appendChild(b); }
  b.textContent = `⚠ ${self.HH_VERSION} · ${String(m).slice(0, 300)}  (눌러서 닫기)`;
};
addEventListener('error', (e) => { rlog(`error ${e.message} @${e.filename}:${e.lineno}`); showErr(`${e.message} @${String(e.filename).split('/').pop()}:${e.lineno}`); });
addEventListener('unhandledrejection', (e) => { rlog(`rejection ${e.reason?.message || e.reason}`); showErr(`rejection ${e.reason?.message || e.reason}`); });
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
    // 10-18 class-link test (photos only, 32s): Galaxy 43.5s / 43.9s, iPhone 49.3s — the old guess said "about 2 minutes"
    const live = S.images.some((c) => c.live), estSec = live ? 40 + seconds * 1.5 : 15 + seconds * 1.1, est = Math.ceil(estSec / 60);
    $('eta').textContent = T(`예상 ${est <= 1 ? '1분 안쪽' : `약 ${est}분`} · 화면을 켜 둔 채 기다려 주세요. 처음 한 번은 글꼴을 받느라 조금 더 걸려요.`,
      `About ${est <= 1 ? 'a minute' : `${est} minutes`} · keep the screen on. The first time takes a little longer while fonts download.`);
    // A clip's <video> can pass the clean-probe and then turn protected while it plays (Android, HEVC through the
    // system player) - the same file worked on 10-04 and failed on 10-10. A tainted canvas stays tainted, so swap in
    // fresh ones; the export decodes the file itself and never needs the <video>.
    const tainted = (c) => { try { c.getContext('2d').getImageData(0, 0, 1, 1); return false; } catch { return true; } };
    S.images = S.images.map((c) => {
      if (!c.live || !tainted(c)) return c;
      const n = document.createElement('canvas'); n.width = c.width; n.height = c.height; n.live = true; n.clip = c.clip;
      if (c.hhAlign) n.hhAlign = c.hhAlign;   // the clean copy keeps the position the person chose (10-19)
      n.clip.videoOk = false; rlog('clip canvas tainted - swapped for a clean one');
      return n;
    });
    const canvas = tainted(stage) ? Object.assign(document.createElement('canvas'), { width: stage.width, height: stage.height }) : stage;
    if (canvas !== stage) rlog('stage tainted - exporting on a clean canvas');
    rebuild();
    status(T('글꼴 준비 중… 멈춘 게 아니에요', 'Loading fonts… it hasn’t stopped'));
    // the class templates' Halloween poster face is sliced by Google like Gaegu - fetch the syllables this short uses
    const kidsFont = S.look.kids ? document.fonts.load('80px "Black Han Sans"', [$('brand').value, $('t1').value, $('t2').value, '참 잘했어요', ...S.d.phrases.map((p) => p.text)].join(' ')).catch(() => {}) : null;
    await within(Promise.all([hangulReady(), kidsFont, ensureLyricFont([...S.d.phrases.map((p) => p.text), S.d.boxText, $('brand').value, $('t1').value, $('t2').value].filter(Boolean).join(' '))]), 8000);
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
    $('save').href = url;
    { const d = new Date(), p = (n) => String(n).padStart(2, '0');
      $('fname').value = `${cleanName($('brand').value) || 'herhours'}_${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; setFname(); }
    $('doneMeta').textContent = T(`${seconds.toFixed(0)}초 · ${(blob.size / 1048576).toFixed(0)}MB · ${elapsed.toFixed(0)}초 만에 완성`, `${seconds.toFixed(0)}s · ${(blob.size / 1048576).toFixed(0)}MB · made in ${elapsed.toFixed(0)}s`);
    // an iPhone saves a download to Files, not Photos — the share sheet's 'Save Video' is the way to Photos
    $('credit').textContent = S.useOurs ? `Music: Her Hours — ${S.song.name}` : '';
    if (isIOS()) $('doneMeta').textContent += KIDS ? T(' · 「사진 앱에 저장」 → 「동영상 저장」을 눌러요', ' · Tap “Save to Photos” → “Save Video”')
      : T(' · 사진 앱에 넣으려면 「인스타에 올리기」 → 「동영상 저장」', ' · For Photos: “Share to Instagram” → “Save Video”');
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
$('make').onclick = () => (!S.flowDone ? window.hhOpen('look') : needPhotos() ? window.hhOpen('photo') : make());

$('again').onclick = () => {
  document.body.classList.remove('is-done');
  $('out').pause(); S.vf = 0; S.started = false;
};

async function doShare() {
  if (!S.blob) return;
  const file = new File([S.blob], `${S.fname || `herhours_${Date.now()}`}.mp4`, { type: 'video/mp4' });
  rlog(`share ${(S.blob.size / 1048576).toFixed(1)}MB`);
  // canShare() says yes to any size, but Chrome then refuses files over 50MB
  if (S.blob.size > 49 * 1048576) {
    $('doneMeta').textContent = T('영상이 커서 바로 공유가 안 돼요. 「저장」으로 받아서 인스타에서 올려주세요.', 'The video is too large to share directly. Tap “Save”, then post it from Instagram.');
  } else if (navigator.canShare && navigator.canShare({ files: [file] })) {
    // Instagram refused a share that carried text alongside the video (영샘's Android 10-10: "can't ..."), so the
    // video goes alone, as on 10-04, and the music credit rides the clipboard into the caption instead.
    const credit = S.useOurs && !KIDS ? `Music: Her Hours — ${S.song.name}` : '';   // the class does not post - no caption to copy
    if (credit) {
      try { await navigator.clipboard.writeText(credit); $('credit').textContent = T(`「${credit}」 복사했어요 · 인스타 설명에 붙여 넣어 주세요`, `Copied “${credit}” · paste it into the caption`); } catch {}
    }
    // 영샘 10-10: the first hand-off to Instagram showed "can't ...", the same tap again opened the post screen
    try {
      await navigator.share({ files: [file], title: 'Her Hours Shorts' });
      // 10-11 (4): sending to Instagram does not keep a copy on the phone - people assumed it did
      $('doneMeta').textContent = KIDS
        ? T('「동영상 저장」을 눌렀다면 사진 앱에 들어갔어요 📷', 'If you chose “Save Video”, it’s in Photos now 📷')
        : isIOS()
          ? T('보냈어요. 폰 사진 앱에는 아직 없어요 — 한 번 더 눌러 「동영상 저장」을 골라 두세요.', 'Sent. It isn’t in Photos yet — tap again and choose “Save Video”.')
          : T('보냈어요. 폰에는 아직 저장 안 됐어요 — 아래 「저장」도 눌러 두세요.', 'Sent. It isn’t saved on the phone yet — tap “Save” below too.');
      if (!KIDS) $('doneMeta').textContent += ' ' + T('인스타에서 「할 수 없습니다」가 뜨면 한 번 더 눌러 주세요.', 'If Instagram says it can’t, tap share once more.');
      $('save').classList.add('nudge');
    }
    catch (e) { rlog(`share failed ${e.name} ${e.message}`); if (e.name !== 'AbortError') $('doneMeta').textContent = `${T('공유 실패', 'Share failed')}: ${e.message}`; }
  } else {
    $('doneMeta').textContent = inAppBrowser()
      ? T('앱 안 브라우저라 바로 공유가 안 돼요. 크롬·사파리로 열어서 다시 만들거나, 「저장」으로 받아서 인스타에서 올려주세요.', 'This in-app browser can’t share. Open the page in Chrome or Safari, or tap “Save” and post it from Instagram.')
      : T('이 브라우저는 바로 공유가 안 돼요. 「저장」으로 받아서 인스타에서 올려주세요.', 'This browser can’t share directly. Tap “Save”, then post it from Instagram.');
  }
}
$('save').addEventListener('click', () => $('save').classList.remove('nudge'));
// 10-19 영샘: "저장할 때 파일 이름 설정" - what is typed names both the download and the shared file.
// Then "칸이 잘 안 보여 — 저장 누를 때 창": 「저장」 and share open the 「파일 이름」 sheet first; its button does the real thing
// (still inside the tap, so the download and the share sheet are allowed).
function cleanName(s) { return String(s || '').replace(/[\\/:*?"<>|#%\u0000-\u001f]/g, '').replace(/\s+/g, '_').replace(/^\.+/, '').slice(0, 40).trim(); }
function setFname() { S.fname = cleanName($('fname').value) || `herhours_${Date.now()}`; $('save').download = `${S.fname}.mp4`; }
$('fname').addEventListener('input', setFname);
let nameNext = null, nameOk = false;
function askName(next, label) {
  nameNext = next; $('fnameGo').textContent = label; window.hhOpen('fname');
  setTimeout(() => { const i = $('fname'); i.focus(); i.select(); }, 280);
}
$('save').addEventListener('click', (e) => {
  if (nameOk) return;                      // the second, real click from 「저장하기」
  e.preventDefault(); askName('save', T('저장하기', 'Save'));
});
$('share').onclick = () => askName('share', $('share').textContent.trim() || T('보내기', 'Send'));
$('fnameGo').onclick = () => {
  // the log says only whether a name was typed - the name itself can be a person's name and never leaves the phone
  setFname(); rlog(`file name ${$('fname').value.trim() ? 'set' : 'default'}`);
  const next = nameNext; window.hhClose();
  if (next === 'save') { nameOk = true; $('save').click(); nameOk = false; }
  else if (next === 'share') doShare();
};
$('fname').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('fnameGo').click(); } });

// 10-22 apple-design §1 "respond on pointer-down": the press shows the instant the finger lands, not when the browser has
// decided it isn't a scroll, and a quick tap still shows for 140ms. A scroll that starts on a button cancels it.
document.addEventListener('pointerdown', (e) => {
  // every key presses (영샘 10-22 "눌리는 모든 버튼") - except the whole-stage play/pause, which must not shrink the video
  const b = e.target.closest?.('button,a.pill,label.pill,label.opt,[role="button"]');
  if (!b || b.disabled || b.classList.contains('tap')) return;
  b.classList.add('press');
  const t0 = performance.now();
  const up = () => {
    setTimeout(() => b.classList.remove('press'), Math.max(0, 140 - (performance.now() - t0)));
    removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true);
  };
  addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
}, { capture: true, passive: true });

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

// 10-20 시험 기록: three iPhones (Safari 26, one installed) stopped one second after opening on "준비 실패: A network error
// occurred." - a file read that broke off mid-way, not the app's code. Each boot read gets two more tries, the log says
// which one failed, and a failure leaves a 「다시 불러오기」 button instead of a dead screen.
let bootStep = '';
async function boot(label, fn) {
  for (let k = 0; ; k++) {
    try { bootStep = label; return await fn(); }
    catch (e) {
      if (k >= 2 || !/network|load failed|failed to fetch|NotReadable|abort/i.test(`${e?.name} ${e?.message}`)) throw e;
      rlog(`boot retry ${label} #${k + 1} ${e?.name} ${e?.message}`);
      await new Promise((res) => setTimeout(res, 700 * (k + 1)));
    }
  }
}
(async () => {
  try {
    S.tpl = await boot('template', () => loadTemplate(S.song));
    const txt = KIDS ? KIDS_TEXT[S.look.id] || KIDS_TEXT['minjeong-hw'] : { brand: S.tpl.brand, t1: S.tpl.title1, t2: S.tpl.title2 };
    if (KIDS) {
      // 10-20 영샘: "글자를 넣지 않으면 정해진 문구가 들어가는데 들어가지 않도록" - the boxes start empty, the class words
      // are only faint examples, and our song's lyrics show only when 「가사 자막」 is ticked
      $('brand').value = ''; $('t1').value = ''; $('t2').value = ''; kidsExamples(txt);
      $('songLyricsRow').hidden = false; $('blankHint').hidden = false; $('songLyrics').checked = S.songLyrics;
    } else { $('brand').value = txt.brand; $('t1').value = txt.t1; $('t2').value = txt.t2; }
    if (KIDS) {
      document.body.classList.add('kids'); rlog('class kids');
      // 10-19 랩코 점검 A1: the class is under 14 - Instagram must not be the biggest button. Android: 「저장」 becomes the
      // main button and share goes. iPhone: a download lands in Files, not Photos, so the share sheet stays, renamed to
      // what it does for a child ("Save Video" is in it) - no Instagram anywhere on the screen.
      if (isIOS()) $('share').lastChild.textContent = T('사진 앱에 저장', 'Save to Photos');
      else { $('share').hidden = true; $('save').classList.remove('ghost'); }
      // A3: the first text box is printed on the video - 「이름」 invites the child's own name
      $('brandLbl').textContent = T('반 이름', 'Class name');
      document.fonts.load('80px "Black Han Sans"', '민정샘 반 참 잘했어요 HALLOWEEN NIGHT PARTY').catch(() => {});
      for (const set of ['halloween', 'everyday']) loadDemoKids(set).then((ims) => { S.demoKids[set] = ims; if (!S.images.length) { rebuild(); renderLooks(); } }).catch(() => {});
    }
    // 10-21 설치앱 `boot retry fonts` NetworkError: a font that won't arrive is not worth a dead screen - open on the
    // system font and keep trying behind it (the canvas redraws every frame, so the look picks the font up when it lands)
    try { await boot('fonts', () => loadFonts()); }
    catch (e) {
      rlog(`fonts fail ${e?.name} ${e?.message} - system font for now`);
      setTimeout(() => loadFonts().then(() => rlog('fonts ok later')).catch(() => {}), 4000);
    }
    S.demo = await boot('demo', () => loadDemo());
    loadDemoHw().then((ims) => { S.demoHw = ims; if (!S.images.length) rebuild(); }).catch(() => {});
    pv.src = S.song.file;
    renderSongs();
    applyCut();
    rebuild(); chips(); renderLooks();
    await listen(await boot('song', async () => (await fetch(S.song.file)).arrayBuffer()));
    document.body.classList.add('ready');
    S.vf = 120;                       // open on a frame where the look is fully on screen
    requestAnimationFrame(loop);
    caps();
    setMake(); warnInApp();
    S.ready = true; rlog('boot ok');
    if (!document.body.classList.contains('panel-open')) await offerResume();
  } catch (e) {
    rlog(`boot fail at ${bootStep} ${e?.name} ${e?.message}`);
    status(`${T('준비 실패', 'Setup failed')}: ${e.message}`, true);
    // the loading card would otherwise spin forever over a blank stage
    const card = document.querySelector('.boot span');
    card.textContent = T('불러오다가 끊겼어요. 인터넷을 확인하고 다시 불러와 주세요.', 'Loading was interrupted. Check the connection and try again.');
    document.querySelector('.boot i').hidden = true;
    const again = document.createElement('button'); again.className = 'pill'; again.style.cssText = 'margin-top:14px;min-height:48px;padding:0 22px;width:auto;white-space:nowrap;flex:0 0 auto';
    again.textContent = T('다시 불러오기', 'Try again'); again.onclick = () => { rlog('boot reload tap'); location.reload(); };
    document.querySelector('.boot').appendChild(again);
  }
})();
