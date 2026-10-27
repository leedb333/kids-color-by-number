import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { policeCarRobot as drawing } from '../src/data/police-car-robot'
import { newDrawings } from '../src/data/drawings'
import { storageKey } from '../src/engine'
import { measurePoliceFidelity } from './police-fidelity'

const ordered = drawing.colors.flatMap((color) =>
  drawing.regions.filter((region) => region.colorId === color.id),
)
const otherDrawing = newDrawings[1]
const otherFirst = otherDrawing.regions.find(r => r.colorId === 1)!
const locator = (page: Page, id: string) =>
  page.locator(`[data-region="${id}"]`)
async function open(page: Page) {
  await page.goto('./')
  await page
    .getByRole('button', {
      name: '경찰차 로봇 변신, 28색, 색칠하기',
      exact: true,
    })
    .tap()
}
async function tap(page: Page, id: string) {
  const r = drawing.regions.find((region) => region.id === id)!
  const node = locator(page, id)
  await node.scrollIntoViewIfNeeded()
  const p = await node.evaluate((el, label) => {
    const p = new DOMPoint(...label).matrixTransform(
      el.closest('svg')!.getScreenCTM()!,
    )
    return { x: p.x, y: p.y }
  }, r.label)
  await page.touchscreen.tap(p.x, p.y)
}
async function seedBefore(page: Page, color: number) {
  await page.addInitScript(
    ({ key, history }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 1,
            history,
            updatedAt: new Date().toISOString(),
          }),
        )
    },
    {
      key: storageKey(drawing),
      history: ordered.filter((r) => r.colorId < color).map((r) => r.id),
    },
  )
}

test('common SVG starts monochrome and every number belongs to its own independent cell', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await open(page)
  await expect(page.locator('[data-region]')).toHaveCount(135)
  await expect(page.locator('[data-painted=true]')).toHaveCount(0)
  expect(
    await page
      .locator('[data-region]')
      .evaluateAll((nodes) => [
        ...new Set(nodes.map((n) => n.getAttribute('fill'))),
      ]),
  ).toEqual(['#FFFFFF'])
  for (const region of drawing.regions) {
    const hit = await locator(page, region.id).evaluate((el, label) => {
      const point = new DOMPoint(...label).matrixTransform(
        el.closest('svg')!.getScreenCTM()!,
      )
      return document
        .elementFromPoint(point.x, point.y)
        ?.getAttribute('data-region')
    }, region.label)
    expect(hit, region.id).toBe(region.id)
  }
  await expect(page.locator('.canvas-panel svg image')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('one blue lightbar tap fills exactly one cell; same-color robot and legs stay untouched', async ({
  page,
}) => {
  await seedBefore(page, 7)
  await open(page)
  const before = await page
    .locator('[data-region]')
    .evaluateAll((nodes) =>
      Object.fromEntries(
        nodes.map((n) => [
          n.getAttribute('data-region')!,
          n.getAttribute('fill'),
        ]),
      ),
    )
  const count = await page.locator('[data-painted=true]').count()
  await tap(page, 'car-lightbar-blue')
  const after = await page
    .locator('[data-region]')
    .evaluateAll((nodes) =>
      Object.fromEntries(
        nodes.map((n) => [
          n.getAttribute('data-region')!,
          n.getAttribute('fill'),
        ]),
      ),
    )
  expect(Object.keys(after).filter((id) => after[id] !== before[id])).toEqual([
    'car-lightbar-blue',
  ])
  await expect(page.locator('[data-painted=true]')).toHaveCount(count + 1)
  await expect(locator(page, 'robot-lightbar-blue')).toHaveAttribute(
    'data-painted',
    'false',
  )
  await expect(locator(page, 'robot-shin-left-blue-upper')).toHaveAttribute(
    'data-painted',
    'false',
  )
  await tap(page, 'car-lightbar-blue')
  await expect(page.locator('[data-painted=true]')).toHaveCount(count + 1)
  const same = drawing.regions.filter(
    (r) => r.colorId === 7 && r.id !== 'car-lightbar-blue',
  )
  for (let i = 0; i < same.length; i++) {
    await expect(page.locator('.current-instruction strong')).toContainText(
      '경찰 파랑 차례예요',
    )
    await tap(page, same[i].id)
  }
  await expect(page.locator('.current-instruction strong')).toContainText(
    '경광등 빨강 차례예요',
  )
})

test('undo, resume and confirmed reset remain isolated from other drawing records', async ({
  page,
}) => {
  await page.addInitScript(({ key, id }) => {
    if (!localStorage.getItem(key))
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          history: [id],
          updatedAt: new Date().toISOString(),
        }),
      )
  }, { key: storageKey(otherDrawing), id: otherFirst.id })
  await open(page)
  await tap(page, 'background')
  await tap(page, 'car-lightbar-white')
  await page.getByRole('button', { name: '되돌리기', exact: true }).tap()
  await expect(page.locator('[data-painted=true]')).toHaveCount(1)
  await page.reload()
  await page
    .getByRole('button', {
      name: '경찰차 로봇 변신, 28색, 색칠하기',
      exact: true,
    })
    .tap()
  await expect(locator(page, 'background')).toHaveAttribute(
    'data-painted',
    'true',
  )
  await expect(locator(page, 'car-lightbar-white')).toHaveAttribute(
    'data-painted',
    'false',
  )
  await page.getByRole('button', { name: '처음부터', exact: true }).tap()
  await page.getByRole('button', { name: '계속 칠할래요' }).tap()
  await expect(page.locator('[data-painted=true]')).toHaveCount(1)
  await page.getByRole('button', { name: '처음부터', exact: true }).tap()
  await page.getByRole('button', { name: '처음부터 칠하기' }).tap()
  await expect(page.locator('[data-painted=true]')).toHaveCount(0)
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).history,
      storageKey(otherDrawing),
    ),
  ).toEqual([otherFirst.id])
  await page.getByRole('button', { name: '도안 선택' }).tap()
  await page.getByRole('button', { name: `${otherDrawing.title}, 28색, 색칠하기`, exact: true }).tap()
  await expect(
    page.getByRole('heading', { name: otherDrawing.title, exact: true }),
  ).toBeVisible()
  await expect(locator(page, otherFirst.id)).toHaveAttribute('data-painted', 'true')
})

