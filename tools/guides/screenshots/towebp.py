import sys,glob,os
from PIL import Image
src,dst=sys.argv[1],sys.argv[2]; os.makedirs(dst,exist_ok=True)
for f in sorted(glob.glob(src+'/*.png')):
    n=os.path.basename(f)
    if n.startswith('_') or n=='first.png': continue
    im=Image.open(f).convert('RGB')
    if im.width>2400: im=im.resize((im.width*3//4, im.height*3//4), Image.LANCZOS)
    out=os.path.join(dst,n[:-4]+'.webp'); im.save(out,'WEBP',quality=82,method=6)
    print(n, im.size, os.path.getsize(out)//1024,'KB')
