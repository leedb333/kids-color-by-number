import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Artwork } from './Artwork'
import {
  drawings,
  officialCatalog,
  featuredDrawing,
  type Drawing,
} from './data/drawings'
import {
  activeColor,
  paint,
  progress,
  readProgress,
  saveProgress,
} from './engine'
import { exportPng } from './export'

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  )
}

function Home({ onOpen }: { onOpen: (drawing: Drawing) => void }) {
  const { saved } = readProgress(featuredDrawing)
  const count = saved?.history.length ?? 0
  return (
    <main className="home">
      <section className="welcome">
        <span className="eyebrow">나만의 작은 색칠 시간</span>
        <h1>
          한 칸, 한 칸.
          <br />내 손으로 만드는 <span>알록달록!</span>
        </h1>
        <p>
          같은 숫자를 찾아 톡!
          <br className="mobile-break" /> 하나씩 칠하다 보면 멋진 그림이
          완성돼요.
        </p>
      </section>
      <section className="featured-card" aria-labelledby="featured-title">
        <div className="featured-preview">
          <Artwork drawing={featuredDrawing} history={[]} preview />
          <span className="preview-caption">색칠하면 이렇게 변해요</span>
        </div>
        <div className="featured-copy">
          <span className="badge">첫 번째 정식 도안 · 무지개 놀이터</span>
          <h2 id="featured-title">{featuredDrawing.title}</h2>
          <p>
            무지개 아래, 노란 우비를 입은 아이!
            <br />
            {featuredDrawing.colors.length}가지 색으로 놀이터를 채워 볼까요?
          </p>
          <span className="details">
            {featuredDrawing.colors.length}색 <span>·</span>{' '}
            {featuredDrawing.regions.length}개 영역 <span>·</span> 터치 SVG
          </span>
          {count > 0 && (
            <div className="saved-summary">
              {count === featuredDrawing.regions.length
                ? '완성한 그림이 있어요!'
                : `${progress(featuredDrawing, saved!.history)}%까지 칠했어요. 이어서 해 볼까요?`}
            </div>
          )}
          <button
            className="button primary start-button"
            onClick={() => onOpen(featuredDrawing)}
          >
            {count > 0
              ? count === featuredDrawing.regions.length
                ? '완성한 그림 보기'
                : '이어서 색칠하기'
              : '색칠 시작하기'}{' '}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
      <section className="catalog" aria-labelledby="catalog-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">나의 색칠 그림책</span>
            <h2 id="catalog-title">어떤 그림을 좋아하나요?</h2>
          </div>
          <span className="count-badge">{officialCatalog.length}개 도안</span>
        </div>
        <p className="catalog-note">
          무지개와 경찰차 로봇을 골라 보세요. 나머지 네 그림도 차례로
          준비할게요.
        </p>
        <div className="catalog-grid">
          {officialCatalog.map((item) => (
            <button
              type="button"
              disabled={
                !drawings[item.id] || drawings[item.id].kind !== 'official'
              }
              onClick={() => {
                if (drawings[item.id]?.kind === 'official')
                  onOpen(drawings[item.id])
              }}
              className={`catalog-card ${item.tint}`}
              key={item.id}
              aria-label={`${item.title}, ${item.colorCount}색, ${drawings[item.id]?.kind === 'official' ? '색칠하기' : '도안 준비 중'}`}
            >
              <span className="catalog-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="catalog-name">{item.title}</span>
              <span className="catalog-meta">
                {item.colorCount}색 <span>·</span>{' '}
                {drawings[item.id]?.kind === 'official'
                  ? '색칠하기'
                  : '도안 준비 중'}
              </span>
            </button>
          ))}
        </div>
      </section>
      <aside className="gentle-note">
        <span aria-hidden="true">♡</span>
        <p>
          서두르지 않아도 괜찮아요.
          <br />
          색칠한 곳은 이 기기에 자동으로 저장돼요.
        </p>
      </aside>
      <footer>
        광고 없이, 가입 없이, 즐겁게 색칠해요.
        <br />
        <span>그림과 진행 상태는 이 브라우저에만 저장돼요.</span>
      </footer>
    </main>
  )
}

