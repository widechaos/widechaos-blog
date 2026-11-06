import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectScreenshot, shuviaProjectVisual } from '../static/manual-view.js';
import { buildPublicSnapshot, validateContent } from '../scripts/content-schema.mjs';
const screenshot = () => ({ src:'/static/assets/projects/example-abcdef123456.jpg', width:1280, height:720, alt:{zh:'真实截图',en:'Actual screenshot'}, caption:{zh:'真实来源界面',en:'Actual source interface'}, sourceUrl:'https://huggingface.co/spaces/example/demo' });
test('a source screenshot keeps the original image and attribution links with escaped text', () => {
 const s=screenshot();const html=projectScreenshot({...s,alt:'Actual <interface>',caption:'Screen & evidence'},'en');
 assert.match(html,/width="1280" height="720"/);assert.match(html,/loading="lazy"/);assert.match(html,/Actual &lt;interface&gt;/);assert.match(html,/Screen &amp; evidence/);assert.match(html,/Original page/);assert.match(html,/href="https:\/\/huggingface.co\/spaces\/example\/demo"/);assert.match(html,/href="\/static\/assets\/projects\/example-abcdef123456.jpg"/);
});
test('the existing Shuvia screenshot markup retains its original behavior', () => {
 for (const lang of ['zh','en']) { const html=shuviaProjectVisual(lang);assert.match(html,/class="project-screenshot"/);assert.doesNotMatch(html,/project-screenshot-sourced|loading="lazy"|Original page/); }
});
test('the public snapshot includes only screenshot fields and rejects invalid image metadata', () => {
 const source=JSON.parse(readFileSync(new URL('../examples/public-content.json',import.meta.url),'utf8'));source.projects[0].screenshot={...screenshot(),privateNote:'secret'};source.projects[0].screenshot.alt.privateNote='secret';
 const data=buildPublicSnapshot(source);const image=data.projects.find(p=>p.id===source.projects[0].id).screenshot;assert.deepEqual(image,screenshot());assert.equal(validateContent(data).length,0);
 image.src='/static/../secret.jpg';assert.ok(validateContent(data).some(s=>s.includes('screenshot')));
});
