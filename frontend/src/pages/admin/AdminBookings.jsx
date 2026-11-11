// Кадр 11: перегляд, підтвердження та скасування бронювань (FR-15).
// Робоче місце адміністратора: зліва список бронювань, справа — деталі обраного й дії з ним.
import { useEffect, useMemo, useState } from 'react'
import { adminApi } from '../../api.js'
import {
  PAYMENT_STATUS, REFUND_REASON, REFUND_STATUS, date, dateTime, groupText, money, nightsText, plural, shortDate,
} from '../../format.js'
import { Alert, Field, Hint, Loading, StatusBadge } from '../../components/ui.jsx'
import {
  IconCalendar, IconCard, IconCheck, IconClock, IconMail, IconMountain, IconPhone, IconSearch, IconSki, IconSpa, IconUsers,
} from '../../components/icons.jsx'

const TABS = [
  ['paid', 'Очікують перевірки'],
  ['new', 'Очікують оплати'],
  ['confirmed', 'Підтверджені'],
  ['cancelled', 'Скасовані'],
  ['', 'Усі'],
]

const nightsBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000)
const initials = (b) => `${(b.first_name || '?')[0]}${(b.last_name || '')[0] || ''}`.toUpperCase()

export default function AdminBookings() {
  const [filter, setFilter] = useState({ status: 'paid', q: '' })
  const [list, setList] = useState(null)
  const [all, setAll] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = (keepId) => {
    setError('')
    adminApi('/bookings/', { params: filter })
      .then((rows) => {
        setList(rows)
        setSelectedId((cur) => {
          const want = keepId ?? cur
          return rows.some((b) => b.id === want) ? want : rows[0]?.id ?? null
        })
      })
      .catch((e) => setError(e.message))
    adminApi('/bookings/')
      .then(setAll)
      .catch(() => {})
  }

  useEffect(() => load(), [filter.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c = { '': all.length }
    all.forEach((b) => (c[b.status] = (c[b.status] || 0) + 1))
    return c
  }, [all])
  const revenue = all.filter((b) => b.status === 'paid' || b.status === 'confirmed').reduce((s, b) => s + Number(b.total_amount), 0)

  // Після дії бронювання може перейти в інший статус — шукаємо його серед усіх.
  const selected = list?.find((b) => b.id === selectedId) || all.find((b) => b.id === selectedId) || null

  const updated = (b, msg) => {
    setNotice(msg)
    setAll((rows) => rows.map((r) => (r.id === b.id ? b : r)))
    load(b.id)
  }

  return (
    <div className="bk">
      <header className="bk-head">
        <div>
          <h1>Бронювання</h1>
          <p className="muted">
            {counts.paid ? (
              <>
                <strong className="bk-attn">{counts.paid}</strong>{' '}
                {plural(counts.paid, 'бронювання чекає', 'бронювання чекають', 'бронювань чекають')} перевірки
              </>
            ) : (
              'Усі оплачені бронювання перевірено'
            )}{' '}
            · оплачено клієнтами {money(revenue)}
          </p>
        </div>
        <form
          className="bk-search"
          onSubmit={(e) => {
            e.preventDefault()
            load()
          }}
        >
          <IconSearch size={18} />
          <input placeholder="Код, email або прізвище" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
          <button className="btn btn-primary btn-sm">Знайти</button>
        </form>
      </header>

      <nav className="bk-tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={`bk-tab t-${k || 'all'} ${filter.status === k ? 'active' : ''}`} onClick={() => setFilter({ ...filter, status: k })}>
            <i />
            {label}
            <span>{counts[k] || 0}</span>
          </button>
        ))}
      </nav>

      <Alert>{error}</Alert>

      <div className="bk-work">
        <section className="bk-list">
          {!list && !error && <Loading />}
          {list && list.length === 0 && (
            <div className="bk-nothing">
              <span>
                <IconMountain size={28} />
              </span>
              <strong>Тут порожньо</strong>
              <p className="muted small">У цьому розділі бронювань немає. Оберіть іншу вкладку або змініть пошук.</p>
            </div>
          )}
          {list?.map((b) => (
            <button
              key={b.id}
              className={`bk-card s-${b.status} ${b.id === selectedId ? 'active' : ''}`}
              onClick={() => {
                setSelectedId(b.id)
                setNotice('')
              }}
            >
              {b.tour_image ? <img src={b.tour_image} alt="" /> : <span className="bk-card-ph"><IconMountain size={20} /></span>}
              <span className="bk-card-body">
                <span className="bk-card-top">
                  <span className="bk-code">{b.code || 'без коду'}</span>
                  <StatusBadge status={b.status} label={b.status_display} />
                </span>
                <strong>{b.hotel_name || b.tour}</strong>
                <small>
                  {shortDate(b.start_date)} – {date(b.end_date)} · {b.last_name} {b.first_name}
                </small>
              </span>
              <span className="bk-card-sum">{money(b.total_amount)}</span>
            </button>
          ))}
        </section>

        <section className="bk-detail">
          {selected ? (
            <BookingPanel key={`${selected.id}-${selected.status}`} booking={selected} notice={notice} onUpdated={updated} />
          ) : (
            list && (
              <div className="bk-detail-empty">
                <img src="/images/banners/yablunytsia-3.jpg" alt="" />
                <div>
                  <strong>Оберіть бронювання зі списку</strong>
                  <span>Тут з’являться деталі, платежі та дії з ним.</span>
                </div>
              </div>
            )
          )}
        </section>
      </div>
    </div>
  )
}

