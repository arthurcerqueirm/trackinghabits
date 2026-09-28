import type { VercelRequest, VercelResponse } from '@vercel/node'
import { admin, sendToSubs } from './_lib.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return res.status(401).json({ error: 'unauthorized' })

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', data.user.id)

  if (!subs?.length) return res.status(404).json({ error: 'Nenhum dispositivo inscrito' })

  const sent = await sendToSubs(subs, {
    title: 'Notificações ativas 🎉',
    body: 'Tudo certo! Você vai receber os lembretes dos seus hábitos aqui.',
    tag: 'test',
    url: '/',
  })
  return res.json({ sent })
}
