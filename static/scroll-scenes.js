const clamp = value => Math.max(0, Math.min(1, value));

// Native scroll drives presentation; it never triggers a forced page turn.
export function mountScrollScenes(root) {
  const sequences = [...root.querySelectorAll('[data-home-sequence],[data-card-sequence]')];
  const groups = sequences.map(sequence => ({sequence, cards:[...sequence.querySelectorAll('[data-home-scene],[data-stack-card]')]}));
  const detail = root.querySelector('[data-project-reveal]');
  const work = root.querySelector('[data-work-browser]');
  if (!groups.length && !detail && !work) return () => {};
  const rows = [...(work?.querySelectorAll('[data-work-id]') || [])];
  const previews = [...(work?.querySelectorAll('[data-work-preview]') || [])];
  let currentWork = -1;
  function showWork(index) {
    if (currentWork === index || !rows[index]) return;
    currentWork = index;
    rows.forEach((row, i) => row.classList.toggle('is-current', i === index));
    previews.forEach(preview => { preview.hidden = preview.dataset.workPreview !== rows[index].dataset.workId; });
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 981px) and (min-height: 560px)');
  const visual = detail?.querySelector('.detail-visual');
  const panels = detail?.querySelector('.detail-panels');
  const controller = new AbortController();
  const {signal} = controller;
  let frame = 0, enabled = false;
  function paint() {
    frame = 0;
    if (!enabled || document.hidden) return;
    const height = window.innerHeight;
    const layouts = groups.map(group => group.cards.map(card => ({height:card.offsetHeight, top:card.getBoundingClientRect().top})));
    const detailTop = panels?.getBoundingClientRect().top;
    const rowTops = rows.map(row => row.getBoundingClientRect().top);
    groups.forEach((group, g) => group.cards.forEach((card, index) => {
      const next = layouts[g][index + 1];
      const progress = next ? clamp((height - 24 - next.top) / Math.max(240, height - 120)) : 0;
      card.style.setProperty('--scene-cover', progress.toFixed(4));
      card.style.setProperty('--scene-top', `${Math.min(96, height - layouts[g][index].height - 24)}px`);
      card.style.setProperty('--scene-order', index + 1);
    }));
    if (rows.length && !work.querySelector('.work-preview')?.contains(document.activeElement)) {
      let index = 0;
      rowTops.forEach((top, i) => { if (top < height * .46) index = i; });
      const focused = document.activeElement?.closest('[data-work-id]');
      if (focused?.matches(':focus-visible') && rows.includes(focused)) index = rows.indexOf(focused);
      showWork(index);
    }
    if (visual && panels) detail.style.setProperty('--unfold', clamp((height * .9 - detailTop) / Math.max(200, height * .9 - 160)).toFixed(4));
  }
  function schedule() { if (!frame && enabled) frame = requestAnimationFrame(paint); }
  function clearCards() {
    groups.forEach(group => group.cards.forEach(card => {
      card.style.removeProperty('--scene-cover'); card.style.removeProperty('--scene-top'); card.style.removeProperty('--scene-order');
    }));
  }
  function configure() {
    enabled = !reduced.matches && desktop.matches && document.documentElement.dataset.motion !== 'off';
    for (const scene of [...sequences, detail, work].filter(Boolean)) scene.dataset.scrollScene = enabled ? 'on' : 'off';
    if (!enabled) { cancelAnimationFrame(frame); frame = 0; clearCards(); detail?.style.removeProperty('--unfold'); }
    else schedule();
  }
  work?.addEventListener('focusin', event => {
    const row = event.target.closest('[data-work-id]');
    if (row) showWork(rows.indexOf(row));
  }, {signal});
  window.addEventListener('scroll', schedule, {passive:true, signal});
  window.addEventListener('resize', schedule, {passive:true, signal});
  document.addEventListener('visibilitychange', schedule, {signal});
  reduced.addEventListener('change', configure, {signal});
  desktop.addEventListener('change', configure, {signal});
  const settings = new MutationObserver(configure);
  settings.observe(document.documentElement, {attributes:true, attributeFilter:['data-motion']});
  const sizing = new ResizeObserver(schedule);
  groups.forEach(group => group.cards.forEach(card => sizing.observe(card)));
  if (panels) sizing.observe(panels);
  if (work) sizing.observe(work);
  configure();
  return () => {
    controller.abort(); settings.disconnect(); sizing.disconnect(); cancelAnimationFrame(frame); clearCards();
    for (const scene of [...sequences, detail, work].filter(Boolean)) { delete scene.dataset.scrollScene; scene.style.removeProperty('--unfold'); }
  };
}
