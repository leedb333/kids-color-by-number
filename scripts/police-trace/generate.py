"""One connected source component = one independently paintable region.
No owners, parent links, merging, gradients, transparency, or bitmap overlays.
"""
import hashlib
import json
from pathlib import Path
import cv2
import numpy as np
import potrace
from scipy import ndimage
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CONFIG = json.loads((Path(__file__).parent/'config.json').read_text())
SOURCE = ROOT/'public/assets/source/police-car-robot'
OUTPUT = ROOT/'src/data/police-car-robot'

def read(name):
    data=(SOURCE/name).read_bytes()
    if hashlib.sha256(data).hexdigest()!=CONFIG['sources'][name]:
        raise ValueError(f'Original changed; review mapping before tracing: {name}')
    return np.array(Image.open(SOURCE/name).convert('RGB'))
def trace(mask):
    """Return closed cubic Béziers at source coordinates, including holes."""
    ys, xs = np.where(mask)
    if not len(xs):
        return ''
    left, top, right, bottom = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    crop = mask[top:bottom + 1, left:right + 1]
    bitmap = potrace.Bitmap(~crop)
    paths = bitmap.trace(turdsize=0, alphamax=0.85, opttolerance=0.15)
    def point(p):
        return f'{p.x + left:.2f},{p.y + top:.2f}'
    parts = []
    for curve in paths:
        parts.append('M' + point(curve.start_point))
        for segment in curve:
            if segment.is_corner:
                parts.append('L' + point(segment.c) + ' ' + point(segment.end_point))
            else:
                parts.append('C' + point(segment.c1) + ' ' + point(segment.c2) + ' ' + point(segment.end_point))
        parts.append('Z')
    return ' '.join(parts)

