import { AnimatePresence, motion } from 'framer-motion'
import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { IconCheck } from '../components/Icons'
import { Segmented, spring, Tap } from '../components/ui'

const translate = (m: string) => {
  if (/invalid login/i.test(m)) return 'Email ou senha incorretos'
  if (/already registered/i.test(m)) return 'Este email já tem conta — faça login'
  if (/at least 6/i.test(m) || /password should/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres'
  if (/email not confirmed/i.test(m)) return 'Confirme seu email antes de entrar'
  if (/rate limit/i.test(m)) return 'Muitas tentativas, espere um pouco'
  return m
}

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim() }, emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        if (!data.session) setInfo('Conta criada! Confira seu email para confirmar e depois faça login.')
      }
    } catch (err) {
      setError(translate((err as Error).message))
    } finally {
      setLoading(false)
    }
  }

  const forgot = async () => {
    if (!email) return setError('Digite seu email primeiro')
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (error) setError(translate(error.message))
    else setInfo('Enviamos um link para redefinir sua senha.')
  }

  return (
    <div className="auth">
      <motion.div
        className="blob"
        style={{ width: 320, height: 320, background: 'var(--accent)', top: -80, left: -100 }}
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="blob"
        style={{ width: 280, height: 280, background: 'var(--accent-2)', bottom: -60, right: -90 }}
        animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="logo"
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
      >
        <svg width={38} height={38} viewBox="0 0 24 24">
          <motion.path
            d="M5 12.5 10 17.5 19 7.5"
            fill="none"
            stroke="#fff"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.45, duration: 0.5 }}
          />
        </svg>
      </motion.div>

      <motion.h1 className="title" style={{ marginTop: 24, fontSize: 34 }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 }}>
        Construa hábitos
        <br />
        <span style={{ background: 'var(--grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>que duram.</span>
      </motion.h1>
      <motion.p className="text-2" style={{ margin: '10px 0 28px', fontSize: 15, lineHeight: 1.5 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
        Acompanhe, mantenha a sequência e veja sua evolução todos os dias.
      </motion.p>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.4 }}>
        <div style={{ marginBottom: 18 }}>
          <Segmented
            id="auth"
            value={mode}
            onChange={(m) => {
              setMode(m)
              setError('')
              setInfo('')
            }}
            options={[
              { value: 'login', label: 'Entrar' },
              { value: 'signup', label: 'Criar conta' },
            ]}
          />
        </div>

        <form onSubmit={submit}>
          <AnimatePresence initial={false}>
            {mode === 'signup' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} style={{ overflow: 'hidden' }}>
                <div className="field">
                  <input className="input" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="field">
            <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required inputMode="email" />
          </div>
          <div className="field">
            <input
              className="input"
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
            />
          </div>

          <AnimatePresence>
            {(error || info) && (
              <motion.div
                key={error || info}
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto', x: error ? [0, -8, 8, -4, 4, 0] : 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35 }}
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  marginBottom: 14,
                  padding: '12px 16px',
                  borderRadius: 16,
                  color: error ? 'var(--danger)' : 'var(--good)',
                  background: `color-mix(in srgb, ${error ? 'var(--danger)' : 'var(--good)'} 12%, transparent)`,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                {info && <IconCheck size={16} />}
                {error || info}
              </motion.div>
            )}
          </AnimatePresence>

          <Tap type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? (
              <motion.span
                style={{ width: 20, height: 20, borderRadius: 99, border: '2.5px solid rgba(255,255,255,.35)', borderTopColor: '#fff', display: 'block' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
              />
            ) : mode === 'login' ? (
              'Entrar'
            ) : (
              'Criar conta'
            )}
          </Tap>
        </form>

        {mode === 'login' && (
          <button onClick={forgot} className="muted" style={{ display: 'block', margin: '18px auto 0', fontSize: 13.5, fontWeight: 600 }}>
            Esqueci minha senha
          </button>
        )}
      </motion.div>
    </div>
  )
}