test('hint zooms and centers a tiny tail light without painting it', async ({
  page,
}) => {
  await seedBefore(page, 8)
  await open(page)
  await tap(page, 'car-lightbar-red')
  const count = await page.locator('[data-painted=true]').count()
  await page.getByRole('button', { name: '힌트', exact: true }).tap()
  await expect(locator(page, 'car-tail-light')).toHaveAttribute(
    'data-hint',
    'true',
  )
  await expect
    .poll(async () =>
      Number(
        (await page
          .getByRole('button', { name: '원래 크기로' })
          .textContent())!.replace('%', ''),
      ),
    )
    .toBeGreaterThan(100)
  const r = drawing.regions.find((r) => r.id === 'car-tail-light')!
  await expect
    .poll(() =>
      locator(page, r.id).evaluate((el, label) => {
        const p = new DOMPoint(...label).matrixTransform(
          el.closest('svg')!.getScreenCTM()!,
        )
        return document.elementFromPoint(p.x, p.y)?.getAttribute('data-region')
      }, r.label),
    )
    .toBe(r.id)
  await expect(page.locator('[data-painted=true]')).toHaveCount(count)
  await tap(page, r.id)
  await expect(page.locator('[data-painted=true]')).toHaveCount(count + 1)
  await page.getByRole('button', { name: '원래 크기로' }).tap()
  await expect(page.getByRole('button', { name: '원래 크기로' })).toHaveText(
    '100%',
  )
})

