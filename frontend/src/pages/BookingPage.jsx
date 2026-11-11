// Кадри 4–5: скі-паси та активності, контактні дані й підсумок, оформлення бронювання (FR-03…FR-06).
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { date, groupText, money, nightsText } from '../format.js'
import Extras, { emptyExtras } from '../components/Extras.jsx'
import ResortPhoto from '../components/ResortPhoto.jsx'
import {
  IconArrowLeft, IconArrowRight, IconCalendar, IconCard, IconClock, IconCoffee, IconMail, IconMountain, IconPhone, IconShield, IconSki, IconUsers,
} from '../components/icons.jsx'
import { Alert, Field, Loading, PriceSummary, Steps } from '../components/ui.jsx'

export function checkoutPath(url) {
  try {
    return new URL(url, window.location.origin).pathname
  } catch {
    return url
  }
}

const STEPS = ['Тур і дата', 'Скі-паси та активності', 'Контакти й підсумок', 'Оплата']

export default function BookingPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const group = {
    adults: parseInt(params.get('adults') || '1', 10),
    children: parseInt(params.get('children') || '0', 10),
    infants: parseInt(params.get('infants') || '0', 10),
  }
  const departureId = Number(params.get('departure'))

  const [tour, setTour] = useState(null)
  const [extras, setExtras] = useState(emptyExtras())
  const [quote, setQuote] = useState(null)
  const [step, setStep] = useState(2)
  const [contact, setContact] = useState({ first_name: '', last_name: '', phone: '', email: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api(`/tours/${params.get('tour')}/`)
      .then(setTour)
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!tour) return error ? <Alert>{error}</Alert> : <Loading />
  const departure = tour.departures.find((d) => d.id === departureId)
  if (!departure) return <Alert>Виїзд недоступний для бронювання. Поверніться до пошуку.</Alert>

  const selection = { departure_id: departureId, ...group, ...extras }

  const calculate = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      setQuote(await api('/bookings/quote/', { method: 'POST', body: selection }))
      setStep(3)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await api('/bookings/', { method: 'POST', body: { ...selection, ...contact } })
      navigate(checkoutPath(res.checkout_url))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const setC = (key) => (e) => setContact({ ...contact, [key]: e.target.value })

  return (
    <>
      <section className="checkout-hero">
        <ResortPhoto name={tour.resort_name} src={tour.banner_url || tour.image_url} eager />
        <div className="checkout-hero-text">
          <span className="eyebrow">
            <IconMountain size={16} /> {tour.resort_name} · оформлення бронювання
          </span>
          <h1>{tour.hotel_name}</h1>
          <p>
            {date(departure.start_date)} – {date(departure.end_date)} · {nightsText(tour.nights)} · {groupText(group)}
          </p>
        </div>
      </section>
      <Steps current={step} items={STEPS} />
      <div className="checkout-layout">
        <div>
          {step === 2 && (
            <form className="card" onSubmit={calculate}>
              <Extras tour={tour} departure={departure} group={group} value={extras} onChange={setExtras} />
              <Alert>{error}</Alert>
              <div className="actions between">
                <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
                  <IconArrowLeft size={18} /> Назад до туру
                </button>
                <button className="btn btn-primary btn-lg" disabled={busy}>
                  {busy ? 'Розрахунок…' : 'Розрахувати вартість'} <IconArrowRight size={18} />
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form className="card" onSubmit={submit}>
              <h2 className="card-title">Контактні дані</h2>
              <p className="muted">На email надійде лист із кодом бронювання — за ним ви зможете керувати поїздкою.</p>
              <div className="grid-2">
                <Field label="Ім’я">
                  <input value={contact.first_name} onChange={setC('first_name')} required maxLength={60} autoComplete="given-name" placeholder="Олена" />
                </Field>
                <Field label="Прізвище">
                  <input value={contact.last_name} onChange={setC('last_name')} required maxLength={60} autoComplete="family-name" placeholder="Коваль" />
                </Field>
                <Field label="Телефон" icon={<IconPhone size={18} />}>
                  <input type="tel" value={contact.phone} onChange={setC('phone')} required autoComplete="tel" placeholder="+380 67 123 45 67" />
                </Field>
                <Field label="Email" icon={<IconMail size={18} />}>
                  <input type="email" value={contact.email} onChange={setC('email')} required autoComplete="email" placeholder="you@example.com" />
                </Field>
              </div>
              <div className="hold-note">
                <IconClock />
                <span>
                  Після натискання «Оформити бронювання» місця утримуються <strong>15 хвилин</strong>. Якщо оплату не завершено вчасно,
                  бронювання скасовується автоматично.
                </span>
              </div>
              <Alert>{error}</Alert>
              <div className="actions between">
                <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>
                  <IconArrowLeft size={18} /> Змінити послуги
                </button>
                <button className="btn btn-primary btn-lg" disabled={busy}>
                  {busy ? 'Оформлення…' : 'Оформити бронювання'} <IconArrowRight size={18} />
                </button>
              </div>
            </form>
          )}
          <CheckoutInfo />
        </div>

        <aside className="order-side">
          <div className="order-media">
            <ResortPhoto name={tour.resort_name} src={tour.image_url} />
            <div>
              <span className="eyebrow dark">{tour.resort_name}</span>
              <strong>{tour.hotel_name}</strong>
            </div>
          </div>
          <ul className="order-facts">
            <li>
              <IconCalendar size={18} /> {date(departure.start_date)} – {date(departure.end_date)} · {nightsText(tour.nights)}
            </li>
            <li>
              <IconUsers size={18} /> {groupText(group)}
            </li>
          </ul>
          {quote ? (
            <PriceSummary quote={quote} />
          ) : (
            <div className="summary-placeholder">
              <span>Проживання</span>
              <strong>{money(group.adults * Number(tour.adult_price) + group.children * Number(tour.child_price))}</strong>
              <small>Повна сума — після розрахунку зі скі-пасами та активностями</small>
            </div>
          )}
          <div className="order-terms">
            <h3>Умови</h3>
            <ul>
              <li>
                <IconShield size={16} /> Скасування до 7 днів до заїзду — повернення 100 %
              </li>
              <li>
                <IconCalendar size={16} /> Зміна дати чи складу групи — не пізніше ніж за 7 днів
              </li>
              <li>
                <IconCoffee size={16} /> Сніданки включено, трансфер — самостійно
              </li>
            </ul>
            <a href="tel:+380440000000" className="order-help">
              <IconPhone size={16} /> Питання? +380 44 000 00 00
            </a>
          </div>
        </aside>
      </div>
    </>
  )
}

