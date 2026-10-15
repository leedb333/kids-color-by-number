import { forwardRef } from 'react'
import type { Drawing } from './data/drawings'

interface Props {
  drawing: Drawing
  history: string[]
  activeId?: number
  hintId?: string
  onPaint?: (id: string) => void
  preview?: boolean
}

export const Artwork = forwardRef<SVGSVGElement, Props>(function Artwork(
  { drawing, history, activeId, hintId, onPaint, preview = false },
  ref,
) {
  const painted = new Set(history)
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={drawing.viewBox.join(' ')}
      role="group"
      aria-label={
        preview ? '테스트 도안 미리보기' : `${drawing.title} 색칠 도안`
      }
      className="artwork"
    >
      <rect
        x={drawing.viewBox[0]}
        y={drawing.viewBox[1]}
        width={drawing.viewBox[2]}
        height={drawing.viewBox[3]}
        rx="20"
        fill="#fffdf5"
      />
      <g
        fill="none"
        stroke="#514c43"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {drawing.decorations?.map((item, index) => (
          <path key={index} d={item.d} stroke={item.stroke} />
        ))}
      </g>
      {drawing.regions.map((region) => {
        const color = drawing.colors.find((item) => item.id === region.colorId)!
        const filled = preview || painted.has(region.id)
        const target = !filled && region.colorId === activeId
        const interactive = !!onPaint && !filled
        return (
          <g key={region.id}>
            <path
              d={region.d}
              data-region={region.id}
              data-color={region.colorId}
              data-painted={filled}
              data-current={target}
              data-hint={region.id === hintId}
              fill={filled ? color.hex : '#fffefb'}
              stroke="#514c43"
              strokeWidth="3"
              strokeLinejoin="round"
              className={`paint-region ${target ? 'is-current' : ''} ${region.id === hintId ? 'is-hint' : ''}`}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={
                interactive
                  ? `${region.colorId}번 ${color.name} 영역 ${region.id}`
                  : undefined
              }
              onClick={() => onPaint?.(region.id)}
              onKeyDown={(event) => {
                if (
                  interactive &&
                  (event.key === 'Enter' || event.key === ' ')
                ) {
                  event.preventDefault()
                  onPaint(region.id)
                }
              }}
            />
            {!filled && (
              <text
                x={region.label[0]}
                y={region.label[1]}
                data-guide="true"
                textAnchor="middle"
                dominantBaseline="central"
                pointerEvents="none"
                fill={target ? '#9b5d16' : '#8c8b80'}
                fontFamily="sans-serif"
                fontSize="20"
                fontWeight="700"
              >
                {region.colorId}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
})
