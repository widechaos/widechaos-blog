const API = '/reading-notes';
const PREFERENCE = 'wc-reading-notes';
const MARK = 'data-reading-mark';
const UI = 'data-reading-ui';
const noop = () => {};
const icons = {
  chevron: '<polyline points="18 15 12 9 6 15"/>',
  radio: '<path d="M16.24 7.76a6 6 0 0 1 0 8.48m-8.48 0a6 6 0 0 1 0-8.48m11.31-2.83a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/><circle cx="12" cy="12" r="2"/>',
  message: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>'
};
/*
Lucide icons (https://lucide.dev/), ISC License
Copyright (c) 2022, Lucide Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/
function icon(name) {
  const holder = document.createElement('span');
  holder.setAttribute('aria-hidden','true');
  holder.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + icons[name] + '</svg>';
  return holder;
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function button(className, text) {
  const element = node('button', className, text);
  element.type = 'button';
  return element;
}

function fragmentText(block) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode: text => text.parentElement.closest('['+UI+']') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

export function fingerprint(text) {
  let n = 2166136261;
  for (let i=0; i<text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
  return (n >>> 0).toString(16);
}

export function locateAnchor(blocks, anchor) {
  const {quote, prefix, suffix, block, offset} = anchor;
  const home = blocks[block];
  if (home && fingerprint(home) === anchor.fingerprint && home.slice(offset, offset+quote.length) === quote) {
    return {index:block, offset};
  }
  const exact = [], contextual = [];
  for (const [index,text] of blocks.entries()) {
    let i = text.indexOf(quote);
    while (i >= 0) {
      const candidate = {index,offset:i};
      exact.push(candidate);
      if ((prefix || suffix) && text.slice(Math.max(0,i-prefix.length),i) === prefix
          && text.slice(i+quote.length,i+quote.length+suffix.length) === suffix) contextual.push(candidate);
      i = text.indexOf(quote,i+1);
    }
  }
  return contextual.length === 1 ? contextual[0] : exact.length === 1 ? exact[0] : null;
}

export async function noteRequest(body, options = {}) {
  const {signal, path, lang} = options;
  const query = new URLSearchParams(path ? {path,lang} : {});
  const response = await fetch(body ? API : API+'?'+query, {
    method:body?'POST':'GET', credentials:'same-origin', cache:'no-store', signal,
    headers: body ? {'Content-Type':'application/json'} : {}, body:body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || 'busy');
  return data;
}

export function mountReadingNotes(root, {path, lang, track = noop}) {
  if (!/^\/(?:blog|docs\/tianshu)\/[A-Za-z0-9_-]+$/.test(path)) return noop;
  const source = root.querySelector('.article-body,.manual-article');
  if (!source) return noop;
  const toolbarParent = root.querySelector('.article-top') || source.querySelector('header');
  const siteHeader = document.getElementById('header');
  if (!toolbarParent) return noop;
  const tr = (zh,en) => lang === 'en' ? en : zh;
  const blocks = [...source.querySelectorAll('p,li')].filter(el => !el.closest('nav,pre,figure,table') && !el.querySelector('p,li'));
  const original = blocks.map(block => fragmentText(block).map(part => part.data).join(''));
  const context = {path,lang};
  const abort = new AbortController();
  const listener = {signal:abort.signal};
  let enabled = true;
  try { enabled = localStorage.getItem(PREFERENCE) !== 'off'; } catch {}
  let unfolded = true, loaded = false, seen = [], reader = null, selection = null, writing = false;
  let request = null, requestKey = '', serial = 0, selected = [], rows = [];
  const lastTrack = new Set();
  let lastDraftEvent = 0;
  let anchorRange = null, anchorBlock = null;
  const preview = 'reading-note-selection';
  const bar = node('div','reading-note-bar');
  const toggle = button('reading-note-toggle');
  const toggleLabel = node('span');
  toggle.setAttribute('role','switch');
  toggle.setAttribute('aria-label',tr('显示批注','Show annotations'));
  toggle.append(icon('message'),toggleLabel);
  bar.append(toggle);
  toolbarParent.append(bar);
  toolbarParent.classList.add('reading-note-toolbar');
  source.classList.add('reading-note-source');
  const articleFrame = source.closest('.article-layout') || source;
  articleFrame.classList.add('reading-note-frame');

  const fold = button('reading-note-fold');
  fold.append(icon('chevron'));
  fold.setAttribute(UI,'');
  source.prepend(fold);
  const loadStatus = node('div','reading-note-load');
  loadStatus.setAttribute('role','status');
  bar.append(loadStatus);
  const retry = button('reading-note-secondary',tr('重试','Retry'));
  retry.hidden = true;
  bar.append(retry);

  const overlay = node('aside','reading-note-overlay');
  overlay.hidden = true;
  overlay.setAttribute(UI,'');
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-label',tr('写批注','Write an annotation'));
  const composer = node('div','reading-note-compose');
  const form = node('form');
  const quotation = node('blockquote','reading-note-quote');
  const body = node('textarea');
  body.name = 'body'; body.rows = 3; body.maxLength = 500; body.required = true;
  const identity = node('fieldset','reading-note-identity');
  const mail = node('input');
  mail.name='email'; mail.type='email'; mail.autocomplete='email'; mail.maxLength=254; mail.required=true;
  const name = node('input');
  name.name='name'; name.autocomplete='nickname'; name.maxLength=24; name.required=true;
  const random = button('reading-note-secondary',tr('随机生成用户名','Suggest a name'));
  const recover = button('reading-note-secondary',tr('用邮箱恢复身份','Recover by email'));
  const help = node('p','reading-note-help',tr('用户名会公开，邮箱只用于验证和恢复身份。','Your name is public. Your email is used to verify and recover your identity.'));
  const submit = button('primary-link',tr('提交批注','Submit annotation'));
  submit.type = 'submit';
  const cancel = button('reading-note-secondary',tr('取消','Cancel'));
  const formStatus = node('p','reading-note-help');
  formStatus.setAttribute('role','status');
  const transmission = node('div','reading-note-transmission');
  transmission.setAttribute(UI,'');
  const signal = node('span','reading-note-signal');
  signal.append(icon('radio'));
  const transmissionText = node('span');
  transmissionText.setAttribute('role','status');
  transmission.append(signal, transmissionText);

  function label(text, field) {
    const item = node('label','',text);
    item.append(field);
    return item;
  }

  identity.append(label(tr('邮箱','Email'),mail),label(tr('用户名','Name'),name),random,recover,help);
  const actions = node('div','reading-note-actions');
  actions.append(submit,cancel);
  form.append(quotation,label(tr('批注','Annotation'),body),identity,actions,formStatus);
  composer.append(form);
  overlay.append(composer,transmission);
  document.body.append(overlay);

  function errorText(error) {
    return ({
      rate:tr('提交太频繁，请稍后再试。','Too many requests. Try again later.'),
      mail:tr('验证邮件发送失败，草稿已保留。请重试。','Email delivery failed. Your draft is still here. Try again.'),
      email:tr('请检查邮箱地址。','Check your email address.'),
      name:tr('请换一个用户名。','Choose a different name.'),
      invalid:tr('请检查所填内容。','Check the information you entered.'),
      signin:tr('身份已失效，请通过邮箱恢复。','Your session expired. Recover by email.'),
    })[error.message] || tr('暂时无法连接，请重试。','Could not connect. Try again.');
  }

  function afterBlock(index, element) {
    const block = blocks[index];
    if (block.matches('li')) block.append(element);
    else block.after(element);
  }

  function updateControls() {
    toggle.setAttribute('aria-checked',String(enabled));
    toggleLabel.textContent = enabled ? tr('批注开启','Notes on') : tr('批注关闭','Notes off');
    fold.hidden = !enabled || !rows.length;
    fold.setAttribute('aria-expanded',String(unfolded));
    fold.setAttribute('aria-label',unfolded ? tr('折叠侧注','Collapse notes') : tr('展开侧注','Expand notes'));
    fold.title=fold.getAttribute('aria-label');
    fold.setAttribute('aria-controls',rows.map(row => row.element.id).join(' '));
    rows.forEach(({element}) => { element.hidden = !enabled || !unfolded; });
    articleFrame.classList.toggle('reading-note-folded',!enabled || !unfolded);
  }

  function clearMarks() {
    const parents = new Set();
    source.querySelectorAll('['+MARK+']').forEach(mark => {
      parents.add(mark.parentNode);
      mark.replaceWith(...mark.childNodes);
    });
    parents.forEach(parent => parent.normalize());
  }

  function markBlocks(positions) {
    for (const [index, ranges] of positions) {
      let offset = 0;
      for (const part of fragmentText(blocks[index])) {
        const base = offset;
        offset += part.length;
        const points = ranges.flatMap(range => [range.offset,range.end]).filter(x => x>base && x<offset);
        const edges = [...new Set([base,...points,offset])].sort((a,b)=>a-b);
        if (!edges.slice(0,-1).some(at => ranges.some(range=>range.offset<=at && range.end>at))) continue;
        const marked = edges.slice(0,-1).map((at,i) => {
          const entries = ranges.filter(range => range.offset<=at && range.end>at).map(range=>range.note);
          const text = part.data.slice(at-base,edges[i+1]-base);
          if (!entries.length) return text;
          const embedded = part.parentElement.closest('a,button');
          const marker = node(embedded ? 'span' : 'a','reading-note-mark',text);
          marker.setAttribute(MARK,'');
          marker.dataset.noteIds = entries.map(entry => entry.id).join(' ');
          if (!embedded) {
            marker.href='#note-'+entries[0].id;
            marker.draggable=false;
            marker.setAttribute('aria-label',text+' · '+tr('查看侧注','Read notes'));
          }
          marker.classList.toggle('is-current',entries.some(entry=>selected.includes(entry.id)));
          return marker;
        });
        part.replaceWith(...marked);
      }
    }
  }

  function noteCard(note) {
    const item = node('div','reading-note-item');
    item.id='note-'+note.id;
    item.classList.toggle('is-current', selected.includes(note.id));
    const quote=node('a','reading-note-locate','「'+note.anchor.quote+'」');
    quote.href='#';
    quote.setAttribute('aria-label',tr('定位原文 ','Find text ')+note.anchor.quote);
    quote.addEventListener('click',event=>{
      event.preventDefault();
      focusNote(note.id,false);
    });
    const meta=node('p','reading-note-meta',note.name+(note.state==='pending' ? tr(' · 待审核',' · Pending review') : ''));
    item.append(quote,meta,node('p','reading-note-message',note.body));
    if (note.reply) {
      const reply = node('div','reading-note-reply');
      reply.append(node('p','reading-note-meta',tr('站长回复','Author reply')),node('p','reading-note-message',note.reply));
      item.append(reply);
    }
    if (note.own) {
      const remove=button('reading-note-secondary',tr('撤回','Withdraw'));
      remove.addEventListener('click',async()=>{
        if (!window.confirm(tr('撤回这条批注？','Withdraw this annotation?'))) return;
        remove.disabled=true;
        try {
          await noteRequest({op:'withdraw',id:note.id},listener);
          seen=seen.filter(x=>x.id!==note.id);
          draw();
          toggle.focus({preventScroll:true});
        } catch (error) { if (!abort.signal.aborted) { remove.disabled=false; remove.textContent=errorText(error); } }
      });
      item.append(remove);
    }
    return item;
  }

  function focusNote(id, fromArticle) {
    selected = [id];
    unfolded = true;
    for (const mark of source.querySelectorAll('['+MARK+']')) mark.classList.toggle('is-current',mark.dataset.noteIds.split(' ').includes(id));
    for (const {element} of rows) for (const item of element.children) item.classList.toggle('is-current',item.id==='note-'+id);
    updateControls();
    const destination = fromArticle ? root.querySelector('#note-'+id+' a') : source.querySelector('a['+MARK+'][data-note-ids~="'+id+'"]');
    destination?.focus({preventScroll:true});
    if (destination && (destination.getBoundingClientRect().top < 95 || destination.getBoundingClientRect().bottom > innerHeight-75)) {
      destination.scrollIntoView({block:'center',behavior:'instant'});
    }
    if (fromArticle && !lastTrack.has(id)) { track('annotation_view'); lastTrack.add(id); }
    scheduleMeasure();
  }

  function draw() {
    rows.forEach(({element})=>element.remove());
    rows=[];
    clearMarks();
    if (!enabled) { updateControls(); return; }
    const placed=new Map();
    for (const note of seen) {
      const location=locateAnchor(original,note.anchor);
      if (!location) continue;
      const {index,offset}=location;
      if (!placed.has(index)) placed.set(index,[]);
      placed.get(index).push({note,offset,end:offset+note.anchor.quote.length});
    }
    markBlocks(placed);
    for (const [index, matches] of [...placed].sort((a,b)=>a[0]-b[0])) {
      const element=node('aside','reading-note-group');
      element.id='reading-group-'+index;
      element.setAttribute(UI,'');
      element.setAttribute('aria-label',tr('本段侧注','Annotations for this passage'));
      matches.sort((a,b)=>a.offset-b.offset).forEach(({note})=>element.append(noteCard(note)));
      afterBlock(index,element);
      rows.push({element,index,anchor:matches[0].note.id});
    }
    updateControls();
    scheduleMeasure();
  }

  function measure() {
    const frame=articleFrame.getBoundingClientRect();
    const wide=innerWidth-frame.right >= 230;
    articleFrame.classList.toggle('reading-note-wide',wide);
    if (!wide) {
      for (const row of rows) if (row.element.parentNode === articleFrame && articleFrame !== source) afterBlock(row.index,row.element);
      return;
    }
    let end=0;
    for (const row of rows) {
      if (row.element.hidden) continue;
      if (articleFrame !== source && row.element.parentNode !== articleFrame) articleFrame.append(row.element);
      const mark=source.querySelector('['+MARK+'][data-note-ids~="'+row.anchor+'"]') || blocks[row.index];
      const n=Math.max(end,mark.getBoundingClientRect().top-frame.top);
      row.element.style.setProperty('--reading-note-offset',n+'px');
      end=n+row.element.offsetHeight+16;
    }
  }

  function measureOverlay() {
    if (overlay.hidden) return;
    const rect = anchorRange?.getBoundingClientRect();
    const anchor = rect?.width && rect?.height ? rect : anchorBlock?.getBoundingClientRect();
    if (!anchor) return;
    const visual = window.visualViewport;
    const left = visual?.offsetLeft || 0;
    const top = visual?.offsetTop || 0;
    const width = visual?.width || innerWidth;
    const height = visual?.height || innerHeight;
    const edge = 12, gap = 12;
    const right = left + width - edge, bottom = top + height - edge;
    const availableTop = Math.max(top + edge, (siteHeader?.getBoundingClientRect().bottom ?? 0) + gap);
    const availableHeight = Math.max(120,bottom-availableTop);
    const side = articleFrame.getBoundingClientRect().right + gap;
    const room = right - side;
    const mobile = width <= 660;
    const boxWidth = mobile ? width - 2 * edge : Math.min(320,room >= 244 ? room : width - 2 * edge);
    overlay.style.width = boxWidth+'px';
    overlay.style.maxHeight = availableHeight+'px';
    const h = overlay.offsetHeight;
    let x = side, y = anchor.top;
    if (mobile) {
      x = left + edge;
      y = bottom - h;
    } else if (room < boxWidth) {
      x = anchor.right + gap;
      if (x + boxWidth > right) {
        x = right - boxWidth;
        y = anchor.bottom + gap + h <= bottom ? anchor.bottom + gap : anchor.top - gap - h;
      }
    }
    overlay.style.left = Math.max(left + edge, Math.min(x,right-boxWidth))+'px';
    overlay.style.top = Math.max(availableTop,Math.min(y,bottom-h))+'px';
    overlay.style.visibility = !writing && !composer.hidden &&
      (anchor.bottom < availableTop || anchor.top > bottom) ? 'hidden' : '';
  }

  let frameRequest=0, overlayFrame=0;
  function scheduleOverlay() {
    if (!overlay.hidden && !overlayFrame) overlayFrame=requestAnimationFrame(()=>{overlayFrame=0;measureOverlay();});
  }
  function scheduleMeasure() {
    if (!frameRequest) frameRequest=requestAnimationFrame(()=>{frameRequest=0;measure();measureOverlay();});
  }
  const resize = new ResizeObserver(scheduleMeasure);
  resize.observe(articleFrame);
  const overlayResize = new ResizeObserver(scheduleOverlay);
  overlayResize.observe(overlay);
  window.addEventListener('resize',scheduleMeasure,listener);
  document.addEventListener('scroll',scheduleOverlay,{...listener,capture:true,passive:true});
  window.visualViewport?.addEventListener('resize',scheduleOverlay,listener);
  window.visualViewport?.addEventListener('scroll',scheduleOverlay,listener);

  async function load() {
    const run = ++serial;
    loadStatus.textContent=tr('读取批注…','Loading notes…');
    retry.hidden=true;
    try {
      const result = await noteRequest(null,{...context,...listener});
      if (run!==serial || abort.signal.aborted) return;
      seen=result.notes; reader=result.reader; loaded=true;
      loadStatus.textContent='';
      draw();
      const id=location.hash.match(/^#note-([a-f0-9]{32})$/)?.[1];
      if (id) focusNote(id,true);
    } catch (error) {
      if (run!==serial || abort.signal.aborted) return;
      loadStatus.textContent=errorText(error);
      retry.hidden=false;
    }
  }

  function closeComposer() {
    overlay.hidden=true;
    anchorRange=null;
    anchorBlock=null;
    writing=false;
    selection=null;
    requestKey='';
    form.reset();
    CSS.highlights?.delete(preview);
  }

  document.addEventListener('pointerdown', event=>{
    if (!overlay.hidden && !overlay.contains(event.target) && !submit.disabled && (!body.value.trim() || composer.hidden)) closeComposer();
  },listener);
  document.addEventListener('keydown',event=>{
    if (overlay.hidden || submit.disabled) return;
    if (event.key==='Escape') {
      const restore=overlay.contains(document.activeElement);
      if (selection) document.getSelection()?.removeAllRanges();
      closeComposer();
      if (restore) toggle.focus({preventScroll:true});
    } else if (event.key==='Tab' && !event.shiftKey && !writing && !composer.hidden && !overlay.contains(document.activeElement)) {
      event.preventDefault();
      body.focus({preventScroll:true});
    }
  },listener);

  toggle.addEventListener('click',()=>{
    enabled=!enabled; unfolded=enabled; selected=[];
    try { localStorage.setItem(PREFERENCE,enabled?'on':'off'); } catch {}
    if (!enabled) { serial++; closeComposer(); loadStatus.textContent=''; retry.hidden=true; }
    draw();
    if (enabled) load();
  });
  retry.addEventListener('click',load);
  fold.addEventListener('click',()=>{ unfolded=!unfolded; updateControls(); scheduleMeasure(); });
  source.addEventListener('click',event=>{
    const mark=event.target.closest('a['+MARK+']');
    if (!mark || !enabled) return;
    event.preventDefault();
    if (document.getSelection()?.isCollapsed) focusNote(mark.dataset.noteIds.split(' ')[0],true);
  },listener);

  document.addEventListener('selectionchange',()=>{
    if (!enabled || !loaded || writing) return;
    const native=document.getSelection();
    if (!native?.rangeCount || native.isCollapsed) {
      if (!overlay.hidden && !composer.hidden) closeComposer();
      return;
    }
    const range=native.getRangeAt(0);
    const index=blocks.findIndex(block=>block.contains(range.startContainer)&&block.contains(range.endContainer));
    if (index<0 || [range.startContainer,range.endContainer].some(n=>(n.nodeType===1?n:n.parentElement).closest('['+UI+']'))) return;
    const quote=range.toString();
    if (quote.trim().length<2 || quote.length>440) return;
    const prefix=range.cloneRange();
    prefix.selectNodeContents(blocks[index]);
    prefix.setEnd(range.startContainer,range.startOffset);
    const offset=prefix.toString().length;
    const text=original[index];
    if (text.slice(offset,offset+quote.length)!==quote) return;
    selection={quote,offset,block:index,prefix:text.slice(Math.max(0,offset-48),offset),suffix:text.slice(offset+quote.length,offset+quote.length+48),fingerprint:fingerprint(text)};
    anchorRange = range.cloneRange();
    anchorBlock = blocks[index];
    if (CSS.highlights && typeof Highlight !== 'undefined') CSS.highlights.set(preview,new Highlight(anchorRange));
    quotation.textContent=quote;
    formStatus.textContent='';
    identityFields(false);
    submit.textContent=reader ? tr('提交批注','Submit annotation') : tr('继续','Continue');
    composer.hidden=false;
    transmission.hidden=true;
    overlay.hidden=false;
    measureOverlay();
  },listener);

  function identityFields(show) {
    identity.hidden=!show;
    mail.required=show;
    name.required=show;
  }

  overlay.addEventListener('pointerdown',()=>{
    if (!composer.hidden) writing=true;
  });
  body.addEventListener('focus',()=>{
    writing=true;
    if (Date.now()-lastDraftEvent>2000) { track('annotation_start'); lastDraftEvent=Date.now(); }
  });

  random.addEventListener('click',()=>{
    const options=lang==='en' ? ['Night Reader','Paper Mountain','Window Star','Quiet Comet'] : ['夜航读者','窗边松石','纸上远山','临溪看书'];
    const choices=options.filter(value=>value!==name.value);
    name.value=choices[Math.floor(Math.random()*choices.length)];
  });
  cancel.addEventListener('click',()=>{document.getSelection()?.removeAllRanges();closeComposer();toggle.focus({preventScroll:true});});
  recover.addEventListener('click',async()=>{
    if (!mail.reportValidity()) return;
    recover.disabled=true;
    try {
      await noteRequest({...context,op:'recover',email:mail.value},listener);
      formStatus.textContent=tr('验证链接已发送。','Verification email sent.');
    } catch (error) {
      if (!abort.signal.aborted) formStatus.textContent=errorText(error);
    } finally { recover.disabled=false; }
  });

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if (!selection || !body.value.trim() || submit.disabled) return;
    if (!reader && identity.hidden) {
      identityFields(true);
      submit.textContent=tr('提交批注','Submit annotation');
      measureOverlay();
      mail.focus({preventScroll:true});
      return;
    }
    const anchor=selection;
    const data={...context,op:'submit',anchor,body:body.value.trim(),...(!reader?{email:mail.value,name:name.value}:{})};
    const key=JSON.stringify(data);
    if (key!==requestKey) { requestKey=key; request=crypto.randomUUID().replaceAll('-',''); }
    submit.disabled=true;
    cancel.disabled=true;
    toggle.disabled=true;
    try {
      const result=await noteRequest({...data,requestId:request},listener);
      if (abort.signal.aborted) return;
      track('annotation_submit');
      requestKey='';
      selected=result.note ? [result.note] : [];
      if (result.note) {
        seen=[...seen.filter(note=>note.id!==result.note),{id:result.note,anchor,body:data.body,name:reader,own:true,state:result.state}];
        unfolded=true;
        draw();
      }
      const status={
        awaiting_email:tr('验证链接已发出，确认邮箱后提交审核。','Verification email sent. Confirm your email to submit for review.'),
        pending:tr('批注已提交，等待审核。','Annotation submitted for review.'),
        published:tr('批注已发布。','Annotation published.'),
      }[result.state];
      closeComposer();
      anchorBlock=blocks[anchor.block];
      transmissionText.textContent=status || tr('批注已提交。','Annotation submitted.');
      transmission.classList.remove('is-sending');
      composer.hidden=true;
      transmission.hidden=false;
      overlay.hidden=false;
      measureOverlay();
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        if (abort.signal.aborted) return;
        transmission.classList.add('is-sending');
        if (result.note) root.querySelector('#note-'+result.note)?.classList.add('is-received');
      }));
      scheduleMeasure();
    } catch (error) {
      if (abort.signal.aborted) return;
      if (error.message==='signin' || error.message==='email') { reader=null; identityFields(true); submit.textContent=tr('提交批注','Submit annotation'); }
      formStatus.textContent=errorText(error);
    } finally { submit.disabled=false; cancel.disabled=false; toggle.disabled=false; }
  });

  updateControls();
  if (enabled) load();
  return () => {
    abort.abort();
    closeComposer();
    overlay.remove();
    resize.disconnect();
    overlayResize.disconnect();
    if (frameRequest) cancelAnimationFrame(frameRequest);
    if (overlayFrame) cancelAnimationFrame(overlayFrame);
  };
}
