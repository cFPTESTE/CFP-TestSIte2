"""Download remote profile photos (photo: https://...) into src/assets/people/<slug>.jpg.
Run before the build (the GitHub Action does it). Existing local files are kept.
Uses only the Python standard library."""
import os, re, sys, urllib.request
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PEOPLE=os.path.join(ROOT,'content','people'); OUT=os.path.join(ROOT,'src','assets','people')
os.makedirs(OUT,exist_ok=True); ok=fail=0
for f in sorted(os.listdir(PEOPLE)):
    if not f.endswith('.yml'): continue
    slug=f[:-4]; txt=open(os.path.join(PEOPLE,f),encoding='utf-8').read()
    m=re.search(r'^photo:\s*(https?://\S+)',txt,re.M)
    if not m or any(os.path.exists(os.path.join(OUT,f'{slug}.{e}')) for e in ('jpg','jpeg','png','webp')): continue
    try:
        req=urllib.request.Request(m.group(1),headers={'User-Agent':'Mozilla/5.0 (cfp-site build)'})
        data=urllib.request.urlopen(req,timeout=20).read()
        if len(data)<2000 or not (data[:3]==b'\xff\xd8\xff' or data[:8]==b'\x89PNG\r\n\x1a\n' or data[8:12]==b'WEBP'): raise ValueError('not an image')
        ext='png' if data[:4]==b'\x89PNG' else ('webp' if data[8:12]==b'WEBP' else 'jpg')
        open(os.path.join(OUT,f'{slug}.{ext}'),'wb').write(data); ok+=1; print('  +',slug)
    except Exception as e:
        fail+=1; print(f'  ! {slug}: {e} (the site will link the remote photo instead)')
print(f'{ok} photos downloaded, {fail} failed')
