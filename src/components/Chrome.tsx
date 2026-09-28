import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { haptic } from '../lib/push'
import { IconChart, IconHome, IconList, IconSettings } from './Icons'
import { spring } from './ui'

export type Tab = 'today' | 'stats' | 'habits' | 'settings'
export const TABS: { id: Tab; label: string; Icon: typeof IconHome }[] = [
  { id: 'today', label: 'Hoje', Icon: IconHome },
  { id: 'stats', label: 'Stats', Icon: IconChart },
  { id: 'habits', label: 'Hábitos', Icon: IconList },
  { id: 'settings', label: 'Ajustes', Icon: IconSettings },
]

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="nav-wrap">
      <motion.nav className="nav" initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...spring, delay: 0.1 }}>
        {TABS.map(({ id, label, Icon }) => {
          const active = id === tab
          return (
            <motion.button
              key={id}
              className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => {
                if (!active) haptic(8)
                onChange(id)
              }}
              whileTap={{ scale: 0.9 }}
              aria-label={label}
            >
              {active && <motion.div layoutId="nav-pill" className="nav-pill" transition={spring} />}
              <motion.span animate={active ? { y: [0, -3, 0], rotate: [0, -8, 0] } : {}} transition={{ duration: 0.35 }} style={{ display: 'grid' }}>
                <Icon size={21} />
              </motion.span>
              <AnimatePresence initial={false}>
                {active && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={spring}
                    style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )
        })}
      </motion.nav>
    </div>
  )
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="toasts">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            className="toast"
            initial={{ opacity: 0, y: -24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.9 }}
            transition={spring}
            style={t.tone === 'error' ? { background: 'var(--danger)', color: '#fff' } : undefined}
          >
            {t.emoji && <span>{t.emoji}</span>}
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