test('all 135 touches complete all 28 stages, celebrate, and export exactly 28 flat SVG fills to PNG', async ({
  page,
}) => {
  test.setTimeout(120000)
  await open(page)
  for (const region of ordered) {
    const count = await page.locator('[data-painted=true]').count()
    // Exercise the supported child flow for tiny cells: hint centers and enlarges the current cell.
    await page.getByRole('button', { name: '힌트', exact: true }).tap()
    await expect(locator(page, region.id)).toHaveAttribute('data-hint', 'true')
    await expect
      .poll(() =>
        locator(page, region.id).evaluate((el, label) => {
          const point = new DOMPoint(...label).matrixTransform(
            el.closest('svg')!.getScreenCTM()!,
          )
          return document
            .elementFromPoint(point.x, point.y)
            ?.getAttribute('data-region')
        }, region.label),
      )
      .toBe(region.id)
    await tap(page, region.id)
    await expect(locator(page, region.id)).toHaveAttribute(
      'data-painted',
      'true',
    )
    await expect(page.locator('[data-painted=true]')).toHaveCount(count + 1)
  }
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '100',
  )
  const fills = await page
    .locator('.canvas-panel svg')
    .evaluate((svg) =>
      [
        ...new Set(
          [...svg.querySelectorAll('[fill]')]
            .map((el) => el.getAttribute('fill')!)
            .filter((fill) => /^#[0-9A-F]{6}$/.test(fill)),
        ),
      ].sort(),
    )
  expect(fills).toEqual(drawing.colors.map((c) => c.hex).sort())
  expect(fills).toHaveLength(28)
  await expect(
    page.locator(
      '.canvas-panel svg linearGradient, .canvas-panel svg radialGradient, .canvas-panel svg image, .canvas-panel svg [opacity]',
    ),
  ).toHaveCount(0)
  const event = page.waitForEvent('download')
  await page.getByRole('button', { name: '내 그림 저장하기' }).tap()
  const download = await event
  expect(download.suggestedFilename()).toBe('경찰차 로봇 변신.png')
  const bytes = await readFile((await download.path())!)
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(bytes.readUInt32BE(16)).toBe(1200)
  expect(bytes.readUInt32BE(20)).toBe(1499)
  const pixel = await page.evaluate(async (png) => {
    const image = new Image()
    image.src = 'data:image/png;base64,' + png
    await image.decode()
    const c = document.createElement('canvas')
    c.width = image.width
    c.height = image.height
    const ctx = c.getContext('2d')!
    ctx.drawImage(image, 0, 0)
    return [...ctx.getImageData(142, 635, 1, 1).data]
  }, bytes.toString('base64'))
  expect(pixel).toEqual([64, 187, 253, 255])
  await page.reload()
  await page
    .getByRole('button', {
      name: '경찰차 로봇 변신, 28색, 색칠하기',
      exact: true,
    })
    .tap()
  await expect(page.locator('[data-painted=true]')).toHaveCount(135)
  await page.getByRole('button', { name: '되돌리기', exact: true }).tap()
  await expect(page.locator('[data-painted=true]')).toHaveCount(134)
  await expect(page.getByRole('progressbar')).not.toHaveAttribute(
    'aria-valuenow',
    '100',
  )
})

test('police vectors reload offline and continue independently', async ({
  page,
  context,
}) => {
  await open(page)
  await tap(page, 'background')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => resolve(),
          { once: true },
        ),
      )
  })
  await context.setOffline(true)
  await page.reload()
  await page
    .getByRole('button', {
      name: '경찰차 로봇 변신, 28색, 색칠하기',
      exact: true,
    })
    .tap()
  await expect(locator(page, 'background')).toHaveAttribute(
    'data-painted',
    'true',
  )
  await tap(page, 'car-lightbar-white')
  await expect(page.locator('[data-painted=true]')).toHaveCount(2)
  await expect(locator(page, 'robot-lightbar-white')).toHaveAttribute(
    'data-painted',
    'false',
  )
})

test('actual source faces, arms, legs and wheels match traced SVG outlines', async ({
  page,
}) => {
  await open(page)
  const png = (
    await readFile('public/assets/source/police-car-robot/line-reference.png')
  ).toString('base64')
  const path = await page
    .locator('[data-outline]')
    .evaluate((el) => el.outerHTML)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="999">${path}</svg>`
  const metrics = await page.evaluate(measurePoliceFidelity, { png, svg })
  for (const [name, value] of Object.entries(metrics)) {
    expect(value.sourceInk, name).toBeGreaterThan(100)
    expect(value.iou, name).toBeGreaterThan(name === 'full' ? 0.9 : 0.85)
    expect(value.withinOnePixel, name).toBeGreaterThan(0.99)
  }
})
