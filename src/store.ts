import { create } from 'zustand'
import { supabase } from './lib/supabase'
import type { Habit, HabitDraft, Profile } from './lib/types'
import { addDays, todayKey } from './lib/date'
import { ck, type Counts } from './lib/stats'

type Pending = Record<string, { habit_id: string; day: string; count: number }>

type Toast = { id: number; text: string; tone?: 'ok' | 'error' | 'info'; emoji?: string }

type State = {
  userId: string | null
  profile: Profile | null
  habits: Habit[]
  counts: Counts
  ready: boolean
  today: string
  selectedDay: string
  toasts: Toast[]

  boot: (userId: string) => Promise<void>
  refresh: () => Promise<void>
  reset: () => void
  setSelectedDay: (d: string) => void
  tick: () => void

  setCount: (habitId: string, day: string, count: number) => void
  addHabit: (d: HabitDraft) => Promise<Habit | null>
  updateHabit: (id: string, patch: Partial<Habit>) => Promise<void>
  deleteHabit: (id: string) => Promise<void>
  reorder: (ids: string[]) => void
  updateProfile: (patch: Partial<Profile>) => Promise<void>
  toast: (text: string, opts?: Omit<Toast, 'id' | 'text'>) => void
}

const cacheKey = (u: string) => `habitos:cache:${u}`
const pendingKey = (u: string) => `habitos:pending:${u}`
const readJSON = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
const writeJSON = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* storage cheio / privado */
  }
}

let pending: Pending = {}
let flushTimer: ReturnType<typeof setTimeout> | undefined
let toastId = 0

const sortHabits = (hs: Habit[]) =>
  [...hs].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))

