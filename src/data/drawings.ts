import type { Drawing } from './types'
import { policeCarRobot } from './police-car-robot'
import fireData from './new-drawings/fire-robot.json' with { type: 'json' }
import dinosaurData from './new-drawings/baby-dinosaur.json' with { type: 'json' }
import butterflyData from './new-drawings/garden-butterfly.json' with { type: 'json' }
import roseData from './new-drawings/rose.json' with { type: 'json' }
export type { Drawing, Region, PaintColor } from './types'
export { testDrawing } from './test-flower'

export const newDrawings = [fireData, dinosaurData, butterflyData, roseData] as Drawing[]
export const officialCatalog = [
  {
    id: 'police-car-robot',
    title: '경찰차 로봇 변신',
    colorCount: 28,
    icon: '🚓',
    tint: 'mint',
  },
  {
    id: 'fire-robot',
    title: '소방차 로봇 변신',
    colorCount: 28,
    icon: '🚒',
    tint: 'pink',
  },
  {
    id: 'baby-dinosaur',
    title: '공룡과 알',
    colorCount: 28,
    icon: '🦕',
    tint: 'lemon',
  },
  {
    id: 'garden-butterfly',
    title: '알록달록 나비',
    colorCount: 28,
    icon: '🦋',
    tint: 'lavender',
  },
  { id: 'rose', title: '장미꽃', colorCount: 28, icon: '🌹', tint: 'peach' },
] as const

export const featuredDrawing = policeCarRobot

// Only complete, playable designs are exposed in the production catalog.
export const drawings: Record<string, Drawing> = {
  [policeCarRobot.id]: policeCarRobot,
  ...Object.fromEntries(newDrawings.map(drawing => [drawing.id, drawing])),
}
