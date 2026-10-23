const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const artwork = new Map();

export function collectionCard(item, lang = 'zh') {
  const parts = item.title.split(/\s*[·:]\s*/);
  const issuer = parts.length > 1 ? parts.shift() : '';
  const title = parts.join(' · ') || item.title;
  return `<a class="collection-card" data-collection-card data-kind="${escape(item.kind)}" data-title="${escape(item.title)}" data-image="${escape(item.image)}" data-source="${escape(item.url)}" href="${escape(item.image)}" aria-label="${escape((lang === 'zh' ? '查看大图：' : 'Enlarge: ') + item.title)}"><div class="collection-art"><img src="${escape(item.image)}" alt="${escape(item.title)}" loading="lazy" decoding="async"><span class="collection-enlarge" aria-hidden="true">↗</span></div><div class="collection-caption">${issuer ? `<small>${escape(issuer)}</small>` : ''}<span>${escape(title)}</span></div><i class="collection-glint" aria-hidden="true"></i></a>`;
}

async function fullArtwork(source, signal) {
  if (artwork.has(source)) return artwork.get(source);
  // These local presentation wrappers contain the original artwork, not just a thumbnail.
  if (!/^\/static\/assets\/collection\/[a-f0-9]{20}-light\.svg$/.test(source)) return source;
  const response = await fetch(source, {signal});
  if (!response.ok) throw new Error('Artwork unavailable');
  const svg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
  let image = svg.querySelector('image')?.getAttribute('href');
  if (!/^data:image\/(?:png|jpeg|webp|svg\+xml);base64,/i.test(image || '')) return source;
  // Older wrappers label their JPEG payload as PNG.
  image = image.replace(/^data:image\/png;base64,(?=\/9j\/)/, 'data:image/jpeg;base64,');
  artwork.set(source, image);
  return image;
}