export const useStore = create<State>((set, get) => {
  async function flush() {
    const { userId } = get()
    if (!userId) return
    const entries = Object.entries(pending)
    if (!entries.length || !navigator.onLine) return
    const snapshot = Object.fromEntries(entries)
    const upserts = entries.filter(([, v]) => v.count > 0).map(([, v]) => ({ ...v, updated_at: new Date().toISOString() }))
    const deletes = entries.filter(([, v]) => v.count <= 0).map(([, v]) => v)

    try {
      if (upserts.length) {
        const { error } = await supabase.from('checkins').upsert(upserts, { onConflict: 'habit_id,day' })
        if (error) throw error
      }
      for (const d of deletes) {
        const { error } = await supabase.from('checkins').delete().eq('habit_id', d.habit_id).eq('day', d.day)
        if (error) throw error
      }
      // remove apenas o que não mudou durante o envio
      for (const [k, v] of Object.entries(snapshot)) {
        if (pending[k]?.count === v.count) delete pending[k]
      }
      writeJSON(pendingKey(userId), pending)
    } catch (e) {
      console.warn('sync falhou, tentando depois', e)
    }
  }

  const scheduleFlush = () => {
    clearTimeout(flushTimer)
    flushTimer = setTimeout(flush, 350)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => void flush())
  }

  let persistTimer: ReturnType<typeof setTimeout> | undefined
  const persist = () => {
    clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      const { userId, habits, counts, profile } = get()
      if (userId) writeJSON(cacheKey(userId), { habits, counts, profile })
    }, 400)
  }

  async function loadAll(userId: string) {
    const since = addDays(todayKey(), -400)
    const [profRes, habRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('habits').select('*').order('position').order('created_at'),
    ])
    if (habRes.error) throw habRes.error

    const counts: Counts = {}
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('checkins')
        .select('habit_id, day, count')
        .gte('day', since)
        .order('day')
        .range(from, from + PAGE - 1)
      if (error) throw error
      for (const c of data) counts[ck(c.habit_id, c.day)] = c.count
      if (data.length < PAGE) break
    }
    for (const v of Object.values(pending)) counts[ck(v.habit_id, v.day)] = v.count

    let profile = profRes.data as Profile | null
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!profile) {
      const { data: u } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('profiles')
        .upsert({ id: userId, name: u.user?.user_metadata?.name ?? u.user?.email?.split('@')[0], timezone: tz })
        .select()
        .single()
      profile = data as Profile
    } else if (profile.timezone !== tz) {
      profile = { ...profile, timezone: tz }
      void supabase.from('profiles').update({ timezone: tz }).eq('id', userId)
    }

    set({ habits: sortHabits(habRes.data as Habit[]), counts, profile, ready: true })
    persist()
  }

  return {
    userId: null,
    profile: null,
    habits: [],
    counts: {},
    ready: false,
    today: todayKey(),
    selectedDay: todayKey(),
    toasts: [],

    async boot(userId) {
      pending = readJSON<Pending>(pendingKey(userId), {})
      const cached = readJSON<{ habits: Habit[]; counts: Counts; profile: Profile | null } | null>(cacheKey(userId), null)
      set({
        userId,
        ...(cached ? { habits: cached.habits, counts: cached.counts, profile: cached.profile, ready: true } : {}),
      })
      try {
        await loadAll(userId)
        void flush()
      } catch (e) {
        console.error(e)
        if (!cached) set({ ready: true })
        get().toast('Sem conexão — usando dados salvos', { tone: 'info', emoji: '📡' })
      }
    },

    async refresh() {
      const { userId } = get()
      if (!userId) return
      await flush()
      try {
        await loadAll(userId)
      } catch {
        /* offline */
      }
    },

    reset() {
      pending = {}
      set({ userId: null, profile: null, habits: [], counts: {}, ready: false })
    },

    setSelectedDay: (d) => set({ selectedDay: d }),

    tick() {
      const t = todayKey()
      const { today, selectedDay } = get()
      if (t !== today) set({ today: t, selectedDay: selectedDay === today ? t : selectedDay })
    },

    setCount(habitId, day, count) {
      const { userId } = get()
      if (!userId) return
      const k = ck(habitId, day)
      const counts = { ...get().counts }
      if (count > 0) counts[k] = count
      else delete counts[k]
      set({ counts })
      pending[k] = { habit_id: habitId, day, count }
      writeJSON(pendingKey(userId), pending)
      persist()
      scheduleFlush()
    },

    async addHabit(d) {
      const { userId, habits } = get()
      if (!userId) return null
      const habit: Habit = {
        ...d,
        id: crypto.randomUUID(),
        user_id: userId,
        archived: false,
        position: habits.length ? Math.max(...habits.map((h) => h.position)) + 1 : 0,
        created_at: new Date().toISOString(),
      }
      set({ habits: sortHabits([...habits, habit]) })
      persist()
      const { error } = await supabase.from('habits').insert(habit)
      if (error) {
        set({ habits: get().habits.filter((h) => h.id !== habit.id) })
        get().toast('Não foi possível criar o hábito', { tone: 'error' })
        return null
      }
      return habit
    },

    async updateHabit(id, patch) {
      const prev = get().habits
      set({ habits: sortHabits(prev.map((h) => (h.id === id ? { ...h, ...patch } : h))) })
      persist()
      const { error } = await supabase.from('habits').update(patch).eq('id', id)
      if (error) {
        set({ habits: prev })
        get().toast('Não foi possível salvar', { tone: 'error' })
      }
    },

    async deleteHabit(id) {
      const prev = get().habits
      const prevCounts = get().counts
      const counts = Object.fromEntries(Object.entries(prevCounts).filter(([k]) => !k.startsWith(id + '|')))
      for (const k of Object.keys(pending)) if (k.startsWith(id + '|')) delete pending[k]
      set({ habits: prev.filter((h) => h.id !== id), counts })
      persist()
      const { error } = await supabase.from('habits').delete().eq('id', id)
      if (error) {
        set({ habits: prev, counts: prevCounts })
        get().toast('Não foi possível excluir', { tone: 'error' })
      }
    },

    reorder(ids) {
      const byId = new Map(get().habits.map((h) => [h.id, h]))
      const changed: { id: string; position: number }[] = []
      const next = get().habits.map((h) => {
        const pos = ids.indexOf(h.id)
        if (pos === -1 || pos === h.position) return h
        changed.push({ id: h.id, position: pos })
        return { ...byId.get(h.id)!, position: pos }
      })
      set({ habits: sortHabits(next) })
      persist()
      void Promise.all(changed.map((c) => supabase.from('habits').update({ position: c.position }).eq('id', c.id)))
    },

    async updateProfile(patch) {
      const { profile, userId } = get()
      if (!userId) return
      const prev = profile
      set({ profile: { ...(profile as Profile), ...patch } })
      persist()
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
      if (error) {
        set({ profile: prev })
        get().toast('Não foi possível salvar', { tone: 'error' })
      }
    },

    toast(text, opts) {
      const id = ++toastId
      set({ toasts: [...get().toasts, { id, text, ...opts }].slice(-3) })
      setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2600)
    },
  }
})
