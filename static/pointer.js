// The sword uses exact event coordinates; only its surrounding reticle is eased.
const ACTION = 'a[href],button,summary,[role="button"],input[type="button"],input[type="submit"],input[type="checkbox"],input[type="radio"],select,[data-cursor="action"]';
const EDITOR = 'textarea,input:not([type]),input:is([type="text"],[type="search"],[type="email"],[type="url"],[type="tel"],[type="password"],[type="number"]),[contenteditable]:not([contenteditable="false"])';

export function pointerMode(target) {
  if (!target?.closest) return 'idle';
  if (target.closest(':disabled,[aria-disabled="true"],[inert]')) return 'disabled';
  if (target.closest(EDITOR)) return 'text';
  if (target.closest('input[type="range"],input[type="file"],input[type="color"]')) return 'native';
  if (target.closest(ACTION)) return 'action';
  if (target.closest('p,blockquote,pre,code,.article-body li,figcaption,[data-cursor="text"]')) return 'text';
  return 'idle';
}

export function mountPointer() {
  const root = document.documentElement;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const contrast = matchMedia('(forced-colors: active)');
  const abort = new AbortController();
  const {signal} = abort;
  const follower = document.createElement('div');
  follower.className = 'sword-reticle';
  follower.setAttribute('aria-hidden','true');
  follower.innerHTML = '<div class="sword-tip"><img class="sword-tip-idle" src="/static/pointer-sword.svg?v=2" width="32" height="36" alt="" draggable="false"><img class="sword-tip-action" src="/static/pointer-sword-active.svg?v=2" width="32" height="36" alt="" draggable="false"></div><div class="sword-reticle-position"><div class="sword-reticle-frame"><i></i><i></i><i></i><i></i></div><div class="sword-reticle-pulse"></div></div>';
  if (typeof follower.showPopover === 'function') follower.setAttribute('popover','manual');
  document.body.append(follower);
  const tip = follower.querySelector('.sword-tip');
  const idleImage = follower.querySelector('.sword-tip-idle');
  const activeImage = follower.querySelector('.sword-tip-action');
  const reticle = follower.querySelector('.sword-reticle-position');
  let x = 0, y = 0, px = 0, py = 0, raf = 0, inside = false, selecting = false, pulse;
  let ready = idleImage.complete && idleImage.naturalWidth > 0;
  const available = () => ready && fine.matches && !contrast.matches && !document.hidden;
  const moving = () => available() && !reduce.matches && root.dataset.motion !== 'off';
  const hide = () => {
    follower.classList.remove('is-visible','is-down');
    root.classList.remove('sword-pointer');
    cancelAnimationFrame(raf); raf = 0;
  };
  const topLayer = () => {
    if (typeof follower.showPopover === 'function') {
      if (follower.matches(':popover-open')) follower.hidePopover();
      if (available() && inside) follower.showPopover();
    } else {
      const dialogs = [...document.querySelectorAll('dialog[open]')];
      (dialogs.at(-1) || document.body).append(follower);
    }
  };
  const frame = () => {
    px += (x-px)*0.3; py += (y-py)*0.3;
    reticle.style.transform = `translate3d(${px}px,${py}px,0)`;
    if (Math.abs(x-px)+Math.abs(y-py) > 0.1 && moving() && inside) raf = requestAnimationFrame(frame);
    else raf = 0;
  };
  const mode = (target) => {
    const state = pointerMode(target);
    follower.dataset.state = state;
    const enabled = available() && inside && !selecting;
    const visible = enabled && !['text','disabled','native'].includes(state);
    // Exceptions in the stylesheet restore native editing/selection cursors.
    root.classList.toggle('sword-pointer',enabled);
    follower.classList.toggle('is-visible',visible);
    follower.classList.toggle('has-reticle',moving());
    if (!visible || !moving()) {
      follower.classList.remove('is-down');
      cancelAnimationFrame(raf); raf = 0; px=x; py=y;
      reticle.style.transform = `translate3d(${x}px,${y}px,0)`;
    }
    return visible;
  };
  const point = (event) => {
    x = event.clientX; y = event.clientY;
    // Preserve the original 3px/3px tip hotspot, without interpolation or a frame queue.
    tip.style.transform = `translate3d(${x-3}px,${y-3}px,0)`;
    if (typeof follower.showPopover !== 'function') {
      const host = event.target.closest?.('dialog[open]') || document.body;
      if (follower.parentElement !== host) host.append(follower);
    }
    if (!inside) {
      inside=true; px=x; py=y;
      reticle.style.transform = `translate3d(${x}px,${y}px,0)`;
      topLayer();
    }
  };
  const sync = () => {
    if (!available() || !inside) {hide(); return;}
    topLayer(); mode(document.elementFromPoint(x,y));
  };
  const imageReady = () => {
    ready = idleImage.naturalWidth > 0;
    sync();
  };
  idleImage.addEventListener('load',imageReady,{signal});
  idleImage.addEventListener('error',() => {ready=false; hide();},{signal});
  const activeReady = () => follower.classList.toggle('has-active-image',activeImage.naturalWidth > 0);
  activeImage.addEventListener('load',activeReady,{signal});
  activeReady();
  document.addEventListener('pointermove',(event) => {
    if (event.pointerType !== 'mouse' || !fine.matches) {inside=false; hide(); return;}
    point(event);
    if (mode(event.target) && moving() && !raf) raf = requestAnimationFrame(frame);
  },{signal,passive:true});
  document.addEventListener('pointerover',(event) => {
    if (event.pointerType !== 'mouse' || !fine.matches) return;
    point(event); mode(event.target);
  },{signal,passive:true});
  document.addEventListener('pointerdown',(event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    point(event); px=x; py=y; topLayer();
    reticle.style.transform = `translate3d(${x}px,${y}px,0)`;
    if (!mode(event.target) || !moving()) return;
    follower.classList.add('is-down');
    pulse?.cancel();
    pulse = follower.querySelector('.sword-reticle-pulse').animate([
      {opacity:0.65,transform:'translate(-50%,-50%) rotate(45deg) scale(.4)'},
      {opacity:0,transform:'translate(-50%,-50%) rotate(45deg) scale(1.5)'}
    ],{duration:340,easing:'cubic-bezier(.2,.7,.3,1)'});
  },{signal,passive:true});
  document.addEventListener('pointerup',() => follower.classList.remove('is-down'),{signal,passive:true});
  const leave = () => {inside=false; hide();};
  document.addEventListener('pointerout',(event) => {if(!event.relatedTarget) leave();},{signal,passive:true});
  window.addEventListener('blur',leave,{signal});
  document.addEventListener('visibilitychange',() => {if(document.hidden) leave();},{signal});
  document.addEventListener('selectionchange',() => {
    selecting = !window.getSelection()?.isCollapsed;
    if (selecting) hide();
    else if (inside) mode(document.elementFromPoint(x,y));
  },{signal});
  document.addEventListener('keydown',(event) => {if(event.key === 'Tab') leave();},{signal});
  document.addEventListener('scroll',() => {if(inside) mode(document.elementFromPoint(x,y));},{signal,passive:true,capture:true});
  document.addEventListener('toggle',(event) => {
    if (event.target?.tagName === 'DIALOG') topLayer();
  },{signal,capture:true});
  const observer = new MutationObserver(sync);
  observer.observe(root,{attributes:true,attributeFilter:['data-motion']});
  fine.addEventListener('change',sync,{signal});
  reduce.addEventListener('change',sync,{signal});
  contrast.addEventListener('change',sync,{signal});
  sync();
  return () => {abort.abort(); observer.disconnect(); hide(); pulse?.cancel(); follower.remove();};
}
