// Вибір дати українською (вбудоване поле дати браузер підписує мовою системи, напр. «dd.mm.yyyy»).
import { useEffect, useRef, useState } from 'react'
import { IconCalendar } from './icons.jsx'

const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень']
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня']
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const WEEKDAYS_SHORT = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

const pad = (n) => String(n).padStart(2, '0')
const toIso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`
const parse = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m: m - 1, d }
}

/** «21 листопада 2026, сб» */
export function formatLong(iso, withWeekday = true) {
  if (!iso) return ''
  const { y, m, d } = parse(iso)
  const wd = new Date(y, m, d).getDay()
  return `${d} ${MONTHS_GEN[m]} ${y}${withWeekday ? `, ${WEEKDAYS_SHORT[wd]}` : ''}`
}

export default function DatePicker({ label, value, onChange, min, max, placeholder = 'Оберіть дату', icon = true, hint, compact = false }) {
  const [open, setOpen] = useState(false)
  const start = value || min || toIso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
  const [view, setView] = useState(() => ({ y: parse(start).y, m: parse(start).m }))
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    if (!open) {
      const s = parse(value || min || start)
      setView({ y: s.y, m: s.m })
    }
    setOpen(!open)
  }

  const shift = (delta) =>
    setView(({ y, m }) => {
      const t = new Date(y, m + delta, 1)
      return { y: t.getFullYear(), m: t.getMonth() }
    })

  const firstWeekday = (new Date(view.y, view.m, 1).getDay() + 6) % 7 // понеділок = 0
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const today = (() => {
    const t = new Date()
    return toIso(t.getFullYear(), t.getMonth(), t.getDate())
  })()
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const prevDisabled = min && toIso(view.y, view.m, 1) <= min.slice(0, 8) + '01'
  const nextDisabled = max && toIso(view.y, view.m, daysInMonth) >= max

  return (
    <div className={`field date-field ${icon ? 'with-icon' : ''}`} ref={ref}>
      {label && <span className="field-label">{label}</span>}
      <button type="button" className={`field-control as-input ${value ? '' : 'placeholder'}`} onClick={toggle} aria-haspopup="dialog" aria-expanded={open}>
        {icon && (
          <span className="field-icon">
            <IconCalendar size={compact ? 18 : 20} />
          </span>
        )}
        {value ? formatLong(value, !compact) : placeholder}
      </button>
      {hint && <span className="field-hint">{hint}</span>}
      {open && (
        <div className="calendar" role="dialog" aria-label="Вибір дати">
          <div className="cal-head">
            <button type="button" onClick={() => shift(-1)} disabled={prevDisabled} aria-label="Попередній місяць">
              ‹
            </button>
            <strong>
              {MONTHS[view.m]} {view.y}
            </strong>
            <button type="button" onClick={() => shift(1)} disabled={nextDisabled} aria-label="Наступний місяць">
              ›
            </button>
          </div>
          <div className="cal-grid">
            {WEEKDAYS.map((w, i) => (
              <span key={w} className={`cal-wd ${i > 4 ? 'weekend' : ''}`}>
                {w}
              </span>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <span key={`e${i}`} />
              const iso = toIso(view.y, view.m, d)
              const disabled = (min && iso < min) || (max && iso > max)
              return (
                <button
                  type="button"
                  key={iso}
                  disabled={disabled}
                  className={`cal-day ${iso === value ? 'selected' : ''} ${iso === today ? 'today' : ''}`}
                  onClick={() => {
                    onChange(iso)
                    setOpen(false)
                  }}
                >
                  {d}
                </button>
              )
            })}
          </div>
          {value && !compact && (
            <button type="button" className="cal-clear" onClick={() => (onChange(''), setOpen(false))}>
              Очистити
            </button>
          )}
        </div>
      )}
    </div>
  )
}
