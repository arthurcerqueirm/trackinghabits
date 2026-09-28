import { AnimatePresence, motion } from 'framer-motion'
import { memo, useEffect, useRef, useState } from 'react'
import type { Habit } from '../lib/types'
import { haptic } from '../lib/push'
import { IconBell, IconFlame } from './Icons'
import { spring } from './ui'

const PARTICLES = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1)
  const d = 30 + (i % 3) * 8
  return { x: Math.cos(a) * d, y: Math.sin(a) * d, s: i % 3 === 0 ? 1.2 : 0.8 }
})

export const CheckButton = memo(function CheckButton({ color, count, target, onTap, onLongPress, size = 48 }: {
  color: string
  count: number
  target: number
  onTap: () => void
  onLongPress?: () => void
  size?: number
}) {
  const done = count >= target
  const [burst, setBurst] = useState(0)
  const prevDone = useRef(done)
  const pressTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const longFired = useRef(false)

  useEffect(() => {
    if (done && !prevDone.current) setBurst((b) => b + 1)
    prevDone.current = done
  }, [done])

  const r = size / 2 - 2
  const c = 2 * Math.PI * r

  return (
    <motion.button
      className="check"
      style={{ width: size, height: size }}
      aria-label={done ? 'Desmarcar' : 'Marcar como feito'}
      whileTap={{ scale: 0.84 }}
      transition={spring}
      onPointerDown={() => {
        longFired.current = false
        if (onLongPress)
          pressTimer.current = setTimeout(() => {
            longFired.current = true
            haptic(30)
            onLongPress()
          }, 480)
      }}
      onPointerUp={() => clearTimeout(pressTimer.current)}
      onPointerLeave={() => clearTimeout(pressTimer.current)}
      onClick={(e) => {
        e.stopPropagation()
        if (longFired.current) return
        haptic(done ? 8 : [14, 30, 20])
        onTap()
      }}
    >
      {/* fundo */}
      <motion.span
        style={{ position: 'absolute', inset: 0, borderRadius: 999, background: color }}
        initial={false}
        animate={{ scale: done ? 1 : 0.4, opacity: done ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      />
      {/* anel de progresso (metas > 1) */}
      <svg className="check-ring" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={3} opacity={done ? 0 : 1} />
        {target > 1 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={false}
            animate={{ strokeDashoffset: c * (1 - Math.min(1, count / target)), opacity: done ? 0 : 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
          />
        )}
      </svg>

      <AnimatePresence mode="popLayout" initial={false}>
        {done ? (
          <motion.svg
            key="check"
            width={size * 0.5}
            height={size * 0.5}
            viewBox="0 0 24 24"
            style={{ position: 'relative' }}
            initial={{ scale: 0.3, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 600, damping: 20 }}
          >
            <motion.path
              d="M5 12.5 10 17.5 19 7.5"
              fill="none"
              stroke="#fff"
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
            />
          </motion.svg>
        ) : target > 1 ? (
          <motion.span
            key={`n${count}`}
            className="tnum"
            style={{ position: 'relative', fontWeight: 800, fontSize: 14, color: 'var(--text)' }}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={spring}
          >
            {count}
          </motion.span>
        ) : null}
      </AnimatePresence>

      {/* explosão */}
      <AnimatePresence>
        {burst > 0 && (
          <motion.span key={burst} style={{ position: 'absolute', inset: 0 }} initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.span
              style={{ position: 'absolute', inset: -2, borderRadius: 999, border: `2px solid ${color}` }}
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
            {PARTICLES.map((p, i) => (
              <motion.span
                key={i}
                className="particle"
                style={{ background: i % 2 ? color : 'var(--accent-2)' }}
                initial={{ x: 0, y: 0, scale: 0 }}
                animate={{ x: p.x, y: p.y, scale: [0, p.s, 0] }}
                transition={{ duration: 0.6, ease: [0.2, 0.8, 0.3, 1] }}
                onAnimationComplete={i === 0 ? () => setBurst(0) : undefined}
              />
            ))}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
})

export const HabitCard = memo(function HabitCard({ habit, count, streak, onToggle, onReset, onOpen }: {
  habit: Habit
  count: number
  streak: number
  onToggle: (h: Habit) => void
  onReset: (h: Habit) => void
  onOpen: (h: Habit) => void
}) {
  const done = count >= habit.target
  const ratio = Math.min(1, count / habit.target)

  return (
    <motion.div
      className="habit"
      onClick={() => onOpen(habit)}
      whileTap={{ scale: 0.985 }}
      transition={spring}
    >
      <motion.div
        className="habit-fill"
        style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${habit.color} 16%, transparent), color-mix(in srgb, ${habit.color} 8%, transparent))` }}
        initial={false}
        animate={{ scaleX: ratio }}
        transition={{ type: 'spring', stiffness: 160, damping: 24 }}
      />
      <motion.div
        className="habit-emoji"
        style={{ background: `color-mix(in srgb, ${habit.color} 20%, var(--surface))` }}
        animate={done ? { rotate: [0, -14, 12, -6, 0], scale: [1, 1.15, 1] } : { rotate: 0, scale: 1 }}
        transition={{ duration: 0.55 }}
      >
        {habit.emoji}
      </motion.div>

      <div className="habit-body">
        <div className="habit-name" style={{ color: done ? 'var(--text-2)' : 'var(--text)' }}>
          {habit.name}
        </div>
        <div className="habit-meta">
          {streak > 0 && (
            <motion.span className="meta-chip" style={{ color: '#f97316' }} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} key={streak}>
              <IconFlame size={14} /> {streak}
            </motion.span>
          )}
          {habit.target > 1 && (
            <span className="meta-chip tnum">
              {count}/{habit.target} {habit.unit || ''}
            </span>
          )}
          {habit.reminder_time && (
            <span className="meta-chip muted">
              <IconBell size={13} /> {habit.reminder_time}
            </span>
          )}
          {streak === 0 && habit.target === 1 && !habit.reminder_time && <span className="muted">{done ? 'Feito hoje 🎉' : 'Toque para marcar'}</span>}
        </div>
      </div>

      <CheckButton
        color={habit.color}
        count={count}
        target={habit.target}
        onTap={() => onToggle(habit)}
        onLongPress={count > 0 ? () => onReset(habit) : undefined}
      />
    </motion.div>
  )
})
