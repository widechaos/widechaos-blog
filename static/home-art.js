// Choose once per homepage visit; keep language and display changes on the same artwork.
export const HOME_ART = Object.freeze([
  "/static/assets/china2098/XnegW3.jpg",
  "/static/assets/china2098/YeLBvP.jpg",
  "/static/assets/china2098/ELqvdA.jpg",
  "/static/assets/china2098/3dl9nD.jpg",
  "/static/assets/china2098/J9av10.jpg",
  "/static/assets/china2098/bKXlem.jpg",
  "/static/assets/china2098/28l9Ra.jpg",
  "/static/assets/china2098/28l9wa.jpg",
  "/static/assets/china2098/rA0xyJ.jpg",
  "/static/assets/china2098/0n0PEK.jpg",
  "/static/assets/china2098/d8dY43.jpg",
  "/static/assets/china2098/oADgZW.jpg",
  "/static/assets/china2098/8exKRO.jpg",
  "/static/assets/china2098/Ye35Oq.jpg",
  "/static/assets/china2098/rAQgvG.jpg",
  "/static/assets/china2098/w61Ao5.jpg",
  "/static/assets/china2098/9mAw9a.jpg",
  "/static/assets/china2098/0nAY04.jpg",
  "/static/assets/china2098/aYKoBk.jpg",
  "/static/assets/china2098/4XoXE2.jpg",
  "/static/assets/china2098/6bZR06.jpg",
  "/static/assets/china2098/Lelzqw.jpg",
  "/static/assets/china2098/eJ4KYG.jpg",
  "/static/assets/china2098/9NXdAR.jpg",
  "/static/assets/china2098/5B4rng.jpg",
  "/static/assets/china2098/xYoEJ4.jpg",
  "/static/assets/china2098/g8qe0x.jpg",
  "/static/assets/china2098/lRlmEJ.jpg",
  "/static/assets/china2098/QnPvW8.jpg",
  "/static/assets/china2098/xYoEZ2.jpg",
]);
export function chooseHomeArt(previous = '', random = Math.random) {
  const choices = HOME_ART.filter(src => src !== previous);
  return choices[Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)))];
}
export function nextHomeArt() {
  let previous = '';
  try { previous = sessionStorage.getItem('wc-home-art') || ''; } catch {}
  const selected = chooseHomeArt(previous);
  try { sessionStorage.setItem('wc-home-art', selected); } catch {}
  return selected;
}