function Coloring({
  drawing,
  onBack,
}: {
  drawing: Drawing
  onBack: () => void
}) {
  const [initial] = useState(() => readProgress(drawing))
  const [history, setHistory] = useState<string[]>(initial.saved?.history ?? [])
  const [storageOk, setStorageOk] = useState(!initial.unavailable)
  const [zoom, setZoom] = useState(1)
  const [hintId, setHintId] = useState<string>()
  const [message, setMessage] = useState('반짝이는 숫자를 찾아 톡 눌러 주세요!')
  const [resetOpen, setResetOpen] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const [exporting, setExporting] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const maxZoom = drawing.maxZoom ?? 3
  const current = activeColor(drawing, history)
  const complete = !current
  const remaining = drawing.regions.filter(
    (region) => region.colorId === current?.id && !history.includes(region.id),
  ).length
  const percent = progress(drawing, history)

  useEffect(() => () => clearTimeout(hintTimer.current), [])
  useEffect(() => {
    const palette = paletteRef.current
    const chip = palette?.querySelector<HTMLElement>('[aria-current="step"]')
    if (palette && chip)
      palette.scrollTo({
        left: chip.offsetLeft - palette.clientWidth / 2 + chip.clientWidth / 2,
      })
  }, [current?.id])

  function commit(next: string[]) {
    setHistory(next)
    setStorageOk(saveProgress(drawing, next))
    setHintId(undefined)
    clearTimeout(hintTimer.current)
  }

  function handlePaint(id: string) {
    if (history.includes(id)) return
    const next = paint(drawing, history, id)
    if (next === history) {
      setMessage(
        `지금은 ${current?.id}번 ${current?.name} 차례예요. 같은 숫자를 찾아볼까요?`,
      )
      return
    }
    commit(next)
    const nextColor = activeColor(drawing, next)
    if (!nextColor) {
      setMessage('모두 칠했어요! 정말 멋진 그림이에요.')
      setCelebrate(true)
    } else if (nextColor.id !== current?.id)
      setMessage(
        `참 잘했어요! 이제 ${nextColor.id}번 ${nextColor.name} 차례예요.`,
      )
    else setMessage('좋아요! 같은 숫자를 더 찾아볼까요?')
  }

  function hint() {
    const region = drawing.regions.find(
      (item) => item.colorId === current?.id && !history.includes(item.id),
    )
    if (!region) return
    clearTimeout(hintTimer.current)
    setHintId(region.id)
    setMessage(`${current!.id}번이 반짝반짝! 이곳을 눌러 보세요.`)
    // Small independent cells need a usable touch target; center them without painting.
    const stage = stageRef.current
    const svg = svgRef.current
    const baseHeight = svg ? svg.getBoundingClientRect().height / zoom : 0
    const scale = baseHeight / drawing.viewBox[3]
    const targetZoom =
      region.touchRadius && scale > 0
        ? Math.min(
            maxZoom,
            Math.max(
              1,
              Math.ceil((48 / (2 * region.touchRadius * scale)) * 2) / 2,
            ),
          )
        : 1
    setZoom(targetZoom)
    requestAnimationFrame(() => {
      if (!stage) return
      if (targetZoom === 1) {
        stage.scrollTo({ top: 0, left: 0 })
        return
      }
      const path = svgRef.current?.querySelector<SVGPathElement>(
        `[data-region="${region.id}"]`,
      )
      const matrix = path?.getScreenCTM()
      if (!matrix) return
      const point = new DOMPoint(...region.label).matrixTransform(matrix)
      const bounds = stage.getBoundingClientRect()
      stage.scrollTo({
        left: stage.scrollLeft + point.x - bounds.left - stage.clientWidth / 2,
        top: stage.scrollTop + point.y - bounds.top - stage.clientHeight / 2,
      })
    })
    hintTimer.current = setTimeout(() => setHintId(undefined), 6000)
  }

  async function download() {
    if (!svgRef.current || exporting) return
    setExporting(true)
    try {
      await exportPng(
        svgRef.current,
        `${drawing.kind === 'test' ? '테스트-' : ''}${drawing.title}.png`,
      )
      setMessage('PNG 그림을 저장했어요! 다운로드 폴더를 확인해 주세요.')
    } catch {
      setMessage('그림을 저장하지 못했어요. 잠시 후 다시 눌러 주세요.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="coloring">
      <div className="coloring-heading">
        <button className="button back-button" onClick={onBack}>
          <span aria-hidden="true">←</span> 도안 선택
        </button>
        <span className="save-status" role="status">
          {storageOk
            ? '✓ 이 기기에 자동 저장'
            : '⚠ 저장 공간을 사용할 수 없어요'}
        </span>
      </div>
      {!storageOk && (
        <p className="storage-warning">
          지금은 자동 저장이 되지 않아요. 창을 닫으면 진행 상태가 사라질 수
          있어요.
        </p>
      )}
      <div className="drawing-title">
        <div>
          <span className="eyebrow">
            {drawing.kind === 'test'
              ? '체험용 SVG · 정식 승인 도안 아님'
              : '순서대로 색칠해요'}
          </span>
          <h1>{drawing.title}</h1>
        </div>
        <span className="drawing-size">{drawing.colors.length}색</span>
      </div>
      <section className="progress-panel" aria-label="색칠 진행 상태">
        <div className="progress-top">
          <span>
            {complete ? '멋지게 완성했어요!' : '조금씩, 알록달록 채워져요'}{' '}
            <span aria-hidden="true">✦</span>
          </span>
          <strong data-testid="progress">{percent}%</strong>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="완성도"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        <div
          className="palette"
          ref={paletteRef}
          aria-label="색칠 순서"
          tabIndex={0}
        >
          {drawing.colors.map((color) => (
            <span
              key={color.id}
              className={`color-chip ${color.id === current?.id ? 'selected' : ''}`}
              style={{ backgroundColor: color.hex }}
              aria-label={`${color.id}번 ${color.name}${color.id === current?.id ? ', 현재 색상' : ''}`}
              aria-current={color.id === current?.id ? 'step' : undefined}
            >
              {color.id < (current?.id ?? Infinity) ? (
                <>
                  <span aria-hidden="true">✓</span>
                  <span className="sr-only">{color.id}번 완료</span>
                </>
              ) : (
                color.id
              )}
            </span>
          ))}
        </div>
      </section>
      <section
        className="canvas-panel"
        aria-label="색칠하기"
        style={
          {
            '--art-ratio': drawing.viewBox[2] / drawing.viewBox[3],
          } as React.CSSProperties
        }
      >
        <div className="current-instruction">
          {current ? (
            <>
              <span
                className="current-number"
                style={{ backgroundColor: current.hex }}
              >
                {current.id}
              </span>
              <div>
                <strong>
                  {current.name} 차례예요{' '}
                  <span className="step-count">
                    {current.id}/{drawing.colors.length}
                  </span>
                </strong>
                <span>
                  {current.id}번을 찾아 톡! <b>{remaining}곳</b> 남았어요
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="current-number done-star" aria-hidden="true">
                ★
              </span>
              <div>
                <strong>나만의 작품 완성!</strong>
                <span>그림을 저장하거나 다시 칠해 보세요.</span>
              </div>
            </>
          )}
          <span className="canvas-tag">
            {drawing.kind === 'test' ? '테스트 도안' : '색칠 도안'}
          </span>
        </div>
        <div
          className="canvas-scroll"
          ref={stageRef}
          data-testid="canvas-scroll"
        >
          <div
            className="canvas-scale"
            style={{ width: `calc(min(100%, var(--canvas-width)) * ${zoom})` }}
          >
            <Artwork
              ref={svgRef}
              drawing={drawing}
              history={history}
              activeId={current?.id}
              hintId={hintId}
              onPaint={handlePaint}
            />
          </div>
        </div>
        <div className="zoom-tools">
          <span>
            {zoom > 1 ? '화면을 밀어서 이동해요' : '같은 숫자를 눌러 주세요'}
          </span>
          <div>
            <button
              className="icon-button"
              disabled={zoom <= 1}
              onClick={() => setZoom((value) => Math.max(1, value - 0.5))}
              aria-label="축소"
            >
              −
            </button>
            <button
              className="zoom-label"
              onClick={() => {
                setZoom(1)
                stageRef.current?.scrollTo(0, 0)
              }}
              aria-label="원래 크기로"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              className="icon-button"
              disabled={zoom >= maxZoom}
              onClick={() => setZoom((value) => Math.min(maxZoom, value + 0.5))}
              aria-label="확대"
            >
              ＋
            </button>
          </div>
        </div>
      </section>
      <p className="encouragement" role="status" aria-live="polite">
        {message}
      </p>
      <div className="action-bar">
        <button
          className="button hint-button"
          disabled={complete}
          onClick={hint}
        >
          <span aria-hidden="true">✧</span> 힌트
        </button>
        <button
          className="button"
          disabled={!history.length}
          onClick={() => {
            commit(history.slice(0, -1))
            setMessage('한 칸 되돌렸어요. 다시 칠해 볼까요?')
          }}
        >
          <span aria-hidden="true">↶</span> 되돌리기
        </button>
        <button
          className="button reset-button"
          disabled={!history.length}
          onClick={() => setResetOpen(true)}
        >
          <span aria-hidden="true">↻</span> 처음부터
        </button>
      </div>
      <button
        className="button download-button"
        onClick={download}
        disabled={!complete || exporting}
      >
        <span aria-hidden="true">↓</span>{' '}
        {exporting
          ? '그림을 저장하고 있어요…'
          : complete
            ? '완성한 그림 PNG로 저장'
            : '완성하면 그림을 저장할 수 있어요'}
      </button>
      <p className="small-note">
        {drawing.id === 'police-car-robot'
          ? '작은 영역은 힌트를 눌러 크게 볼 수 있어요.'
          : '작은 영역은 확대해서 칠해 보세요.'}{' '}
        · 저장된 기록은 이 브라우저에서 이어 할 수 있어요.
      </p>
      {resetOpen && (
        <Dialog
          title="처음부터 다시 칠할까요?"
          onClose={() => setResetOpen(false)}
        >
          <p>
            지금까지 칠한 색이 모두 지워져요.
            <br />
            도안은 그대로 남아 있어요.
          </p>
          <div className="dialog-actions">
            <button
              className="button"
              onClick={() => setResetOpen(false)}
              autoFocus
            >
              계속 칠할래요
            </button>
            <button
              className="button primary"
              onClick={() => {
                commit([])
                setResetOpen(false)
                setCelebrate(false)
                setZoom(1)
                setMessage('새롭게 시작해요! 1번부터 찾아볼까요?')
              }}
            >
              처음부터 칠하기
            </button>
          </div>
        </Dialog>
      )}
      {celebrate && (
        <Dialog
          title="우와, 내가 완성했어요!"
          onClose={() => setCelebrate(false)}
        >
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => (
              <i key={index} style={{ '--i': index } as React.CSSProperties} />
            ))}
          </div>
          <div className="trophy" aria-hidden="true">
            🌟
          </div>
          <p>
            한 칸씩 칠해서 멋진 그림이 되었어요.
            <br />
            오늘의 꼬마 예술가, 정말 잘했어요!
          </p>
          <div className="dialog-actions">
            <button
              className="button primary"
              autoFocus
              onClick={() => {
                setCelebrate(false)
                void download()
              }}
            >
              내 그림 저장하기
            </button>
            <button className="button" onClick={() => setCelebrate(false)}>
              그림 더 보기
            </button>
          </div>
        </Dialog>
      )}
    </main>
  )
}

