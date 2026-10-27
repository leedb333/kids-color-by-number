import { describe, expect, it } from 'vitest'
import {
  activeColor,
  decodeProgress,
  paint,
  progress,
  storageKey,
} from './engine'
import { officialCatalog, testDrawing as drawing } from './data/drawings'

const ordered = drawing.colors.flatMap((color) =>
  drawing.regions.filter((region) => region.colorId === color.id),
)
const serialized = (history: unknown, version = 1) =>
  JSON.stringify({ version, history, updatedAt: '2026-10-15T00:00:00.000Z' })

describe('ordered SVG paint engine', () => {
  it('rejects a wrong color, nonexistent region, and duplicate taps', () => {
    const empty: string[] = []
    expect(paint(drawing, empty, 'cloud-left')).toBe(empty)
    expect(paint(drawing, empty, 'missing')).toBe(empty)
    const history = paint(drawing, empty, 'sun')
    expect(history).toEqual(['sun'])
    expect(paint(drawing, history, 'sun')).toBe(history)
    expect(activeColor(drawing, history)?.id).toBe(1)
  })
  it('advances only after every region of a color and completes all 25 regions', () => {
    let history: string[] = []
    for (const region of ordered) {
      expect(activeColor(drawing, history)?.id).toBe(region.colorId)
      history = paint(drawing, history, region.id)
    }
    expect(history).toHaveLength(drawing.regions.length)
    expect(activeColor(drawing, history)).toBeUndefined()
    expect(progress(drawing, history)).toBe(100)
  })
  it('undo crosses the color boundary and can undo completion', () => {
    const firstColor = ordered
      .filter((region) => region.colorId === 1)
      .map((region) => region.id)
    expect(activeColor(drawing, firstColor)?.id).toBe(2)
    expect(activeColor(drawing, firstColor.slice(0, -1))?.id).toBe(1)
    expect(
      activeColor(drawing, ordered.map((region) => region.id).slice(0, -1))?.id,
    ).toBe(8)
  })
})

describe('safe, versioned persistence', () => {
  it('restores valid partially completed history and keeps revision-specific keys', () => {
    const history = ordered.slice(0, 8).map((region) => region.id)
    expect(decodeProgress(drawing, serialized(history))?.history).toEqual(
      history,
    )
    expect(storageKey(drawing)).not.toBe(
      storageKey({ ...drawing, revision: 2 }),
    )
  })
  it.each([
    null,
    '',
    '{bad json',
    '{}',
    serialized(['unknown']),
    serialized(['cloud-left']),
    serialized(['sun', 'sun']),
    serialized([42]),
    serialized([], 99),
    JSON.stringify({ version: 1, history: [], updatedAt: 'bad' }),
  ])('ignores malformed, incompatible, and illegal progress: %s', (raw) => {
    expect(decodeProgress(drawing, raw)).toBeNull()
  })
})

describe('drawing data contracts', () => {
  it('keeps the test SVG separate from all official catalog designs', () => {
    expect(drawing.kind).toBe('test')
    expect(officialCatalog.map((item) => item.colorCount)).toEqual([
      28, 28, 28, 28, 28,
    ])
    expect(officialCatalog.map((item) => item.id)).not.toContain(drawing.id)
  })
  it('has unique IDs, closed paths and usable colors with at least one region per color', () => {
    expect(new Set(drawing.regions.map((region) => region.id)).size).toBe(
      drawing.regions.length,
    )
    expect(drawing.regions).toHaveLength(25)
    expect(drawing.colors).toHaveLength(8)
    for (const region of drawing.regions) {
      expect(region.d).toMatch(/Z$/)
      expect(drawing.colors.some((color) => color.id === region.colorId)).toBe(
        true,
      )
      expect(region.label[0]).toBeGreaterThan(0)
      expect(region.label[1]).toBeGreaterThan(0)
    }
    for (const color of drawing.colors)
      expect(
        drawing.regions.some((region) => region.colorId === color.id),
      ).toBe(true)
  })
})
