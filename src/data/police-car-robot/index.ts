import type { Drawing } from '../types'
import { palette } from './palette'
import { regions } from './regions'
import { decorations } from './decorations'
import { outlinePath } from './outline'

export const policeCarRobot: Drawing = {
  id: 'police-car-robot',
  revision: 1,
  title: '경찰차 로봇 변신',
  kind: 'official',
  viewBox: [0, 0, 800, 999],
  labelSize: 20,
  strokeWidth: 0,
  strokeColor: 'none',
  outlineColor: '#000000',
  paperColor: '#FFFFFF',
  maxZoom: 16,
  colors: palette,
  regions,
  decorations,
  outlinePath,
}
