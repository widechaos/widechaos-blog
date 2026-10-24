const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ENTRY = 'a.article-row,a.latest-story,.latest-side > a,a.radar-archive-row';

export function placeArticlePeek({x, y, width, height, viewportWidth, viewportHeight, top, side = 1}) {
  const gap = 30, edge = 12;
  const fitsRight = x + gap + width <= viewportWidth - edge;
  const fitsLeft = x - gap - width >= edge;
  if (side === 1 && !fitsRight && fitsLeft) side = -1;
  else if (side === -1 && !fitsLeft && fitsRight) side = 1;
  return {side,
    x: Math.max(edge, Math.min(side === 1 ? x + gap : x - width - gap, viewportWidth - width - edge)),
    y: Math.max(top, Math.min(y - 48, viewportHeight - height - 24))};
}

export function mountArticlePeek(root, {articles, language, categoryLabel, readingTime, motionEnabled, mountSurface}) {
  const eligible = matchMedia('(hover:hover) and (pointer:fine) and (min-width:821px)');
  const records = new Map(articles.filter(a => a.status === 'published').map(a => [a.id, a]));
  const cache = new Map();
  const abort = new AbortController();
  const {signal} = abort;
  const panel = document.createElement('aside');
  panel.id = 'article-peek';
  panel.className = 'article-peek';
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', language === 'zh' ? '文章预览' : 'Article preview');
  const nativePopover = typeof panel.showPopover === 'function';
  if (nativePopover) panel.setAttribute('popover', 'manual');
  document.body.append(panel);
  let active = null, dismissed = null, pending = null, point = null, openTimer, closeTimer, surfaceCleanup = () => {};
  let frame = 0, lastFrame = 0, current = null, target = null, side = 1, exitTimer;
  let following = false, leaving = false, geometry = null, readyFrame = 0;
  function stopFollow() {
    cancelAnimationFrame(frame); frame = 0; lastFrame = 0;
    target = current ? {...current} : null;
  }
  function tick(now) {
    frame = 0;
    if (!current || !target || panel.hidden) return;
    const dt = lastFrame ? Math.min(now - lastFrame, 48) : 16.7;
    lastFrame = now;
    const blend = 1 - Math.exp(-dt / 28);
    current.x += (target.x - current.x) * blend;
    current.y += (target.y - current.y) * blend;
    if (following && point && geometry) {
      const overlaps = side === 1 ? current.x < point.x + 24 : current.x + geometry.width > point.x - 24;
      if (overlaps) current.x = target.x;
    }
    panel.style.transform = `translate3d(${current.x}px,${current.y}px,0)`;
    if (Math.abs(target.x-current.x) + Math.abs(target.y-current.y) > .15) frame = requestAnimationFrame(tick);
    else lastFrame = 0;
  }
  const label = (zh, en) => language === 'zh' ? zh : en;
  function recordFor(anchor) {
    if (!anchor || !root.contains(anchor)) return null;
    try {
      const url = new URL(anchor.href);
      if (url.origin !== location.origin || !url.pathname.startsWith('/blog/')) return null;
      return records.get(decodeURIComponent(url.pathname.slice('/blog/'.length)));
    }
    catch { return null; }
  }
  function previewFor(article) {
    if (cache.has(article.id)) return cache.get(article.id);
    const body = new DOMParser().parseFromString(article.body || '', 'text/html');
    const paragraphs = [...body.querySelectorAll('p')].map(p => p.textContent.trim());
    const excerpt = paragraphs.find(text => text.length > 40) || article.summary || paragraphs[0] || '';
    const limit = article.lang === 'zh' ? 140 : 260;
    const characters = Array.from(excerpt);
    const headings = [...body.querySelectorAll('h2,h3')].map(h => h.textContent.trim()).filter(Boolean);
    const value = {excerpt: characters.slice(0, limit).join('') + (characters.length > limit ? '…' : ''), headings};
    cache.set(article.id, value);
    return value;
  }
  function close(restoreFocus = false) {
    clearTimeout(openTimer); clearTimeout(closeTimer); clearTimeout(exitTimer);
    stopFollow(); leaving = false; panel.classList.remove('is-leaving');
    surfaceCleanup(); surfaceCleanup = () => {};
    if (nativePopover && panel.matches(':popover-open')) panel.hidePopover();
    panel.hidden = true;
    if (active) {
      active.removeAttribute('aria-expanded'); active.removeAttribute('aria-controls');
      if (restoreFocus && active.isConnected) active.focus({preventScroll:true});
    }
    active = null; pending = null; geometry = null;
  }
  function deferClose() {
    clearTimeout(openTimer); pending = null;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (panel.hidden || !motionEnabled()) { close(); return; }
      stopFollow(); leaving = true; panel.classList.add('is-leaving');
      exitTimer = setTimeout(() => close(), 180);
    }, 140);
  }
  function keepOpen() {
    clearTimeout(closeTimer); clearTimeout(exitTimer);
    leaving = false; panel.classList.remove('is-leaving');
  }
  function position(anchor, mouse, immediate = false) {
    if (immediate || !geometry) {
      const box = anchor.getBoundingClientRect();
      geometry = {width:panel.offsetWidth, height:panel.offsetHeight,
        anchorX:box.right - 20, anchorY:box.top + 40,
        top:(document.querySelector('#header')?.getBoundingClientRect().bottom || 0) + 18};
    }
    const {width, height, top, anchorX, anchorY} = geometry;
    const pointerX = mouse?.x ?? anchorX, pointerY = mouse?.y ?? anchorY;
    const placement = placeArticlePeek({x:pointerX, y:pointerY, width, height,
      viewportWidth:innerWidth, viewportHeight:innerHeight, top, side});
    const switched = side !== placement.side;
    side = placement.side;
    const {x,y} = placement;
    target = {x,y};
    if (immediate || switched || !motionEnabled()) {
      stopFollow(); current = {x,y}; target = {x,y};
      panel.style.transform = `translate3d(${x}px,${y}px,0)`;
    } else if (!frame) frame = requestAnimationFrame(tick);
  }
  function show(anchor) {
    const article = recordFor(anchor);
    if (!eligible.matches || !article || dismissed === anchor || !anchor.isConnected) return;
    close(); active = anchor;
    const preview = previewFor(article);
    panel.innerHTML = `<div class="article-peek-sheet" data-surface><svg class="peek-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 .3H95L99.7 5V99.7H5L.3 95V.3Z"/></svg><div class="peek-meta"><span>${escape(categoryLabel(article.category) || label('文章', 'WRITING'))}</span><span>${escape(readingTime(article))}</span></div><p class="peek-excerpt">${escape(preview.excerpt)}</p>${preview.headings.length ? `<div class="peek-contents"><p>${label('本文章节', 'IN THIS ARTICLE')} </p><ol>${preview.headings.slice(0,4).map(h => `<li>${escape(h.replace(/^\d+\.\s+(\S+)\s+⭐.*$/, '$1'))}</li>`).join('')}</ol>${preview.headings.length > 4 ? `<small>${label('另有', '+')} ${preview.headings.length-4} ${label('节', 'more sections')}</small>` : ''}</div>` : ''}</div>`;
    panel.lang = article.lang;
    panel.classList.toggle('is-still', !motionEnabled());
    panel.style.setProperty('--peek-roll', motionEnabled() ? '-1.6deg' : '0deg');
    if (nativePopover) anchor.after(panel); else document.body.append(panel);
    panel.hidden = false;
    if (nativePopover) panel.showPopover();
    following = !!point;
    panel.classList.toggle('is-pointer', following);
    position(anchor, point, true);
    anchor.setAttribute('aria-expanded', 'true'); anchor.setAttribute('aria-controls', panel.id);
    surfaceCleanup = mountSurface(panel);
  }
  function arm(anchor, mouse = null) {
    if (!eligible.matches || !recordFor(anchor) || dismissed === anchor) return;
    keepOpen(); clearTimeout(openTimer);
    point = mouse;
    if (active === anchor && !panel.hidden) {
      pending = null;
      following = !!mouse; panel.classList.toggle('is-pointer', following); return;
    }
    const replacing = !!active && !panel.hidden;
    if (replacing && motionEnabled()) {
      leaving = true; panel.classList.add('is-leaving');
    } else close();
    pending = {anchor, keyboard: !mouse};
    openTimer = setTimeout(() => show(anchor), mouse ? (replacing ? 180 : 150) : 100);
  }
  root.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch' || event.buttons || panel.contains(event.target)) return;
    const anchor = event.target.closest(ENTRY);
    if (!anchor || anchor.contains(event.relatedTarget)) return;
    dismissed = null; arm(anchor, {x:event.clientX,y:event.clientY});
  }, {signal});
  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || event.buttons || panel.contains(event.target)) return;
    point = {x:event.clientX,y:event.clientY};
    const anchor = event.target.closest(ENTRY);
    if (anchor && recordFor(anchor) && active !== anchor && pending?.anchor !== anchor) arm(anchor, point);
    if (active && following && !panel.hidden) position(active, point);
  }, {signal,passive:true});
  root.addEventListener('pointerout', event => {
    const anchor = event.target.closest(ENTRY);
    if (anchor && !anchor.contains(event.relatedTarget)) {
      if (!following) stopFollow();
      if (!panel.contains(event.relatedTarget)) deferClose();
    }
  }, {signal});
  root.addEventListener('focusin', event => {
    if (panel.contains(event.target)) { keepOpen(); following = false; panel.classList.remove('is-pointer'); stopFollow(); return; }
    const anchor = event.target.closest(ENTRY);
    if (anchor) arm(anchor);
  }, {signal});
  root.addEventListener('focusout', event => {
    if (!panel.contains(event.relatedTarget) && !active?.contains(event.relatedTarget)) deferClose();
  }, {signal});
  panel.addEventListener('pointerenter', () => { if (!following) { keepOpen(); stopFollow(); } }, {signal});
  panel.addEventListener('pointerleave', deferClose, {signal});
  document.addEventListener('pointerdown', event => {
    if (!panel.contains(event.target) && !active?.contains(event.target)) close();
  }, {signal});
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      if (document.querySelector('dialog[open]')) { close(); return; }
      const restore = panel.contains(document.activeElement); dismissed = active; close(restore);
      event.preventDefault();
    }
  }, {signal});
  window.addEventListener('scroll', () => {
    if (panel.hidden && pending?.keyboard && document.activeElement === pending.anchor) return;
    if (active && !following && document.activeElement === active) {
      const box = active.getBoundingClientRect();
      if (box.bottom > 0 && box.top < innerHeight) return;
    }
    close();
  }, {signal,passive:true});
  window.addEventListener('resize', () => close(), {signal,passive:true});
  eligible.addEventListener('change', () => close(), {signal});
  // Rendering can replace a link already underneath a stationary pointer.
  // Recover its hover after the route has restored scrolling; no re-entry is needed.
  readyFrame = requestAnimationFrame(() => {
    readyFrame = requestAnimationFrame(() => {
      readyFrame = 0;
      if (!eligible.matches || active || pending) return;
      const anchor = [...root.querySelectorAll(ENTRY)].find(node => node.matches(':hover') && recordFor(node));
      if (anchor) {
        const box = anchor.getBoundingClientRect();
        arm(anchor, point || {x:box.left + box.width / 2, y:box.top + box.height / 2});
      }
    });
  });
  return () => { cancelAnimationFrame(readyFrame); abort.abort(); close(); panel.remove(); };
}
