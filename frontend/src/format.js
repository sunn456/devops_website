// Допоміжні функції форматування.

export function money(value) {
  const n = Number(value || 0)
  return n.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' грн'
}

export function date(value) {
  if (!value) return '—'
  const [y, m, d] = String(value).slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

export function dateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function shortDate(value) {
  const [, m, d] = String(value).slice(0, 10).split('-')
  return `${d}.${m}`
}

export function isoToday(offsetDays = 0) {
  const t = new Date()
  t.setDate(t.getDate() + offsetDays)
  const pad = (n) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}

export function plural(n, one, few, many) {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return one
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few
  return many
}

export function starsText(n = 4) {
  return '★'.repeat(n)
}

export function nightsText(n) {
  return `${n} ${plural(n, 'ніч', 'ночі', 'ночей')}`
}

export function groupText({ adults = 0, children = 0, infants = 0 }) {
  const parts = [`${adults} ${plural(adults, 'дорослий', 'дорослих', 'дорослих')}`]
  if (children) parts.push(`${children} ${plural(children, 'дитина', 'дитини', 'дітей')}`)
  if (infants) parts.push(`${infants} ${plural(infants, 'малюк', 'малюки', 'малюків')}`)
  return parts.join(', ')
}

export const BOOKING_STATUS = {
  new: 'Нове',
  paid: 'Оплачене',
  confirmed: 'Підтверджене',
  cancelled: 'Скасоване',
}

export const PAYMENT_STATUS = {
  pending: 'Очікує',
  succeeded: 'Проведено',
  failed: 'Не проведено',
}

export const REFUND_STATUS = {
  pending: 'Виконується',
  succeeded: 'Повернено',
  failed: 'Помилка',
}

export const REFUND_REASON = {
  cancellation: 'Скасування',
  change: 'Різниця при зміні',
  late_payment: 'Запізніла оплата',
  duplicate: 'Повторна оплата',
}
