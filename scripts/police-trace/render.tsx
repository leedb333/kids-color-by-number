import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import manifest from '../../src/data/police-car-robot/manifest.json'
import { Artwork } from '../../src/Artwork'
import { policeCarRobot as drawing } from '../../src/data/police-car-robot'

const folder = 'docs/police-car-robot'
mkdirSync(folder, { recursive: true })
for (const [name, history] of [
  ['start', []],
  ['complete', drawing.regions.map((region) => region.id)],
] as const) {
  // Same renderer and exact data as the app, with numbers/guides omitted for comparison.
  const svg = renderToStaticMarkup(
    createElement(Artwork, { drawing, history: [...history] }),
  ).replace(/<text\b[^>]*>[\s\S]*?<\/text>/g, '')
  writeFileSync(`${folder}/${name}.svg`, svg)
}
const rows = drawing.colors.map(
  (color) =>
    `| ${color.id} | ${color.name} | \`${color.hex}\` | ${drawing.regions.filter((region) => region.colorId === color.id).length} |`,
)
writeFileSync(
  `${folder}/palette.md`,
  `# 경찰차 로봇 변신: 실제 28색\n\n배경·윤곽 포함, 서로 다른 불투명 HEX 28개. 모든 번호가 필수 터치 영역에 사용됩니다. PNG의 경계 안티앨리어싱에서 생기는 중간 픽셀은 별도의 도안 색상이 아닙니다.\n\n| ID | 한글 이름 | 실제 채우기 HEX | 필수 영역 수 |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`,
)
console.log(
  'Rendered start/complete from common SVG data; palette has',
  new Set(drawing.regions.map((region) => region.fill)).size,
  'unique fills',
)

const excluded = manifest.nonPaintable.map(
  (cell) =>
    `| ${cell.component} | ${cell.area} | ${cell.radius} | ${cell.fill} | ${cell.label.join(', ')} |`,
)
writeFileSync(
  `${folder}/non-paintable.md`,
  `# 비색칠 요소 49개

각 원본 닫힌 공간의 목록입니다. 폭이 얇은 눈 흰자·눈빛과 작은 틈/손잡이/연결선은 상시 검정/흰색으로 보존합니다. 시작/완성에서 동일하며 다른 영역을 터치해도 바뀌지 않습니다. 별·경광등·문·전조등·얼굴·팔·다리·바퀴의 필수 면은 별도 135개 ID로 제공합니다. 작은 후미등과 입안은 제외하지 않고 힌트 확대를 지원합니다.

| 원본 공간 ID | 면적(px²) | 내부 최대 반경(px) | 고정 HEX | 원본 내부 좌표 |
| --- | --- | --- | --- | --- |
${excluded.join('\n')}
`,
)
