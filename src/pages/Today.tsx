import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import type { Habit } from '../lib/types'
import { addDays, fromKey, greeting, longLabel, MONTHS_LONG, weekday, WEEKDAYS_SHORT } from '../lib/date'
import { countOf, currentStreak, dayProgress, isScheduled } from '../lib/stats'
import { HabitCard } from '../components/HabitCard'
import { Confetti } from '../components/Confetti'
import { IconChevronLeft, IconChevronRight, IconPlus } from '../components/Icons'
import { CountUp, Ring, rise, spring, stagger, Tap } from '../components/ui'

const MESSAGES: [number, string][] = [
  [0, 'Bora começar o dia com tudo! 🚀'],
  [0.01, 'Bom começo, continue assim 💪'],
  [0.5, 'Mais da metade! Não para agora 🔥'],
  [0.8, 'Quase lá, só mais um pouquinho ✨'],
  [1, 'Dia perfeito! Você é incrível 🎉'],
]

export function TodayPage({ onOpenHabit, onNew }: { onOpenHabit: (h: Habit) => void; onNew: () => void }) {
  const habits = useStore((s) => s.habits)
  const counts = useStore((s) => s.counts)
  const today = useStore((s) => s.today)
  const day = useStore((s) => s.selectedDay)
  const setDay = useStore((s) => s.setSelectedDay)
  const setCount = useStore((s) => s.setCount)
  const profile = useStore((s) => s.profile)
  const toast = useStore((s) => s.toast)
  const ready = useStore((s) => s.ready)

  const active = useMemo(() => habits.filter((h) => !h.archived), [habits])
  const scheduled = useMemo(() => active.filter((h) => isScheduled(h, day)), [active, day])
  const off = useMemo(() => active.filter((h) => !isScheduled(h, day)), [active, day])
  const progress = dayProgress(active, counts, day)
  const pending = scheduled.filter((h) => countOf(counts, h, day) < h.target)
  const done = scheduled.filter((h) => countOf(counts, h, day) >= h.target)
  const isFuture = day > today

  // confete quando o dia fica completo
  const [confetti, setConfetti] = useState(0)
  const wasComplete = useRef<boolean | null>(null)
  useEffect(() => {
    const complete = progress.total > 0 && progress.done === progress.total
    if (wasComplete.current === false && complete) {
      setConfetti((c) => c + 1)
      toast('Todos os hábitos concluídos!', { emoji: '🏆' })
    }
    wasComplete.current = complete
  }, [progress.done, progress.total, toast])
  useEffect(() => {
    wasComplete.current = null
  }, [day])

  const toggle = useCallback(
    (h: Habit) => {
      const s = useStore.getState()
      if (s.selectedDay > s.today) {
        s.toast('Não dá pra marcar o futuro 😉', { tone: 'info' })
        return
      }
      const c = countOf(s.counts, h, s.selectedDay)
      setCount(h.id, s.selectedDay, c >= h.target ? 0 : c + 1)
    },
    [setCount],
  )
  const reset = useCallback((h: Habit) => setCount(h.id, useStore.getState().selectedDay, 0), [setCount])

  const msg = [...MESSAGES].reverse().find(([t]) => progress.ratio >= t)![1]
  const name = profile?.name?.split(' ')[0]

  return (
    <div>
      <Confetti fire={confetti} />
      <motion.header className="header" variants={stagger} initial="hidden" animate="show">
        <div>
          <motion.div className="eyebrow" variants={rise}>
            {greeting()}
            {name ? `, ${name}` : ''} 👋
          </motion.div>
          <motion.h1 className="title" variants={rise}>
            {longLabel(day)}
          </motion.h1>
        </div>
        <motion.button
          className="add-btn"
          aria-label="Novo hábito"
          onClick={onNew}
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          whileTap={{ scale: 0.86, rotate: 90 }}
          transition={{ ...spring, delay: 0.15 }}
        >
          <IconPlus size={26} />
        </motion.button>
      </motion.header>

      <motion.div className="card hero" initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...spring, delay: 0.05 }}>
        <div className="hero-glow" />
        <Ring value={progress.ratio} size={100} stroke={11}>
          <span>
            <CountUp value={progress.ratio * 100} />
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>%</span>
          </span>
        </Ring>
        <div style={{ position: 'relative', minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
            <CountUp value={progress.done} /> de {progress.total}
          </div>
          <div className="text-2" style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>
            {progress.total ? 'hábitos concluídos' : 'nenhum hábito para este dia'}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={msg}
              style={{ marginTop: 10, fontSize: 13.5, fontWeight: 700 }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {progress.total ? msg : ''}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      <DateStrip day={day} today={today} onChange={setDay} />

      {!ready ? (
        <div style={{ marginTop: 20 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 78, marginBottom: 10 }} />
          ))}
        </div>
      ) : active.length === 0 ? (
        <Empty onNew={onNew} />
      ) : (
        <LayoutGroup>
          <SectionTitle>{isFuture ? 'Programado' : pending.length ? 'A fazer' : scheduled.length ? 'Tudo feito!' : 'Dia livre'}</SectionTitle>
          <div key={day}>
            <AnimatePresence mode="popLayout">
              {pending.map((h, i) => (
                <motion.div key={h.id} layout="position" initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }} transition={{ ...spring, delay: Math.min(i, 8) * 0.045 }}>
                  <HabitCard habit={h} count={countOf(counts, h, day)} streak={currentStreak(h, counts, today)} onToggle={toggle} onReset={reset} onOpen={onOpenHabit} />
                </motion.div>
              ))}
            </AnimatePresence>
            {pending.length === 0 && scheduled.length > 0 && (
              <motion.div className="card" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring} style={{ textAlign: 'center', padding: 22 }}>
                <motion.div style={{ fontSize: 40, display: 'inline-block' }} animate={{ rotate: [0, -10, 10, -6, 0], scale: [1, 1.2, 1] }} transition={{ duration: 0.8, delay: 0.2 }}>
                  🏆
                </motion.div>
                <div style={{ fontWeight: 800, marginTop: 6 }}>Missão cumprida!</div>
                <div className="text-2" style={{ fontSize: 13.5, marginTop: 2 }}>Todos os hábitos do dia estão feitos.</div>
              </motion.div>
            )}

            {done.length > 0 && pending.length > 0 && <SectionTitle>Concluídos</SectionTitle>}
            <AnimatePresence mode="popLayout">
              {done.map((h, i) => (
                <motion.div key={h.id} layout="position" initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }} transition={{ ...spring, delay: Math.min(i, 8) * 0.045 }}>
                  <HabitCard habit={h} count={countOf(counts, h, day)} streak={currentStreak(h, counts, today)} onToggle={toggle} onReset={reset} onOpen={onOpenHabit} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {off.length > 0 && (
            <>
              <SectionTitle>Folga neste dia</SectionTitle>
              <div className="chips">
                {off.map((h) => (
                  <Tap key={h.id} className="chip" onClick={() => onOpenHabit(h)} style={{ opacity: 0.75 }}>
                    {h.emoji} {h.name}
                  </Tap>
                ))}
              </div>
            </>
          )}
        </LayoutGroup>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <motion.h2 layout="position" className="section-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {children}
    </motion.h2>
  )
}

