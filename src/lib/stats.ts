import type { Habit } from './types'
import { addDays, createdKey, diffDays, todayKey, weekday } from './date'

export type Counts = Record<string, number>
export const ck = (habitId: string, day: string) => `${habitId}|${day}`

export const isScheduled = (h: Habit, day: string) =>
  h.days.includes(weekday(day)) && day >= createdKey(h.created_at)

export const countOf = (counts: Counts, h: Habit, day: string) => counts[ck(h.id, day)] ?? 0
export const isDone = (counts: Counts, h: Habit, day: string) => countOf(counts, h, day) >= h.target
export const ratioOf = (counts: Counts, h: Habit, day: string) => Math.min(1, countOf(counts, h, day) / h.target)

export function dayProgress(habits: Habit[], counts: Counts, day: string) {
  let total = 0, done = 0, partial = 0
  for (const h of habits) {
    if (h.archived || !isScheduled(h, day)) continue
    total++
    const r = ratioOf(counts, h, day)
    partial += r
    if (r >= 1) done++
  }
  return { total, done, ratio: total ? partial / total : 0 }
}

/** Sequência atual: hoje ainda incompleto não quebra a sequência */
export function currentStreak(h: Habit, counts: Counts, today = todayKey()) {
  const start = createdKey(h.created_at)
  let day = today
  let streak = 0
  if (isScheduled(h, day) && !isDone(counts, h, day)) day = addDays(day, -1)
  for (let i = 0; i < 1500 && day >= start; i++, day = addDays(day, -1)) {
    if (!h.days.includes(weekday(day))) continue
    if (isDone(counts, h, day)) streak++
    else break
  }
  return streak
}

export function bestStreak(h: Habit, counts: Counts, today = todayKey()) {
  const start = createdKey(h.created_at)
  let best = 0, run = 0
  const n = Math.min(1500, diffDays(today, start))
  for (let i = 0; i <= n; i++) {
    const day = addDays(start, i)
    if (!h.days.includes(weekday(day))) continue
    if (isDone(counts, h, day)) best = Math.max(best, ++run)
    else if (day !== today) run = 0
  }
  return best
}

/** Taxa de conclusão de um hábito nos últimos N dias (hoje só conta se concluído) */
export function habitRate(h: Habit, counts: Counts, days: number, today = todayKey()) {
  let total = 0, sum = 0
  for (let i = 0; i < days; i++) {
    const day = addDays(today, -i)
    if (!isScheduled(h, day)) continue
    if (day === today && !isDone(counts, h, day)) continue
    total++
    sum += ratioOf(counts, h, day)
  }
  return total ? sum / total : 0
}

export function series(habits: Habit[], counts: Counts, days: number, today = todayKey()) {
  const out: { day: string; value: number; done: number; total: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i)
    const p = dayProgress(habits, counts, day)
    out.push({ day, value: p.ratio, done: p.done, total: p.total })
  }
  return out
}

/** Dias perfeitos seguidos (todos os hábitos programados concluídos) */
export function perfectStreak(habits: Habit[], counts: Counts, today = todayKey()) {
  const active = habits.filter((h) => !h.archived)
  if (!active.length) return 0
  const firstDay = active.map((h) => createdKey(h.created_at)).sort()[0]
  let day = today
  let s = 0
  const p0 = dayProgress(active, counts, day)
  if (p0.done < p0.total) day = addDays(day, -1)
  for (let i = 0; i < 1500 && day >= firstDay; i++, day = addDays(day, -1)) {
    const p = dayProgress(active, counts, day)
    if (p.total === 0) continue
    if (p.done === p.total) s++
    else break
  }
  return s
}

export function weekdayAverages(habits: Habit[], counts: Counts, days: number, today = todayKey()) {
  const sum = Array(7).fill(0), n = Array(7).fill(0)
  for (let i = 0; i < days; i++) {
    const day = addDays(today, -i)
    const p = dayProgress(habits, counts, day)
    if (!p.total || (day === today && p.done < p.total)) continue
    sum[weekday(day)] += p.ratio
    n[weekday(day)]++
  }
  return sum.map((s, i) => (n[i] ? s / n[i] : null))
}
