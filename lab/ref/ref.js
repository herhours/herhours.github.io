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
    // 세는 건 칸 그림 수. 그림은 24장까지만 그리니 그보다 많을 때만 ui.js 가 적은 「지금 K장」을 쓴다(그 글은 사진을 뺄 때 바로 안 바뀐다)
    cnt.querySelector('b').textContent = n >= 24 && now > n ? now : n;
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

  // ══ 11-12 영샘 폰 피드백 셋 ══
  // ⑦ "스타일 고를 때 예시 영상의 위아래가 잘려서 불편 — 전체 화면으로 볼 수 있게": 「전체 보기」를 누르면 영상 전체(9:16)가 화면에 가득,
  //    「돌아가기」(또는 폰의 뒤로)로 고르던 자리 그대로 돌아온다. 위 카드가 가득 찬 평소 모습(11-09 영샘)은 그대로 둔다.
  {
    const body = document.body, stage = $('.stage');
    const open = document.createElement('button'); open.type = 'button'; open.className = 'rfull';
    open.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><span>${T2('전체 보기', 'Full view')}</span>`;
    const back = document.createElement('button'); back.type = 'button'; back.className = 'rfullx';
    back.innerHTML = `<svg width="18" height="18"><use href="#i-back"/></svg><span>${T2('돌아가기', 'Back')}</span>`;
    body.append(open, back);   // 시트가 열리면 위 카드를 가림막(scrim)이 덮는다 - 단추는 그 위에 있어야 눌린다
    let on = false;
    const leave = () => { if (!on) return; on = false; body.classList.remove('ref-full'); };
    open.onclick = (e) => {
      e.stopPropagation(); on = true; body.classList.add('ref-full');
      history.pushState({ hhFull: 1 }, '');
      if (!body.classList.contains('is-playing')) $('#tap')?.click();   // 들어가면 바로 재생
    };
    back.onclick = () => { if (on) history.back(); };
    // 이 파일은 ui.js(모듈)보다 먼저 돈다 — 여기서 먼저 받아, 전체 보기 중의 '뒤로'가 단계 시트까지 닫지 않게 한다
    addEventListener('popstate', (e) => { if (on) { leave(); e.stopImmediatePropagation(); } });
    // 만들기를 시작하면 전체 보기는 저절로 끝난다
    new MutationObserver(() => { if (on && (body.classList.contains('is-making') || body.classList.contains('is-done'))) back.click(); }).observe(body, { attributes: true, attributeFilter: ['class'] });
  }

  // ⑧ "스타일 고를 때 사진 개수가 잘 안 보임 — 고르는 칸에 표시": 칸마다 「사진 N장+」, 고른 스타일 설명·추천 장수는 칸들 위에 붙여 둔다
  {
    const box = $('#looks'), info = $('#lookInfo');
    // 위에 붙어 다니는 줄은 이름 + 추천 장수만(짧게), 스타일 설명은 칸들 아래로
    const top = document.createElement('div'); top.className = 'rinfo'; const sub = document.createElement('p'); sub.className = 'rsub';
    if (box && info) { box.before(top); box.after(sub); }
    const sync = () => {
      top.textContent = ''; const b = document.createElement('b'); b.textContent = $('b', info)?.textContent || ''; top.append(b);
      $$('.adv', info).forEach((a) => { const s = document.createElement('span'); s.className = a.className; s.textContent = a.textContent; top.append(s); });
      sub.textContent = [...info.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/^\s*·\s*/, '').trim();
    };
    if (info) { new MutationObserver(sync).observe(info, { childList: true, characterData: true, subtree: true }); sync(); }
    const tag = () => $$('.tile', box).forEach((t) => {
      if (!t.dataset.min || $('.rneed', t)) return;
      const e = document.createElement('em'); e.className = 'rneed'; e.textContent = T2(`사진 ${t.dataset.min}장+`, `${t.dataset.min}+ photos`); t.append(e);
    });
    if (box) { new MutationObserver(tag).observe(box, { childList: true }); tag(); }
  }

  // ⑨ "사진 올릴 때 추천 개수가 먼저, 그 아래에 올리는 칸" + "영상도 함께 올릴 수 있다는 게 눈에 들어오게":
  //    사진 화면 맨 위에 추천 장수, 바로 아래 「사진 · 영상 넣기」 큰 단추(영상 그림 + 한 줄), 그 아래 칸들
  {
    const pane = $('.pane-photo'), head = $('.rhead', pane), pa = $('#padv');
    const need = document.createElement('div'); need.className = 'rneedbox'; need.innerHTML = '<b></b><span></span><i></i>';
    const up = document.createElement('label'); up.className = 'rupload'; up.htmlFor = 'photos';
    up.innerHTML = `<span class="ic"><svg width="24" height="24"><use href="#i-photo"/></svg><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.4v5.2l4.6-2.6z" fill="currentColor" stroke="none"/></svg></span>`
      + `<span class="tx"><b>${T2('사진 · 영상 넣기', 'Add photos · videos')}</b><small>${T2('영상도 돼요 · 섞어서 골라도 돼요', 'Videos work too · pick them together')}</small></span><span class="plus">＋</span>`;
    head.after(need, up);
    const show = () => {
      const { min, cap } = want(), s = pa?.textContent || '';
      const shape = /(가로|세로) 사진이 잘 맞아요|(landscape|portrait) photos fit best/.exec(s)?.[0] || '';
      const now = /지금 \d+장 — [^·]+(?:· [^·]+)?|\d+ now — [^·]+/.exec(s)?.[0]?.trim() || '';
      need.children[0].textContent = T2(`사진 ${Math.min(min, cap)}장 이상 추천`, `${Math.min(min, cap)}+ photos recommended`);
      need.children[1].textContent = [T2(`${cap}장까지 다 쓰여요`, `up to ${cap} are used`), shape].filter(Boolean).join(' · ');
      need.children[2].textContent = now; need.children[2].hidden = !now;
    };
    show(); if (pa) new MutationObserver(show).observe(pa, { childList: true, characterData: true, subtree: true });
    // 집 네 칸의 「사진」도 영상이 된다는 걸 말한다
    const l = $('.rail [data-open="photo"] .l'); if (l) l.textContent = T2('사진 · 영상', 'Photos · clips');
  }
})();
