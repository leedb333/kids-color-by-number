import type { Drawing } from './data/drawings'

export function activeColor(drawing: Drawing, history: string[]) {
  const painted = new Set(history)
  return drawing.colors.find((color) =>
    drawing.regions.some(
      (region) => region.colorId === color.id && !painted.has(region.id),
    ),
  )
}

export function paint(
  drawing: Drawing,
  history: string[],
  regionId: string,
): string[] {
  const region = drawing.regions.find((item) => item.id === regionId)
  if (
    !region ||
    history.includes(regionId) ||
    region.colorId !== activeColor(drawing, history)?.id
  )
    return history
  return [...history, regionId]
}

export function progress(drawing: Drawing, history: string[]) {
  return Math.round((history.length / drawing.regions.length) * 100)
}

export const storageKey = (drawing: Drawing) =>
  `coloring:v1:${drawing.id}:r${drawing.revision}`
export interface SavedProgress {
  history: string[]
  updatedAt: string
}

// Validate both shape and legal color order; corrupted/future-version data is ignored.
export function decodeProgress(
  drawing: Drawing,
  raw: string | null,
): SavedProgress | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (
      !value ||
      typeof value !== 'object' ||
      !('history' in value) ||
      !('version' in value) ||
      value.version !== 1 ||
      !Array.isArray(value.history) ||
      !('updatedAt' in value) ||
      typeof value.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(value.updatedAt))
    )
      return null
    let accepted: string[] = []
    for (const id of value.history) {
      if (typeof id !== 'string') return null
      const next = paint(drawing, accepted, id)
      if (next === accepted) return null
      accepted = next
    }
    return { history: accepted, updatedAt: value.updatedAt }
  } catch {
    return null
  }
}

export function readProgress(drawing: Drawing): {
  saved: SavedProgress | null
  unavailable: boolean
} {
  try {
    return {
      saved: decodeProgress(drawing, localStorage.getItem(storageKey(drawing))),
      unavailable: false,
    }
  } catch {
    return { saved: null, unavailable: true }
  }
}

export function saveProgress(drawing: Drawing, history: string[]): boolean {
  try {
    localStorage.setItem(
      storageKey(drawing),
      JSON.stringify({
        version: 1,
        history,
        updatedAt: new Date().toISOString(),
      }),
    )
    return true
  } catch {
    return false
  }
}
