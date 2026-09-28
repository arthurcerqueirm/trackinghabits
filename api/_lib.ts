import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export type PushPayload = {
  title: string
  body: string
  tag?: string
  url?: string
  habitId?: string
}

type Sub = { endpoint: string; p256dh: string; auth: string }

/** Envia para todas as inscrições; remove as que expiraram. Retorna quantas deram certo. */
export async function sendToSubs(subs: Sub[], payload: PushPayload) {
  const json = JSON.stringify(payload)
  const dead: string[] = []
  let ok = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
          { TTL: 60 * 60, urgency: 'high' },
        )
        ok++
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(s.endpoint)
        else console.error('push error', err?.statusCode, err?.body)
      }
    }),
  )
  if (dead.length) await admin.from('push_subscriptions').delete().in('endpoint', dead)
  return ok
}

/** Data/hora local de um fuso: { date: 'YYYY-MM-DD', minutes, weekday (0=dom) } */
export function localNow(timeZone: string, now = new Date()) {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
    }).formatToParts(now)
  } catch {
    return localNow('America/Sao_Paulo', now)
  }
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    weekday: wd,
  }
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}
