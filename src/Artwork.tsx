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
        preview
          ? `${drawing.title} 완성 미리보기`
          : `${drawing.title} 색칠 도안`
      }
      className="artwork"
    >
      <rect
        x={drawing.viewBox[0]}
        y={drawing.viewBox[1]}
        width={drawing.viewBox[2]}
        height={drawing.viewBox[3]}
        rx="20"
        fill={drawing.paperColor ?? '#fffdf5'}
      />
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
              fillRule={region.fillRule}
              fill={
                filled
                  ? (region.fill ?? color.hex)
                  : (drawing.paperColor ?? '#fffefb')
              }
              stroke={drawing.strokeColor ?? '#514c43'}
              strokeWidth={drawing.strokeWidth ?? 3}
              strokeLinejoin="round"
              className={`paint-region ${target ? 'is-current' : ''} ${region.id === hintId ? 'is-hint' : ''}`}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={
                interactive
                  ? `${region.colorId}번 ${color.name} 영역 ${region.id}`
                  : undefined
              }
              onClick={interactive ? () => onPaint?.(region.id) : undefined}
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
          </g>
        )
      })}
      <g
        fill="none"
        strokeWidth={drawing.strokeWidth ?? 3}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
        aria-hidden="true"
      >
        {drawing.decorations?.map((item, index) => (
          <path
            key={index}
            d={item.d}
            stroke={item.stroke}
            fill={
              item.paintWith && !preview && !painted.has(item.paintWith)
                ? 'none'
                : (item.fill ?? 'none')
            }
            fillRule={item.fillRule}
            strokeWidth={item.strokeWidth ?? drawing.strokeWidth ?? 3}
          />
        ))}
      </g>
      {drawing.outlinePath && (
        <path
          data-outline="true"
          d={drawing.outlinePath}
          fill={drawing.outlineColor ?? '#141414'}
          fillRule="evenodd"
          pointerEvents="none"
          aria-hidden="true"
        />
      )}
      {drawing.outlinePath &&
        drawing.regions
          .filter(
            (region) =>
              !preview &&
              !painted.has(region.id) &&
              (region.colorId === activeId || region.id === hintId),
          )
          .map((region) => (
            <path
              key={`guide-${region.id}`}
              data-guide="true"
              d={region.d}
              fill="none"
              fillRule={region.fillRule}
              pointerEvents="none"
              stroke={region.id === hintId ? '#2e8357' : '#b37718'}
              strokeWidth={region.id === hintId ? 5 : 3}
              strokeDasharray="8 7"
              opacity="0.85"
            />
          ))}
      {drawing.regions
        .filter((region) => !preview && !painted.has(region.id))
        .map((region) => (
          <text
            key={`label-${region.id}`}
            x={region.label[0]}
            y={region.label[1]}
            data-guide="true"
            textAnchor="middle"
            dominantBaseline="central"
            pointerEvents="none"
            fill={region.colorId === activeId ? '#9b5d16' : '#676b61'}
            fontFamily="sans-serif"
            fontSize={region.labelSize ?? drawing.labelSize ?? 20}
            fontWeight="700"
          >
            {region.colorId}
          </text>
        ))}
    </svg>
  )
})
