import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { measurePoliceFidelity } from '../../tests/police-fidelity'

const folder = 'docs/police-car-robot'
const original =
  'data:image/png;base64,' +
  readFileSync(
    'public/assets/source/police-car-robot/color-reference.png',
  ).toString('base64')
const completeText = readFileSync(`${folder}/complete.svg`, 'utf8')
const complete =
  'data:image/svg+xml;base64,' + Buffer.from(completeText).toString('base64')
const line =
  'data:image/png;base64,' +
  readFileSync(
    'public/assets/source/police-car-robot/line-reference.png',
  ).toString('base64')
const start =
  'data:image/svg+xml;base64,' +
  readFileSync(`${folder}/start.svg`).toString('base64')
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {},
)
const page = await browser.newPage({
  viewport: { width: 1280, height: 950 },
  deviceScaleFactor: 1,
})
const style =
  '<style>*{box-sizing:border-box}body{margin:24px;background:#f7f8ef;color:#354b43;font-family:system-ui,sans-serif}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}h2{font-size:19px;margin:0 0 12px}p{font-size:13px}img{display:block;width:100%;height:auto;border-radius:10px}.crop{overflow:hidden;position:relative;background:white}.crop img{position:absolute;max-width:none;width:800px;border-radius:0;transform-origin:0 0}</style>'
await page.setContent(
  style +
    `<div class="grid"><section><h2>원본 컬러 PNG</h2><img src="${original}"/></section><section><h2>공통 SVG 완성본 · 28색 · 135영역</h2><img src="${complete}"/></section></div><p>원본 윤곽 직접 추적 / 평면색으로 단순화 / 영역별 독립 터치 / 사진 배경 사용 없음</p>`,
)
await page
  .locator('img')
  .last()
  .evaluate((image) => (image as HTMLImageElement).decode())
await page.screenshot({ path: `${folder}/comparison.png`, fullPage: true })
await page.setContent(
  style +
    `<div class="grid"><section><h2>원본 흑백 PNG</h2><img src="${line}"/></section><section><h2>공통 SVG 시작 화면 · 번호/강조 제외</h2><img src="${start}"/></section></div><p>시작과 완성은 같은 SVG 영역 데이터와 앱 렌더러를 사용합니다. 고정 비색칠 장식은 검정/흰색만 사용합니다.</p>`,
)
await page
  .locator('img')
  .last()
  .evaluate((image) => (image as HTMLImageElement).decode())
await page.screenshot({ path: `${folder}/line-comparison.png`, fullPage: true })
const crops = [
  ['경찰차 얼굴', 210, 60, 455, 150],
  ['로봇 얼굴', 372, 436, 515, 534],
  ['경찰차 앞바퀴', 360, 195, 486, 347],
  ['로봇 팔', 100, 445, 340, 770],
  ['로봇 다리와 바퀴', 140, 690, 713, 985],
] as const
const content = crops
  .map(([name, x0, y0, x1, y1]) => {
    const scale = Math.min(2, 592 / (x1 - x0)),
      width = (x1 - x0) * scale,
      height = (y1 - y0) * scale
    const crop = (src: string) =>
      `<div class="crop" style="width:${width}px;height:${height}px"><img src="${src}" style="transform:translate(${-x0 * scale}px,${-y0 * scale}px) scale(${scale})"/></div>`
    return `<section><h2>${name} · 원본</h2>${crop(original)}</section><section><h2>${name} · SVG</h2>${crop(complete)}</section>`
  })
  .join('')
await page.setContent(style + `<div class="grid">${content}</div>`)
await page
  .locator('img')
  .last()
  .evaluate((image) => (image as HTMLImageElement).decode())
await page.screenshot({ path: `${folder}/details.png`, fullPage: true })
const outline =
  /<path\b(?=[^>]*data-outline="true")[^>]*(?:\/>|>[\s\S]*?<\/path>)/.exec(
    completeText,
  )![0]
// tsx preserves nested function names with this harmless authoring-only helper.
await page.evaluate('globalThis.__name = (fn) => fn')
const metrics = await page.evaluate(measurePoliceFidelity, {
  png: readFileSync(
    'public/assets/source/police-car-robot/line-reference.png',
  ).toString('base64'),
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="999">${outline}</svg>`,
})
writeFileSync(
  `${folder}/fidelity.json`,
  JSON.stringify(metrics, null, 2) + '\n',
)
console.log(metrics)
await browser.close()
