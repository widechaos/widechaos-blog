import {noteRequest} from './reading-notes.js';

const trigger=document.querySelector('#verify-note');
const status=document.querySelector('#verify-status');
const token=location.hash.slice(1);
history.replaceState(null,'',location.pathname);
if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
  trigger.disabled=true;
  status.textContent='验证链接无效或已用过。 / The verification link is missing or expired.';
}
trigger.addEventListener('click',async()=>{
  trigger.disabled=true;
  try {
    const {next}=await noteRequest({op:'verify',token});
    if (!/^\/(?:blog|docs\/tianshu)\/[A-Za-z0-9_-]+\?lang=(?:zh|en)$/.test(next)) throw new Error('invalid');
    location.replace(next);
  } catch (error) {
    status.textContent=error.message==='expired' ?
      '链接已失效，请回到文章重新获取。 / Request a new link from the article.' :
      '暂时无法验证，请重试。 / Verification unavailable. Try again.';
    trigger.disabled=error.message==='expired';
  }
});