/** Що відбувається після оформлення + гарантії (підказки, вимога 6.1). */
function CheckoutInfo() {
  const steps = [
    [<IconCard key="i" />, 'Оплата карткою', 'Місця утримуються 15 хвилин, поки ви оплачуєте.'],
    [<IconMail key="i" />, 'Лист із кодом', 'Одразу після оплати — код бронювання на email.'],
    [<IconShield key="i" />, 'Підтвердження', 'Адміністратор перевіряє платіж і дати скі-пасів.'],
    [<IconSki key="i" />, 'Гори й сніг', 'Заселення в день заїзду, сніданки щодня.'],
  ]
  return (
    <section className="checkout-info">
      <h3>Що далі</h3>
      <ol className="next-steps">
        {steps.map(([icon, title, text], i) => (
          <li key={title}>
            <span className="next-icon">{icon}</span>
            <span className="next-num">0{i + 1}</span>
            <strong>{title}</strong>
            <small>{text}</small>
          </li>
        ))}
      </ol>
      <div className="guarantees">
        <div>
          <IconShield size={20} />
          <span>
            <strong>Безпечна оплата</strong>
            <small>Дані картки обробляє лише платіжний сервіс</small>
          </span>
        </div>
        <div>
          <IconClock size={20} />
          <span>
            <strong>Повернення 100 %</strong>
            <small>Якщо скасуєте не пізніше ніж за 7 днів</small>
          </span>
        </div>
        <div>
          <IconPhone size={20} />
          <span>
            <strong>Підтримка щодня</strong>
            <small>З 9:00 до 21:00, +380 44 000 00 00</small>
          </span>
        </div>
      </div>
    </section>
  )
}
