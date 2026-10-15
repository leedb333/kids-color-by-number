import { afterEach, expect, it } from 'vitest'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const folders: string[] = []
afterEach(() => {
  for (const folder of folders.splice(0))
    rmSync(folder, { recursive: true, force: true })
})
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'rainbow-import-test-'))
  folders.push(root)
  mkdirSync(join(root, 'scripts'))
  copyFileSync(
    'scripts/import-rainbow-sources.mjs',
    join(root, 'scripts/import-rainbow-sources.mjs'),
  )
  // A tiny test fixture, never used as an artwork reference or stored in the project.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  )
  const color = join(root, 'color.png'),
    outline = join(root, 'outline.png')
  writeFileSync(color, png)
  writeFileSync(outline, png)
  const run = () =>
    spawnSync(
      process.execPath,
      [join(root, 'scripts/import-rainbow-sources.mjs'), color, outline],
      { encoding: 'utf8' },
    )
  return {
    root,
    color,
    outline,
    png,
    run,
    target: join(root, 'public/assets/source/rainbow-child'),
  }
}
it('copies supplied originals byte-for-byte, records checksums, and refuses overwrite', () => {
  const { png, run, target } = fixture()
  expect(run().status).toBe(0)
  expect(readFileSync(join(target, 'color-reference.png'))).toEqual(png)
  expect(readFileSync(join(target, 'outline-reference.png'))).toEqual(png)
  const metadata = JSON.parse(
    readFileSync(join(target, 'sources.json'), 'utf8'),
  )
  expect(metadata.files[0]).toMatchObject({
    width: 1,
    height: 1,
    sha256: createHash('sha256').update(png).digest('hex'),
  })
  expect(run().status).not.toBe(0)
  expect(readFileSync(join(target, 'color-reference.png'))).toEqual(png)
})
it('validates both PNGs before copying either input', () => {
  const { outline, run, target } = fixture()
  writeFileSync(outline, 'This is not a PNG')
  expect(run().status).not.toBe(0)
  expect(existsSync(join(target, 'color-reference.png'))).toBe(false)
  expect(existsSync(join(target, 'sources.json'))).toBe(false)
})
