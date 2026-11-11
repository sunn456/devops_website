// Кадри 8–9: пошук бронювання за кодом і email, скасування та зміна (FR-09…FR-11).
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { date, money } from '../format.js'
import Extras from '../components/Extras.jsx'
import { IconCalendar, IconMail, IconPhone, IconSearch, IconShield, IconTicket } from '../components/icons.jsx'
import { Alert, Field, GroupFields, Hint, Loading, PriceSummary, StatusBadge } from '../components/ui.jsx'
import { checkoutPath } from './BookingPage.jsx'
import { BookingDetails } from './ConfirmationPage.jsx'

const LOOKUP_KEY = 'winterra_lookup'

function loadLookup() {
  try {
    return JSON.parse(sessionStorage.getItem(LOOKUP_KEY)) || { code: '', email: '' }
  } catch {
    return { code: '', email: '' }
  }
}

function saveLookup(value) {
  try {
    sessionStorage.setItem(LOOKUP_KEY, JSON.stringify(value))
  } catch {
    /* не критично */
  }
}

export default function MyBookingPage() {
  const [params] = useSearchParams()
  const [lookup, setLookup] = useState(loadLookup)
  const [booking, setBooking] = useState(null)
  const [mode, setMode] = useState('view') // view | cancel | change
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(params.get('changed') ? 'Доплату проведено, бронювання змінено.' : '')
  const [busy, setBusy] = useState(false)

  const find = async (e, silent = false) => {
    e?.preventDefault()
    setBusy(true)
    if (!silent) setNotice('')
    setError('')
    try {
      const b = await api('/my-booking/', { method: 'POST', body: lookup })
      setBooking(b)
      setMode('view')
      saveLookup(lookup)
    } catch (err) {
      setBooking(null)
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (params.get('changed') && lookup.code && lookup.email) find(null, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <section className="page-hero lookup-page-hero">
        <img className="hero-art" src="/images/banners/yablunytsia-2.jpg" alt="" />
        <div className="hero-shade" />
        <div className="container lookup-hero">
        <div className="lookup-text">
          <span className="eyebrow">Без облікового запису</span>
          <h1>Моє бронювання</h1>
          <p>Введіть код із листа та email, вказаний під час оформлення. Тут можна переглянути, змінити або скасувати поїздку.</p>
        </div>
        <form className="lookup-form" onSubmit={find}>
          <Field label="Код бронювання" icon={<IconTicket size={18} />} hint="Наприклад, BK-20481">
            <input
              value={lookup.code}
              onChange={(e) => setLookup({ ...lookup, code: e.target.value.trim().toUpperCase() })}
              required
              placeholder="BK-00000"
            />
          </Field>
          <Field label="Email" icon={<IconMail size={18} />}>
            <input type="email" value={lookup.email} onChange={(e) => setLookup({ ...lookup, email: e.target.value.trim() })} required placeholder="you@example.com" />
          </Field>
          <button className="btn btn-primary btn-wide btn-lg" disabled={busy}>
            <IconSearch size={18} /> Знайти бронювання
          </button>
        </form>
        </div>
      </section>
      <div className="container mybooking-body">
      <Alert kind="success">{notice}</Alert>
      <Alert>{error}</Alert>

      {booking && (
        <div className="card">
          <div className="row-between">
            <h2 className="card-title">Бронювання {booking.code}</h2>
            <StatusBadge status={booking.status} label={booking.status_display} />
          </div>
          <BookingDetails booking={booking} />
          {booking.status === 'cancelled' && (
            <Alert kind="info">Бронювання скасоване {booking.cancel_reason && `(${booking.cancel_reason})`}.</Alert>
          )}
          {mode === 'view' && booking.status !== 'cancelled' && (
            <>
              <Hint>До заїзду ≥ 7 днів: повернення 100 %, пізніше — без повернення. Зміна — не пізніше ніж за 7 днів.</Hint>
              <div className="actions">
                {booking.can_cancel && (
                  <button className="btn btn-danger" onClick={() => setMode('cancel')}>
                    Скасувати бронювання
                  </button>
                )}
                {booking.can_change ? (
                  <button className="btn btn-primary" onClick={() => setMode('change')}>
                    Змінити бронювання
                  </button>
                ) : (
                  booking.status !== 'new' && <span className="muted">Зміна вже недоступна (менше 7 днів до заїзду).</span>
                )}
              </div>
            </>
          )}
          {mode === 'cancel' && (
            <CancelPanel
              lookup={lookup}
              onDone={(b, msg) => {
                setBooking({ ...b, can_cancel: false, can_change: false })
                setNotice(msg)
                setMode('view')
              }}
              onBack={() => setMode('view')}
            />
          )}
          {mode === 'change' && (
            <ChangePanel
              booking={booking}
              lookup={lookup}
              onApplied={(msg) => {
                setNotice(msg)
                find(null, true)
              }}
              onBack={() => setMode('view')}
            />
          )}
        </div>
      )}

      {!booking && <HelpSections />}
      </div>
    </>
  )
}

/** Довідка під формою пошуку (вимога 6.1: підказки в інтерфейсі). */
function HelpSections() {
  return (
    <>
      <div className="help-cards">
        <div className="help-card peach">
          <span className="why-icon">
            <IconMail />
          </span>
          <h3>Де знайти код</h3>
          <p>Код бронювання на кшталт BK-20481 приходить у листі одразу після оплати. Його також видно на сторінці підтвердження.</p>
        </div>
        <div className="help-card rose">
          <span className="why-icon">
            <IconShield />
          </span>
          <h3>Скасування</h3>
          <p>Не пізніше ніж за 7 днів до заїзду повертаємо 100 % суми на картку. Пізніше бронювання можна скасувати, але без повернення коштів.</p>
        </div>
        <div className="help-card lavender">
          <span className="why-icon">
            <IconCalendar />
          </span>
          <h3>Зміна дат чи складу групи</h3>
          <p>Оберіть інший виїзд того ж готелю або змініть кількість учасників — система перерахує суму. Різницю доплачуєте або отримуєте назад.</p>
        </div>
      </div>

      <div className="help-grid">
        <section className="faq card">
          <h2 className="card-title">Часті запитання</h2>
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
        <aside className="support-card">
          <img src="/images/banners/bukovel-1.jpg" alt="" loading="lazy" />
          <div className="support-body">
            <span className="eyebrow">Підтримка</span>
            <h2>Потрібна допомога?</h2>
            <p>Адміністратор бронювань відповість щодня з 9:00 до 21:00.</p>
            <a href="tel:+380440000000" className="support-line">
              <IconPhone size={18} /> +380 44 000 00 00
            </a>
            <a href="mailto:hello@winterra.test" className="support-line">
              <IconMail size={18} /> hello@winterra.test
            </a>
            <Link to="/" className="btn btn-light">
              Підібрати новий тур
            </Link>
          </div>
        </aside>
      </div>
    </>
  )
}

const FAQ = [
  ['Не прийшов лист із кодом. Що робити?', 'Перевірте папку «Спам». Якщо листа немає, зателефонуйте нам — адміністратор знайде бронювання за прізвищем і email.'],
  ['Скільки часу утримуються місця під час оплати?', '15 хвилин. Якщо оплату не завершено, місця звільняються, а бронювання скасовується автоматично.'],
  ['Чи можна додати скі-паси після оплати?', 'Так — через «Змінити бронювання»: оберіть скі-паси й активності, система розрахує доплату.'],
  ['Чому статус «Оплачене», а не «Підтверджене»?', 'Після оплати адміністратор перевіряє платіж, контакти й дати скі-пасів. Зазвичай це займає кілька годин.'],
  ['Що буде, якщо агенція скасує виїзд?', 'Усі бронювання на цей виїзд скасовуються з поверненням 100 % суми, ми повідомимо вас листом.'],
]

function CancelPanel({ lookup, onDone, onBack }) {
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/my-booking/cancel-preview/', { method: 'POST', body: lookup })
      .then(setPreview)
      .catch((e) => setError(e.message))
  }, [lookup])

  const confirm = async () => {
    setBusy(true)
    try {
      const res = await api('/my-booking/cancel/', { method: 'POST', body: lookup })
      onDone(
        res.booking,
        res.completed
          ? `Бронювання скасовано. Повернено: ${money(res.refund_amount)}.`
          : res.message,
      )
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <h3>Скасування бронювання</h3>
      {!preview && !error && <Loading />}
      {preview && (
        <>
          <p>До заїзду залишилось днів: {preview.days_before_start}.</p>
          <p>
            Сплачено: {money(preview.paid_amount)} · до повернення: <strong>{money(preview.refund_amount)}</strong>
          </p>
          {!preview.full_refund && Number(preview.paid_amount) > 0 && (
            <Alert kind="warning">До заїзду менше 7 днів — кошти за умовами не повертаються.</Alert>
          )}
        </>
      )}
      <Alert>{error}</Alert>
      <div className="actions">
        <button className="btn btn-secondary" onClick={onBack}>
          Не скасовувати
        </button>
        <button className="btn btn-danger" onClick={confirm} disabled={!preview || busy}>
          Підтвердити скасування
        </button>
      </div>
    </div>
  )
}

function ChangePanel({ booking, lookup, onApplied, onBack }) {
  const navigate = useNavigate()
  const [tour, setTour] = useState(null)
  const [departureId, setDepartureId] = useState(booking.departure)
  const [group, setGroup] = useState({ adults: booking.adults, children: booking.children, infants: booking.infants })
  const [extras, setExtras] = useState({
    ski_passes: booking.ski_passes.map((s) => ({ ski_pass_id: s.ski_pass, start_date: s.start_date, quantity: s.quantity })),
    activities: booking.activities.map((a) => ({ activity_id: a.activity, persons: a.persons })),
  })
  const [quote, setQuote] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api(`/tours/${booking.tour_id}/`)
      .then(setTour)
      .catch((e) => setError(e.message))
  }, [booking.tour_id])

  if (!tour) return error ? <Alert>{error}</Alert> : <Loading />
  const departures = tour.departures.some((d) => d.id === booking.departure)
    ? tour.departures
    : [{ id: booking.departure, start_date: booking.start_date, end_date: booking.end_date, free_seats: '—' }, ...tour.departures]
  const departure = departures.find((d) => d.id === Number(departureId))
  const body = { ...lookup, departure_id: Number(departureId), ...group, ...extras }

  const changeDeparture = (id) => {
    const d = departures.find((x) => x.id === Number(id))
    setDepartureId(Number(id))
    setQuote(null)
    // скі-паси прив’язані до дат — переносимо початок дії на нову дату заїзду
    setExtras({ ...extras, ski_passes: extras.ski_passes.map((s) => ({ ...s, start_date: d.start_date })) })
  }

  const calc = async () => {
    setBusy(true)
    setError('')
    try {
      setQuote(await api('/my-booking/change-quote/', { method: 'POST', body }))
    } catch (e) {
      setQuote(null)
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const apply = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api('/my-booking/change/', { method: 'POST', body })
      if (res.applied) {
        const diff = Number(res.difference)
        onApplied(
          diff < 0
            ? `Бронювання змінено. Різницю ${money(-diff)} повернено на картку.`
            : 'Бронювання змінено.',
        )
      } else {
        navigate(checkoutPath(res.checkout_url))
      }
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const diff = quote ? Number(quote.difference) : 0

  return (
    <div className="panel">
      <h3>Зміна бронювання</h3>
      <Field label="Виїзд">
        <select value={departureId} onChange={(e) => changeDeparture(e.target.value)}>
          {departures.map((d) => (
            <option key={d.id} value={d.id}>
              {date(d.start_date)} – {date(d.end_date)}
              {d.id === booking.departure ? ' (поточний)' : ` · вільно ${d.free_seats}`}
            </option>
          ))}
        </select>
      </Field>
      <GroupFields
        value={group}
        onChange={(g) => {
          setGroup(g)
          setQuote(null)
        }}
      />
      <Extras
        tour={tour}
        departure={departure}
        group={group}
        value={extras}
        onChange={(v) => {
          setExtras(v)
          setQuote(null)
        }}
      />
      <PriceSummary quote={quote} title="Нова вартість" />
      {quote && (
        <p className="big-price">
          {diff > 0 && `Доплата: ${money(diff)} (місця нового виїзду утримуються 15 хвилин)`}
          {diff < 0 && `До повернення: ${money(-diff)}`}
          {diff === 0 && 'Різниці в сумі немає'}
        </p>
      )}
      <Alert>{error}</Alert>
      <div className="actions">
        <button className="btn btn-secondary" onClick={onBack}>
          Скасувати зміну
        </button>
        <button className="btn btn-secondary" onClick={calc} disabled={busy}>
          Розрахувати
        </button>
        <button className="btn btn-primary" onClick={apply} disabled={!quote || busy}>
          {diff > 0 ? 'Підтвердити й доплатити' : 'Підтвердити зміну'}
        </button>
      </div>
    </div>
  )
}
