"""Combine the browser-rendered text layers with existing artwork at build time."""
import json,sys
from pathlib import Path
from PIL import Image,ImageOps

root=Path(__file__).resolve().parent.parent
temp=Path(sys.argv[1]);pool=json.loads((temp/'pool.json').read_text())
out=root/'static/assets/share-cards';out.mkdir(parents=True,exist_ok=True)
layers=[Image.open(temp/f'{i}.png').convert('RGBA') for i in range(len(pool['quotes']))]
total=0
for art_index,src in enumerate(pool['artworks']):
 with Image.open(root/src.lstrip('/')) as source:
  background=ImageOps.fit(source.convert('RGB'),(1200,630),method=Image.Resampling.LANCZOS).convert('RGBA')
 for quote_index,layer in enumerate(layers):
  index=art_index*len(layers)+quote_index
  target=out/f'{pool["version"]}-{index:04d}.jpg'
  Image.alpha_composite(background,layer).convert('RGB').save(target,quality=76,optimize=True,progressive=True)
  total+=target.stat().st_size
 print(f'Artwork {art_index+1}/{len(pool["artworks"])} complete',flush=True)
print(f'{len(layers)*len(pool["artworks"])} cards, {total/1024/1024:.1f} MiB')
