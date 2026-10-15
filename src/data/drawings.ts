import type { Drawing } from './types'
import { rainbowChild } from './rainbow-child'
export type { Drawing, Region, PaintColor } from './types'
export { testDrawing } from './test-flower'

export const officialCatalog = [
  {
    id: 'rainbow-child',
    title: '무지개를 바라보는 아이',
    colorCount: 25,
    icon: '🌈',
    tint: 'peach',
  },
  {
    id: 'swing-child',
    title: '그네 타는 아이',
    colorCount: 24,
    icon: '🌿',
    tint: 'mint',
  },
  {
    id: 'fire-robot',
    title: '불을 끄는 소방차 로봇',
    colorCount: 30,
    icon: '🚒',
    tint: 'pink',
  },
  {
    id: 'baby-dinosaur',
    title: '아기 공룡과 알',
    colorCount: 23,
    icon: '🦕',
    tint: 'lemon',
  },
  {
    id: 'garden-butterfly',
    title: '꽃밭의 알록달록 나비',
    colorCount: 27,
    icon: '🦋',
    tint: 'lavender',
  },
] as const

export const featuredDrawing = rainbowChild

// Only playable, approved designs are exposed in the production catalog.
export const drawings: Record<string, Drawing> = {
  [rainbowChild.id]: rainbowChild,
}
