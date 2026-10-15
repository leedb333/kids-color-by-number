import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { testDrawing } from '../src/data/drawings'
import { storageKey } from '../src/engine'

const firstColor = testDrawing.regions.filter((region) => region.colorId === 1)
const ordered = testDrawing.colors.flatMap((color) =>
  testDrawing.regions.filter((region) => region.colorId === color.id),
)
async function openDrawing(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: '색칠 시작하기' }).tap()
}
async function tapRegion(page: Page, id: string) {
  const region = testDrawing.regions.find((item) => item.id === id)!
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

test('five official menus are clearly pending; test SVG launches on a portrait tablet', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./')
  await expect(page.getByRole('button', { name: /도안 준비 중/ })).toHaveCount(
    5,
  )
  for (const button of await page
    .getByRole('button', { name: /도안 준비 중/ })
    .all())
    await expect(button).toBeDisabled()
  await expect(page.getByText('체험용 · 정식 승인 도안 아님')).toBeVisible()
  await page.screenshot({
    path: 'test-results/home-tablet.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: '색칠 시작하기' }).tap()
  await expect(page.locator('[data-region]')).toHaveCount(25)
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
  await tapRegion(page, 'cloud-left')
  await expect(page.locator('[data-region="cloud-left"]')).toHaveAttribute(
    'data-painted',
    'false',
  )
  await expect(
    page.getByText('지금은 1번 햇살 노랑 차례예요.', { exact: false }),
  ).toBeVisible()
  for (const region of firstColor) await tapRegion(page, region.id)
  await expect(
    page.getByText('하늘 파랑 차례예요', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: '되돌리기' }).tap()
  await expect(
    page.getByText('햇살 노랑 차례예요', { exact: true }),
  ).toBeVisible()
  const count = firstColor.length - 1
  await expect(page.locator('[data-painted=true]')).toHaveCount(count)
  await page.reload()
  await page.getByRole('button', { name: '이어서 색칠하기' }).tap()
  await expect(page.locator('[data-painted=true]')).toHaveCount(count)
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    String(Math.round((count / 25) * 100)),
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
    .getByRole('button', { name: '1번 햇살 노랑 영역 sun', exact: true })
    .focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-region=sun]')).toHaveAttribute(
    'data-painted',
    'true',
  )
  await expect(page.locator('[data-hint=true]')).toHaveCount(0)
})

test('reset requires confirmation, can be cancelled, and persists the cleared drawing', async ({
  page,
}) => {
  await openDrawing(page)
  await tapRegion(page, 'sun')
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
  expect(file.readUInt32BE(20)).toBe(1240)
  const pixel = await page.evaluate(async (data) => {
    const image = new Image()
    image.src = `data:image/png;base64,${data}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    return [...context.getImageData(220, 210, 1, 1).data]
  }, file.toString('base64'))
  expect(pixel).toEqual([255, 207, 74, 255])
  await page.reload()
  await page.getByRole('button', { name: '완성한 그림 보기' }).tap()
  await expect(page.locator('[data-painted=true]')).toHaveCount(25)
  await page.getByRole('button', { name: '되돌리기' }).tap()
  await expect(page.getByText('화분 주황 차례예요')).toBeVisible()
  await expect(
    page.getByRole('button', { name: '완성하면 그림을 저장할 수 있어요' }),
  ).toBeDisabled()
})

test('production service worker supports offline reload and continued touch coloring', async ({
  page,
  context,
}) => {
  await openDrawing(page)
  await tapRegion(page, 'sun')
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
  await expect(page.locator('[data-region=sun]')).toHaveAttribute(
    'data-painted',
    'true',
  )
  await tapRegion(page, 'ray-top')
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
  await tapRegion(page, 'sun')
  await expect(page.getByText('⚠ 저장 공간을 사용할 수 없어요')).toBeVisible()
  await expect(page.locator('[data-region=sun]')).toHaveAttribute(
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
    storageKey(testDrawing),
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
  await tapRegion(page, 'sun')
  await expect(page.locator('[data-region=sun]')).toHaveAttribute(
    'data-painted',
    'true',
  )
})
