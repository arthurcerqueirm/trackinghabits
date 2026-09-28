import type { VercelRequest, VercelResponse } from '@vercel/node'
import { admin, localNow, sendToSubs, toMinutes, type PushPayload } from './_lib.js'

// Janela para disparar depois do horário marcado (o cron roda a cada 5 min)
const WINDOW_MIN = 30

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
  if (subErr) return res.status(500).json({ error: subErr.message })
  if (!subs?.length) return res.json({ sent: 0 })

  const userIds = [...new Set(subs.map((s) => s.user_id))]

  const [{ data: profiles }, { data: habits }] = await Promise.all([
    admin.from('profiles').select('id, timezone, daily_reminder, notifications_enabled, name').in('id', userIds),
    admin.from('habits').select('id, user_id, name, emoji, target, days, reminder_time').in('user_id', userIds).eq('archived', false),
  ])

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))
  const local = new Map(
    userIds.map((id) => [id, localNow(profileById.get(id)?.timezone || 'America/Sao_Paulo')]),
  )

  const dates = [...new Set([...local.values()].map((l) => l.date))]
  const { data: checkins } = await admin
    .from('checkins')
    .select('habit_id, day, count')
    .in('user_id', userIds)
    .in('day', dates)
  const countOf = new Map((checkins ?? []).map((c) => [`${c.habit_id}:${c.day}`, c.count as number]))

  type Job = { key: string; userId: string; payload: PushPayload }
  const jobs: Job[] = []
  const inWindow = (hhmm: string | null | undefined, now: number) => {
    if (!hhmm) return false
    const t = toMinutes(hhmm)
    return now >= t && now < t + WINDOW_MIN
  }

  for (const userId of userIds) {
    const prof = profileById.get(userId)
    if (prof && prof.notifications_enabled === false) continue
    const l = local.get(userId)!
    const todays = (habits ?? []).filter((h) => h.user_id === userId && (h.days as number[]).includes(l.weekday))
    const pending = todays.filter((h) => (countOf.get(`${h.id}:${l.date}`) ?? 0) < h.target)

    for (const h of pending) {
      if (!inWindow(h.reminder_time, l.minutes)) continue
      jobs.push({
        key: `h:${h.id}:${l.date}`,
        userId,
        payload: {
          title: `${h.emoji} ${h.name}`,
          body: h.target > 1 ? `Bora! Meta de hoje: ${h.target}x` : 'Hora de cumprir seu hábito 💪',
          tag: `habit-${h.id}`,
          habitId: h.id,
          url: '/',
        },
      })
    }

    if (pending.length && inWindow(prof?.daily_reminder ?? '09:00', l.minutes)) {
      const first = prof?.name ? `${prof.name}, ` : ''
      jobs.push({
        key: `d:${userId}:${l.date}`,
        userId,
        payload: {
          title: 'Seus hábitos de hoje ✨',
          body:
            pending.length === 1
              ? `${first}falta só 1: ${pending[0].emoji} ${pending[0].name}`
              : `${first}você tem ${pending.length} hábitos para hoje. Vamos nessa!`,
          tag: 'daily',
          url: '/',
        },
      })
    }
  }

  if (!jobs.length) return res.json({ sent: 0 })

  // Reserva as chaves — só envia o que ainda não foi enviado (idempotente)
  const { data: claimed, error: logErr } = await admin
    .from('reminder_log')
    .upsert(jobs.map((j) => ({ key: j.key })), { onConflict: 'key', ignoreDuplicates: true })
    .select('key')
  if (logErr) return res.status(500).json({ error: logErr.message })
  const claimedKeys = new Set((claimed ?? []).map((c) => c.key))

  let sent = 0
  await Promise.all(
    jobs
      .filter((j) => claimedKeys.has(j.key))
      .map(async (j) => {
        sent += await sendToSubs(subs.filter((s) => s.user_id === j.userId), j.payload)
      }),
  )

  return res.json({ sent, jobs: claimedKeys.size })
}
