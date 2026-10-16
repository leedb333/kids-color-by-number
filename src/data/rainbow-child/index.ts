import type { Drawing } from '../types'
import { palette } from './palette'
import { regions } from './regions'
import { decorations } from './decorations'
import { outlinePath } from './outline'

/** Original PNG contours, with small cells grouped into child-friendly targets. */
export const rainbowChild: Drawing = {
  id: 'rainbow-child',
  // The traced geometry and palette replace revision 1; old records stay untouched.
  revision: 2,
  title: '무지개를 바라보는 아이',
  kind: 'official',
  viewBox: [0, 0, 800, 999],
  labelSize: 22,
  strokeWidth: 0,
  strokeColor: 'none',
  colors: palette,
  regions,
  decorations,
  outlinePath,
}
