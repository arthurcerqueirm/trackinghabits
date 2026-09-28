export type Habit = {
  id: string
  user_id: string
  name: string
  emoji: string
  color: string
  target: number
  unit: string | null
  days: number[]
  reminder_time: string | null
  archived: boolean
  position: number
  created_at: string
}

export type Profile = {
  id: string
  name: string | null
  timezone: string
  daily_reminder: string | null
  notifications_enabled: boolean
}

export type HabitDraft = Pick<Habit, 'name' | 'emoji' | 'color' | 'target' | 'unit' | 'days' | 'reminder_time'>
