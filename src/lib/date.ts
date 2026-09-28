const pad = (n: number) => String(n).padStart(2, '0')

/** 'YYYY-MM-DD' no fuso local */
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const todayKey = () => toKey(new Date())
export const addDays = (k: string, n: number) => {
  const d = fromKey(k)
  d.setDate(d.getDate() + n)
  return toKey(d)
}
export const weekday = (k: string) => fromKey(k).getDay()
export const diffDays = (a: string, b: string) =>
  Math.round((fromKey(a).getTime() - fromKey(b).getTime()) / 86400000)

export const WEEKDAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const MONTHS_LONG = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export const shortLabel = (k: string) => {
  const d = fromKey(k)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export const longLabel = (k: string) => {
  const t = todayKey()
  if (k === t) return 'Hoje'
  if (k === addDays(t, -1)) return 'Ontem'
  if (k === addDays(t, 1)) return 'Amanhã'
  const d = fromKey(k)
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`
}

export const greeting = () => {
  const h = new Date().getHours()
  if (h < 5) return 'Boa noite'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** created_at (timestamptz) -> dia local */
export const createdKey = (iso: string) => toKey(new Date(iso))
