"""Convert generated color references to independent, flat, closed SVG cells.
Development only; the shipped app never needs Python or raster overlays.
Run with Pillow, numpy, scipy and opencv-python-headless installed.
"""
import json
import hashlib
from pathlib import Path
import cv2
import potrace
import numpy as np
from scipy import ndimage
from scipy.cluster.vq import kmeans2
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CONFIG = json.loads((Path(__file__).parent / 'config.json').read_text(encoding='utf-8'))

def trace(mask):
    ys,xs=np.where(mask)
    if not len(xs): return ''
    left,top,right,bottom=int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())
    curves=potrace.Bitmap(~mask[top:bottom+1,left:right+1].astype(bool)).trace(turdsize=1,alphamax=.9,opttolerance=.15)
    parts = []
    def point(p): return f'{p.x+left:.2f},{p.y+top:.2f}'
    for curve in curves:
        parts.append('M'+point(curve.start_point))
        for segment in curve:
            if segment.is_corner: parts.append('L'+point(segment.c)+' '+point(segment.end_point))
            else: parts.append('C'+point(segment.c1)+' '+point(segment.c2)+' '+point(segment.end_point))
        parts.append('Z')
    return ' '.join(parts)

def hexcolor(rgb):
    return '#' + ''.join(f'{int(v):02X}' for v in rgb)

def namecolor(rgb):
    h,s,v = cv2.cvtColor(np.array(rgb, dtype='uint8').reshape(1,1,3), cv2.COLOR_RGB2HSV)[0,0]
    if s < 28: return '하양' if v > 220 else '밝은 회색' if v > 160 else '회색' if v > 95 else '진회색'
    h=int(h)*2
    hue = '빨강' if h < 15 or h >= 345 else '주황' if h < 42 else '노랑' if h < 70 else '연두' if h < 95 else '초록' if h < 160 else '청록' if h < 190 else '하늘' if h < 210 else '파랑' if h < 255 else '보라' if h < 290 else '분홍' if h < 330 else '장미'
    return ('밝은 ' if v>210 and s<130 else '진한 ' if v<145 else '') + hue

