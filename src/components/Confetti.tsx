import { useEffect, useRef } from 'react'

const COLORS = ['#8b7cf6', '#f472b6', '#22c55e', '#facc15', '#38bdf8', '#fb923c']

/** Confete leve em canvas (roda ~2.6s e some) */
export function Confetti({ fire }: { fire: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!fire || !ref.current) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = ref.current
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = window.innerWidth
    const H = window.innerHeight
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const parts = Array.from({ length: 140 }, (_, i) => {
      const fromLeft = i % 2 === 0
      return {
        x: fromLeft ? -10 : W + 10,
        y: H * 0.65,
        vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 8),
        vy: -(10 + Math.random() * 11),
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        c: COLORS[i % COLORS.length],
        round: Math.random() > 0.6,
      }
    })

    let raf = 0
    const start = performance.now()
    const frame = (t: number) => {
      const el = t - start
      ctx.clearRect(0, 0, W, H)
      const alpha = el > 2000 ? Math.max(0, 1 - (el - 2000) / 600) : 1
      for (const p of parts) {
        p.vy += 0.38
        p.vx *= 0.985
        p.vy *= 0.985
        p.x += p.vx
        p.y += p.vy
        p.r += p.vr
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(p.x, p.y)
        ctx.rotate(p.r)
        ctx.fillStyle = p.c
        if (p.round) {
          ctx.beginPath()
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.roundRect(-p.w / 2, -p.h / 4, p.w, p.h / 2, 2)
          ctx.fill()
        }
        ctx.restore()
      }
      if (el < 2600) raf = requestAnimationFrame(frame)
      else ctx.clearRect(0, 0, W, H)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [fire])

  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, width: '100vw', height: '100dvh', pointerEvents: 'none', zIndex: 90 }} />
}