function DateStrip({ day, today, onChange }: { day: string; today: string; onChange: (d: string) => void }) {
  const habits = useStore((s) => s.habits)
  const counts = useStore((s) => s.counts)
  const weekStart = addDays(day, -weekday(day))
  const thisWeekStart = addDays(today, -weekday(today))
  const [dir, setDir] = useState(0)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const d = fromKey(weekStart)

  const shift = (n: number) => {
    setDir(n)
    const next = addDays(day, n * 7)
    onChange(next > today ? today : next)
  }

  return (
    <div>
      <div className="date-nav">
        <Tap className="icon-btn" onClick={() => shift(-1)} aria-label="Semana anterior">
          <IconChevronLeft size={18} />
        </Tap>
        <Tap className="label" onClick={() => onChange(today)} scale={0.96}>
          {day === today ? `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}` : '↺ Voltar para hoje'}
        </Tap>
        <Tap className="icon-btn" onClick={() => shift(1)} disabled={weekStart >= thisWeekStart} style={{ opacity: weekStart >= thisWeekStart ? 0.3 : 1 }} aria-label="Próxima semana">
          <IconChevronRight size={18} />
        </Tap>
      </div>
      <div style={{ overflow: 'hidden', margin: '0 -4px', padding: '0 4px' }}>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={weekStart}
            className="dates"
            custom={dir}
            variants={{
              enter: (d: number) => ({ x: d * 80, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -80, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
          >
            {days.map((k) => {
              const p = dayProgress(habits, counts, k)
              const sel = k === day
              const future = k > today
              return (
                <motion.button
                  key={k}
                  className={`date ${k === today ? 'is-today' : ''}`}
                  onClick={() => {
                    setDir(0)
                    onChange(k)
                  }}
                  whileTap={{ scale: 0.9 }}
                  style={{ opacity: future ? 0.45 : 1 }}
                >
                  {sel && <motion.div layoutId="date-sel" className="date-sel" transition={spring} />}
                  <span className="wd">{WEEKDAYS_SHORT[weekday(k)]}</span>
                  <Ring value={future ? 0 : p.ratio} size={32} stroke={3.5} track="var(--surface-3)">
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: sel ? 'var(--text)' : 'var(--text-2)' }}>{fromKey(k).getDate()}</span>
                  </Ring>
                </motion.button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function Empty({ onNew }: { onNew: () => void }) {
  return (
    <motion.div className="empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
      <motion.div className="empty-emoji" animate={{ y: [0, -10, 0], rotate: [0, -6, 6, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
        🌱
      </motion.div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 12 }}>Comece seu primeiro hábito</h2>
      <p className="text-2" style={{ margin: '8px 0 22px', fontSize: 14.5, lineHeight: 1.5 }}>
        Pequenas ações todos os dias viram grandes resultados.
      </p>
      <Tap className="btn btn-primary" onClick={onNew}>
        <IconPlus size={20} /> Criar hábito
      </Tap>
    </motion.div>
  )
}