function BookingPanel({ booking, notice, onUpdated }) {
  const [reason, setReason] = useState('')
  const [fullRefund, setFullRefund] = useState(booking.status === 'paid')
  const [cancelMode, setCancelMode] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const paidSum = booking.payments.filter((p) => p.status === 'succeeded').reduce((s, p) => s + Number(p.amount), 0)
  const sumOk = Math.abs(paidSum - Number(booking.total_amount)) < 0.005
  const contactsOk = [booking.first_name, booking.last_name, booking.phone, booking.email].every((v) => String(v || '').trim())
  const passesOk = booking.ski_passes.every((s) => s.start_date >= booking.start_date && s.end_date <= booking.end_date)
  const nights = nightsBetween(booking.start_date, booking.end_date)

  const run = async (fn) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const confirm = () =>
    run(async () => {
      const b = await adminApi(`/bookings/${booking.id}/confirm/`, { method: 'POST' })
      onUpdated(b, `Бронювання ${b.code} підтверджено — клієнт отримає лист.`)
    })

  const cancel = () =>
    run(async () => {
      const res = await adminApi(`/bookings/${booking.id}/cancel/`, { method: 'POST', body: { reason, full_refund: fullRefund } })
      onUpdated(res.booking, `Бронювання скасовано. До повернення: ${money(res.refund_amount)}.`)
    })

  const timeline = [
    ['Створено', booking.created_at],
    ['Оплачено', booking.paid_at],
    ['Підтверджено', booking.confirmed_at],
    ['Скасовано', booking.cancelled_at],
  ].filter(([, t]) => t)

  return (
    <article className="bk-panel">
      <div className="bk-cover">
        {(booking.tour_banner || booking.tour_image) && <img src={booking.tour_banner || booking.tour_image} alt="" />}
        <div className="bk-cover-text">
          <span className="bk-cover-code">{booking.code || 'Без коду'}</span>
          <h2>{booking.hotel_name || booking.tour}</h2>
          <span>
            <IconMountain size={16} /> {booking.resort} · {date(booking.start_date)} – {date(booking.end_date)} · {nightsText(nights)}
          </span>
        </div>
        <StatusBadge status={booking.status} label={booking.status_display} />
      </div>

      <div className="bk-panel-body">
        <Alert kind="success">{notice}</Alert>

        {booking.status === 'paid' && (
          <div className="bk-checks">
            <Check ok={sumOk} title="Сума платежу" text={sumOk ? `${money(paidSum)} — збігається` : `${money(paidSum)} замість ${money(booking.total_amount)}`} />
            <Check ok={contactsOk} title="Контактні дані" text={contactsOk ? 'Заповнені повністю' : 'Є незаповнені поля'} />
            <Check ok={passesOk} title="Скі-паси" text={booking.ski_passes.length ? (passesOk ? 'У межах дат туру' : 'Виходять за дати туру') : 'Не замовлені'} />
          </div>
        )}

        <div className="bk-grid">
          <div className="bk-box">
            <h3>Клієнт</h3>
            <div className="bk-client">
              <span className="avatar">{initials(booking)}</span>
              <strong>
                {booking.last_name} {booking.first_name}
              </strong>
            </div>
            <a className="bk-line" href={`tel:${booking.phone}`}>
              <IconPhone size={17} /> {booking.phone}
            </a>
            <a className="bk-line" href={`mailto:${booking.email}`}>
              <IconMail size={17} /> {booking.email}
            </a>
          </div>
          <div className="bk-box">
            <h3>Поїздка</h3>
            <span className="bk-line">
              <IconCalendar size={17} /> {date(booking.start_date)} – {date(booking.end_date)}
            </span>
            <span className="bk-line">
              <IconUsers size={17} /> {groupText(booking)}
            </span>
            <span className="bk-line">
              <IconClock size={17} /> {nightsText(nights)}, сніданки
            </span>
          </div>
        </div>

        <div className="bk-box">
          <h3>Додаткові послуги</h3>
          {booking.ski_passes.length === 0 && booking.activities.length === 0 && <p className="muted small">Без скі-пасів і активностей.</p>}
          <ul className="bk-items">
            {booking.ski_passes.map((s, i) => (
              <li key={`s${i}`}>
                <span className="bk-item-icon"><IconSki size={17} /></span>
                <span>
                  {s.title} × {s.quantity}
                  <small>
                    {date(s.start_date)} – {date(s.end_date)}
                  </small>
                </span>
                <strong>{money(s.line_total)}</strong>
              </li>
            ))}
            {booking.activities.map((a, i) => (
              <li key={`a${i}`}>
                <span className="bk-item-icon spa"><IconSpa size={17} /></span>
                <span>
                  {a.title}
                  <small>{a.persons} {plural(a.persons, 'особа', 'особи', 'осіб')}</small>
                </span>
                <strong>{money(a.line_total)}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="bk-grid">
          <div className="bk-box">
            <h3>Платежі</h3>
            {booking.payments.length === 0 && <p className="muted small">Платежів ще немає.</p>}
            <ul className="bk-items">
              {booking.payments.map((p) => (
                <li key={p.id}>
                  <span className={`bk-item-icon pay-${p.status}`}><IconCard size={17} /></span>
                  <span>
                    {p.kind === 'surcharge' ? 'Доплата' : 'Оплата'} · {PAYMENT_STATUS[p.status]}
                    <small>{dateTime(p.paid_at || p.created_at)}</small>
                  </span>
                  <strong>{money(p.amount)}</strong>
                </li>
              ))}
              {booking.refunds.map((r) => (
                <li key={`r${r.id}`}>
                  <span className="bk-item-icon refund"><IconCard size={17} /></span>
                  <span>
                    Повернення · {REFUND_STATUS[r.status]}
                    <small>{REFUND_REASON[r.reason]}</small>
                  </span>
                  <strong>−{money(r.amount)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="bk-box">
            <h3>Історія</h3>
            <ol className="bk-timeline">
              {timeline.map(([label, t]) => (
                <li key={label}>
                  <strong>{label}</strong>
                  <small>{dateTime(t)}</small>
                </li>
              ))}
            </ol>
            {booking.cancel_reason && <p className="muted small">Причина: {booking.cancel_reason}</p>}
          </div>
        </div>

        {cancelMode && (
          <div className="bk-box bk-cancel">
            <h3>Скасування бронювання</h3>
            <Field label="Причина скасування">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Наприклад, запит клієнта телефоном" />
            </Field>
            <label className="check">
              <input type="checkbox" checked={fullRefund} onChange={(e) => setFullRefund(e.target.checked)} />
              <span>Підтвердити неможливо — повернути всю фактично отриману суму</span>
            </label>
            <Hint>Без позначки діють правила скасування за клієнта: 100 % не пізніше ніж за 7 днів до заїзду, інакше без повернення.</Hint>
          </div>
        )}
        <Alert>{error}</Alert>
      </div>

      <footer className="bk-actions">
        <div>
          <small>Вартість бронювання</small>
          <strong>{money(booking.total_amount)}</strong>
        </div>
        {booking.status !== 'cancelled' && !cancelMode && (
          <div className="bk-actions-btns">
            <button className="btn btn-secondary" onClick={() => setCancelMode(true)}>
              Скасувати
            </button>
            {booking.status === 'paid' && (
              <button className="btn btn-primary" onClick={confirm} disabled={busy}>
                <IconCheck size={18} /> Підтвердити
              </button>
            )}
          </div>
        )}
        {cancelMode && (
          <div className="bk-actions-btns">
            <button className="btn btn-secondary" onClick={() => setCancelMode(false)}>
              Назад
            </button>
            <button className="btn btn-danger" onClick={cancel} disabled={busy}>
              Скасувати бронювання
            </button>
          </div>
        )}
      </footer>
    </article>
  )
}

function Check({ ok, title, text }) {
  return (
    <div className={`bk-check ${ok ? 'ok' : 'warn'}`}>
      <span>{ok ? '✓' : '!'}</span>
      <div>
        <strong>{title}</strong>
        <small>{text}</small>
      </div>
    </div>
  )
}
