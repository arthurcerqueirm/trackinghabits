import { AnimatePresence, motion } from 'framer-motion'
import { useId, useMemo, useState } from 'react'
import { useWidth } from './ui'

export type ChartPoint = { label: string; value: number; tip?: string }

type Props = {
  data: ChartPoint[]
  color?: string
  height?: number
  /** muda para reanimar a entrada */
  animKey?: string | number
  format?: (v: number) => string
}

const EASE = [0.65, 0, 0.35, 1] as const
const DURATION = 1.15
const PAD = { top: 18, right: 14, bottom: 30, left: 38 }

/** Curva monotônica (Fritsch–Carlson): suave e nunca "passa" de 0% ou 100% */
function monotonePath(pts: [number, number][]) {
  const n = pts.length
  if (!n) return ''
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`
  const m: number[] = []
  const t: number[] = []
  for (let i = 0; i < n - 1; i++) m.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]))
  t[0] = m[0]
  t[n - 1] = m[n - 2]
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = t[i] / m[i]
    const b = t[i + 1] / m[i]
    const s = a * a + b * b
    if (s > 9) {
      const k = 3 / Math.sqrt(s)
      t[i] = k * a * m[i]
      t[i + 1] = k * b * m[i]
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const dx = (x1 - x0) / 3
    d += `C${x0 + dx},${y0 + t[i] * dx},${x1 - dx},${y1 - t[i + 1] * dx},${x1},${y1}`
  }
  return d
}

export function AreaChart({ data, color = 'var(--accent)', height = 220, animKey, format = (v) => `${Math.round(v * 100)}%` }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const uid = useId().replace(/:/g, '')

  const innerW = Math.max(0, width - PAD.left - PAD.right)
  const innerH = height - PAD.top - PAD.bottom
  const n = data.length
  const step = n > 1 ? innerW / (n - 1) : 0

  const pts = useMemo<[number, number][]>(
    () => data.map((d, i) => [PAD.left + (n > 1 ? i * step : innerW / 2), PAD.top + innerH * (1 - Math.max(0, Math.min(1, d.value)))]),
    [data, n, step, innerW, innerH],
  )
  const line = useMemo(() => monotonePath(pts), [pts])
  const area = pts.length ? `${line}L${pts[pts.length - 1][0]},${PAD.top + innerH}L${pts[0][0]},${PAD.top + innerH}Z` : ''

  const xTicks = useMemo(() => {
    if (n <= 7) return data.map((_, i) => i)
    const count = 5
    return Array.from({ length: count }, (_, k) => Math.round((k * (n - 1)) / (count - 1)))
  }, [n, data])

  const showDots = n <= 31
  const pick = (clientX: number, el: Element) => {
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left - PAD.left
    const i = Math.round(x / (step || 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  const hp = hover != null ? pts[hover] : null
  const tipX = hp ? Math.max(62, Math.min(width - 62, hp[0])) : 0

  return (
    <div ref={ref} className="chart-wrap" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.42 }} />
              <stop offset="60%" style={{ stopColor: color, stopOpacity: 0.12 }} />
              <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
            </linearGradient>
            <linearGradient id={`stroke-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.55 }} />
              <stop offset="100%" style={{ stopColor: color, stopOpacity: 1 }} />
            </linearGradient>
            <clipPath id={`clip-${uid}-${animKey}`}>
              <motion.rect
                key={`${animKey}-${width}`}
                x={0}
                y={0}
                height={height}
                initial={{ width: 0 }}
                animate={{ width: PAD.left + innerW + PAD.right }}
                transition={{ duration: DURATION, ease: EASE }}
              />
            </clipPath>
          </defs>

          {/* grade — recessiva */}
          {[0, 0.5, 1].map((g) => {
            const y = PAD.top + innerH * (1 - g)
            return (
              <g key={g}>
                <line x1={PAD.left} x2={PAD.left + innerW} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth={1} strokeDasharray={g === 0 ? undefined : '3 5'} />
                <text x={PAD.left - 10} y={y + 4} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--muted)">
                  {format(g)}
                </text>
              </g>
            )
          })}
          {xTicks.map((i) => (
            <text key={i} x={pts[i]?.[0]} y={height - 8} textAnchor="middle" fontSize={11} fontWeight={600} fill={hover === i ? 'var(--text)' : 'var(--muted)'}>
              {data[i]?.label}
            </text>
          ))}

          <g key={`${animKey}-${width}`}>
            <motion.path
              d={area}
              fill={`url(#fill-${uid})`}
              clipPath={`url(#clip-${uid}-${animKey})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, d: area }}
              transition={{ opacity: { duration: 0.6 }, d: { type: 'spring', stiffness: 120, damping: 20 } }}
            />
            <motion.path
              d={line}
              fill="none"
              stroke={`url(#stroke-${uid})`}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1, d: line }}
              transition={{ pathLength: { duration: DURATION, ease: EASE }, d: { type: 'spring', stiffness: 120, damping: 20 } }}
            />

            {showDots &&
              pts.map(([x, y], i) => (
                <motion.circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={4}
                  fill={color}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: hover === i ? 1.6 : 1, opacity: 1, cx: x, cy: y }}
                  transition={{
                    scale: { type: 'spring', stiffness: 500, damping: 18, delay: hover == null ? (i / Math.max(1, n - 1)) * DURATION : 0 },
                    opacity: { delay: (i / Math.max(1, n - 1)) * DURATION, duration: 0.15 },
                    cx: { type: 'spring', stiffness: 120, damping: 20 },
                    cy: { type: 'spring', stiffness: 120, damping: 20 },
                  }}
                />
              ))}

            {/* último ponto pulsando */}
            {pts.length > 0 && hover == null && (
              <motion.circle
                cx={pts[n - 1][0]}
                cy={pts[n - 1][1]}
                fill={color}
                initial={{ r: 4, opacity: 0 }}
                animate={{ r: [4, 14], opacity: [0.45, 0] }}
                transition={{ delay: DURATION, duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            {!showDots && pts.length > 0 && (
              <motion.circle
                cx={pts[n - 1][0]}
                cy={pts[n - 1][1]}
                r={4.5}
                fill={color}
                stroke="var(--surface)"
                strokeWidth={2}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: DURATION, type: 'spring', stiffness: 500, damping: 16 }}
              />
            )}
          </g>

          {/* crosshair */}
          <AnimatePresence>
            {hp && (
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <motion.line
                  y1={PAD.top}
                  y2={PAD.top + innerH}
                  stroke="var(--text-2)"
                  strokeOpacity={0.35}
                  strokeDasharray="4 4"
                  initial={false}
                  animate={{ x1: hp[0], x2: hp[0] }}
                  transition={{ type: 'spring', stiffness: 700, damping: 40 }}
                />
                {!showDots && (
                  <motion.circle
                    r={5.5}
                    fill={color}
                    stroke="var(--surface)"
                    strokeWidth={2.5}
                    initial={false}
                    animate={{ cx: hp[0], cy: hp[1] }}
                    transition={{ type: 'spring', stiffness: 700, damping: 40 }}
                  />
                )}
              </motion.g>
            )}
          </AnimatePresence>

          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="transparent"
            style={{ cursor: 'crosshair' }}
            onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
            onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
            onPointerLeave={() => setHover(null)}
            onPointerCancel={() => setHover(null)}
          />
        </svg>
      )}

      <AnimatePresence>
        {hp && hover != null && (
          <motion.div
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 2 }}
            initial={{ opacity: 0, scale: 0.9, x: tipX, y: hp[1] - 64 }}
            animate={{ opacity: 1, scale: 1, x: tipX, y: Math.max(-12, hp[1] - 64) }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 600, damping: 38 }}
          >
            <div className="chart-tip" style={{ transform: 'translateX(-50%)' }}>
              <b>{format(data[hover].value)}</b>
              {data[hover].tip ?? data[hover].label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
