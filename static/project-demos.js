const activeDemos = new WeakMap();
const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const choose = (language, zh, en) => language === 'en' ? en : zh;

const titles = {
  zh: ['Bulletin', '我的 LoRA 更会选路由了，JSON 却更不可靠了', 'Obsidian Cinematic', '把散落的站，捏成一处', 'DeepSeek Navigator', 'Bilingual Patch Contracts', 'Evidence Agent', 'RAG 上生产：召回、重排与那 200ms'],
  en: ['Bulletin', 'My LoRA improved routing and made JSON less reliable', 'Obsidian Cinematic', '把散落的站，捏成一处', 'DeepSeek Navigator', 'Bilingual Patch Contracts', 'Evidence Agent', 'RAG 上生产：召回、重排与那 200ms']
};

function routerMarkup(language) {
  const t = (zh, en) => choose(language, zh, en);
  return `<section class="demo-root demo-router" data-demo="router" data-demo-lang="${language}" aria-label="${t('LoRA 实验结果对比', 'LoRA experiment comparison')}">
    <div class="demo-topline"><span>MLX / LoRA</span><span class="demo-mode" data-demo-mode>LoRA</span></div>
    <div class="demo-metrics" aria-live="polite" aria-atomic="true">
      <div class="demo-metric demo-metric-accuracy"><div class="demo-metric-label">${t('严格全字段匹配', 'Strict all-field accuracy')}</div><div class="demo-number"><span data-demo-accuracy>47.2</span><small>%</small></div><div class="demo-track" aria-hidden="true"><span class="demo-base-mark" style="left:7.6%"></span><i data-demo-accuracy-bar style="transform:scaleX(.472)"></i></div><span class="demo-change">7.6 → 47.2 <b>+39.6 pp</b></span></div>
      <div class="demo-metric demo-metric-json"><div class="demo-metric-label">${t('严格 JSON 合法', 'Strict JSON validity')}</div><div class="demo-number"><span data-demo-json>95.5</span><small>%</small></div><div class="demo-track" aria-hidden="true"><span class="demo-base-mark" style="left:98.6%"></span><i data-demo-json-bar style="transform:scaleX(.955)"></i></div><span class="demo-change">98.6 → 95.5 <b>−3.1 pp</b></span></div>
    </div>
    <div class="demo-state-control"><button type="button" class="demo-state-button" data-demo-set="0" aria-pressed="false">${t('基座', 'Base')}</button><label class="demo-range-wrap"><span class="demo-sr">${t('选择基座或 LoRA', 'Choose Base or LoRA')}</span><input class="demo-range" data-demo-router-range type="range" min="0" max="1" step="1" value="1" aria-valuetext="LoRA"></label><button type="button" class="demo-state-button" data-demo-set="1" aria-pressed="true">LoRA</button></div>
    <p class="demo-caption">${t('576 条留出合成请求 · 不代表生产效果', '576 held-out synthetic requests · not production results')}</p>
  </section>`;
}

