import { motion } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Habit } from '../lib/types'
import { addDays, shortLabel, WEEKDAYS, WEEKDAYS_SHORT } from '../lib/date'
import { bestStreak, currentStreak, dayProgress, habitRate, perfectStreak, series, weekdayAverages } from '../lib/stats'
import { AreaChart } from '../components/AreaChart'
import { Heatmap } from '../components/Heatmap'
import { IconCheck, IconFlame, IconTarget, IconTrophy } from '../components/Icons'
import { CountUp, rise, Segmented, spring, stagger } from '../components/ui'

type Range = 7 | 30 | 90

export function StatsPage({ onOpenHabit }: { onOpenHabit: (h: Habit) => void }) {
  const habits = useStore((s) => s.habits)
  const counts = useStore((s) => s.counts)
  const today = useStore((s) => s.today)
  const [range, setRange] = useState<Range>(7)

  const active = useMemo(() => habits.filter((h) => !h.archived), [habits])

  const data = useMemo(() => {
    const s = series(active, counts, range, today)
    // hoje incompleto puxa a média pra baixo, então só entra se já houver algo marcado
    const counted = s.filter((p) => p.total > 0 && (p.day !== today || p.done > 0))
    const avg = counted.length ? counted.reduce((a, p) => a + p.value, 0) / counted.length : 0

    const prev = series(active, counts, range, addDays(today, -range)).filter((p) => p.total > 0)
    const prevAvg = prev.length ? prev.reduce((a, p) => a + p.value, 0) / prev.length : null

    let checkins = 0
    for (const p of s) checkins += p.done

    const points = s.map((p) => ({
      label: range === 7 ? WEEKDAYS[new Date(p.day + 'T12:00').getDay()] : shortLabel(p.day),
      value: p.value,
      tip: `${shortLabel(p.day)} · ${p.done}/${p.total} hábitos`,
    }))
    return { points, avg, delta: prevAvg == null ? null : avg - prevAvg, checkins }
  }, [active, counts, range, today])

  const perfect = useMemo(() => perfectStreak(active, counts, today), [active, counts, today])
  const best = useMemo(() => Math.max(0, ...active.map((h) => bestStreak(h, counts, today))), [active, counts, today])
  const weekdays = useMemo(() => weekdayAverages(active, counts, 90, today), [active, counts, today])
  const perHabit = useMemo(
    () =>
      active
        .map((h) => ({ h, rate: habitRate(h, counts, range, today), streak: currentStreak(h, counts, today) }))
        .sort((a, b) => b.rate - a.rate),
    [active, counts, range, today],
  )
  const heatValue = useCallback(
    (day: string) => {
      const p = dayProgress(active, counts, day)
      return p.total ? p.ratio : null
    },
    [active, counts],
  )

  const bestDay = weekdays.reduce<number | null>((b, v, i) => (v != null && (b == null || v > (weekdays[b] ?? 0)) ? i : b), null)

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.header className="header" variants={rise}>
        <div>
          <div className="eyebrow">Seu progresso</div>
          <h1 className="title">Estatísticas</h1>
        </div>
      </motion.header>

      <motion.div variants={rise} style={{ marginBottom: 14 }}>
        <Segmented
          id="range"
          value={range}
          onChange={setRange}
          options={[
            { value: 7, label: '7 dias' },
            { value: 30, label: '30 dias' },
            { value: 90, label: '90 dias' },
          ]}
        />
      </motion.div>

      <motion.div className="card" variants={rise} style={{ padding: '18px 14px 10px' }}>
        <div style={{ padding: '0 4px 6px' }}>
          <div className="eyebrow">Taxa de conclusão</div>
          <div className="row" style={{ alignItems: 'baseline', gap: 10, marginTop: 2 }}>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em' }}>
              <CountUp value={data.avg * 100} key={range} />%
            </div>
            {data.delta != null && Math.abs(data.delta) >= 0.005 && (
              <motion.span
                key={`${range}-${Math.round(data.delta * 100)}`}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...spring, delay: 0.5 }}
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: 99,
                  color: data.delta > 0 ? 'var(--good)' : 'var(--danger)',
                  background: `color-mix(in srgb, ${data.delta > 0 ? 'var(--good)' : 'var(--danger)'} 14%, transparent)`,
                }}
              >
                {data.delta > 0 ? '▲' : '▼'} {Math.abs(Math.round(data.delta * 100))} pts
              </motion.span>
            )}
          </div>
          <div className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>
            média dos últimos {range} dias {data.delta != null ? 'vs. período anterior' : ''}
          </div>
        </div>
        <AreaChart data={data.points} animKey={range} height={230} />
      </motion.div>

      <motion.div className="tiles" variants={rise} style={{ marginTop: 12 }}>
        <Tile icon={<IconFlame size={15} />} color="#f97316" label="Dias perfeitos seguidos" value={perfect} />
        <Tile icon={<IconTrophy size={15} />} color="#facc15" label="Maior sequência" value={best} suffix=" dias" />
        <Tile icon={<IconCheck size={15} />} color="#22c55e" label={`Concluídos (${range}d)`} value={data.checkins} />
        <Tile icon={<IconTarget size={15} />} color="var(--accent)" label="Hábitos ativos" value={active.length} />
      </motion.div>

      <motion.h2 className="section-title" variants={rise}>Consistência</motion.h2>
      <motion.div className="card" variants={rise}>
        <Heatmap valueOf={heatValue} weeks={18} />
      </motion.div>

      <motion.h2 className="section-title" variants={rise}>
        Por dia da semana
        {bestDay != null && <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>melhor: {WEEKDAYS[bestDay]}</span>}
      </motion.h2>
      <motion.div className="card" variants={rise}>
        <div className="bars">
          {weekdays.map((v, i) => (
            <div key={i} className="bar-col">
              <span className="tnum" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>
                {v == null ? '–' : `${Math.round(v * 100)}%`}
              </span>
              <div className="bar-track">
                <motion.div
                  className="bar"
                  style={{ height: `${Math.max(4, (v ?? 0) * 100)}%`, background: i === bestDay ? 'var(--grad)' : 'color-mix(in srgb, var(--accent) 55%, var(--surface-2))' }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ type: 'spring', stiffness: 140, damping: 18, delay: 0.25 + i * 0.05 }}
                />
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: i === bestDay ? 'var(--text)' : 'var(--muted)' }}>{WEEKDAYS_SHORT[i]}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {perHabit.length > 0 && (
        <>
          <motion.h2 className="section-title" variants={rise}>Por hábito</motion.h2>
          <motion.div className="list" variants={rise}>
            {perHabit.map(({ h, rate, streak }, i) => (
              <motion.button key={h.id} className="list-item" onClick={() => onOpenHabit(h)} whileTap={{ scale: 0.98 }}>
                <div className="habit-emoji" style={{ width: 42, height: 42, fontSize: 21, borderRadius: 14, background: `color-mix(in srgb, ${h.color} 20%, var(--surface))` }}>
                  {h.emoji}
                </div>
                <div className="grow">
                  <div className="row-between">
                    <span className="t" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                    <span className="tnum" style={{ fontWeight: 800, fontSize: 14 }}>{Math.round(rate * 100)}%</span>
                  </div>
                  <div className="habit-bar" style={{ marginTop: 7 }}>
                    <motion.div
                      style={{ background: h.color, width: '100%' }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: rate }}
                      transition={{ type: 'spring', stiffness: 90, damping: 18, delay: 0.3 + i * 0.06 }}
                    />
                  </div>
                  {streak > 0 && (
                    <div className="s" style={{ color: '#f97316', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <IconFlame size={12} /> {streak} {streak === 1 ? 'dia' : 'dias'} seguidos
                    </div>
                  )}
                </div>
              </motion.button>
            ))}
          </motion.div>
        </>
      )}
    </motion.div>
  )
}

function Tile({ icon, color, label, value, suffix = '' }: { icon: React.ReactNode; color: string; label: string; value: number; suffix?: string }) {
  return (
    <div className="card tile">
      <div className="tile-label">
        <span style={{ color, display: 'grid' }}>{icon}</span>
        {label}
      </div>
      <div className="tile-value">
        <CountUp value={value} />
        <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{suffix}</span>
      </div>
    </div>
  )
}
