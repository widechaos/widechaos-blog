// Build the complete static matrix; no image renderer is needed in production.
const { chromium } = await import(process.env.SHARE_PLAYWRIGHT || 'playwright');
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { SHARE_CARD_POOL as pool } from '../static/share-card-pool.js';

const root = resolve(import.meta.dirname, '..');
const temp = mkdtempSync(resolve(tmpdir(), 'site-share-'));
const browser = await chromium.launch({headless: true, ...(process.env.SHARE_CHROMIUM ? {executablePath: process.env.SHARE_CHROMIUM} : {})});
try {
  const page = await browser.newPage({viewport: {width: 1200, height: 630}, deviceScaleFactor: 1});
  const logo = 'data:image/svg+xml;base64,' + readFileSync(resolve(root, 'static/x-sword.svg')).toString('base64');
  const template = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>
    :root{--ink:#e6e9e4;--accent:#d17b6b;--gutter:64px;--name:80px;--copy:40px;--label:18px;--source:16px}
    *{box-sizing:border-box}body{margin:0;color:var(--ink);font-family:Arial,"PingFang SC","Microsoft Yahei",sans-serif;font-synthesis:none}
    .card{position:relative;width:1200px;height:630px;overflow:hidden;background:linear-gradient(90deg,rgba(12,18,26,.97),rgba(12,18,26,.86) 40%,rgba(12,18,26,.16) 76%,rgba(12,18,26,.03)),linear-gradient(0deg,rgba(12,18,26,.58),transparent 25%)}
    .brand{position:absolute;left:var(--gutter);top:48px;display:flex;align-items:center;gap:16px;font-size:20px;letter-spacing:3px}.brand img{width:36px;height:42px}
    h1{position:absolute;left:58px;top:158px;margin:0;font-size:var(--name);line-height:1.2;letter-spacing:-3px;font-weight:700}
    .copy{position:absolute;left:var(--gutter);top:294px;margin:0;font-size:var(--copy);line-height:1.6;letter-spacing:1px;white-space:pre}
    .source{position:absolute;left:var(--gutter);top:442px;margin:0;font-size:var(--source);color:var(--ink)}
    .slogan{position:absolute;left:var(--gutter);top:496px;margin:0;font-size:var(--label);letter-spacing:2px;color:var(--accent)}
    .domain{position:absolute;left:var(--gutter);bottom:40px;font-size:20px;letter-spacing:1px}
  </style><section class="card"><div class="brand"><img src="${logo}" alt="">WIDECHAOS</div><h1>十方空烬</h1><p class="copy"></p><p class="source"></p><p class="slogan">BUILD. BREAK. REBUILD.</p><span class="domain">widechaos.cn</span></section></html>`;
  writeFileSync(resolve(temp, 'template.html'), template);
  await page.goto(pathToFileURL(resolve(temp, 'template.html')).href);
  await page.evaluate(() => document.fonts.ready);
  for (const [index, quote] of pool.quotes.entries()) {
    await page.evaluate(q => {
      const split = q.text.search(/[，；]/);
      document.querySelector('.copy').textContent = split < 0 ? q.text : q.text.slice(0, split + 1) + '\n' + q.text.slice(split + 1);
      document.querySelector('.source').textContent = q.source;
    }, quote);
    const bounds = await page.locator('.copy').boundingBox();
    if (bounds.x + bounds.width > 1160 || bounds.y + bounds.height > 438) throw Error(`Quote overflows: ${quote.id}`);
    await page.screenshot({path: resolve(temp, `${index}.png`), omitBackground: true});
  }
  writeFileSync(resolve(temp, 'pool.json'), JSON.stringify(pool));
  const result = spawnSync(process.env.SHARE_PYTHON || 'python3', [resolve(root, 'scripts/compose-share-cards.py'), temp], {stdio: 'inherit'});
  if (result.status !== 0) throw Error('Card composition failed');
} finally { await browser.close(); rmSync(temp, {recursive: true, force: true}); }
