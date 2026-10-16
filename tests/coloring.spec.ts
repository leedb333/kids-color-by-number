import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { featuredDrawing as drawing, testDrawing } from '../src/data/drawings'
import { storageKey } from '../src/engine'

const firstColors = drawing.regions.filter((region) => region.colorId <= 2)
const ordered = drawing.colors.flatMap((color) =>
  drawing.regions.filter((region) => region.colorId === color.id),
)
async function openDrawing(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: '색칠 시작하기' }).tap()
}
async function tapRegion(page: Page, id: string) {
  const region = drawing.regions.find((item) => item.id === id)!
  const locator = page.locator(`[data-region="${id}"]`)
  await locator.scrollIntoViewIfNeeded()
  const point = await locator.evaluate((element, label) => {
    const svg = element.closest('svg')!
    const point = new DOMPoint(label[0], label[1]).matrixTransform(
      svg.getScreenCTM()!,
    )
    return { x: point.x, y: point.y }
  }, region.label)
  await page.touchscreen.tap(point.x, point.y)
}

test('the official rainbow puzzle is featured and four future designs remain pending', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('./')
  await expect(page.getByRole('button', { name: /도안 준비 중/ })).toHaveCount(
    4,
  )
  for (const button of await page
    .getByRole('button', { name: /도안 준비 중/ })
    .all())
    await expect(button).toBeDisabled()
  await expect(page.getByRole('heading', { name: drawing.title })).toBeVisible()
  await expect(page.getByText('햇살 아래 작은 꽃')).toHaveCount(0)
  await expect(
    page.getByRole('button', {
      name: /무지개를 바라보는 아이, 25색, 색칠하기/,
    }),
  ).toBeEnabled()
  await page.screenshot({
    path: 'test-results/home-tablet.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: '색칠 시작하기' }).tap()
  await expect(page.locator('[data-region]')).toHaveCount(
    drawing.regions.length,
  )
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '0',
  )
  await page.screenshot({
    path: 'test-results/coloring-tablet.png',
    fullPage: true,
  })
  expect(errors).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('touch coloring enforces order, advances, undoes, autosaves and resumes', async ({
  page,
}) => {
  await openDrawing(page)
  await tapRegion(page, 'rainbow-red')
  await expect(page.locator('[data-region="rainbow-red"]')).toHaveAttribute(
    'data-painted',
    'false',
  )
  await expect(
    page.getByText('지금은 1번 맑은 하늘 차례예요.', { exact: false }),
  ).toBeVisible()
  for (const region of firstColors) await tapRegion(page, region.id)
  await expect(page.locator('.current-instruction strong')).toContainText(
    '무지개 빨강 차례예요',
  )
  await page.getByRole('button', { name: '되돌리기' }).tap()
  await expect(page.locator('.current-instruction strong')).toContainText(
    '구름 하양 차례예요',
  )
  const count = firstColors.length - 1
  await expect(page.locator('[data-painted=true]')).toHaveCount(count)
  await page.reload()
  await page.getByRole('button', { name: '이어서 색칠하기' }).tap()
  await expect(page.locator('[data-painted=true]')).toHaveCount(count)
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    String(Math.round((count / drawing.regions.length) * 100)),
  )
  await page.getByRole('button', { name: '도안 선택' }).tap()
  await expect(
    page.getByRole('button', { name: '이어서 색칠하기' }),
  ).toBeVisible()
})

test('zoom, accessible number controls and hints work without coloring for the child', async ({
  page,
}) => {
  await openDrawing(page)
  await page.getByRole('button', { name: '확대', exact: true }).tap()
  await expect(page.getByRole('button', { name: '원래 크기로' })).toHaveText(
    '150%',
  )
  const sizes = await page
    .locator('[data-testid=canvas-scroll]')
    .evaluate((element) => ({
      outer: element.clientHeight,
      inner: element.scrollHeight,
    }))
  expect(sizes.inner).toBeGreaterThan(sizes.outer)
  await page.getByRole('button', { name: '힌트', exact: true }).tap()
  await expect(page.getByRole('button', { name: '원래 크기로' })).toHaveText(
    '100%',
  )
  await expect(page.locator('[data-hint=true]')).toHaveCount(1)
  await expect(page.locator('[data-painted=true]')).toHaveCount(0)
  await page
    .getByRole('button', { name: '1번 맑은 하늘 영역 sky', exact: true })
    .focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-region=sky]')).toHaveAttribute(
    'data-painted',
    'true',
  )
  await expect(page.locator('[data-hint=true]')).toHaveCount(0)
})

