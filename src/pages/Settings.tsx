import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { currentSubscription, disablePush, enablePush, isIOS, isStandalone, pushSupported, sendTestPush } from '../lib/push'
import { IconBell, IconClock, IconDownload, IconLogout, IconMoon, IconSend, IconShare, IconUser } from '../components/Icons'
import { rise, Segmented, spring, stagger, Switch, Tap } from '../components/ui'

export type ThemePref = 'system' | 'light' | 'dark'

export function applyTheme(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0b12' : '#f5f4fa')
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferredInstall: InstallEvent | null = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredInstall = e as InstallEvent
})

export function SettingsPage({ email }: { email: string }) {
  const profile = useStore((s) => s.profile)
  const updateProfile = useStore((s) => s.updateProfile)
  const toast = useStore((s) => s.toast)
  const habits = useStore((s) => s.habits)
  const counts = useStore((s) => s.counts)

  const [theme, setTheme] = useState<ThemePref>(() => {
    try {
      return (localStorage.getItem('habitos:theme') as ThemePref) || 'system'
    } catch {
      return 'system'
    }
  })
  const [pushOn, setPushOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(profile?.name ?? '')
  const [canInstall, setCanInstall] = useState(!!deferredInstall)

  useEffect(() => {
    void currentSubscription().then((s) => setPushOn(!!s && Notification.permission === 'granted'))
    const t = setInterval(() => setCanInstall(!!deferredInstall), 1000)
    return () => clearInterval(t)
  }, [])

  const changeTheme = (t: ThemePref) => {
    setTheme(t)
    try {
      localStorage.setItem('habitos:theme', t)
    } catch {
      /* ok */
    }
    applyTheme(t)
  }

  const togglePush = async (v: boolean) => {
    setBusy(true)
    try {
      if (v) {
        const r = await enablePush()
        if (!r.ok) {
          toast(r.reason || 'Não foi possível ativar', { tone: 'error' })
          return
        }
        setPushOn(true)
        if (profile && !profile.notifications_enabled) void updateProfile({ notifications_enabled: true })
        toast('Notificações ativadas', { emoji: '🔔' })
      } else {
        await disablePush()
        setPushOn(false)
        toast('Notificações desativadas neste aparelho', { emoji: '🔕' })
      }
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = () => {
    const rows = [['habito', 'dia', 'quantidade', 'meta']]
    const byId = new Map(habits.map((h) => [h.id, h]))
    for (const [k, v] of Object.entries(counts)) {
      const [id, day] = k.split('|')
      const h = byId.get(id)
      if (h) rows.push([`"${h.name.replace(/"/g, '""')}"`, day, String(v), String(h.target)])
    }
    rows.sort((a, b) => a[1].localeCompare(b[1]))
    const blob = new Blob(['﻿' + rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `habitos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const showIosTip = isIOS() && !isStandalone()

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.header className="header" variants={rise}>
        <div>
          <div className="eyebrow">Preferências</div>
          <h1 className="title">Ajustes</h1>
        </div>
      </motion.header>

      <motion.div className="card row" variants={rise} style={{ gap: 14 }}>
        <div className="logo" style={{ width: 56, height: 56, borderRadius: 20, fontSize: 22, fontWeight: 800 }}>
          {(profile?.name || email || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            className="input"
            style={{ height: 42, fontWeight: 700, padding: '0 12px' }}
            value={name}
            placeholder="Seu nome"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() !== (profile?.name ?? '') && updateProfile({ name: name.trim() || null })}
          />
          <div className="muted" style={{ fontSize: 12.5, marginTop: 6, paddingLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
        </div>
      </motion.div>

      <motion.h2 className="section-title" variants={rise}>Notificações</motion.h2>
      <AnimatePresence>
        {showIosTip && (
          <motion.div className="card" variants={rise} style={{ marginBottom: 10, background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))' }}>
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <IconShare size={20} />
              <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                <b>No iPhone:</b> toque em <b>Compartilhar</b> → <b>Adicionar à Tela de Início</b> e abra o app por lá para receber notificações.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div className="list" variants={rise}>
        <div className="list-item">
          <div className="list-icon" style={{ background: 'var(--grad)' }}>
            <IconBell size={19} />
          </div>
          <div className="grow">
            <div className="t">Notificações push</div>
            <div className="s">{pushSupported() ? (pushOn ? 'Ativas neste aparelho' : 'Receba lembretes diários') : 'Não suportado aqui'}</div>
          </div>
          <div style={{ opacity: busy ? 0.5 : 1, pointerEvents: busy ? 'none' : 'auto' }}>
            <Switch on={pushOn} onChange={togglePush} />
          </div>
        </div>
        <div className="list-item">
          <div className="list-icon" style={{ background: '#f97316' }}>
            <IconClock size={19} />
          </div>
          <div className="grow">
            <div className="t">Resumo diário</div>
            <div className="s">Lembra dos hábitos pendentes</div>
          </div>
          <Switch
            on={!!profile?.daily_reminder}
            onChange={(v) => updateProfile({ daily_reminder: v ? '09:00' : null })}
          />
        </div>
        <AnimatePresence initial={false}>
          {profile?.daily_reminder && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} style={{ overflow: 'hidden' }}>
              <div className="list-item" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="grow t" style={{ paddingLeft: 52 }}>Horário</div>
                <input
                  type="time"
                  className="input"
                  style={{ width: 120, height: 42 }}
                  value={profile.daily_reminder}
                  onChange={(e) => e.target.value && updateProfile({ daily_reminder: e.target.value })}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {pushOn && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} style={{ overflow: 'hidden' }}>
              <motion.button
                className="list-item"
                style={{ borderTop: '1px solid var(--border)' }}
                whileTap={{ scale: 0.98 }}
                onClick={async () => {
                  try {
                    await sendTestPush()
                    toast('Enviado! Confira a notificação', { emoji: '📨' })
                  } catch (e) {
                    toast((e as Error).message, { tone: 'error' })
                  }
                }}
              >
                <div className="list-icon" style={{ background: '#22c55e' }}>
                  <IconSend size={18} />
                </div>
                <div className="grow">
                  <div className="t">Enviar notificação de teste</div>
                  <div className="s">Confirme que está tudo funcionando</div>
                </div>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.h2 className="section-title" variants={rise}>Aparência</motion.h2>
      <motion.div className="card" variants={rise} style={{ padding: 14 }}>
        <div className="row" style={{ gap: 10, marginBottom: 12, paddingLeft: 4 }}>
          <IconMoon size={18} />
          <span style={{ fontWeight: 700 }}>Tema</span>
        </div>
        <Segmented
          id="theme"
          value={theme}
          onChange={changeTheme}
          options={[
            { value: 'system', label: 'Sistema' },
            { value: 'light', label: 'Claro' },
            { value: 'dark', label: 'Escuro' },
          ]}
        />
      </motion.div>

      <motion.h2 className="section-title" variants={rise}>Conta e dados</motion.h2>
      <motion.div className="list" variants={rise}>
        {canInstall && !isStandalone() && (
          <motion.button
            className="list-item"
            whileTap={{ scale: 0.98 }}
            onClick={async () => {
              await deferredInstall?.prompt()
              deferredInstall = null
              setCanInstall(false)
            }}
          >
            <div className="list-icon" style={{ background: 'var(--accent)' }}>
              <IconDownload size={18} />
            </div>
            <div className="grow">
              <div className="t">Instalar app</div>
              <div className="s">Adicionar à tela inicial</div>
            </div>
          </motion.button>
        )}
        <motion.button className="list-item" whileTap={{ scale: 0.98 }} onClick={exportCsv}>
          <div className="list-icon" style={{ background: '#14b8a6' }}>
            <IconDownload size={18} />
          </div>
          <div className="grow">
            <div className="t">Exportar dados (CSV)</div>
            <div className="s">Todo o seu histórico</div>
          </div>
        </motion.button>
        <motion.button
          className="list-item"
          whileTap={{ scale: 0.98 }}
          onClick={async () => {
            await disablePush().catch(() => {})
            await supabase.auth.signOut()
          }}
        >
          <div className="list-icon" style={{ background: 'var(--danger)' }}>
            <IconLogout size={18} />
          </div>
          <div className="grow">
            <div className="t" style={{ color: 'var(--danger)' }}>Sair</div>
          </div>
        </motion.button>
      </motion.div>

      <motion.div variants={rise} className="muted row" style={{ justifyContent: 'center', fontSize: 12, marginTop: 24, gap: 6 }}>
        <IconUser size={13} /> Hábitos · v1.0
      </motion.div>
    </motion.div>
  )
}
