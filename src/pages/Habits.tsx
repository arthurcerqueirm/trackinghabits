import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Habit } from '../lib/types'
import { currentStreak } from '../lib/stats'
import { daysLabel } from '../components/HabitSheets'
import { IconBell, IconChevronRight, IconFlame, IconGrip, IconPlus } from '../components/Icons'
import { rise, spring, stagger, Tap } from '../components/ui'

export function HabitsPage({ onOpenHabit, onNew }: { onOpenHabit: (h: Habit) => void; onNew: () => void }) {
  const habits = useStore((s) => s.habits)
  const counts = useStore((s) => s.counts)
  const today = useStore((s) => s.today)
  const reorder = useStore((s) => s.reorder)
  const updateHabit = useStore((s) => s.updateHabit)
  const [showArchived, setShowArchived] = useState(false)

  const active = useMemo(() => habits.filter((h) => !h.archived), [habits])
  const archived = useMemo(() => habits.filter((h) => h.archived), [habits])
  const [order, setOrder] = useState(active.map((h) => h.id))
  useEffect(() => setOrder(active.map((h) => h.id)), [active])
  const byId = useMemo(() => new Map(active.map((h) => [h.id, h])), [active])

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.header className="header" variants={rise}>
        <div>
          <div className="eyebrow">{active.length} {active.length === 1 ? 'ativo' : 'ativos'}</div>
          <h1 className="title">Meus hábitos</h1>
        </div>
        <Tap className="btn btn-primary btn-sm" onClick={onNew}>
          <IconPlus size={18} /> Novo
        </Tap>
      </motion.header>

      {active.length === 0 && (
        <motion.div className="card empty" variants={rise}>
          <div className="empty-emoji">📋</div>
          <p className="text-2" style={{ marginTop: 10 }}>Nenhum hábito ainda. Crie o primeiro!</p>
        </motion.div>
      )}

      {active.length > 1 && (
        <motion.p className="muted" variants={rise} style={{ fontSize: 12.5, fontWeight: 600, margin: '0 4px 10px' }}>
          Segure e arraste ⠿ para reordenar
        </motion.p>
      )}

      <Reorder.Group axis="y" values={order} onReorder={setOrder} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {order.map((id, i) => {
          const h = byId.get(id)
          if (!h) return null
          return (
            <Row
              key={id}
              habit={h}
              index={i}
              streak={currentStreak(h, counts, today)}
              onOpen={() => onOpenHabit(h)}
              onDrop={() => reorder(order)}
            />
          )
        })}
      </Reorder.Group>

      {archived.length > 0 && (
        <>
          <motion.button className="section-title" style={{ width: 'calc(100% - 8px)' }} onClick={() => setShowArchived((v) => !v)} variants={rise}>
            <span>Arquivados ({archived.length})</span>
            <motion.span animate={{ rotate: showArchived ? 90 : 0 }} transition={spring} style={{ display: 'grid' }}>
              <IconChevronRight size={18} />
            </motion.span>
          </motion.button>
          <AnimatePresence initial={false}>
            {showArchived && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} style={{ overflow: 'hidden' }}>
                <div className="list">
                  {archived.map((h) => (
                    <div key={h.id} className="list-item">
                      <div className="habit-emoji" style={{ width: 40, height: 40, fontSize: 20, borderRadius: 14, background: 'var(--surface-2)', filter: 'grayscale(0.6)' }}>
                        {h.emoji}
                      </div>
                      <button className="grow" style={{ textAlign: 'left' }} onClick={() => onOpenHabit(h)}>
                        <div className="t">{h.name}</div>
                        <div className="s">{daysLabel(h.days)}</div>
                      </button>
                      <Tap className="btn btn-sm" onClick={() => updateHabit(h.id, { archived: false })}>
                        Restaurar
                      </Tap>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  )
}

function Row({ habit, index, streak, onOpen, onDrop }: { habit: Habit; index: number; streak: number; onOpen: () => void; onDrop: () => void }) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={habit.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: index * 0.04 }}
      whileDrag={{ scale: 1.03, boxShadow: 'var(--shadow-lg)', zIndex: 5 }}
      className="habit"
      style={{ position: 'relative', cursor: 'default' }}
    >
      <div className="drag-handle" onPointerDown={(e) => controls.start(e)} aria-label="Arrastar">
        <IconGrip size={18} />
      </div>
      <div className="habit-emoji" style={{ width: 46, height: 46, fontSize: 23, borderRadius: 16, background: `color-mix(in srgb, ${habit.color} 20%, var(--surface))` }}>
        {habit.emoji}
      </div>
      <button className="habit-body" style={{ textAlign: 'left' }} onClick={onOpen}>
        <div className="habit-name">{habit.name}</div>
        <div className="habit-meta">
          <span>{daysLabel(habit.days)}</span>
          {habit.reminder_time && (
            <span className="meta-chip muted">
              <IconBell size={12} /> {habit.reminder_time}
            </span>
          )}
          {streak > 0 && (
            <span className="meta-chip" style={{ color: '#f97316' }}>
              <IconFlame size={13} /> {streak}
            </span>
          )}
        </div>
      </button>
      <span style={{ width: 10, height: 36, borderRadius: 99, background: habit.color, flexShrink: 0 }} />
    </Reorder.Item>
  )
}
