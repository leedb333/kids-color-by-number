/** Self-contained so Playwright can serialize it into the browser. */
export async function measurePoliceFidelity({
  png,
  svg,
}: {
  png: string
  svg: string
}) {
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
  const vector = await pixels('data:image/svg+xml;base64,' + btoa(svg))
  const a = new Uint8Array(width * height),
    b = new Uint8Array(width * height)
  for (let i = 0; i < a.length; i++) {
    a[i] = Number(
      Math.min(original[i * 4], original[i * 4 + 1], original[i * 4 + 2]) < 128,
    )
    b[i] = Number(
      Math.min(vector[i * 4], vector[i * 4 + 1], vector[i * 4 + 2]) < 128,
    )
  }
  const boxes: Record<string, number[]> = {
    full: [0, 0, 800, 999],
    carFace: [210, 60, 455, 150],
    robotFace: [372, 436, 515, 534],
    leftArm: [100, 445, 340, 770],
    rightArm: [540, 470, 750, 700],
    legs: [140, 690, 713, 985],
    carFrontWheel: [360, 195, 486, 347],
    carRearWheel: [575, 195, 682, 330],
    robotWheel: [436, 816, 509, 940],
  }
  const result: Record<
    string,
    { iou: number; withinOnePixel: number; sourceInk: number }
  > = {}
  for (const [name, [x0, y0, x1, y1]] of Object.entries(boxes)) {
    let intersection = 0,
      union = 0,
      sourceInk = 0,
      near = 0
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * width + x
        if (a[i] && b[i]) intersection++
        if (a[i] || b[i]) union++
        if (!a[i]) continue
        sourceInk++
        let hit = false
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if (
              x + dx >= 0 &&
              x + dx < width &&
              y + dy >= 0 &&
              y + dy < height &&
              b[i + dy * width + dx]
            )
              hit = true
        if (hit) near++
      }
    result[name] = {
      iou: intersection / union,
      withinOnePixel: near / sourceInk,
      sourceInk,
    }
  }
  return result
}