function bulletinMarkup(language, headlines) {
  const t = (zh, en) => choose(language, zh, en);
  const source = headlines?.length ? headlines : titles[language];
  const list = Array.from({ length: 9 }, (_, i) => source[i % source.length]);
  const rows = [list.slice(0, 3), list.slice(3, 6), list.slice(6, 9)];
  return `<section class="demo-root demo-bulletin" data-demo="bulletin" data-demo-lang="${language}" aria-label="${t('Bulletin 标题流展示', 'Bulletin title-stream demonstration')}">
    <div class="demo-topline"><span>BULLETIN</span><button type="button" class="demo-pause" data-demo-pause aria-pressed="false">${t('暂停', 'Pause')} <span aria-hidden="true">Ⅱ</span></button></div>
    <div class="demo-bulletin-window"><span class="demo-window-cross demo-window-cross-one" aria-hidden="true"></span><span class="demo-window-cross demo-window-cross-two" aria-hidden="true"></span>
      <div class="demo-stream" aria-hidden="true">${rows.map((row, index) => `<div class="demo-lane demo-lane-${index}"><div class="demo-lane-track">${[0, 1].map(() => `<div class="demo-lane-copy">${row.map((title, i) => `<span class="demo-headline"><i>${String(index * 3 + i + 1).padStart(2, '0')}</i>${escapeHTML(title)}</span>`).join('')}</div>`).join('')}</div></div>`).join('')}</div>
      <span class="demo-stream-word" aria-hidden="true">Bulletin</span>
    </div>
    <p class="demo-caption">${headlines?.length ? t('标题流展示 · 本站最新文章与开源雷达', 'Title-stream demonstration · latest writing and radar picks') : t('标题流展示 · 使用本站作品与文章标题', 'Title-stream demonstration · project and article titles')}</p>
    <ul class="demo-sr">${list.map(title => `<li>${escapeHTML(title)}</li>`).join('')}</ul>
  </section>`;
}

function imageMarkup() {
  return `<svg class="demo-note-image" viewBox="0 0 600 260" role="img" aria-label="Build. Break. Rebuild." preserveAspectRatio="xMidYMid slice"><path fill="#a8cbd4" opacity=".13" d="M0 0H600V260H0z"/><circle cx="440" cy="86" r="68" fill="#a3bdc8"/><path d="M0 210L100 139 170 199 277 65 436 229 550 145 600 182V260H0Z" fill="#0d1114"/><path d="M0 230L100 159 170 219 277 85 436 249 550 165 600 202" fill="none" stroke="#a8cbd4" stroke-width="1.5"/><path d="M277 85L277 260M100 159L100 260M550 165L550 260" stroke="#a8cbd4" opacity=".3"/><path d="M0 239H600M0 250H600M0 260H600" stroke="#a8cbd4" opacity=".25"/></svg>`;
}

function obsidianMarkup(language) {
  const t = (zh, en) => choose(language, zh, en);
  return `<section class="demo-root demo-obsidian" data-demo="obsidian" data-demo-lang="${language}" style="--demo-reveal:55%" aria-label="${t('Obsidian 样式对比', 'Obsidian style comparison')}">
    <div class="demo-topline"><span>OBSIDIAN CINEMATIC</span><span>${t('样式对比', 'Style comparison')}</span></div>
    <div class="demo-compare-stage">
      <div class="demo-note demo-note-plain"><div class="demo-note-content"><strong>Build. Break. Rebuild.</strong><p>智灯已灭余空烬<br>犹自光明照十方</p></div>${imageMarkup()}</div>
      <div class="demo-note demo-note-cinematic" data-demo-enhanced aria-hidden="true">${imageMarkup()}<div class="demo-glass-note"><span>Build. Break. Rebuild.</span><p>智灯已灭余空烬<br>犹自光明照十方</p><i aria-hidden="true"></i></div></div>
      <div class="demo-compare-line" aria-hidden="true"><span>↔</span></div>
    </div>
    <div class="demo-state-control"><button type="button" class="demo-state-button" data-demo-compare-set="0">${t('原始', 'Plain')}</button><label class="demo-range-wrap"><span class="demo-sr">${t('调整样式对比', 'Adjust the style comparison')}</span><input class="demo-range" type="range" data-demo-compare-range min="0" max="100" step="1" value="55" aria-valuetext="55% Cinematic"></label><button type="button" class="demo-state-button" data-demo-compare-set="100">Cinematic</button></div>
  </section>`;
}

export function demoMarkup(id, lang = 'zh', headlines = []) {
  const language = lang === 'en' ? 'en' : 'zh';
  if (id === 'router') return routerMarkup(language);
  if (id === 'bulletin') return bulletinMarkup(language, headlines);
  if (id === 'obsidian') return obsidianMarkup(language);
  return '';
}

