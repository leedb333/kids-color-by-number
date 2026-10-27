import { expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { newDrawings, drawings, featuredDrawing, officialCatalog } from '../drawings'
import { activeColor, paint, progress, storageKey } from '../../engine'
import { Artwork } from '../../Artwork'

it('exposes exactly five finished designs, keeping the police identity and saved key',()=>{
  expect(Object.keys(drawings)).toHaveLength(5)
  expect(officialCatalog.map(c=>c.id)).toEqual(Object.keys(drawings))
  expect(featuredDrawing.id).toBe('police-car-robot')
  expect(storageKey(featuredDrawing)).toBe('coloring:v1:police-car-robot:r1')
  expect(drawings['rainbow-child']).toBeUndefined()
})
for(const drawing of newDrawings) it(`${drawing.id}: closed independent regions, 28 flat fills and legal complete history`,()=>{
  expect(drawing.colors).toHaveLength(28)
  expect(new Set(drawing.colors.map(c=>c.hex)).size).toBe(28)
  expect(new Set(drawing.regions.map(r=>r.id)).size).toBe(drawing.regions.length)
  let history:string[]=[]
  for(const c of drawing.colors) {
    expect(c.hex).toMatch(/^#[A-F0-9]{6}$/)
    expect(activeColor(drawing,history)?.id).toBe(c.id)
    const regions=drawing.regions.filter(r=>r.colorId===c.id)
    expect(regions.length).toBeGreaterThan(0)
    for(const r of regions) {
      expect(r.d).toMatch(/Z$/)
      expect(r.fill).toBe(c.hex)
      expect(r.touchRadius).toBeGreaterThanOrEqual(6)
      expect(r.label[0]).toBeGreaterThanOrEqual(0)
      expect(r.label[1]).toBeGreaterThanOrEqual(0)
      const next=paint(drawing,history,r.id)
      expect(next.length).toBe(history.length+1)
      history=next
    }
  }
  expect(activeColor(drawing,history)).toBeUndefined()
  expect(progress(drawing,history)).toBe(100)
  const svg=renderToStaticMarkup(createElement(Artwork,{drawing,history}))
  expect(svg).not.toMatch(/<image|linearGradient|radialGradient|opacity=/)
  const folder=`public/assets/source/${drawing.id}`
  const manifest=JSON.parse(readFileSync(`${folder}/manifest.json`,'utf8'))
  expect(createHash('sha256').update(readFileSync(`${folder}/generated-reference.png`)).digest('hex')).toBe(manifest.sourceSha256)
})
