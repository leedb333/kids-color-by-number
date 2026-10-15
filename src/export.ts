export async function exportPng(svg: SVGSVGElement, filename: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const width = 1200
  const height = Math.round(
    (width * svg.viewBox.baseVal.height) / svg.viewBox.baseVal.width,
  )
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.querySelectorAll('[data-guide]').forEach((node) => node.remove())
  clone
    .querySelectorAll('[class]')
    .forEach((node) => node.removeAttribute('class'))
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: 'image/svg+xml;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('PNG canvas unavailable')
    context.drawImage(image, 0, 0)
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(new Error('PNG export failed')),
        'image/png',
      ),
    )
    const downloadUrl = URL.createObjectURL(png)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
  } finally {
    URL.revokeObjectURL(url)
  }
}