export function mountDemos(root = document) {
  const nodes = [...root.querySelectorAll('[data-demo]')];
  if (root.matches?.('[data-demo]')) nodes.unshift(root);
  const cleanups = nodes.map(node => {
    activeDemos.get(node)?.();
    const listeners = [];
    const listen = (target, event, callback) => {
      target.addEventListener(event, callback);
      listeners.push(() => target.removeEventListener(event, callback));
    };
    const language = node.dataset.demoLang;
    const t = (zh, en) => choose(language, zh, en);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let paused = false;
    let intersecting = true;
    let cleaned = false;
    const pauseButton = node.querySelector('[data-demo-pause]');
    const updateMotion = () => {
      const enforced = reduced.matches || document.documentElement.dataset.motion === 'off';
      node.dataset.demoMotion = enforced || paused || document.hidden || !intersecting ? 'off' : 'on';
      if (pauseButton) {
        pauseButton.disabled = enforced;
        pauseButton.setAttribute('aria-pressed', String(paused || enforced));
        pauseButton.textContent = enforced ? t('动效已暂停', 'Motion paused') : paused ? `${t('继续', 'Resume')} ▷` : `${t('暂停', 'Pause')} Ⅱ`;
      }
    };
    if (pauseButton) listen(pauseButton, 'click', () => { paused = !paused; updateMotion(); });
    listen(reduced, 'change', updateMotion);
    listen(document, 'visibilitychange', updateMotion);
    const motionObserver = new MutationObserver(updateMotion);
    motionObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    let visibilityObserver;
    if ('IntersectionObserver' in window) {
      visibilityObserver = new IntersectionObserver(entries => {
        intersecting = entries[0].isIntersecting;
        updateMotion();
      });
      visibilityObserver.observe(node);
    }

    if (node.dataset.demo === 'router') {
      const slider = node.querySelector('[data-demo-router-range]');
      const update = () => {
        const adapted = slider.value === '1';
        node.querySelector('[data-demo-accuracy]').textContent = adapted ? '47.2' : '7.6';
        node.querySelector('[data-demo-json]').textContent = adapted ? '95.5' : '98.6';
        node.querySelector('[data-demo-accuracy-bar]').style.transform = `scaleX(${adapted ? '.472' : '.076'})`;
        node.querySelector('[data-demo-json-bar]').style.transform = `scaleX(${adapted ? '.955' : '.986'})`;
        const label = adapted ? 'LoRA' : t('基座', 'Base');
        node.querySelector('[data-demo-mode]').textContent = label;
        slider.setAttribute('aria-valuetext', label);
        node.querySelectorAll('[data-demo-set]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.demoSet === slider.value)));
      };
      listen(slider, 'input', update);
      node.querySelectorAll('[data-demo-set]').forEach(button => listen(button, 'click', () => { slider.value = button.dataset.demoSet; update(); }));
      update();
    }

    if (node.dataset.demo === 'obsidian') {
      const slider = node.querySelector('[data-demo-compare-range]');
      const update = () => {
        node.style.setProperty('--demo-reveal', `${slider.value}%`);
        slider.setAttribute('aria-valuetext', `${slider.value}% Cinematic`);
        node.querySelectorAll('[data-demo-compare-set]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.demoCompareSet === slider.value)));
      };
      listen(slider, 'input', update);
      node.querySelectorAll('[data-demo-compare-set]').forEach(button => listen(button, 'click', () => { slider.value = button.dataset.demoCompareSet; update(); }));
      update();
    }

    updateMotion();
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      listeners.forEach(remove => remove());
      motionObserver.disconnect();
      visibilityObserver?.disconnect();
      node.dataset.demoMotion = 'off';
      if (activeDemos.get(node) === cleanup) activeDemos.delete(node);
    };
    activeDemos.set(node, cleanup);
    return cleanup;
  });
  return () => cleanups.forEach(cleanup => cleanup());
}
