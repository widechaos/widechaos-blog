import { SHARE_CARD_POOL as pool } from './share-card-pool.js';

export const SHARE_CARD_COUNT = pool.artworks.length * pool.quotes.length;
export function chooseShareCard(recent = [], random = Math.random) {
  const blocked = new Set(recent.slice(-128));
  const keys = Array.from({length: SHARE_CARD_COUNT}, (_, i) => `${pool.version}-${String(i).padStart(4, '0')}`);
  const choices = keys.filter(key => !blocked.has(key));
  return choices[Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)))];
}
export function nextShareLink(storage = localStorage, random = Math.random) {
  const historyKey = `wc-share-cards-${pool.version}`;
  let recent = [];
  try { const saved = JSON.parse(storage.getItem(historyKey) || '[]'); if (Array.isArray(saved)) recent = saved.filter(x => typeof x === 'string'); } catch {}
  const card = chooseShareCard(recent, random);
  try { storage.setItem(historyKey, JSON.stringify([...recent, card].slice(-128))); } catch {}
  return `https://widechaos.cn/?card=${card}`;
}

export function mountShareLink(root, english = false) {
  const button = root.querySelector('[data-share-site]');
  if (!button) return;
  const status = root.querySelector('[data-share-status]');
  const fallback = root.querySelector('[data-share-url]');
  button.onclick = async () => {
    button.disabled = true;
    const url = nextShareLink();
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = english ? 'Share link copied' : '分享链接已复制';
      fallback.hidden = true;
    } catch {
      fallback.value = url;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      status.textContent = english ? 'Select and copy this link' : '请选择并复制下方链接';
    } finally { button.disabled = false; }
  };
}
