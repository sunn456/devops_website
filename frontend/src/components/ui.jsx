// Спільні компоненти інтерфейсу.
import { useEffect, useState } from 'react'
import { money } from '../format.js'
import { IconCheck } from './icons.jsx'

export function Alert({ kind = 'error', children }) {
  if (!children) return null
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

export function Hint({ children }) {
  return <p className="hint">{children}</p>
}

export function Loading({ text = 'Завантаження…' }) {
  return (
    <div className="loading">
      <span className="spinner" aria-hidden="true" />
      {text}
    </div>
  )
}

export function Field({ label, hint, icon, children }) {
  return (
    <label className={`field ${icon ? 'with-icon' : ''}`}>
      <span className="field-label">{label}</span>
      <span className="field-control">
        {icon && <span className="field-icon">{icon}</span>}
        {children}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function StatusBadge({ status, label }) {
  return <span className={`badge badge-${status}`}>{label}</span>
}

export function Stepper({ label, note, value, min = 0, max = 20, onChange }) {
  return (
    <div className="stepper">
      <div className="stepper-text">
        <span className="stepper-label">{label}</span>
        {note && <span className="stepper-note">{note}</span>}
      </div>
      <div className="stepper-ctrl">
        <button type="button" aria-label={`Менше: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          −
        </button>
        <output>{value}</output>
        <button type="button" aria-label={`Більше: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  )
}

/** Склад групи: дорослі (від 12), діти (4–11), малюки (0–3). */
export function GroupFields({ value, onChange, compact = false }) {
  const set = (key) => (n) => onChange({ ...value, [key]: n })
  return (
    <div className={`group-fields ${compact ? 'compact' : ''}`}>
      <Stepper label="Дорослі" note="від 12 років" value={value.adults} min={1} onChange={set('adults')} />
      <Stepper label="Діти" note="4–11 років" value={value.children} onChange={set('children')} />
      <Stepper label="Малюки" note="0–3, без місця" value={value.infants} max={10} onChange={set('infants')} />
    </div>
  )
}

/** Підсумок замовлення: перелік позицій і загальна сума. */
export function PriceSummary({ quote, title = 'Підсумок замовлення' }) {
  if (!quote) return null
  return (
    <div className="summary">
      <h3>{title}</h3>
      <ul className="summary-lines">
        {quote.lines.map((line, i) => (
          <li key={i}>
            <span className="summary-title">
              {line.title}
              <small>
                {line.quantity} × {money(line.unit_price)}
              </small>
            </span>
            <span className="num">{money(line.total)}</span>
          </li>
        ))}
      </ul>
      <div className="summary-total">
        <span>Разом до сплати</span>
        <strong>{money(quote.total)}</strong>
      </div>
    </div>
  )
}

/** Кроки оформлення. */
export function Steps({ current, items }) {
  return (
    <ol className="steps">
      {items.map((title, i) => {
        const n = i + 1
        const state = n < current ? 'done' : n === current ? 'active' : ''
        return (
          <li key={title} className={state}>
            <span className="step-dot">{n < current ? <IconCheck size={14} /> : n}</span>
            <span className="step-title">{title}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** Зворотний відлік часу утримання місць. */
export function Countdown({ until, onExpire }) {
  const [left, setLeft] = useState(() => new Date(until) - Date.now())
  useEffect(() => {
    const id = setInterval(() => {
      const ms = new Date(until) - Date.now()
      setLeft(ms)
      if (ms <= 0) {
        clearInterval(id)
        onExpire?.()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [until, onExpire])
  if (left <= 0) return <span className="countdown expired">00:00</span>
  const total = Math.floor(left / 1000)
  const mm = String(Math.floor(total / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return (
    <span className={`countdown ${total < 120 ? 'warn' : ''}`}>
      {mm}:{ss}
    </span>
  )
}
