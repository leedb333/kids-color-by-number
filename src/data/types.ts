/** Every paintable region is a closed SVG path with a stable ID and number position. */
export interface PaintColor {
  id: number
  name: string
  hex: string
}
export interface Region {
  id: string
  colorId: number
  /** Explicit fill is independent from the ordered color-stage ID. */
  fill?: string
  d: string
  label: [number, number]
  labelSize?: number
  touchRadius?: number
  fillRule?: 'evenodd' | 'nonzero'
}
export interface Drawing {
  id: string
  revision: number
  title: string
  kind: 'test' | 'official'
  viewBox: [number, number, number, number]
  colors: PaintColor[]
  regions: Region[]
  labelSize?: number
  strokeColor?: string
  strokeWidth?: number
  outlinePath?: string
  outlineColor?: string
  paperColor?: string
  maxZoom?: number
  decorations?: Decoration[]
}

export interface Decoration {
  d: string
  stroke: string
  fill?: string
  strokeWidth?: number
  paintWith?: string
  fillRule?: 'evenodd' | 'nonzero'
}
