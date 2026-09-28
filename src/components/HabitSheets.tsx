import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Habit, HabitDraft } from '../lib/types'
import { addDays, createdKey, fromKey, MONTHS_LONG, shortLabel, toKey, WEEKDAYS_SHORT } from '../lib/date'
import { bestStreak, ck, currentStreak, habitRate, isScheduled, ratioOf } from '../lib/stats'
import { haptic } from '../lib/push'
import { AreaChart } from './AreaChart'
import { IconArchive, IconBell, IconChevronLeft, IconChevronRight, IconEdit, IconFlame, IconTrash, IconTrophy, IconTarget, IconCheck } from './Icons'
import { CountUp, spring, Switch, Tap } from './ui'

export const EMOJIS = ['✨', '💧', '📚', '🏃', '🧘', '😴', '🥗', '💊', '🦷', '🚭', '🎸', '✍️', '🧠', '💪', '🚶', '🌅', '🧹', '💰', '🙏', '📵', '☕', '🍎', '🚴', '🏊', '🎯', '📝', '🌱', '❤️', '🎨', '🛏️', '🐶', '🧴']
export const COLORS = ['#8b7cf6', '#f472b6', '#f97316', '#facc15', '#22c55e', '#14b8a6', '#38bdf8', '#6366f1', '#ef4444', '#a855f7']
const ALL = [0, 1, 2, 3, 4, 5, 6]

const SUGGESTIONS: HabitDraft[] = [
  { name: 'Beber água', emoji: '💧', color: '#38bdf8', target: 8, unit: 'copos', days: ALL, reminder_time: '10:00' },
  { name: 'Ler 20 minutos', emoji: '📚', color: '#8b7cf6', target: 1, unit: null, days: ALL, reminder_time: '21:00' },
  { name: 'Exercício', emoji: '🏃', color: '#f97316', target: 1, unit: null, days: [1, 2, 3, 4, 5], reminder_time: '07:00' },
  { name: 'Meditar', emoji: '🧘', color: '#14b8a6', target: 1, unit: null, days: ALL, reminder_time: '08:00' },
  { name: 'Dormir cedo', emoji: '😴', color: '#6366f1', target: 1, unit: null, days: ALL, reminder_time: '22:30' },
  { name: 'Comer fruta', emoji: '🍎', color: '#22c55e', target: 2, unit: 'frutas', days: ALL, reminder_time: null },
]

export const daysLabel = (days: number[]) => {
  const s = [...days].sort().join()
  if (s === '0,1,2,3,4,5,6') return 'Todos os dias'
  if (s === '1,2,3,4,5') return 'Dias úteis'
  if (s === '0,6') return 'Fins de semana'
  return [...days].sort().map((d) => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d]).join(', ')
}