test('reset requires confirmation, can be cancelled, and persists the cleared drawing', async ({
  page,
}) => {
  await openDrawing(page)
  await tapRegion(page, 'sky')
  await page.getByRole('button', { name: '처음부터', exact: true }).tap()
  await page.getByRole('button', { name: '계속 칠할래요' }).tap()
  await expect(page.locator('[data-painted=true]')).toHaveCount(1)
  await page.getByRole('button', { name: '처음부터', exact: true }).tap()
  await page.getByRole('button', { name: '처음부터 칠하기' }).tap()
  await expect(page.locator('[data-painted=true]')).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: '색칠 시작하기' }).tap()
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '0',
  )
})

test('all regions complete by touch, celebration appears, PNG is a real colored image', async ({
  page,
}) => {
  await openDrawing(page)
  for (const region of ordered) {
    await tapRegion(page, region.id)
    await expect(page.locator(`[data-region="${region.id}"]`)).toHaveAttribute(
      'data-painted',
      'true',
    )
  }
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: '우와, 내가 완성했어요!' }),
  ).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '100',
  )
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '내 그림 저장하기' }).tap()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.png$/)
  const file = await readFile((await download.path())!)
  expect(file.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(file.readUInt32BE(16)).toBe(1200)
  expect(file.readUInt32BE(20)).toBe(1499)
  const pixel = await page.evaluate(async (data) => {
    const image = new Image()
    image.src = `data:image/png;base64,${data}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    return [
      [753, 485],
      [501, 825],
      [369, 1283],
    ].map(([x, y]) => [...context.getImageData(x, y, 1, 1).data])
  }, file.toString('base64'))
  expect(pixel).toEqual([
    [124, 207, 252, 255],
    [254, 208, 5, 255],
    [252, 69, 137, 255],
  ])
  await page.reload()
  await page.getByRole('button', { name: '완성한 그림 보기' }).tap()
  await expect(page.locator('[data-painted=true]')).toHaveCount(
    drawing.regions.length,
  )
  await page.getByRole('button', { name: '되돌리기' }).tap()
  await expect(page.getByText('미끄럼틀 분홍 차례예요')).toBeVisible()
  await expect(
    page.getByRole('button', { name: '완성하면 그림을 저장할 수 있어요' }),
  ).toBeDisabled()
})

test('production service worker supports offline reload and continued touch coloring', async ({
  page,
  context,
}) => {
  await openDrawing(page)
  await tapRegion(page, 'sky')
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
  await expect(page.getByText('오프라인 준비 완료')).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('오프라인 모드')).toBeVisible()
  await page.getByRole('button', { name: '이어서 색칠하기' }).tap()
  await expect(page.locator('[data-region=sky]')).toHaveAttribute(
    'data-painted',
    'true',
  )
  await tapRegion(page, 'cloud-left')
  await expect(page.locator('[data-painted=true]')).toHaveCount(2)
  await context.setOffline(false)
})

test('blocked localStorage degrades visibly while coloring remains usable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage blocked', 'SecurityError')
    }
  })
  await openDrawing(page)
  await tapRegion(page, 'sky')
  await expect(page.getByText('⚠ 저장 공간을 사용할 수 없어요')).toBeVisible()
  await expect(page.locator('[data-region=sky]')).toHaveAttribute(
    'data-painted',
    'true',
  )
})

test('invalid saved data is ignored and a narrow mobile screen has no overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.addInitScript(
    (key) => localStorage.setItem(key, '{broken json'),
    storageKey(drawing),
  )
  await openDrawing(page)
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '0',
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await tapRegion(page, 'sky')
  await expect(page.locator('[data-region=sky]')).toHaveAttribute(
    'data-painted',
    'true',
  )
})

test('every number marks a visible paintable area; palette follows all 25 steps', async ({
  page,
}) => {
  await openDrawing(page)
  for (const region of drawing.regions) {
    const locator = page.locator(`[data-region="${region.id}"]`)
    await locator.scrollIntoViewIfNeeded()
    const hit = await locator.evaluate((element, label) => {
      const point = new DOMPoint(...label).matrixTransform(
        element.closest('svg')!.getScreenCTM()!,
      )
      return document
        .elementFromPoint(point.x, point.y)
        ?.getAttribute('data-region')
    }, region.label)
    expect(
      hit,
      `Number for ${region.id} must be on its own exposed region`,
    ).toBe(region.id)
  }
  for (const color of drawing.colors) {
    const chip = page.locator('.palette [aria-current="step"]')
    await expect(chip).toHaveText(String(color.id))
    const visible = await chip.evaluate((element) => {
      const item = element.getBoundingClientRect()
      const container = element.parentElement!.getBoundingClientRect()
      return item.left >= container.left && item.right <= container.right
    })
    expect(
      visible,
      `Current color ${color.id} must scroll into the palette`,
    ).toBe(true)
    for (const region of drawing.regions.filter(
      (item) => item.colorId === color.id,
    ))
      await tapRegion(page, region.id)
  }
})

test('legacy test progress is kept separate from the official puzzle', async ({
  page,
}) => {
  await page.addInitScript(
    ({ legacy, official }) => {
      localStorage.setItem(
        legacy,
        JSON.stringify({
          version: 1,
          history: ['sun'],
          updatedAt: new Date().toISOString(),
        }),
      )
      localStorage.removeItem(official)
    },
    { legacy: storageKey(testDrawing), official: storageKey(drawing) },
  )
  await openDrawing(page)
  await expect(page.locator('[data-painted=true]')).toHaveCount(0)
  await tapRegion(page, 'sky')
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).history,
      storageKey(testDrawing),
    ),
  ).toEqual(['sun'])
})

test('source PNG outlines are preserved as actual SVG curves within one pixel', async ({
  page,
}) => {
  await openDrawing(page)
  const source = (
    await readFile('public/assets/source/rainbow-child/rainbow-kid-line.png')
  ).toString('base64')
  const metrics = await page.evaluate(async (png) => {
    const width = 800,
      height = 999
    async function pixels(src: string) {
      const image = new Image()
      image.src = src
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(image, 0, 0)
      return ctx.getImageData(0, 0, width, height).data
    }
    const original = await pixels('data:image/png;base64,' + png)
    const path = document.querySelector('[data-outline]')!.outerHTML
    const vector = await pixels(
      'data:image/svg+xml;base64,' +
        btoa(
          `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="999">${path}</svg>`,
        ),
    )
    const a = new Uint8Array(width * height),
      b = new Uint8Array(width * height)
    let intersection = 0,
      union = 0,
      sourceInk = 0,
      near = 0
    for (let i = 0; i < a.length; i++) {
      a[i] = Number(
        Math.min(original[i * 4], original[i * 4 + 1], original[i * 4 + 2]) <
          128,
      )
      b[i] = Number(vector[i * 4] < 128)
      if (a[i] && b[i]) intersection++
      if (a[i] || b[i]) union++
      if (a[i]) sourceInk++
    }
    for (let i = 0; i < a.length; i++) {
      if (!a[i]) continue
      const x = i % width,
        y = Math.floor(i / width)
      let hit = false
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (
            x + dx >= 0 &&
            x + dx < width &&
            y + dy >= 0 &&
            y + dy < height &&
            b[i + dy * width + dx]
          )
            hit = true
        }
      if (hit) near++
    }
    return { iou: intersection / union, withinOnePixel: near / sourceInk }
  }, source)
  expect(metrics.iou).toBeGreaterThan(0.9)
  expect(metrics.withinOnePixel).toBeGreaterThan(0.995)
  expect(await page.locator('.canvas-panel svg image').count()).toBe(0)
})

test('revision one records are retained without replaying old geometry onto revision two', async ({
  page,
}) => {
  const oldKey = storageKey({ ...drawing, revision: 1 })
  await page.addInitScript(
    ({ key, current }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          history: ['sky'],
          updatedAt: new Date().toISOString(),
        }),
      )
      localStorage.removeItem(current)
    },
    { key: oldKey, current: storageKey(drawing) },
  )
  await openDrawing(page)
  await expect(page.locator('[data-painted=true]')).toHaveCount(0)
  await tapRegion(page, 'sky')
  await page.getByRole('button', { name: '처음부터', exact: true }).tap()
  await page.getByRole('button', { name: '처음부터 칠하기' }).tap()
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).history,
      oldKey,
    ),
  ).toEqual(['sky'])
})
