// The native pointer remains independent of the decorative, eased reticle.
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
  follower.innerHTML = '<div class="sword-reticle-frame"><i></i><i></i><i></i><i></i></div><div class="sword-reticle-pulse"></div>';
  if (typeof follower.showPopover === 'function') follower.setAttribute('popover','manual');
  document.body.append(follower);
  let x = 0, y = 0, px = 0, py = 0, raf = 0, inside = false, selecting = false, pulse;
  const moving = () => fine.matches && !reduce.matches && !contrast.matches && root.dataset.motion !== 'off';
  const hide = () => {follower.classList.remove('is-visible','is-down'); cancelAnimationFrame(raf); raf = 0;};
  const topLayer = () => {
    if (typeof follower.showPopover === 'function') {
      if (follower.matches(':popover-open')) follower.hidePopover();
      if (moving() && inside) follower.showPopover();
    } else {
      const dialogs = [...document.querySelectorAll('dialog[open]')];
      (dialogs.at(-1) || document.body).append(follower);
    }
  };
  const frame = () => {
    px += (x-px)*0.3; py += (y-py)*0.3;
    follower.style.transform = `translate3d(${px}px,${py}px,0)`;
    if (Math.abs(x-px)+Math.abs(y-py) > 0.1 && moving() && inside) raf = requestAnimationFrame(frame);
    else raf = 0;
  };
  const mode = (target) => {
    const state = pointerMode(target);
    follower.dataset.state = state;
    const visible = moving() && inside && !selecting && !['text','disabled','native'].includes(state);
    follower.classList.toggle('is-visible',visible);
    if (!visible) {hide(); px=x; py=y;}
    return visible;
  };
  const sync = () => {
    root.classList.toggle('sword-pointer',fine.matches && !contrast.matches);
    if (!moving()) hide();
    else if (inside) mode(document.elementFromPoint(x,y));
  };
  document.addEventListener('pointermove',(event) => {
    if (event.pointerType !== 'mouse' || !fine.matches) {hide(); return;}
    x = event.clientX; y = event.clientY;
    if (typeof follower.showPopover !== "function") {
      const host = event.target.closest?.("dialog[open]") || document.body;
      if (follower.parentElement !== host) host.append(follower);
    }
    if (!inside) {inside = true; px=x; py=y; topLayer();}
    if (mode(event.target) && !raf) raf = requestAnimationFrame(frame);
  },{signal,passive:true});
  document.addEventListener('pointerover',(event) => {if(event.pointerType === 'mouse') mode(event.target);},{signal,passive:true});
  document.addEventListener('pointerdown',(event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    x=event.clientX; y=event.clientY; inside=true; px=x; py=y; topLayer();
    follower.style.transform = `translate3d(${x}px,${y}px,0)`;
    if (!mode(event.target)) return;
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
  },{signal});
  document.addEventListener('keydown',(event) => {if(event.key === 'Tab') hide();},{signal});
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
  return () => {abort.abort(); observer.disconnect(); hide(); pulse?.cancel(); follower.remove(); root.classList.remove('sword-pointer');};
}
