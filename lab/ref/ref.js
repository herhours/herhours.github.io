// 11-09 레퍼런스 디자인의 손잡이 — ui.js 는 그대로 두고, 화면 옷에 필요한 것만 덧붙인다.
// ① 단계 머리(점 5개 · 뒤로 · 제목) ② 집 네 칸 요약(지금 고른 스타일·사진·노래·이름) ③ 리퀴드 글래스 렌즈 ④ 누르면 부푸는 스프링.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const T2 = (ko, en) => (typeof T === 'function' ? T(ko, en) : ko);

  // 11-10 영샘 갤럭시: 10월 시안 고르기(localStorage hh-ui=b)가 같은 주소라 여기까지 따라와, B 아치 레일의 곡선이 네 칸 격자 한 칸을 먹고 끝없이 자랐다.
  // 이 화면은 옛 시안 A·B·C 를 쓰지 않는다 — 켜지는 즉시 끈다(ui.js 의 아치 레일은 ui-b 가 없으면 스스로 곡선을 치운다).
  const noDirs = () => { const c = document.body.classList; if (c.contains('ui-a') || c.contains('ui-b') || c.contains('ui-c')) c.remove('ui-a', 'ui-b', 'ui-c'); };
  noDirs(); new MutationObserver(noDirs).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // ① 단계 머리 — 점은 스타일·사진·노래·글자·만들기 다섯, 뒤로는 그 단계의 앞(없으면 집으로)
  const STEP = { look: 0, photo: 1, focus: 1, song: 2, lyrics: 2, text: 3 };
  const BACK = { photo: 'look', focus: 'photo', song: 'photo', lyrics: 'song', text: 'song', welcome: null, look: null };
  $$('.panel .pane').forEach((pane) => {
    const name = [...pane.classList].find((c) => c.startsWith('pane-'))?.slice(5);
    const h2 = $('h2', pane); if (!name || !h2) return;
    const head = document.createElement('div'); head.className = 'rhead';
    if (name in STEP) head.innerHTML = `<div class="rdots">${[0, 1, 2, 3, 4].map((i) => `<i class="${i <= STEP[name] ? 'on' : ''}${i === STEP[name] ? ' now' : ''}"></i>`).join('')}</div>`;
    const back = document.createElement('button'); back.className = 'rback'; back.type = 'button'; back.setAttribute('aria-label', T2('뒤로', 'Back'));
    back.innerHTML = '<svg width="20" height="20"><use href="#i-back"/></svg>';
    back.onclick = () => { const to = BACK[name]; to ? window.hhOpen(to) : window.hhClose(); };
    h2.before(head); head.append(back, h2);
    // 단계 이름에서 번호(①②③④)를 뗀다 — 점이 대신 말한다
    h2.textContent = h2.textContent.replace(/^[①②③④]\s*/, '');
  });
  $('.refx').onclick = () => window.hhClose();

  // ⑤ 사진 칸 = 시안처럼 빈 칸 10개 격자(앞 3칸 금테). ui.js 가 #thumbs 를 다시 그릴 때마다 남은 자리에 빈 칸(누르면 사진첩)을 채운다.
  const th = $('#thumbs');
  const cnt = document.createElement('div'); cnt.className = 'rcount';
  cnt.innerHTML = `<b>0</b><span></span>`; th.after(cnt);
  const mo = new MutationObserver(() => requestAnimationFrame(fill));
  // 11-11 영샘 "맞춰 줘": 금테 칸 수와 「/ N장」은 지금 스타일이 권하는 장수를 따른다(전엔 늘 10장·금테 3칸 — 스키 스타일은 10~12장부터 권한다).
  // ui.js 가 #padv 에 쓰는 「사진 N장 이상 추천 · M장까지 다 쓰여요 (· 지금 K장)」을 읽는다 — 노래 길이에 따라 달라지는 값이라 여기서 따로 세지 않는다.
  const want = () => {
    const s = $('#padv')?.textContent || '', m = /(\d+)\s*장 이상 추천\s*·\s*(\d+)\s*장까지|(\d+)\+ photos recommended\s*·\s*up to (\d+)/.exec(s), k = /지금 (\d+)장|· (\d+) now/.exec(s);
    return { min: m ? +(m[1] || m[3]) : 3, cap: m ? +(m[2] || m[4]) : 10, now: k ? +(k[1] || k[2]) : null };
  };
  function fill() {
    mo.disconnect();
    $$('.rslot', th).forEach((e) => e.remove());
    const tw = $$('.tw', th), n = tw.length, used = n + $$(':scope > .ph', th).length;
    const { min, cap, now } = want(), gold = Math.min(min, cap);
    // 칸은 다섯 칸 줄 단위로: 금테가 다 들어가는 줄 수(적어도 두 줄)에서 시작해, 차면 한 칸씩 늘어난다(미리보기 그림은 24장까지)
    const base = Math.min(cap, Math.max(10, Math.ceil(gold / 5) * 5));
    const total = Math.max(base, Math.min(24, used + 1));
    for (let i = used; i < total; i++) {
      const l = document.createElement('label'); l.className = 'rslot' + (i < gold ? ' must' : ''); l.htmlFor = 'photos';
      l.innerHTML = `<span>${i + 1}</span>`; th.appendChild(l);
    }
    tw.forEach((w, i) => w.classList.toggle('must', i < gold));
    cnt.querySelector('b').textContent = now ?? n;
    cnt.querySelector('span').textContent = T2(`/ ${cap}장 · 금테 ${gold}칸 먼저`, `/ ${cap} · gold ones first`);
    mo.takeRecords(); mo.observe(th, { childList: true });
  }
  fill();
  new MutationObserver(() => requestAnimationFrame(fill)).observe($('#padv'), { childList: true, characterData: true, subtree: true });
  // 아이폰 iCloud 안내는 접어 둔다(아이폰에서만 보임)
  const ios = $('#iosTip');
  if (ios) { const d = document.createElement('details'); d.className = 'rmore'; d.innerHTML = `<summary>${T2('아이폰에서 사진이 늦게 들어올 때', 'iPhone: photos slow to come in?')}</summary>`; ios.before(d); d.append(ios); }

  // ⑥ 만드는 중: 위 카드엔 진짜 화면, 아래 판에 큰 숫자 % (시안처럼). 같은 id 를 옮기기만 한다
  document.body.appendChild($('.making'));

  // ② 집 네 칸: 큰 숫자 + 지금 값 알약
  const rail = $$('.rail [data-open="look"], .rail [data-open="photo"], .rail [data-open="song"], .rail [data-open="text"]');
  rail.forEach((b, i) => { b.insertAdjacentHTML('beforeend', `<span class="rpill">…</span><span class="rnum">0${i + 1}</span>`); });
  const val = {
    look: () => $('#lookInfo b')?.textContent?.trim() || T2('고르기', 'Pick'),
    photo: () => { const n = $$('#thumbs .tw').length || $$('#thumbs img, #thumbs .th, #thumbs video').length; return n ? T2(`${n}장`, `${n}`) : T2('예시 사진', 'Demo photos'); },
    song: () => document.body.classList.contains('mine-song') ? T2('내 음악', 'My song') : ($('#ourSongs .opt.on .t b')?.textContent?.trim() || T2('고르기', 'Pick')),
    text: () => { const b = $('#brand'); return (b?.value || b?.placeholder || T2('이름', 'Name')).trim() || T2('이름', 'Name'); },
  };
  const tick = () => {
    if (document.body.classList.contains('panel-open') || document.hidden) return;
    rail.forEach((b) => { const p = $('.rpill', b), v = val[b.dataset.open]?.(); if (p && v && p.textContent !== v) p.textContent = v; });
    // 불 켜진 칸 = 정해진 칸. 스타일·노래는 늘 하나 골라져 있고, 사진은 내 사진을 넣었을 때, 글자는 이름을 썼을 때
    const lit = { look: true, song: true, photo: $$('#thumbs .tw, #thumbs .th, #thumbs video').length > 0, text: !!$('#brand')?.value };
    rail.forEach((b) => b.classList.toggle('lit', !!lit[b.dataset.open]));
  };
  setInterval(tick, 600); addEventListener('load', tick);
  // 11-11: 짧은 화면·「앱 설치」 줄·실패 글이 있을 때 네 칸이 아래 큰 버튼과 겹쳤다 — 위 카드가 남는 높이만 쓰도록 네 칸 높이를 알려 준다(ui-ref.css --hero)
  new ResizeObserver(([e]) => document.body.style.setProperty('--rail-h', `${Math.round(e.target.offsetHeight)}px`)).observe($('.rail'));

  // ③ 리퀴드 글래스 — 크롬 계열만 backdrop-filter 안 SVG 필터를 그린다. 사파리(아이폰)·파이어폭스는 젖빛.
  const ua = navigator.userAgent, root = document.documentElement;
  const chromium = !/Firefox\//.test(ua) && ((navigator.userAgentData?.brands || []).some((b) => /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand)) ||
    /(Chrome|Chromium|Edg|SamsungBrowser)\/\d+/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua));
  root.classList.add(chromium ? 'refract' : 'frost');
  let seq = 0;
  const lensMap = (w, h, r, bezel) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data, hw = w / 2, hh = h / 2; r = Math.min(r, hw, hh);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const px = i + .5 - hw, py = j + .5 - hh, qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
      let depth, nx = 0, ny = 0;
      if (qx > 0 && qy > 0) { const L = Math.hypot(qx, qy) || 1; depth = r - L; nx = qx / L * Math.sign(px); ny = qy / L * Math.sign(py); }
      else if (qx > qy) { depth = r - qx; nx = Math.sign(px); } else { depth = r - qy; ny = Math.sign(py); }
      const t = depth < bezel ? 1 - Math.max(depth, 0) / bezel : 0, m = t * t, k = (j * w + i) * 4;
      d[k] = 128 - nx * m * 127; d[k + 1] = 128 - ny * m * 127; d[k + 2] = 128; d[k + 3] = 255;
    }
    g.putImageData(im, 0, 0); return c.toDataURL();
  };
  const lens = (el) => {
    if (!chromium) return;
    const w = el.offsetWidth, h = el.offsetHeight; if (!w || !h || (el._lw === w && el._lh === h)) return; el._lw = w; el._lh = h;
    const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, h / 2, w / 2);
    let L = el._lens;
    if (!L) {
      const id = 'rlens' + (++seq), f = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      f.setAttribute('id', id); f.setAttribute('x', '0'); f.setAttribute('y', '0'); f.setAttribute('width', '100%'); f.setAttribute('height', '100%');
      f.setAttribute('color-interpolation-filters', 'sRGB');
      f.innerHTML = '<feImage result="map" preserveAspectRatio="none"/><feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G" scale="34" result="d"/>' +
        '<feGaussianBlur in="d" stdDeviation="1.4" result="b"/><feColorMatrix in="b" type="saturate" values="1.5"/>';
      $('#refDefs').appendChild(f); L = el._lens = { id, img: f.children[0] };
    }
    L.img.setAttribute('href', lensMap(w, h, r, Math.min(h / 2, 16))); L.img.setAttribute('width', w); L.img.setAttribute('height', h);
    el.style.backdropFilter = `url(#${L.id})`;
  };
  const ro = new ResizeObserver((es) => es.forEach((e) => lens(e.target)));
  $$('.gbtn').forEach((el) => { lens(el); ro.observe(el); });

  // ④ 누르면 애플처럼 살짝 부풀고(유리) 또는 쏙(칸), 놓으면 한 번 부드럽게 튀며 제자리. 손가락 자리에 빛
  const spring = (el) => {
    let x = 1, v = 0, target = 1, k = 520, c = 26, raf = 0, last = 0;
    const step = (t) => { const dt = Math.min(.032, (t - last) / 1000 || .016); last = t;
      for (let s = 0; s < 4; s++) { const a = -k * (x - target) - c * v; v += a * dt / 4; x += v * dt / 4; }
      el.style.setProperty('--s', x.toFixed(4));
      if (Math.abs(x - target) > 1e-4 || Math.abs(v) > 1e-3) raf = requestAnimationFrame(step); else { x = target; el.style.setProperty('--s', x); raf = 0; } };
    return (to, stiff, damp) => { target = to; k = stiff; c = damp; if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } };
  };
  const SEL = '.gbtn, .pill, .again, .tapbtn, .rail button, .looks .tile, #ourSongs .opt, .opt, .seg button';
  const press = (el) => {
    if (el._sp) return; const go = el._sp = spring(el);
    const big = el.classList.contains('gbtn') ? 1.12 : el.matches('.pill, .tapbtn') ? 1.02 : .965;
    el.addEventListener('pointerdown', (e) => { const r = el.getBoundingClientRect();
      el.style.setProperty('--gx', (e.clientX - r.left) / r.width * 100 + '%'); el.style.setProperty('--gy', (e.clientY - r.top) / r.height * 100 + '%');
      el.style.setProperty('--go', 1); go(big, 520, 26); }, { passive: true });
    const up = () => { el.style.setProperty('--go', 0); go(1, 260, 14); };
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => el.addEventListener(t, up, { passive: true }));
  };
  const all = () => $$(SEL).forEach(press);
  let q = 0;
  all(); new MutationObserver(() => { if (!q) q = requestAnimationFrame(() => { q = 0; all(); }); }).observe(document.body, { childList: true, subtree: true });
})();
