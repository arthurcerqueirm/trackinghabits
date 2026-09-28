import { supabase } from './supabase'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

function b64ToUint8(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) {
    return {
      ok: false,
      reason: isIOS() ? 'No iPhone, adicione o app à Tela de Início primeiro.' : 'Seu navegador não suporta notificações.',
    }
  }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, reason: 'Permissão de notificação negada.' }

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID) })
  }
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: sub.endpoint,
    p256dh: json.keys!.p256dh,
    auth: json.keys!.auth,
  })
  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function sendTestPush() {
  const { data } = await supabase.auth.getSession()
  const res = await fetch('/api/push-test', {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session?.access_token}` },
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Falha ao enviar')
}

export const haptic = (ms: number | number[] = 12) => {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* sem vibração */
  }
}
