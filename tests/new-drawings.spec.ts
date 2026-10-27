import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { newDrawings, officialCatalog, type Drawing } from '../src/data/drawings'
import { storageKey } from '../src/engine'

async function open(page: Page, drawing: Drawing) {
  await page.goto('./')
  await page.getByRole('button', { name: `${drawing.title}, 28색, 색칠하기`, exact: true }).tap()
}
async function touch(page: Page, drawing: Drawing, id: string) {
  const region = drawing.regions.find(r => r.id === id)!
  const node = page.locator(`[data-region="${id}"]`)
  await node.scrollIntoViewIfNeeded()
  const point = await node.evaluate((el, label) => {
    const p = new DOMPoint(...label).matrixTransform(el.closest('svg')!.getScreenCTM()!)
    return { x:p.x, y:p.y, hit:document.elementFromPoint(p.x,p.y)?.getAttribute('data-region') }
  }, region.label)
  expect(point.hit, `${drawing.id}/${id} number must hit its own cell`).toBe(id)
  await page.touchscreen.tap(point.x, point.y)
}

test('five playable designs replace the old catalog and legacy local progress is removed', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('coloring:v1:rainbow-child:r2', '{}')
    localStorage.setItem('unrelated-setting', 'keep')
  })
  await page.goto('./')
  await expect(page.locator('.catalog-card')).toHaveCount(5)
  await expect(page.getByRole('button', { name: /도안 준비 중/ })).toHaveCount(0)
  await expect(page.getByText('무지개를 바라보는 아이')).toHaveCount(0)
  for (const item of officialCatalog)
    await expect(page.getByRole('button', { name:`${item.title}, 28색, 색칠하기`, exact:true })).toBeEnabled()
  expect(await page.evaluate(() => localStorage.getItem('coloring:v1:rainbow-child:r2'))).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('unrelated-setting'))).toBe('keep')
  await page.screenshot({ path:'docs/new-drawings/home-tablet.png', fullPage:true })
})

for (const drawing of newDrawings) {
  test(`${drawing.id}: every independent cell, all 28 steps, PNG and offline resume`, async ({ page, context }) => {
    test.setTimeout(180000)
    const errors: string[]=[]
    page.on('pageerror', e => errors.push(e.message))
    await open(page, drawing)
    await expect(page.locator('[data-region]')).toHaveCount(drawing.regions.length)
    const svg=page.locator('.canvas-panel svg')
    expect(await svg.getAttribute('viewBox')).toBe('0 0 800 1000')
    await page.screenshot({ path:`docs/new-drawings/${drawing.id}-start.png`, fullPage:true })
    // Wrong-color taps never paint, and number points belong to their own path.
    const later=drawing.regions.find(r=>r.colorId===2)!
    await touch(page,drawing,later.id)
    await expect(page.locator('[data-painted=true]')).toHaveCount(0)
    for (const color of drawing.colors) {
      await expect(page.locator('.palette [aria-current=step]')).toHaveText(String(color.id))
      const chipVisible = await page.locator('.palette [aria-current=step]').evaluate(el=>{
        const a=el.getBoundingClientRect(),b=el.parentElement!.getBoundingClientRect()
        return a.left>=b.left && a.right<=b.right
      })
      expect(chipVisible).toBe(true)
      for (const r of drawing.regions.filter(r=>r.colorId===color.id)) {
        await touch(page,drawing,r.id)
        await expect(page.locator(`[data-region="${r.id}"]`)).toHaveAttribute('data-painted','true')
      }
    }
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','100')
    await expect(page.getByRole('dialog')).toBeVisible()
    const promise=page.waitForEvent('download')
    await page.getByRole('button',{name:'내 그림 저장하기'}).tap()
    const download=await promise
    const bytes=await readFile((await download.path())!)
    expect(bytes.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(bytes.readUInt32BE(16)).toBe(1200)
    expect(bytes.readUInt32BE(20)).toBe(1500)
    await download.saveAs(`docs/new-drawings/${drawing.id}-complete.png`)
    expect(await svg.locator('image,linearGradient,radialGradient').count()).toBe(0)
    expect(new Set(await svg.locator('[data-region]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('fill')))).size).toBe(28)
    // Offline app shell includes every new vector puzzle, with isolated saved progress.
    await page.evaluate(async()=>{ await navigator.serviceWorker.ready })
    await context.setOffline(true)
    await page.reload()
    await page.getByRole('button',{name:`${drawing.title}, 28색, 색칠하기`,exact:true}).tap()
    await expect(page.locator('[data-painted=true]')).toHaveCount(drawing.regions.length)
    await page.getByRole('button',{name:'되돌리기',exact:true}).tap()
    await expect(page.locator('[data-painted=true]')).toHaveCount(drawing.regions.length-1)
    await context.setOffline(false)
    expect(errors).toEqual([])
  })

  test(`${drawing.id}: small mobile, hint, zoom, undo, reset and saved resume`, async ({page})=>{
    await page.setViewportSize({width:360,height:800})
    await open(page,drawing)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    const stage=(await page.locator('.canvas-scroll').boundingBox())!
    const art=(await page.locator('.canvas-panel svg').boundingBox())!
    expect(art.width).toBeLessThanOrEqual(stage.width+1)
    expect(art.height).toBeLessThanOrEqual(stage.height+1)
    for(const button of await page.locator('main button').all()) {
      const box=(await button.boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.width).toBeGreaterThanOrEqual(44)
    }
    await page.getByRole('button',{name:'확대',exact:true}).tap()
    await expect(page.getByRole('button',{name:'원래 크기로'})).toHaveText('150%')
    await page.getByRole('button',{name:'원래 크기로'}).tap()
    const first=drawing.regions.find(r=>r.colorId===1)!
    await touch(page,drawing,first.id)
    await page.reload()
    await page.getByRole('button',{name:`${drawing.title}, 28색, 색칠하기`,exact:true}).tap()
    await expect(page.locator('[data-painted=true]')).toHaveCount(1)
    await page.getByRole('button',{name:'되돌리기',exact:true}).tap()
    await expect(page.locator('[data-painted=true]')).toHaveCount(0)
    await page.getByRole('button',{name:'힌트',exact:true}).tap()
    await expect(page.locator('[data-hint=true]')).toHaveCount(1)
    await page.getByRole('button',{name:'원래 크기로'}).tap()
    await touch(page,drawing,first.id)
    await page.getByRole('button',{name:'처음부터',exact:true}).tap()
    await page.getByRole('button',{name:'계속 칠할래요'}).tap()
    await expect(page.locator('[data-painted=true]')).toHaveCount(1)
    await page.getByRole('button',{name:'처음부터',exact:true}).tap()
    await page.getByRole('button',{name:'처음부터 칠하기'}).tap()
    await expect(page.locator('[data-painted=true]')).toHaveCount(0)
    expect(JSON.parse((await page.evaluate(key=>localStorage.getItem(key),storageKey(drawing)))!).history).toEqual([])
    await page.screenshot({path:`docs/new-drawings/${drawing.id}-mobile.png`,fullPage:true})
  })
}