def write(name,export,data,kind):
    (OUTPUT/name).write_text('// Generated from the repository originals by scripts/police-trace/generate.py.\n'
        +f"import type {{ {kind} }} from '../types'\nexport const {export}: {kind}[] = "
        +json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')

color,line=read('color-reference.png'),read('line-reference.png')
assert line.shape==color.shape==(999,800,3)
ink=np.min(line,axis=2)<CONFIG['threshold']
closed=cv2.morphologyEx(ink.astype('uint8'),cv2.MORPH_CLOSE,np.ones((2,2),np.uint8)).astype(bool)
components,count=ndimage.label(~closed)
assert count==CONFIG['sourceComponents']
stats={}
for i in range(1,count+1):
    mask=components==i
    distance=ndimage.distance_transform_edt(np.pad(mask,1))[1:-1,1:-1]
    y,x=np.unravel_index(distance.argmax(),distance.shape)
    radius=float(distance.max())
    pixels=color[mask&(distance>min(3,radius*.5))]
    stats[i]={'rgb':np.median(pixels,axis=0).astype('uint8'),'area':int(mask.sum()),'label':[int(x),int(y)],'radius':radius}

palette=[]
for c in CONFIG['palette']:
    hex=c.get('hex') or '#'+''.join(f'{v:02X}' for v in stats[c['seed']]['rgb'])
    palette.append({'id':c['id'],'name':c['name'],'hex':hex})
assert len(palette)==len({c['hex'] for c in palette})==28
rgb=np.array([[int(c['hex'][j:j+2],16) for j in (1,3,5)] for c in palette],dtype=np.uint8)
lab=cv2.cvtColor(rgb[None,:,:],cv2.COLOR_RGB2LAB)[0].astype(float)
regions=[];manifest=[];used=set()
split_masks={}
for split in CONFIG.get('colorSplits',[]):
    x0,y0,x1,y1=split['box']
    mask=np.zeros(components.shape,dtype=bool)
    mask[y0:y1,x0:x1]=np.min(color[y0:y1,x0:x1],axis=2)>=split['minChannel']
    mask &= components==split['parentComponent']
    # Keep the single source-derived white bulb, never an imagined ellipse.
    islands,n=ndimage.label(mask)
    sizes=np.bincount(islands.ravel());sizes[0]=0
    mask=islands==int(sizes.argmax())
    assert mask.sum()>100
    split_masks[split['id']]=mask
for c in CONFIG['regions']:
    i=c['component'];s=stats[i].copy()
    source_lab=cv2.cvtColor(s['rgb'].reshape(1,1,3),cv2.COLOR_RGB2LAB)[0,0].astype(float)
    color_id=c.get('colorId') or int(np.argmin(np.sum((lab-source_lab)**2,axis=1)))+1
    # Dilate only into the stroke. Never combine another connected cell in this ID.
    mask=components==i
    for split in CONFIG.get('colorSplits',[]):
        if split['parentComponent']==i: mask=mask & ~split_masks[split['id']]
    if any(split['parentComponent']==i for split in CONFIG.get('colorSplits',[])):
        dist=ndimage.distance_transform_edt(np.pad(mask,1))[1:-1,1:-1]
        y,x=np.unravel_index(dist.argmax(),dist.shape)
        s.update(label=[int(x),int(y)],radius=float(dist.max()),area=int(mask.sum()))
        assert ndimage.label(mask)[1]==1, 'Split must leave one connected headlight region'
    mask=cv2.dilate(mask.astype('uint8'),np.ones((3,3),np.uint8)).astype(bool)
    label_size=round(min(20,s['radius']*1.15),1)
    fill=palette[color_id-1]['hex']
    regions.append({'id':c['id'],'colorId':color_id,'fill':fill,'d':trace(mask),'label':s['label'],'labelSize':label_size,'touchRadius':round(s['radius'],2),'fillRule':'evenodd'})
    manifest.append({'id':c['id'],'component':i,'colorId':color_id,'fill':fill,'area':s['area'],'label':s['label'],'radius':round(s['radius'],2)})
    used.add(i)
    print(c['id'],flush=True)
for split in CONFIG.get('colorSplits',[]):
    mask=split_masks[split['id']]
    dist=ndimage.distance_transform_edt(np.pad(mask,1))[1:-1,1:-1]
    y,x=np.unravel_index(dist.argmax(),dist.shape); radius=float(dist.max())
    # Add the child after the parent so the white bulb owns its exact touch surface.
    fill=palette[split['colorId']-1]['hex']
    regions.append({'id':split['id'],'colorId':split['colorId'],'fill':fill,'d':trace(mask),'label':[int(x),int(y)],'labelSize':round(min(20,radius*1.15),1),'touchRadius':round(radius,2),'fillRule':'evenodd'})
    manifest.append({'id':split['id'],'component':split['parentComponent'],'colorId':split['colorId'],'fill':fill,'area':int(mask.sum()),'label':[int(x),int(y)],'radius':round(radius,2),'source':'color-reference opaque white bulb split from its surrounding headlight'})
assert set(c['colorId'] for c in regions)==set(range(1,29))
# Small non-paintable spaces stay pure black/white in BOTH the start and finish.
# They never change on a tap and never inherit paintWith from another object.
decorations=[];excluded=[]
for i in range(1,count+1):
    if i in used:continue
    s=stats[i]
    white=int(s['rgb'].min())>180
    fill='#FFFFFF' if white else '#000000'
    decorations.append({'d':trace(cv2.dilate((components==i).astype('uint8'),np.ones((3,3),np.uint8)).astype(bool)), 'stroke':'none','strokeWidth':0,'fill':fill,'fillRule':'evenodd'})
    excluded.append({'component':i,'area':s['area'],'radius':round(s['radius'],2),'fill':fill,'label':s['label'],'reason':'thin eye white/highlight or tiny seam/trim; fixed monochrome, no touch required'})
write('palette.ts','palette',palette,'PaintColor')
write('regions.ts','regions',regions,'Region')
write('decorations.ts','decorations',decorations,'Decoration')
(OUTPUT/'outline.ts').write_text('// Bézier ink from line-reference.png, no raster content.\nexport const outlinePath = '+json.dumps(trace(ink))+'\n')
report={'sources':[{'file':name,'sha256':sha,'width':800,'height':999} for name,sha in CONFIG['sources'].items()], 'threshold':128,'sourceComponents':count,'touchRegions':len(regions),'uniqueFlatColors':len({c['fill'] for c in regions}),'regions':manifest,'nonPaintable':excluded}
(OUTPUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('Generated',len(regions),'independent targets,',len(excluded),'static monochrome details, 28 unique colors')