const icon = (name) => {
  const paths = {
    zoom: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    fit: '<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    previous: '<path d="m14 5-7 7 7 7"/>',
    next: '<path d="m10 5 7 7-7 7"/>',
    source: '<path d="M14 4h6v6M20 4l-9 9M10 4H4v16h16v-6"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
};

export function mountCollection(root, lang = 'zh') {
  const cards = [...root.querySelectorAll('[data-collection-card]')];
  if (!cards.length) return () => {};
  const abort = new AbortController();
  const {signal} = abort;
  const text = (zh, en) => lang === 'zh' ? zh : en;
  const dialog = document.createElement('dialog');
  dialog.className = 'collection-viewer';
  dialog.setAttribute('aria-labelledby', 'collection-viewer-title');
  dialog.innerHTML = `<div class="collection-viewer-bar"><span class="collection-viewer-count"></span><h2 id="collection-viewer-title"></h2><div><a class="collection-source" target="_blank" rel="noopener" aria-label="${text('凭证来源', 'Credential source')}" title="${text('凭证来源', 'Credential source')}">${icon('source')}</a><button data-viewer-zoom aria-pressed="false" aria-label="${text('放大', 'Zoom in')}" title="${text('放大', 'Zoom in')}">${icon('zoom')}</button><button data-viewer-close aria-label="${text('关闭', 'Close')}" title="${text('关闭', 'Close')}">${icon('close')}</button></div></div><div class="collection-viewer-stage"><button class="collection-prev" data-viewer-prev aria-label="${text('上一张', 'Previous image')}" title="${text('上一张', 'Previous image')}">${icon('previous')}</button><div class="collection-image-scroll"><div class="collection-image-card" hidden><img alt="" draggable="false"></div><p class="collection-image-status" role="status"></p></div><button class="collection-next" data-viewer-next aria-label="${text('下一张', 'Next image')}" title="${text('下一张', 'Next image')}">${icon('next')}</button></div>`;
  document.body.append(dialog);
  const image = dialog.querySelector('.collection-image-scroll img');
  const status = dialog.querySelector('.collection-image-status');
  const sheet = dialog.querySelector('.collection-image-card');
  const stage = dialog.querySelector('.collection-image-scroll');
  const zoom = dialog.querySelector('[data-viewer-zoom]');
  let index = 0, sequence = 0, lastFocus, previousOverflow, frame = 0, viewerFrame = 0;
  const fitSheet = () => {
    if (!image.naturalWidth || sheet.hidden) return;
    const scale = dialog.classList.contains('is-zoomed')
      ? stage.clientWidth * 1.8 / image.naturalWidth
      : Math.min((stage.clientWidth-24) / image.naturalWidth, (stage.clientHeight-28) / image.naturalHeight);
    sheet.style.width = `${Math.max(1, Math.round(image.naturalWidth*scale))}px`;
    sheet.style.height = `${Math.max(1, Math.round(image.naturalHeight*scale))}px`;
  };
  const resetSheet = () => {
    sheet.style.setProperty('--vrx', '0deg'); sheet.style.setProperty('--vry', '0deg');
    sheet.classList.remove('is-active');
  };
  const setZoom = (enabled) => {
    dialog.classList.toggle('is-zoomed', enabled);
    zoom.setAttribute('aria-pressed', String(enabled));
    const label = enabled ? text('适应窗口', 'Fit to window') : text('放大', 'Zoom in');
    zoom.setAttribute('aria-label', label); zoom.title = label;
    zoom.innerHTML = icon(enabled ? 'fit' : 'zoom');
    resetSheet(); fitSheet();
  };
  const resize = new ResizeObserver(fitSheet);
  resize.observe(stage);
  const show = async (next) => {
    index = (next + cards.length) % cards.length;
    const card = cards[index];
    const current = ++sequence;
    setZoom(false);
    sheet.hidden = true;
    image.removeAttribute("src");
    image.alt = card.dataset.title;
    status.hidden = false;
    status.textContent = text('正在载入原图…', 'Loading original artwork…');
    dialog.querySelector('h2').textContent = card.dataset.title.replace(/^.*?[·:]\s*/, '');
    dialog.querySelector('.collection-viewer-count').textContent = `${String(index + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
    const source = dialog.querySelector('.collection-source');
    source.hidden = !/^https:\/\//.test(card.dataset.source);
    if (!source.hidden) source.href = card.dataset.source;
    image.onload = () => { if (current === sequence) { sheet.hidden = false; status.hidden = true; fitSheet(); } };
    image.onerror = () => { if (current === sequence) { status.hidden = false; status.textContent = text('图片加载失败，请关闭后重试。', 'Image unavailable. Close and try again.'); } };
    try {
      const url = await fullArtwork(card.dataset.image, signal);
      if (current === sequence && dialog.open) image.src = url;
    } catch (error) {
      if (error.name !== 'AbortError' && current === sequence) image.onerror();
    }
  };
  const reset = (card) => {
    card.style.removeProperty('--rx'); card.style.removeProperty('--ry');
    card.style.removeProperty('--shine'); card.classList.remove('is-hovered');
  };
  // Keep collapsed and offscreen collections lazy rather than fetching the entire wall.
  const artworkObserver = new IntersectionObserver((entries) => {
    entries.forEach(({target: card, isIntersecting}) => {
      if (!isIntersecting) return;
      artworkObserver.unobserve(card);
      fullArtwork(card.dataset.image, signal).then((url) => {
        if (!signal.aborted) card.querySelector('img').src = url;
      }).catch(() => {});
    });
  }, {rootMargin:'150px'});
  cards.forEach((card) => {
    artworkObserver.observe(card);
    card.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      lastFocus = card;
      previousOverflow = document.body.style.overflow;
      dialog.showModal();
      document.body.style.overflow = 'hidden';
      show(cards.indexOf(card));
      dialog.querySelector('[data-viewer-close]').focus({preventScroll:true});
    }, {signal});
    card.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch' || matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off') return;
      const rect = card.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        card.style.setProperty('--rx', `${(0.5-y)*13}deg`);
        card.style.setProperty('--ry', `${(x-0.5)*17}deg`);
        card.style.setProperty('--mx', `${x*100}%`);
        card.style.setProperty('--my', `${y*100}%`);
        card.style.setProperty('--shine', '1');
        card.classList.add('is-hovered');
      });
    }, {signal});
    card.addEventListener('pointerleave', () => {cancelAnimationFrame(frame); reset(card);}, {signal});
  });
  stage.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || dialog.classList.contains('is-zoomed') || matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off') return;
    const rect = stage.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX-rect.left)/rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY-rect.top)/rect.height));
    cancelAnimationFrame(viewerFrame);
    viewerFrame = requestAnimationFrame(() => {
      sheet.style.setProperty('--vrx', `${(0.5-y)*9}deg`);
      sheet.style.setProperty('--vry', `${(x-0.5)*12}deg`);
      sheet.style.setProperty('--vx', `${x*100}%`);
      sheet.style.setProperty('--vy', `${y*100}%`);
      sheet.classList.add('is-active');
    });
  }, {signal});
  stage.addEventListener('pointerleave', () => {cancelAnimationFrame(viewerFrame); resetSheet();}, {signal});
  dialog.querySelector('[data-viewer-close]').addEventListener('click', () => dialog.close(), {signal});
  dialog.querySelector('[data-viewer-prev]').addEventListener('click', () => show(index-1), {signal});
  dialog.querySelector('[data-viewer-next]').addEventListener('click', () => show(index+1), {signal});
  zoom.addEventListener('click', () => setZoom(!dialog.classList.contains('is-zoomed')), {signal});
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); show(index + (event.key === 'ArrowRight' ? 1 : -1));
    }
  }, {signal});
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  }, {signal});
  dialog.addEventListener('close', () => {
    ++sequence;
    document.body.style.overflow = previousOverflow ?? '';
    if (lastFocus?.isConnected) lastFocus.focus({preventScroll:true});
  }, {signal});
  return () => {
    if (dialog.open) dialog.close();
    abort.abort(); artworkObserver.disconnect(); resize.disconnect(); cancelAnimationFrame(frame); cancelAnimationFrame(viewerFrame);
    cards.forEach(reset); dialog.remove();
  };
}