export default function App() {
  const [opened, setOpened] = useState<Drawing | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [offlineReady, setOfflineReady] = useState(false)
  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    const onReady = () => setOfflineReady(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('offline-ready', onReady)
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker
        .getRegistration()
        .then((reg) => {
          if (reg?.active) setOfflineReady(true)
        })
        .catch(() => {
          /* Coloring remains usable when service workers are blocked. */
        })
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('offline-ready', onReady)
    }
  }, [])
  return (
    <div className={`app-shell${opened ? ' is-coloring' : ''}`}>
      <header className="site-header">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          onClick={(event) => {
            event.preventDefault()
            setOpened(null)
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            ✿
          </span>
          <span>
            순서대로
            <br />
            <b>색칠놀이</b>
          </span>
        </a>
        <span
          className={`connection-pill ${!online ? 'offline' : ''}`}
          role="status"
        >
          <i />
          {!online
            ? '오프라인 모드'
            : offlineReady
              ? '오프라인 준비 완료'
              : '차근차근, 내 속도로'}
        </span>
      </header>
      {opened ? (
        <Coloring
          key={opened.id}
          drawing={opened}
          onBack={() => setOpened(null)}
        />
      ) : (
        <Home
          onOpen={(drawing) => {
            setOpened(drawing)
            window.scrollTo(0, 0)
          }}
        />
      )}
    </div>
  )
}
