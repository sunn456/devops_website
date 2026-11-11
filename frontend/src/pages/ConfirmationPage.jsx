// Кадр 7: підтвердження бронювання — код, статус, лист на email (FR-08).
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { date, groupText, money } from '../format.js'
import ResortPhoto from '../components/ResortPhoto.jsx'
import { IconCalendar, IconCheck, IconClock, IconMail, IconSki, IconSpa, IconUsers } from '../components/icons.jsx'
import { Alert, Loading, StatusBadge } from '../components/ui.jsx'
import { checkoutPath } from './BookingPage.jsx'

export function BookingDetails({ booking }) {
  return (
    <div className="details">
      <div className="details-head">
        <ResortPhoto name={booking.resort} />
        <div>
          <span className="eyebrow dark">{booking.resort}</span>
          <strong>{booking.tour}</strong>
        </div>
      </div>
      <ul className="details-list">
        <li>
          <IconCalendar size={18} />
          <span>
            <small>Виїзд</small>
            {date(booking.start_date)} – {date(booking.end_date)}
          </span>
        </li>
        <li>
          <IconUsers size={18} />
          <span>
            <small>Склад групи</small>
            {groupText(booking)}
          </span>
        </li>
        <li>
          <IconMail size={18} />
          <span>
            <small>Контакт</small>
            {booking.first_name} {booking.last_name} · {booking.phone} · {booking.email}
          </span>
        </li>
        {booking.ski_passes.length > 0 && (
          <li>
            <IconSki size={18} />
            <span>
              <small>Скі-паси</small>
              {booking.ski_passes.map((s, i) => (
                <span className="block" key={i}>
                  {s.title} · {date(s.start_date)}–{date(s.end_date)} × {s.quantity}
                </span>
              ))}
            </span>
          </li>
        )}
        {booking.activities.length > 0 && (
          <li>
            <IconSpa size={18} />
            <span>
              <small>Активності</small>
              {booking.activities.map((a, i) => (
                <span className="block" key={i}>
                  {a.title} × {a.persons}
                </span>
              ))}
            </span>
          </li>
        )}
      </ul>
      <div className="details-total">
        <span>Вартість</span>
        <strong>{money(booking.total_amount)}</strong>
      </div>
    </div>
  )
}

export default function ConfirmationPage() {
  const { publicId } = useParams()
  const navigate = useNavigate()
  const [booking, setBooking] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api(`/bookings/${publicId}/`)
      .then(setBooking)
      .catch((e) => setError(e.message))
  }, [publicId])

  if (!booking) return error ? <Alert>{error}</Alert> : <Loading />

  const pay = async () => {
    try {
      const res = await api(`/bookings/${publicId}/pay/`, { method: 'POST' })
      navigate(checkoutPath(res.checkout_url))
    } catch (e) {
      setError(e.message)
    }
  }

  const paid = booking.status === 'paid' || booking.status === 'confirmed'

  return (
    <div className="confirm">
      <div className={`confirm-hero ${paid ? 'ok' : booking.status === 'new' ? 'wait' : 'off'}`}>
        <span className="confirm-icon">{paid ? <IconCheck size={34} /> : <IconClock size={34} />}</span>
        {paid && (
          <>
            <h1>Дякуємо! Оплату отримано</h1>
            <p>Місця закріплено. Лист із кодом бронювання надіслано на {booking.email}.</p>
            <div className="code-box">
              <span>Код бронювання</span>
              <strong>{booking.code}</strong>
            </div>
            <p>
              <StatusBadge status={booking.status} label={booking.status_display} />{' '}
              {booking.status === 'paid' && <span className="muted">· очікує перевірки адміністратором</span>}
            </p>
          </>
        )}
        {booking.status === 'new' && (
          <>
            <h1>Бронювання очікує оплати</h1>
            <p>Місця утримуються, доки діє час на оплату.</p>
            <button className="btn btn-primary btn-lg" onClick={pay}>
              Перейти до оплати
            </button>
          </>
        )}
        {booking.status === 'cancelled' && (
          <>
            <h1>Бронювання скасовано</h1>
            <p>{booking.cancel_reason || 'Оплату не завершено вчасно, місця звільнено.'}</p>
          </>
        )}
      </div>
      <Alert>{error}</Alert>
      <div className="card">
        <BookingDetails booking={booking} />
        <div className="actions">
          <Link className="btn btn-primary" to="/my-booking">
            Керувати бронюванням
          </Link>
          <Link className="btn btn-ghost" to="/">
            На головну
          </Link>
        </div>
      </div>
    </div>
  )
}
