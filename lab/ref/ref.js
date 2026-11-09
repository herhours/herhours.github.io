// 11-09 레퍼런스 디자인의 손잡이 — ui.js 는 그대로 두고, 화면 옷에 필요한 것만 덧붙인다.
// ① 단계 머리(점 5개 · 뒤로 · 제목) ② 집 네 칸 요약(지금 고른 스타일·사진·노래·이름) ③ 리퀴드 글래스 렌즈 ④ 누르면 부푸는 스프링.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const T2 = (ko, en) => (typeof T === 'function' ? T(ko, en) : ko);

  // ① 단계 머리 — 점은 스타일·사진·노래·글자·만들기 다섯, 뒤로는 그 단계의 앞(없으면 집으로)
  const STEP = { look: 0, photo: 1, focus: 1, song: 2, lyrics: 2, text: 3 };
  const BACK = { photo: 'look', focus: 'photo', song: 'photo', lyrics: 'song', text: 'song', welcome: null, look: null };
  $$('.panel .pane').forEach((pane) => {
    const name = [...pane.classList].find((c) => c.startsWith('pane-'))?.slice(5);
    const h2 = $('h2', pane); if (!name || !h2) return;
    const head = document.createElement('div'); head.className = 'rhead';
    if (name in STEP) head.innerHTML = `<div class="rdots">${[0, 1, 2, 3, 4].map((i) => `<i class="${i <= STEP[name] ? 'on' : ''}${i === STEP[name] ? ' now' : ''}"></i>`).join('')}</div>`;
    const back = document.createElement('button'); back.className = 'rback'; back.type = 'button'; back.setAttribute('aria-label', '뒤로');
    back.innerHTML = '<svg width="20" height="20"><use href="#i-back"/></svg>';
    back.onclick = () => { const to = BACK[name]; to ? window.hhOpen(to) : window.hhClose(); };
    h2.before(head); head.append(back, h2);
    // 단계 이름에서 번호(①②③④)를 뗀다 — 점이 대신 말한다
    h2.textContent = h2.textContent.replace(/^[①②③④]\s*/, '');
  });
  $('.refx').onclick = () => window.hhClose();

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