for item in CONFIG:
    folder = ROOT/'public/assets/source'/item['id']
    folder.mkdir(parents=True, exist_ok=True)
    src = folder/'generated-reference.png'
    # Preserve the AI original separately from the derived flat SVG.
    if not src.exists():
        original = Path.home()/'.codex/generated_images/01a152c8-b71e-7aa0-acdf-edf607971bee'/item['file']
        src.write_bytes(original.read_bytes())
    color = np.array(Image.open(src).convert('RGB').resize((800,1000),Image.Resampling.LANCZOS))
    # AI outlines can be dark green/red rather than perfectly neutral black.
    # Retain those boundaries too; otherwise spots would join the main body.
    if item['id'] == 'rose':
        # Dark teal leaf fills are colors, not black ink.
        ink = (color.max(axis=2) < 83) & ((color.max(axis=2).astype(int)-color.min(axis=2)) < 50)
    else:
        ink = color.max(axis=2) < 125
    ink = cv2.morphologyEx(ink.astype('uint8'), cv2.MORPH_CLOSE, np.ones((2,2),np.uint8)).astype(bool)
    cells, count = ndimage.label(~ink)
    stats = []
    for i, box in enumerate(ndimage.find_objects(cells), 1):
        if box is None: continue
        mask = cells[box] == i
        dist = ndimage.distance_transform_edt(np.pad(mask,1))[1:-1,1:-1]
        y,x = np.unravel_index(dist.argmax(),dist.shape)
        radius = float(dist[y,x])
        pixels = color[box][mask & (dist >= min(3,radius*.6))]
        rgb = np.median(pixels,axis=0)
        stats.append(dict(component=i, area=int(mask.sum()), radius=round(radius,2), border=box[0].start==0 or box[1].start==0 or box[0].stop==1000 or box[1].stop==800,
            label=[int(x+box[1].start),int(y+box[0].start)], rgb=rgb.tolist()))
    targets = [s for s in stats if s['area'] >= 100 and s['radius'] >= 6 and max(s['rgb']) > 95]
    assert len(targets) >= 28, (item['id'],len(targets))
    # Cluster *region* medians, not pixels: no region contains a gradient.
    # Every cluster is used. Identical colors are merged before kmeans.
    samples = np.array([s['rgb'] for s in targets],dtype=float)
    unique = np.unique(samples.round().astype('uint8'),axis=0).astype(float)
    assert len(unique) >= 28
    centers, _ = kmeans2(unique, 28, minit='++', seed=17, iter=80)
    bgcomponent=int(cells[0,0])
    bg=next(s for s in stats if s['component']==bgcomponent)
    bgcluster=int(np.argmin(((centers-np.array(bg['rgb']))**2).sum(axis=1)))
    centers[bgcluster]=bg['rgb']
    assignment = np.argmin(((samples[:,None,:]-centers[None,:,:])**2).sum(axis=2),axis=1)
    # Ensure each of the 28 real colors gets at least one independently colored cell.
    from scipy.optimize import linear_sum_assignment
    bgindices=[j for j,s in enumerate(targets) if s['border'] and np.linalg.norm(samples[j]-np.array(bg['rgb']))<70]
    otherindices=[j for j in range(len(targets)) if j not in bgindices]
    otherclusters=[j for j in range(28) if j!=bgcluster]
    rows,cols = linear_sum_assignment(((centers[otherclusters,None,:]-samples[None,otherindices,:])**2).sum(axis=2))
    for row,col in zip(rows,cols): assignment[otherindices[col]]=otherclusters[row]
    for j in bgindices: assignment[j]=bgcluster
    colors = np.clip(centers.round(),0,255).astype('uint8')
    assert len({hexcolor(c) for c in colors})==28
    # Background is always first; order the remaining colors by lightness.
    background = next(j for j,s in enumerate(targets) if s['component']==bgcomponent)
    order = [int(assignment[background])] + sorted(set(range(28))-{int(assignment[background])},key=lambda j:-float(colors[j].mean()))
    number = {cluster:index+1 for index,cluster in enumerate(order)}
    palette = [dict(id=number[j],hex=hexcolor(colors[j]),name=namecolor(colors[j])) for j in order]
    regions=[]
    for index,(s,cluster) in enumerate(zip(targets,assignment)):
        mask = cells==s['component']
        # One connected component only; expand under the outline to avoid seams.
        path = trace(cv2.dilate(mask.astype('uint8'),np.ones((3,3),np.uint8)))
        assert path.endswith('Z')
        regions.append(dict(id=f"cell-{s['component']:03}",colorId=number[int(cluster)],fill=hexcolor(colors[cluster]),
            d=path,label=s['label'],labelSize=round(min(20,s['radius']*1.12),1),touchRadius=s['radius'],fillRule='evenodd'))
    used={s['component'] for s in targets}
    decorations=[]
    for s in stats:
        if s['component'] in used or s['area'] < 3: continue
        path=trace(cv2.dilate((cells==s['component']).astype('uint8'),np.ones((3,3),np.uint8)))
        if path: decorations.append(dict(d=path,stroke='none',strokeWidth=0,fill='#FFFFFF' if min(s['rgb'])>160 else '#000000',fillRule='evenodd'))
    drawing=dict(id=item['id'],revision=1,title=item['title'],kind='official',viewBox=[0,0,800,1000],labelSize=20,
        strokeWidth=2,strokeColor='#000000',outlineColor='#000000',paperColor='#FFFFFF',maxZoom=16,
        colors=palette,regions=regions,decorations=decorations,outlinePath=trace(ink))
    out=ROOT/'src/data/new-drawings'
    out.mkdir(parents=True,exist_ok=True)
    (out/f"{item['id']}.json").write_text(json.dumps(drawing,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    report=dict(id=item['id'],title=item['title'],tool=item['tool'],prompt=item['prompt'],
        sourceSha256=hashlib.sha256(src.read_bytes()).hexdigest(),colors=palette,regions=[{k:v for k,v in r.items() if k!='d'} for r in regions],
        fixedDetails=len(decorations),minTouchRadius=min(r['touchRadius'] for r in regions),conversion='closed connected cells; one solid HEX per cell; no gradient or raster overlay')
    (folder/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(item['id'],len(regions),'regions; 28 colors;',len(decorations),'fixed details',flush=True)
