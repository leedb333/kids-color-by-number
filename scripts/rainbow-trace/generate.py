"""Trace repository originals into playable vector data; never change source PNGs.

Run from any directory with the dependencies in requirements.txt installed.
The app only consumes the committed TypeScript output, not this tool or Python.
"""
import hashlib
import json
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np
import potrace
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
CONFIG = json.loads((Path(__file__).parent / 'config.json').read_text())
SOURCE = ROOT / 'public/assets/source/rainbow-child'
OUTPUT = ROOT / 'src/data/rainbow-child'


def read_source(name):
    data = (SOURCE / name).read_bytes()
    if hashlib.sha256(data).hexdigest() != CONFIG['sources'][name]:
        raise ValueError(f'Source changed: review component mapping before tracing {name}')
    return np.array(Image.open(SOURCE / name).convert('RGB'))


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


def write_ts(name, export_name, data, type_name):
    text = '// Generated from the repository PNGs by scripts/rainbow-trace/generate.py.\n'
    text += '// Do not hand-edit curves; edit the reviewed mapping and regenerate.\n'
    text += f"import type {{ {type_name} }} from '../types'\n\n"
    text += f'export const {export_name}: {type_name}[] = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n'
    (OUTPUT / name).write_text(text)


line = read_source('rainbow-kid-line.png')
color = read_source('rainbow-kid-color.png')
assert line.shape == color.shape == (999, 800, 3)
original_ink = np.min(line, axis=2) < CONFIG['threshold']
# Seal subpixel gaps for flood fill only. The visible ink uses the unmodified mask.
closed_ink = cv2.morphologyEx(original_ink.astype('uint8'), cv2.MORPH_CLOSE, np.ones((2, 2), np.uint8)).astype(bool)
components, count = ndimage.label(~closed_ink)
assert count == CONFIG['components'], 'Component numbering changed; review the mapping'

# Palette swatches are sampled inside the corresponding black-and-white component.
stats = {}
for component in range(1, count + 1):
    mask = components == component
    distance = ndimage.distance_transform_edt(np.pad(mask, 1))[1:-1, 1:-1]
    pixels = color[mask & (distance > min(4, float(distance.max()) / 2))]
    stats[component] = {'pixels': pixels}

palette = []
for item in CONFIG['colors']:
    pixels = stats[item['component']]['pixels']
    if item['highlight']:
        luminance = pixels @ np.array([.2126, .7152, .0722])
        pixels = pixels[luminance >= np.quantile(luminance, .7)]
    rgb = np.median(pixels, axis=0).astype(int)
    palette.append({'id': item['id'], 'name': item['name'], 'hex': '#' + ''.join(f'{v:02X}' for v in rgb)})

owners = np.zeros(count + 1, dtype=int)
for index, region in enumerate(CONFIG['regions'], 1):
    for component in region['components']:
        assert owners[component] == 0, f'Duplicate component {component}'
        owners[component] = index
known = owners[components]
_, nearest = ndimage.distance_transform_edt(known == 0, return_indices=True)
nearest_owner = known[tuple(nearest)]
for component in range(1, count + 1):
    if owners[component]:
        continue
    parent = CONFIG['helperParents'].get(str(component))
    if parent:
        owners[component] = next(i for i, r in enumerate(CONFIG['regions'], 1) if r['id'] == parent)
    else:
        adjacent = nearest_owner[components == component]
        owners[component] = int(np.bincount(adjacent).argmax())
assert np.all(owners[1:] > 0)

palette_rgb = np.array([[int(c['hex'][i:i + 2], 16) for i in (1, 3, 5)] for c in palette], dtype=np.uint8)
palette_lab = cv2.cvtColor(palette_rgb[None, :, :], cv2.COLOR_RGB2LAB)[0].astype(float)
regions, decorations, metrics = [], [], []
for index, config in enumerate(CONFIG['regions'], 1):
    main_mask = np.isin(components, config['components'])
    mask = owners[components] == index
    distance = ndimage.distance_transform_edt(np.pad(main_mask, 1))[1:-1, 1:-1]
    # Prefer a familiar central part of the shape, with a safe interior label.
    radius = float(distance.max())
    yy, xx = np.indices(distance.shape)
    valid = distance >= min(15, radius * .9)
    px, py = config['preferredLabel']
    score = np.where(valid, (xx - px) ** 2 + (yy - py) ** 2, np.inf)
    y, x = np.unravel_index(score.argmin(), score.shape)
    # Fill slightly under the source ink, avoiding antialiased seams.
    expanded = cv2.dilate(mask.astype('uint8'), np.ones((3, 3), np.uint8)).astype(bool)
    regions.append({'id': config['id'], 'colorId': config['colorId'], 'd': trace(expanded), 'label': [int(x), int(y)], 'fillRule': 'evenodd'})
    helpers = defaultdict(list)
    for component in np.flatnonzero(owners == index):
        if component in config['components']:
            continue
        rgb = np.median(stats[int(component)]['pixels'], axis=0).astype('uint8')
        lab = cv2.cvtColor(rgb.reshape(1, 1, 3), cv2.COLOR_RGB2LAB)[0, 0].astype(float)
        swatch = int(np.argmin(np.sum((palette_lab - lab) ** 2, axis=1)))
        if palette[swatch]['id'] != config['colorId']:
            helpers[palette[swatch]['hex']].append(int(component))
    for hex_color, ids in helpers.items():
        detail_mask = cv2.dilate(np.isin(components, ids).astype('uint8'), np.ones((3, 3), np.uint8)).astype(bool)
        decorations.append({'d': trace(detail_mask), 'stroke': 'none', 'strokeWidth': 0, 'fill': hex_color, 'fillRule': 'evenodd', 'paintWith': config['id']})
    metrics.append({'id': config['id'], 'components': np.flatnonzero(owners == index).tolist(), 'mainComponents': config['components'], 'area': int(mask.sum()), 'labelRadius': round(float(distance[y, x]), 2)})
    print(config['id'], 'traced', flush=True)

write_ts('palette.ts', 'palette', palette, 'PaintColor')
write_ts('regions.ts', 'regions', regions, 'Region')
write_ts('decorations.ts', 'decorations', decorations, 'Decoration')
outline = trace(original_ink)
(OUTPUT / 'outline.ts').write_text('// Generated directly from rainbow-kid-line.png; contains no raster image.\nexport const outlinePath = ' + json.dumps(outline) + '\n')
manifest = {'generator': 'potracer 0.0.4, opttolerance 0.15', 'sourceFiles': [{'name': name, 'sha256': sha, 'width': 800, 'height': 999} for name, sha in CONFIG['sources'].items()], 'threshold': CONFIG['threshold'], 'sourceComponents': count, 'colorCount': len(palette), 'regionCount': len(regions), 'helperGroups': len(decorations), 'sourceInkPixels': int(original_ink.sum()), 'regions': metrics}
(OUTPUT / 'trace-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print('Generated', len(regions), 'targets,', len(palette), 'swatches,', len(outline), 'outline bytes')