// ====================================================================
//  Criar / editar
// ====================================================================
export function HabitForm({ habit, onDone }: { habit?: Habit | null; onDone: () => void }) {
  const addHabit = useStore((s) => s.addHabit)
  const updateHabit = useStore((s) => s.updateHabit)
  const toast = useStore((s) => s.toast)

  const [d, setD] = useState<HabitDraft>(() =>
    habit
      ? { name: habit.name, emoji: habit.emoji, color: habit.color, target: habit.target, unit: habit.unit, days: habit.days, reminder_time: habit.reminder_time }
      : { name: '', emoji: '✨', color: COLORS[0], target: 1, unit: null, days: ALL, reminder_time: null },
  )
  const set = <K extends keyof HabitDraft>(k: K, v: HabitDraft[K]) => setD((p) => ({ ...p, [k]: v }))
  const valid = d.name.trim().length > 0 && d.days.length > 0

  const save = async () => {
    if (!valid) return
    haptic([10, 30, 10])
    const clean = { ...d, name: d.name.trim(), unit: d.target > 1 ? d.unit?.trim() || null : null }
    onDone()
    if (habit) {
      await updateHabit(habit.id, clean)
      toast('Hábito atualizado', { emoji: '✅' })
    } else {
      const h = await addHabit(clean)
      if (h) toast(`${h.emoji} ${h.name} criado!`)
    }
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 20, gap: 14 }}>
        <motion.div
          key={d.emoji + d.color}
          className="habit-emoji"
          style={{ width: 60, height: 60, fontSize: 30, borderRadius: 20, background: `color-mix(in srgb, ${d.color} 22%, var(--surface))` }}
          initial={{ scale: 0.7, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
        >
          {d.emoji}
        </motion.div>
        <div className="sheet-title" style={{ margin: 0 }}>{habit ? 'Editar hábito' : 'Novo hábito'}</div>
      </div>

      {!habit && !d.name && (
        <div className="field">
          <span className="label">Sugestões</span>
          <div className="chips">
            {SUGGESTIONS.map((s, i) => (
              <motion.button
                key={s.name}
                className="chip"
                onClick={() => setD(s)}
                whileTap={{ scale: 0.92 }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, ...spring }}
              >
                {s.emoji} {s.name}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="hname">Nome</label>
        <input id="hname" className="input" placeholder="Ex.: Beber água" value={d.name} maxLength={60} onChange={(e) => set('name', e.target.value)} />
      </div>

      <div className="field">
        <span className="label">Ícone</span>
        <div className="emoji-grid">
          {EMOJIS.map((e) => (
            <motion.button
              key={e}
              className="emoji-opt"
              whileTap={{ scale: 0.85 }}
              onClick={() => set('emoji', e)}
              style={e === d.emoji ? { background: `color-mix(in srgb, ${d.color} 30%, var(--surface-2))`, boxShadow: `inset 0 0 0 2px ${d.color}` } : undefined}
            >
              {e}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="label">Cor</span>
        <div className="color-row">
          {COLORS.map((c) => (
            <motion.button key={c} className="color-opt" style={{ background: c }} whileTap={{ scale: 0.85 }} onClick={() => set('color', c)} aria-label={c}>
              <AnimatePresence>
                {c === d.color && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring} style={{ display: 'grid' }}>
                    <IconCheck size={18} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="label">Meta diária</span>
        <div className="row">
          <div className="stepper">
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => set('target', Math.max(1, d.target - 1))}>−</motion.button>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={d.target} className="tnum" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={spring}>
                {d.target}
              </motion.span>
            </AnimatePresence>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => set('target', Math.min(100, d.target + 1))}>+</motion.button>
          </div>
          <AnimatePresence>
            {d.target > 1 && (
              <motion.input
                className="input"
                placeholder="unidade (copos, páginas…)"
                value={d.unit ?? ''}
                maxLength={20}
                onChange={(e) => set('unit', e.target.value)}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                style={{ height: 52 }}
              />
            )}
          </AnimatePresence>
          {d.target === 1 && <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>1 vez por dia</span>}
        </div>
      </div>

      <div className="field">
        <div className="row-between">
          <span className="label">Dias</span>
          <div className="chips">
            {[
              ['Todos', ALL],
              ['Úteis', [1, 2, 3, 4, 5]],
              ['Fds', [0, 6]],
            ].map(([l, v]) => (
              <button key={l as string} className="chip" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={() => set('days', v as number[])}>
                {l as string}
              </button>
            ))}
          </div>
        </div>
        <div className="day-chips">
          {WEEKDAYS_SHORT.map((w, i) => {
            const on = d.days.includes(i)
            return (
              <motion.button
                key={i}
                className="day-chip"
                whileTap={{ scale: 0.85 }}
                animate={{ backgroundColor: on ? d.color : 'var(--surface-2)', color: on ? '#fff' : 'var(--text-2)' }}
                transition={{ duration: 0.18 }}
                onClick={() => set('days', on ? d.days.filter((x) => x !== i) : [...d.days, i].sort())}
              >
                {w}
              </motion.button>
            )
          })}
        </div>
      </div>

      <div className="field">
        <div className="row-between card" style={{ padding: 14, boxShadow: 'none', background: 'var(--surface-2)', borderRadius: 18 }}>
          <div className="row" style={{ gap: 10 }}>
            <IconBell size={20} />
            <div>
              <div style={{ fontWeight: 700 }}>Lembrete</div>
              <div className="muted" style={{ fontSize: 12.5 }}>Notificação push no horário</div>
            </div>
          </div>
          <Switch on={!!d.reminder_time} onChange={(v) => set('reminder_time', v ? '09:00' : null)} />
        </div>
        <AnimatePresence initial={false}>
          {d.reminder_time && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} style={{ overflow: 'hidden' }}>
              <input type="time" className="input" value={d.reminder_time} onChange={(e) => set('reminder_time', e.target.value || '09:00')} style={{ marginTop: 4 }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Tap className="btn btn-primary btn-block" disabled={!valid} onClick={save} style={{ marginTop: 6 }}>
        {habit ? 'Salvar alterações' : 'Criar hábito'}
      </Tap>
    </div>
  )
}

// ====================================================================
//  Detalhe
// ====================================================================
export function HabitDetail({ habit, onEdit, onClose }: { habit: Habit; onEdit: () => void; onClose: () => void }) {
  const counts = useStore((s) => s.counts)
  const today = useStore((s) => s.today)
  const setCount = useStore((s) => s.setCount)
  const updateHabit = useStore((s) => s.updateHabit)
  const deleteHabit = useStore((s) => s.deleteHabit)
  const toast = useStore((s) => s.toast)
  const [confirm, setConfirm] = useState(false)

  const stats = useMemo(() => {
    let total = 0
    for (const [k, v] of Object.entries(counts)) if (k.startsWith(habit.id + '|') && v >= habit.target) total++
    return {
      streak: currentStreak(habit, counts, today),
      best: bestStreak(habit, counts, today),
      rate: habitRate(habit, counts, 30, today),
      total,
    }
  }, [habit, counts, today])

  const weekly = useMemo(() => {
    const out = []
    for (let w = 11; w >= 0; w--) {
      const end = addDays(today, -w * 7)
      const start = addDays(end, -6)
      let n = 0, s = 0
      for (let i = 0; i < 7; i++) {
        const day = addDays(start, i)
        if (!isScheduled(habit, day) || (day === today && ratioOf(counts, habit, day) < 1)) continue
        n++
        s += ratioOf(counts, habit, day)
      }
      out.push({ label: shortLabel(start), value: n ? s / n : 0, tip: `${shortLabel(start)} – ${shortLabel(end)}` })
    }
    return out
  }, [habit, counts, today])

  return (
    <div>
      <div className="row" style={{ gap: 14, marginBottom: 18 }}>
        <motion.div
          className="habit-emoji"
          style={{ width: 64, height: 64, fontSize: 32, borderRadius: 22, background: `color-mix(in srgb, ${habit.color} 22%, var(--surface))` }}
          initial={{ scale: 0.5, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.1 }}
        >
          {habit.emoji}
        </motion.div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sheet-title" style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.name}</div>
          <div className="text-2" style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>
            {daysLabel(habit.days)}
            {habit.target > 1 && ` · ${habit.target} ${habit.unit || 'vezes'}`}
            {habit.reminder_time && ` · ⏰ ${habit.reminder_time}`}
          </div>
        </div>
        <Tap className="icon-btn" onClick={onEdit} aria-label="Editar">
          <IconEdit size={19} />
        </Tap>
      </div>

      <div className="tiles" style={{ marginBottom: 14 }}>
        {[
          { label: 'Sequência', value: stats.streak, suffix: stats.streak === 1 ? ' dia' : ' dias', icon: <IconFlame size={15} />, c: '#f97316' },
          { label: 'Recorde', value: stats.best, suffix: stats.best === 1 ? ' dia' : ' dias', icon: <IconTrophy size={15} />, c: '#facc15' },
          { label: 'Taxa (30d)', value: stats.rate * 100, suffix: '%', icon: <IconTarget size={15} />, c: habit.color },
          { label: 'Concluído', value: stats.total, suffix: 'x', icon: <IconCheck size={15} />, c: '#22c55e' },
        ].map((t, i) => (
          <motion.div
            key={t.label}
            className="tile"
            style={{ background: 'var(--surface-2)' }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05, ...spring }}
          >
            <div className="tile-label">
              <span style={{ color: t.c, display: 'grid' }}>{t.icon}</span>
              {t.label}
            </div>
            <div className="tile-value">
              <CountUp value={t.value} />
              <span style={{ fontSize: 15, color: 'var(--text-2)' }}>{t.suffix}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="card" style={{ background: 'var(--surface-2)', boxShadow: 'none', marginBottom: 14, padding: '16px 12px 8px' }}>
        <div className="label" style={{ marginBottom: 8 }}>Conclusão por semana</div>
        <AreaChart data={weekly} color={habit.color} height={180} animKey={habit.id} />
      </div>

      <MonthCalendar habit={habit} counts={counts} today={today} onToggle={(day, done) => setCount(habit.id, day, done ? 0 : habit.target)} />

      <div className="row" style={{ marginTop: 18 }}>
        <Tap
          className="btn"
          style={{ flex: 1 }}
          onClick={() => {
            void updateHabit(habit.id, { archived: !habit.archived })
            toast(habit.archived ? 'Hábito restaurado' : 'Hábito arquivado', { emoji: '📦' })
            onClose()
          }}
        >
          <IconArchive size={18} /> {habit.archived ? 'Restaurar' : 'Arquivar'}
        </Tap>
        <Tap
          className="btn btn-danger"
          style={{ flex: 1 }}
          onClick={() => {
            if (!confirm) {
              haptic(20)
              setConfirm(true)
              setTimeout(() => setConfirm(false), 3000)
              return
            }
            onClose()
            void deleteHabit(habit.id)
            toast('Hábito excluído', { emoji: '🗑️' })
          }}
        >
          <IconTrash size={18} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={String(confirm)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
              {confirm ? 'Confirmar?' : 'Excluir'}
            </motion.span>
          </AnimatePresence>
        </Tap>
      </div>
    </div>
  )
}

function MonthCalendar({ habit, counts, today, onToggle }: {
  habit: Habit
  counts: Record<string, number>
  today: string
  onToggle: (day: string, done: boolean) => void
}) {
  const [offset, setOffset] = useState(0)
  const [dir, setDir] = useState(0)
  const base = fromKey(today)
  const first = new Date(base.getFullYear(), base.getMonth() + offset, 1)
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const lead = first.getDay()
  const created = createdKey(habit.created_at)

  const go = (d: number) => {
    setDir(d)
    setOffset((o) => o + d)
  }

  return (
    <div className="card" style={{ background: 'var(--surface-2)', boxShadow: 'none', padding: 14 }}>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <Tap className="icon-btn" style={{ width: 34, height: 34, boxShadow: 'none' }} onClick={() => go(-1)} aria-label="Mês anterior">
          <IconChevronLeft size={18} />
        </Tap>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={offset} style={{ fontWeight: 800 }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
            {MONTHS_LONG[first.getMonth()]} {first.getFullYear()}
          </motion.div>
        </AnimatePresence>
        <Tap className="icon-btn" style={{ width: 34, height: 34, boxShadow: 'none', opacity: offset >= 0 ? 0.3 : 1 }} disabled={offset >= 0} onClick={() => go(1)} aria-label="Próximo mês">
          <IconChevronRight size={18} />
        </Tap>
      </div>
      <div className="cal">
        {WEEKDAYS_SHORT.map((w, i) => (
          <div key={i} className="cal-head">{w}</div>
        ))}
      </div>
      <div style={{ overflow: 'hidden' }}>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={offset}
            className="cal"
            custom={dir}
            variants={{
              enter: (d: number) => ({ x: d * 60, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -60, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
          >
            {Array.from({ length: lead }, (_, i) => <div key={`l${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = toKey(new Date(first.getFullYear(), first.getMonth(), i + 1))
              const future = day > today
              const beforeStart = day < created
              const sched = habit.days.includes(new Date(first.getFullYear(), first.getMonth(), i + 1).getDay())
              const r = Math.min(1, (counts[ck(habit.id, day)] ?? 0) / habit.target)
              const done = r >= 1
              const bg = done ? habit.color : r > 0 ? `color-mix(in srgb, ${habit.color} 35%, var(--surface))` : sched && !future && !beforeStart ? 'var(--surface)' : 'transparent'
              return (
                <motion.button
                  key={day}
                  className="cal-day"
                  disabled={future}
                  whileTap={{ scale: 0.8 }}
                  onClick={() => {
                    haptic(10)
                    onToggle(day, done)
                  }}
                  animate={{ backgroundColor: bg, color: done ? '#ffffff' : future || !sched ? 'var(--muted)' : 'var(--text)' }}
                  transition={{ duration: 0.2 }}
                  style={{ opacity: future ? 0.35 : 1, outline: day === today ? `2px solid ${habit.color}` : undefined, outlineOffset: -2 }}
                >
                  {i + 1}
                </motion.button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 10, fontWeight: 600 }}>
        Toque num dia para marcar/desmarcar
      </div>
    </div>
  )
}
