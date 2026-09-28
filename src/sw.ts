/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

if (import.meta.env.PROD) {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }))
}

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-css' }),
)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
)

// ---------------- Push ----------------
type Payload = { title: string; body: string; tag?: string; url?: string; habitId?: string }

self.addEventListener('push', (event) => {
  let data: Payload = { title: 'Hábitos', body: 'Hora dos seus hábitos!' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    if (event.data) data.body = event.data.text()
  }

  const options: NotificationOptions & { actions?: { action: string; title: string }[]; renotify?: boolean; vibrate?: number[] } = {
    body: data.body,
    tag: data.tag,
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    data: { url: data.url || '/', habitId: data.habitId },
    renotify: true,
    vibrate: [80, 40, 80],
  }
  if (data.habitId) options.actions = [{ action: 'done', title: '✓ Feito' }, { action: 'open', title: 'Abrir' }]

  event.waitUntil(self.registration.showNotification(data.title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { url = '/', habitId } = (event.notification.data || {}) as { url?: string; habitId?: string }
  const markDone = event.action === 'done' && habitId

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const client = all[0] as WindowClient | undefined
      if (client) {
        await client.focus()
        if (markDone) client.postMessage({ type: 'habit-done', habitId })
        return
      }
      await self.clients.openWindow(markDone ? `/?done=${habitId}` : url)
    })(),
  )
})
