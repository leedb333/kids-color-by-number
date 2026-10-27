// Render the actual app vectors for visual QA; never substitute the AI reference.
import { chromium } from '@playwright/test'
import { readFile, mkdir } from 'node:fs/promises'
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH })
try {
  const context = await browser.newContext({ viewport:{width:800,height:1280},hasTouch:true,isMobile:true })
  const page=await context.newPage()
  await mkdir('docs/new-drawings',{recursive:true})
  const items=JSON.parse(await readFile('scripts/new-drawings/config.json','utf8'))
  for(const item of items) {
    const drawing=JSON.parse(await readFile(`src/data/new-drawings/${item.id}.json`,'utf8'))
    await page.goto('http://127.0.0.1:4173/kids-color-by-number/')
    await page.evaluate(d=>{
      localStorage.setItem(`coloring:v1:${d.id}:r1`,JSON.stringify({version:1,history:d.colors.flatMap(c=>d.regions.filter(r=>r.colorId===c.id).map(r=>r.id)),updatedAt:new Date().toISOString()}))
    },drawing)
    await page.reload()
    await page.getByRole('button',{name:`${item.title}, 28색, 색칠하기`,exact:true}).tap()
    const download=page.waitForEvent('download')
    await page.getByRole('button',{name:'완성한 그림 PNG로 저장',exact:true}).tap()
    await (await download).saveAs(`docs/new-drawings/${item.id}-complete.png`)
    console.log(item.id,drawing.regions.length)
  }
  await context.close()
} finally { await browser.close() }
