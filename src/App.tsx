import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { useStore } from './store'
import type { Habit } from './lib/types'
import { countOf } from './lib/stats'
import { BottomNav, TABS, Toasts, type Tab } from './components/Chrome'
import { Sheet } from './components/Sheet'
import { HabitDetail, HabitForm } from './components/HabitSheets'
import { TodayPage } from './pages/Today'
import { StatsPage } from './pages/Stats'
import { HabitsPage } from './pages/Habits'
import { SettingsPage, applyTheme, type ThemePref } from './pages/Settings'
import { AuthPage } from './pages/Auth'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    // tema "sistema" acompanha o SO em tempo real
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const pref = (localStorage.getItem('habitos:theme') as ThemePref) || 'system'
      if (pref === 'system') applyTheme('system')
    }
    mq.addEventListener('change', onChange)
    return () => {
      data.subscription.unsubscribe()
      mq.removeEventListener('change', onChange)
    }
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <Toasts />
      <AnimatePresence mode="wait">
        {session === undefined ? (
          <motion.div key="splash" className="splash" exit={{ opacity: 0 }}>
            <motion.div className="logo" animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
          </motion.div>
        ) : session ? (
          <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Shell session={session} />
          </motion.div>
        ) : (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
            <AuthPage />
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  )
}

function Shell({ session }: { session: Session }) {
  const boot = useStore((s) => s.boot)
  const reset = useStore((s) => s.reset)
  const habits = useStore((s) => s.habits)
  const [tab, setTab] = useState<Tab>('today')
  const [dir, setDir] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [form, setForm] = useState<{ open: boolean; habit: Habit | null }>({ open: false, habit: null })
  const lastHidden = useRef(0)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    void boot(session.user.id)
    return () => reset()
  }, [session.user.id, boot, reset])

  // volta ao app: atualiza dados e o "hoje"
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') lastHidden.current = Date.now()
      else {
        useStore.getState().tick()
        if (Date.now() - lastHidden.current > 30_000) void useStore.getState().refresh()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    const t = setInterval(() => useStore.getState().tick(), 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      clearInterval(t)
    }
  }, [])

  // ação "✓ Feito" vinda da notificação
  const markDone = useCallback((habitId: string) => {
    const s = useStore.getState()
    const h = s.habits.find((x) => x.id === habitId)
    if (!h) return
    if (countOf(s.counts, h, s.today) < h.target) s.setCount(h.id, s.today, h.target)
    s.toast(`${h.emoji} ${h.name} concluído!`)
  }, [])
  const ready = useStore((s) => s.ready)
  useEffect(() => {
    if (!ready) return
    const params = new URLSearchParams(location.search)
    const done = params.get('done')
    if (done) {
      markDone(done)
      history.replaceState(null, '', '/')
    }
    const onMsg = (e: MessageEvent) => e.data?.type === 'habit-done' && markDone(e.data.habitId)
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg)
  }, [ready, markDone])

  const changeTab = (t: Tab) => {
    if (t === tab) return
    const i = TABS.findIndex((x) => x.id === t)
    const j = TABS.findIndex((x) => x.id === tab)
    setDir(i > j ? 1 : -1)
    setTab(t)
    window.scrollTo({ top: 0 })
  }

  const openHabit = useCallback((h: Habit) => setDetailId(h.id), [])
  const openNew = useCallback(() => setForm({ open: true, habit: null }), [])
  const detail = habits.find((h) => h.id === detailId) ?? null

  return (
    <div className="app">
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.main
          key={tab}
          className="page"
          custom={dir}
          variants={{
            enter: (d: number) => ({ x: d * 40, opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit: (d: number) => ({ x: d * -40, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ x: { type: 'spring', stiffness: 500, damping: 40 }, opacity: { duration: 0.14 } }}
        >
          {tab === 'today' && <TodayPage onOpenHabit={openHabit} onNew={openNew} />}
          {tab === 'stats' && <StatsPage onOpenHabit={openHabit} />}
          {tab === 'habits' && <HabitsPage onOpenHabit={openHabit} onNew={openNew} />}
          {tab === 'settings' && <SettingsPage email={session.user.email ?? ''} />}
        </motion.main>
      </AnimatePresence>

      <BottomNav tab={tab} onChange={changeTab} />

      <Sheet open={!!detail && !form.open} onClose={() => setDetailId(null)}>
        {detail && (
          <HabitDetail
            habit={detail}
            onClose={() => setDetailId(null)}
            onEdit={() => setForm({ open: true, habit: detail })}
          />
        )}
      </Sheet>

      <Sheet open={form.open} onClose={() => setForm((f) => ({ ...f, open: false }))}>
        <HabitForm key={form.habit?.id ?? 'new'} habit={form.habit} onDone={() => setForm((f) => ({ ...f, open: false }))} />
      </Sheet>
    </div>
  )
}
