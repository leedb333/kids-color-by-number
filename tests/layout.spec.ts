import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { policeCarRobot } from '../src/data/police-car-robot'

for (const [width, height] of [[800, 1280], [360, 800], [320, 568]]) {
  test(`portrait layout ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('./')
    await page.getByRole('button', { name: '경찰차 로봇 변신, 28색, 색칠하기', exact: true }).tap()
    const css = readFileSync('src/styles.css', 'utf8')
    const baseline = execFileSync('git', ['show', 'f6a09b374ffd9092d4d4d2086a8526a4ffbe469f:src/styles.css'], { encoding: 'utf8' })
    await page.locator('link[rel=stylesheet]').evaluateAll(nodes => nodes.forEach(node => node.remove()))
    const style = await page.addStyleTag({ content: baseline })
    const before = await page.locator('.canvas-panel svg').boundingBox()
    await page.screenshot({ path: `docs/layout/before-${width}.png`, fullPage: true })
    await style.evaluate((node, content) => { node.textContent = content }, css)
    const svg = page.locator('.canvas-panel svg')
    const after = await svg.boundingBox()
    console.log(JSON.stringify({ width, before, after }))
    expect(after!.height).toBeGreaterThan(before!.height)
    const stage = await page.locator('.canvas-scroll').boundingBox()
    expect(after!.x).toBeGreaterThanOrEqual(stage!.x)
    expect(after!.width).toBeLessThanOrEqual(stage!.width + 1)
    expect(after!.height).toBeLessThanOrEqual(stage!.height + 1)
    expect(after!.width / after!.height).toBeCloseTo(policeCarRobot.viewBox[2] / policeCarRobot.viewBox[3], 3)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    for (const button of await page.locator('main button').all()) {
      const box = await button.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(44)
      expect(box!.width).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({ path: `docs/layout/after-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: '확대', exact: true }).tap()
    await expect(page.getByRole('button', { name: '원래 크기로' })).toHaveText('150%')
    await page.getByRole('button', { name: '원래 크기로' }).tap()
    expect((await svg.boundingBox())!.height).toBeCloseTo(after!.height, 0)
  })
}
