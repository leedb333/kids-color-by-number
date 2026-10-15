import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Copies the real files byte-for-byte. Never substitute a generated image for an original.
const paths = process.argv.slice(2)
if (paths.length !== 2) {
  console.error(
    'Usage: node scripts/import-rainbow-sources.mjs <color.png> <outline.png>',
  )
  process.exit(1)
}
const target = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../public/assets/source/rainbow-child',
)
const names = ['color-reference.png', 'outline-reference.png']
const entries = paths.map((path, index) => {
  const bytes = readFileSync(path)
  if (
    bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    bytes.length < 33 ||
    bytes.subarray(12, 16).toString() !== 'IHDR'
  )
    throw new Error(`Not a PNG file: ${path}`)
  if (existsSync(resolve(target, names[index])))
    throw new Error(`Destination already exists: ${names[index]}`)
  return {
    name: names[index],
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
})
if (existsSync(resolve(target, 'sources.json')))
  throw new Error('Source manifest already exists')
mkdirSync(target, { recursive: true })
paths.forEach((path, index) =>
  copyFileSync(path, resolve(target, names[index]), constants.COPYFILE_EXCL),
)
writeFileSync(
  resolve(target, 'sources.json'),
  JSON.stringify({ drawingId: 'rainbow-child', files: entries }, null, 2) +
    '\n',
  { flag: 'wx' },
)
console.log(
  'Original PNGs copied without modification. Manifest includes dimensions and SHA-256 checksums.',
)
