// Кадр 6: сторінка оплати тестового платіжного сервісу (FR-07, FR-12).
// Дані картки передаються лише платіжному сервісу й ніде не зберігаються (вимога 5.3).
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { date, groupText, money } from '../format.js'
import { IconClock, IconShield } from '../components/icons.jsx'
import { Alert, Countdown, Field, Loading, Steps } from '../components/ui.jsx'
import { checkoutPath } from './BookingPage.jsx'

function formatCard(value) {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits
}

function CardPreview({ number, expiry, holder }) {
  const digits = (number || '').replace(/\D/g, '').padEnd(16, '•')
  const shown = digits.replace(/(.{4})(?=.)/g, '$1 ')
  const brand = number.startsWith('4') ? 'VISA' : number.startsWith('5') ? 'Mastercard' : ''
  return (
    <div className="card-preview" aria-hidden="true">
      <div className="card-chip" />
      <span className="card-brand">{brand}</span>
      <div className="card-number">{shown}</div>
      <div className="card-bottom">
        <span>{holder || 'ВЛАСНИК КАРТКИ'}</span>
        <span>{expiry || 'ММ/РР'}</span>
      </div>
    </div>
  )
}

export default function PaymentPage() {
  const { ref } = useParams()
  const navigate = useNavigate()
  const [info, setInfo] = useState(null)
  const [booking, setBooking] = useState(null)
  const [card, setCard] = useState({ card_number: '', expiry: '', cvv: '' })
  const [error, setError] = useState('')
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    api(`/test-gateway/${ref}/`)
      .then(async (i) => {
        setInfo(i)
        setBooking(await api(`/bookings/${i.booking_public_id}/`))
      })
      .catch((e) => setError(e.message))
  }, [ref])

  const onExpire = useCallback(() => setExpired(true), [])

  if (!info) return error ? <Alert>{error}</Alert> : <Loading />
  const isSurcharge = info.kind !== 'Оплата бронювання'

  if (info.status === 'succeeded') {
    return (
      <div className="card narrow-card">
        <Alert kind="success">Цей платіж уже проведено.</Alert>
        <Link className="btn btn-primary" to={`/booking/${info.booking_public_id}`}>
          Переглянути бронювання
        </Link>
      </div>
    )
  }

  const pay = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await api('/test-gateway/charge/', { method: 'POST', body: { provider_ref: ref, ...card } })
      if (res.status === 'succeeded') {
        navigate(isSurcharge ? '/my-booking?changed=1' : `/booking/${res.booking_public_id}`)
      } else {
        setFailed(true)
        setError('Банк відхилив платіж. Перевірте дані картки або спробуйте іншу картку.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const retry = async () => {
    setBusy(true)
    try {
      const res = await api(`/bookings/${info.booking_public_id}/pay/`, { method: 'POST' })
      setFailed(false)
      setCard({ card_number: '', expiry: '', cvv: '' })
      setInfo(null)
      navigate(checkoutPath(res.checkout_url))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const holdUntil = booking?.hold_expires_at
  const holder = booking ? `${booking.first_name} ${booking.last_name}`.toUpperCase() : ''

  return (
    <>
      {!isSurcharge && <Steps current={4} items={['Тур і дата', 'Скі-паси та активності', 'Контакти й підсумок', 'Оплата']} />}
      <div className="pay-layout">
        <div className="card pay-card">
          <div className="gateway-head">
            <span className="gateway-logo">
              <IconShield size={18} /> TestPay
            </span>
            <span className="muted small">Захищена сторінка оплати · тестовий режим</span>
          </div>
          <h1>{isSurcharge ? 'Доплата за зміну бронювання' : 'Оплата бронювання'}</h1>
          {holdUntil && !isSurcharge && !expired && (
            <div className="timer-box">
              <IconClock />
              <span>Місця утримуються ще</span>
              <Countdown until={holdUntil} onExpire={onExpire} />
            </div>
          )}
          {expired ? (
            <Alert>
              Час утримання місць минув, бронювання буде скасовано. <Link to="/">Почати пошук заново</Link>
            </Alert>
          ) : failed ? (
            <>
              <Alert>{error}</Alert>
              {isSurcharge ? (
                <Link className="btn btn-secondary" to="/my-booking">
                  Повернутися до бронювання
                </Link>
              ) : (
                <button className="btn btn-primary btn-lg" onClick={retry} disabled={busy}>
                  Спробувати ще раз
                </button>
              )}
            </>
          ) : (
            <form onSubmit={pay}>
              <CardPreview number={card.card_number} expiry={card.expiry} holder={holder} />
              <Field label="Номер картки">
                <input
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="0000 0000 0000 0000"
                  value={card.card_number}
                  onChange={(e) => setCard({ ...card, card_number: formatCard(e.target.value) })}
                  required
                />
              </Field>
              <div className="grid-2">
                <Field label="Термін дії">
                  <input
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="ММ/РР"
                    value={card.expiry}
                    onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                    required
                  />
                </Field>
                <Field label="CVV">
                  <input
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="•••"
                    maxLength={3}
                    value={card.cvv}
                    onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '') })}
                    required
                  />
                </Field>
              </div>
              <Alert>{error}</Alert>
              <button className="btn btn-pay btn-wide btn-lg" disabled={busy}>
                {busy ? 'Обробка…' : `Сплатити ${money(info.amount)}`}
              </button>
              <p className="muted small center">
                <IconShield size={14} /> Дані картки не зберігаються системою бронювання
              </p>
            </form>
          )}
        </div>
        <aside className="pay-side">
          <div className="card">
            <span className="field-label">До сплати</span>
            <div className="pay-amount">{money(info.amount)}</div>
            {booking && (
              <ul className="order-facts">
                <li>{booking.tour}</li>
                <li>
                  {date(booking.start_date)} – {date(booking.end_date)}
                </li>
                <li>{groupText(booking)}</li>
              </ul>
            )}
          </div>
          <div className="card test-cards">
            <h3>Тестові картки</h3>
            <button type="button" onClick={() => setCard({ card_number: '4242 4242 4242 4242', expiry: '12/28', cvv: '123' })}>
              <code>4242 4242 4242 4242</code>
              <span className="ok">успішна оплата</span>
            </button>
            <button type="button" onClick={() => setCard({ card_number: '4000 0000 0000 0002', expiry: '12/28', cvv: '123' })}>
              <code>4000 0000 0000 0002</code>
              <span className="bad">відмова банку</span>
            </button>
            <p className="muted small">Натисніть, щоб підставити. Реальні кошти не списуються.</p>
          </div>
        </aside>
      </div>
    </>
  )
}
