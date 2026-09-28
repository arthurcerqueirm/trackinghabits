import { motion } from 'framer-motion'
import { memo, useMemo } from 'react'
import { addDays, shortLabel, todayKey, weekday } from '../lib/date'

/** Grade de consistência: colunas = semanas, linhas = dias da semana */
export const Heatmap = memo(function Heatmap({ weeks = 18, valueOf, color = 'var(--accent)', animKey }: {
  weeks?: number
  valueOf: (day: string) => number | null
  color?: string
  animKey?: string | number
}) {
  const today = todayKey()
  const cells = useMemo(() => {
    const end = addDays(today, 6 - weekday(today))
    const start = addDays(end, -(weeks * 7 - 1))
    return Array.from({ length: weeks * 7 }, (_, i) => {
      const day = addDays(start, i)
      return { day, col: Math.floor(i / 7), v: day > today ? undefined : valueOf(day) }
    })
  }, [today, weeks, valueOf])

  const bg = (v: number | null | undefined) => {
    if (v === undefined) return 'transparent'
    if (v === null || v <= 0) return 'var(--surface-2)'
    const pct = v >= 1 ? 100 : v >= 0.66 ? 72 : v >= 0.33 ? 48 : 26
    return `color-mix(in srgb, ${color} ${pct}%, var(--surface-2))`
  }

  return (
    <div>
      <div className="heat-scroll">
        <div className="heat" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(12px, 1fr))` }} key={animKey}>
          {cells.map((c) => (
            <motion.div
              key={c.day}
              className="heat-cell"
              title={`${shortLabel(c.day)}${c.v != null ? ` · ${Math.round(c.v * 100)}%` : ''}`}
              style={{ background: bg(c.v), outline: c.day === today ? '2px solid var(--text-2)' : undefined, outlineOffset: 1 }}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: c.col * 0.025 + (weekday(c.day) * 0.01), type: 'spring', stiffness: 400, damping: 22 }}
            />
          ))}
        </div>
      </div>
      <div className="row-between" style={{ marginTop: 12 }}>
        <span className="legend">{weeks} semanas</span>
        <div className="legend">
          Menos
          {[0, 0.2, 0.5, 0.8, 1].map((v) => (
            <i key={v} style={{ background: bg(v) }} />
          ))}
          Mais
        </div>
      </div>
    </div>
  )
})
