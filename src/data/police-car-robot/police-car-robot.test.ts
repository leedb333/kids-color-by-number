import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Artwork } from '../../Artwork'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { policeCarRobot as drawing } from './index'
import manifest from './manifest.json'
import {
  activeColor,
  decodeProgress,
  paint,
  progress,
  storageKey,
} from '../../engine'
import { rainbowChild } from '../rainbow-child'
import { drawings } from '../drawings'

const ordered = drawing.colors.flatMap((color) =>
  drawing.regions.filter((region) => region.colorId === color.id),
)

describe('28-color police car robot contract', () => {
  it('uses exactly 28 distinct, opaque fills, including background and ink', () => {
    expect(drawing.colors.map((color) => color.id)).toEqual(
      Array.from({ length: 28 }, (_, i) => i + 1),
    )
    const codes = new Set(drawing.colors.map((color) => color.hex))
    expect(codes.size).toBe(28)
    expect(new Set(drawing.regions.map((region) => region.fill))).toEqual(codes)
    expect(
      drawing.regions.find((region) => region.id === 'background')?.colorId,
    ).toBe(1)
    expect(codes.has(drawing.outlineColor!)).toBe(true)
    expect(codes.has(drawing.paperColor!)).toBe(true)
    for (const region of drawing.regions) {
      expect(region.fill).toMatch(/^#[0-9A-F]{6}$/)
      expect(region.fill).toBe(
        drawing.colors.find((color) => color.id === region.colorId)?.hex,
      )
    }
  })
  it('has a distinct ID for every mandatory cell and never links automatic child fills', () => {
    expect(drawing.regions).toHaveLength(135)
    expect(new Set(drawing.regions.map((region) => region.id)).size).toBe(135)
    expect(drawing.decorations?.some((detail) => detail.paintWith)).toBe(false)
    for (const detail of drawing.decorations ?? [])
      expect(['#000000', '#FFFFFF']).toContain(detail.fill)
    expect(
      drawing.regions.find((region) => region.id === 'car-door-front'),
    ).not.toBe(drawing.regions.find((region) => region.id === 'car-door-star'))
    expect(manifest.nonPaintable).toHaveLength(49)
    const main = manifest.regions.filter((region) => !('source' in region))
    expect(new Set(main.map((region) => region.component)).size).toBe(
      main.length,
    )
    expect(main.length + manifest.nonPaintable.length).toBe(
      manifest.sourceComponents,
    )
    expect(
      manifest.regions
        .filter((region) => 'source' in region)
        .map((region) => region.id),
    ).toEqual(['car-headlight-left-bulb'])
  })
  it('touching one cell changes exactly one ID, even with many same-color cells', () => {
    let history: string[] = []
    for (const color of drawing.colors) {
      const cells = drawing.regions.filter(
        (region) => region.colorId === color.id,
      )
      expect(cells.length).toBeGreaterThan(0)
      for (let index = 0; index < cells.length; index++) {
        const before = history.slice()
        expect(activeColor(drawing, history)?.id).toBe(color.id)
        const next = paint(drawing, history, cells[index].id)
        expect(next.filter((id) => !history.includes(id))).toEqual([
          cells[index].id,
        ])
        expect(history).toEqual(before)
        history = next
        if (index < cells.length - 1)
          expect(activeColor(drawing, history)?.id).toBe(color.id)
      }
      expect(activeColor(drawing, history)?.id).toBe(
        color.id < 28 ? color.id + 1 : undefined,
      )
    }
    expect(history).toHaveLength(135)
    expect(progress(drawing, history)).toBe(100)
  })
  it('keeps the car and robot lightbars independent within the same blue step', () => {
    const history = ordered
      .filter((region) => region.colorId < 7)
      .map((region) => region.id)
    const after = paint(drawing, history, 'car-lightbar-blue')
    expect(after).toContain('car-lightbar-blue')
    expect(after).not.toContain('robot-lightbar-blue')
    expect(activeColor(drawing, after)?.id).toBe(7)
    expect(paint(drawing, after, 'car-lightbar-blue')).toBe(after)
    expect(paint(drawing, after, 'car-lightbar-red')).toBe(after)
  })
  it('can undo the final cell, reset to empty, and restore a full valid history', () => {
    const all = ordered.map((region) => region.id)
    expect(activeColor(drawing, all)).toBeUndefined()
    expect(activeColor(drawing, all.slice(0, -1))?.id).toBe(28)
    expect(activeColor(drawing, [])?.id).toBe(1)
    expect(
      decodeProgress(
        drawing,
        JSON.stringify({
          version: 1,
          history: all,
          updatedAt: new Date().toISOString(),
        }),
      )?.history,
    ).toEqual(all)
  })
  it('preserves rainbow IDs, revision, and storage keys', () => {
    expect(drawings['rainbow-child']).toBe(rainbowChild)
    expect(rainbowChild.revision).toBe(2)
    expect(storageKey(rainbowChild)).toBe('coloring:v1:rainbow-child:r2')
    expect(storageKey(drawing)).toBe('coloring:v1:police-car-robot:r1')
    expect(storageKey(drawing)).not.toBe(storageKey(rainbowChild))
  })
  it('records the real original hashes and preserves explicit region boundaries', () => {
    for (const source of manifest.sources) {
      const bytes = readFileSync(
        `public/assets/source/police-car-robot/${source.file}`,
      )
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        source.sha256,
      )
      expect(bytes.readUInt32BE(16)).toBe(800)
      expect(bytes.readUInt32BE(20)).toBe(999)
    }
    for (const region of drawing.regions) {
      expect(region.d).toMatch(/^M/)
      expect(region.d).toMatch(/Z$/)
      expect(region.d).not.toMatch(/image|base64/)
      expect(region.touchRadius).toBeGreaterThan(3)
    }
    expect(manifest.uniqueFlatColors).toBe(28)
  })
})

it('renders start and completion from exactly the same 135 SVG paths', () => {
  const start = renderToStaticMarkup(
    createElement(Artwork, { drawing, history: [] }),
  )
  const finish = renderToStaticMarkup(
    createElement(Artwork, {
      drawing,
      history: drawing.regions.map((region) => region.id),
    }),
  )
  const paths = (svg: string) =>
    [
      ...svg.matchAll(
        /<path(?=[^>]*data-region="([^"]+)")(?=[^>]* d="([^"]+)")[^>]*>/g,
      ),
    ].map((match) => [match[1], match[2]])
  expect(paths(start)).toHaveLength(135)
  expect(paths(finish)).toEqual(paths(start))
  expect(start.match(/data-painted="true"/g) || []).toHaveLength(0)
  expect(finish.match(/data-painted="true"/g)).toHaveLength(135)
  expect(finish).not.toMatch(/<image|<linearGradient|<radialGradient|opacity=/)
})
