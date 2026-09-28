import { animate, motion, useMotionValue, useReducedMotion, useTransform, type HTMLMotionProps } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export const spring = { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 } as const
export const softSpring = { type: 'spring', stiffness: 260, damping: 26 } as const

/** Botão com "squish" ao tocar */
export function Tap({ children, scale = 0.94, ...rest }: HTMLMotionProps<'button'> & { scale?: number }) {
  return (
    <motion.button whileTap={{ scale }} transition={spring} {...rest}>
      {children}
    </motion.button>
  )
}

/** Número que conta até o valor */
export function CountUp({ value, format = (n: number) => String(Math.round(n)), duration = 0.9 }: {
  value: number
  format?: (n: number) => string
  duration?: number
}) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(reduce ? value : 0)
  const text = useTransform(mv, format)
  useEffect(() => {
    const c = animate(mv, value, { duration: reduce ? 0 : duration, ease: [0.22, 1, 0.36, 1] })
    return c.stop
  }, [value, duration, mv, reduce])
  return <motion.span className="tnum">{text}</motion.span>
}

/** Anel de progresso animado */
export function Ring({ value, size = 96, stroke = 10, color = 'url(#ringGrad)', track = 'var(--surface-2)', children }: {
  value: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--accent)" />
            <stop offset="1" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, value))) }}
          transition={{ type: 'spring', stiffness: 90, damping: 18 }}
        />
      </svg>
      {children && <div className="ring-label">{children}</div>}
    </div>
  )
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <motion.div layout transition={spring} />
    </button>
  )
}

export function Segmented<T extends string | number>({ options, value, onChange, id }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  id: string
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.value)} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.value === value && <motion.div layoutId={`seg-${id}`} className="seg-pill" transition={spring} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

/** Entra em cascata quando aparece */
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
}
export const rise = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: softSpring },
}

/** Mede a largura de um elemento (para o gráfico) */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}
