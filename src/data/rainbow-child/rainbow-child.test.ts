import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import manifest from './trace-manifest.json'
import { rainbowChild as drawing } from './index'
import {
  drawings,
  featuredDrawing,
  officialCatalog,
  testDrawing,
} from '../drawings'
import {
  activeColor,
  decodeProgress,
  paint,
  progress,
  storageKey,
} from '../../engine'

const ordered = drawing.colors.flatMap((color) =>
  drawing.regions.filter((region) => region.colorId === color.id),
)

describe('official rainbow puzzle', () => {
  it('is the featured playable design with 25 colors and 37 source-traced regions', () => {
    expect(drawing.kind).toBe('official')
    expect(featuredDrawing).toBe(drawing)
    expect(drawings[drawing.id]).toBe(drawing)
    expect(drawings[testDrawing.id]).toBeUndefined()
    expect(drawing.title).toBe('무지개를 바라보는 아이')
    expect(drawing.colors.map((color) => color.id)).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 1),
    )
    expect(
      officialCatalog.find((item) => item.id === drawing.id)?.colorCount,
    ).toBe(drawing.colors.length)
    expect(drawing.regions).toHaveLength(37)
    expect(new Set(drawing.regions.map((region) => region.id)).size).toBe(37)
    for (const path of [...drawing.regions, ...(drawing.decorations ?? [])]) {
      expect(path.d).toMatch(/^M[MmZzLlHhVvCcSsQqTtAa0-9eE ,.+-]+$/)
    }
    for (const region of drawing.regions) {
      expect(region.d).toMatch(/Z$/)
      expect(drawing.colors.some((color) => color.id === region.colorId)).toBe(
        true,
      )
      expect(region.label[0]).toBeGreaterThan(0)
      expect(region.label[0]).toBeLessThan(drawing.viewBox[2])
      expect(region.label[1]).toBeGreaterThan(0)
      expect(region.label[1]).toBeLessThan(drawing.viewBox[3])
    }
  })
  it('never advances over an incomplete color and completes all 25 steps', () => {
    let history: string[] = []
    for (const color of drawing.colors) {
      const regions = drawing.regions.filter(
        (region) => region.colorId === color.id,
      )
      expect(regions.length).toBeGreaterThan(0)
      for (const region of regions) {
        expect(activeColor(drawing, history)?.id).toBe(color.id)
        history = paint(drawing, history, region.id)
      }
    }
    expect(history).toHaveLength(37)
    expect(progress(drawing, history)).toBe(100)
    expect(activeColor(drawing, history)).toBeUndefined()
  })
  it('rejects out-of-order taps and reverses the last completed color', () => {
    const empty: string[] = []
    expect(paint(drawing, empty, 'boot-left')).toBe(empty)
    const all = ordered.map((region) => region.id)
    expect(activeColor(drawing, all.slice(0, -1))?.id).toBe(25)
  })
  it('round-trips official progress without reusing test or old revision data', () => {
    const history = ordered.slice(0, 18).map((region) => region.id)
    const raw = JSON.stringify({
      version: 1,
      history,
      updatedAt: new Date().toISOString(),
    })
    expect(decodeProgress(drawing, raw)?.history).toEqual(history)
    expect(storageKey(drawing)).not.toBe(storageKey(testDrawing))
    expect(storageKey(drawing)).not.toBe(
      storageKey({ ...drawing, revision: drawing.revision + 1 }),
    )
  })
  it('keeps small decorative trim out of the playable targets', () => {
    expect(
      drawing.regions.some((region) =>
        /eye|sole|button|finger/.test(region.id),
      ),
    ).toBe(false)
    for (const decoration of drawing.decorations ?? []) {
      if (decoration.paintWith)
        expect(
          drawing.regions.some((region) => region.id === decoration.paintWith),
        ).toBe(true)
    }
  })
})

it('keeps source provenance and an isolated geometry revision', () => {
  expect(drawing.revision).toBe(2)
  expect(drawing.viewBox).toEqual([0, 0, 800, 999])
  expect(drawing.outlinePath).toMatch(/^M/)
  expect(drawing.outlinePath).not.toMatch(/data:image|<image|base64/)
  expect(manifest.regionCount).toBe(drawing.regions.length)
  expect(manifest.colorCount).toBe(drawing.colors.length)
  const components = manifest.regions.flatMap((region) => region.components)
  expect(new Set(components).size).toBe(manifest.sourceComponents)
  expect(components).toHaveLength(manifest.sourceComponents)
  for (const source of manifest.sourceFiles) {
    const bytes = readFileSync(
      `public/assets/source/rainbow-child/${source.name}`,
    )
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256)
    expect(bytes.readUInt32BE(16)).toBe(source.width)
    expect(bytes.readUInt32BE(20)).toBe(source.height)
  }
  for (const region of manifest.regions)
    expect(region.labelRadius).toBeGreaterThanOrEqual(12)
})
