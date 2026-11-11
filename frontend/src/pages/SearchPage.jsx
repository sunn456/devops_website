// Головна сторінка: пошук туру (кадр 1, FR-01), курорти, як це працює.
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { isoToday, money, nightsText, plural, starsText } from '../format.js'
import ResortPhoto from '../components/ResortPhoto.jsx'
import {
  IconArrowRight, IconCard, IconClock, IconCoffee, IconMountain, IconSearch, IconShield, IconSki,
  IconTicket, IconUsers,
} from '../components/icons.jsx'
import DatePicker, { formatLong } from '../components/DatePicker.jsx'
import { Alert, Field, GroupFields } from '../components/ui.jsx'

export function readSearch(params) {
  return {
    resort: params.get('resort') || '',
    date: params.get('date') || '',
    adults: parseInt(params.get('adults') || '2', 10),
    children: parseInt(params.get('children') || '0', 10),
    infants: parseInt(params.get('infants') || '0', 10),
    window_days: params.get('window_days') || '',
  }
}

export function SearchForm({ initial, variant = 'main' }) {
  const navigate = useNavigate()
  const [resorts, setResorts] = useState([])
  const [form, setForm] = useState(initial)
  const [groupOpen, setGroupOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/resorts/')
      .then((list) => setResorts(list.filter((r) => r.is_active)))
      .catch((e) => setError(e.message))
  }, [])

  const submit = (e) => {
    e.preventDefault()
    if (!form.resort || !form.date) {
      setError('Оберіть курорт і дату заїзду.')
      return
    }
    setError('')
    // eslint-disable-next-line no-unused-vars
    const { window_days, ...rest } = form
    navigate('/results?' + new URLSearchParams(rest))
  }

  const people = form.adults + form.children + form.infants
  return (
    <form className={`search-panel ${variant}`} onSubmit={submit}>
      <div className="search-row">
        <Field label="Курорт" icon={<IconMountain />}>
          <select value={form.resort} onChange={(e) => setForm({ ...form, resort: e.target.value })}>
            <option value="">Куди їдемо?</option>
            {resorts.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}, {r.country}
              </option>
            ))}
          </select>
        </Field>
        <DatePicker label="Дата заїзду" min={isoToday(1)} value={form.date} onChange={(d) => setForm({ ...form, date: d })} placeholder="Коли їдемо?" />
        <div className="field with-icon group-trigger">
          <span className="field-label">Учасники</span>
          <button type="button" className="field-control as-input" onClick={() => setGroupOpen(!groupOpen)} aria-expanded={groupOpen}>
            <span className="field-icon">
              <IconUsers />
            </span>
            {people} {people === 1 ? 'особа' : people < 5 ? 'особи' : 'осіб'}
            {form.children + form.infants > 0 && <small> · з дітьми</small>}
          </button>
          {groupOpen && (
            <div className="group-pop">
              <GroupFields value={form} onChange={(g) => setForm({ ...form, ...g })} />
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setGroupOpen(false)}>
                Готово
              </button>
            </div>
          )}
        </div>
        <button className="btn btn-primary btn-search">
          <IconSearch /> Знайти тур
        </button>
      </div>
      <Alert>{error}</Alert>
      {variant === 'main' && (
        <p className="search-note">Вік учасників визначається на дату заїзду · Покажемо виїзди протягом 7 днів від обраної дати</p>
      )}
    </form>
  )
}

export default function SearchPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [resorts, setResorts] = useState([])
  const [tours, setTours] = useState([])
  const [hotelFilter, setHotelFilter] = useState('')
  const { hash } = useLocation()

  // перехід за посиланнями шапки «Курорти / Готелі / Як це працює»
  useEffect(() => {
    if (!hash) return
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    return () => clearTimeout(t)
  }, [hash, tours.length])

  useEffect(() => {
    api('/resorts/')
      .then((list) => setResorts(list.filter((r) => r.is_active)))
      .catch(() => {})
    api('/tours/')
      .then(setTours)
      .catch(() => {})
  }, [])

  const resortStats = {}
  for (const t of tours) {
    const s = (resortStats[t.resort_name] ||= { count: 0, min: Infinity })
    s.count += 1
    s.min = Math.min(s.min, Number(t.adult_price))
  }
  const shownTours = tours.filter((t) => !hotelFilter || t.resort_name === hotelFilter)

  const openResort = (r) =>
    navigate('/results?' + new URLSearchParams({ resort: r.id, date: isoToday(1), adults: 2, children: 0, infants: 0, window_days: 30 }))

  return (
    <>
      <section className="hero">
        <img className="hero-art" src="/images/hero.jpg" alt="Засніжені ялини й гора на світанку в Карпатах" />
        <div className="hero-shade" />
        <div className="container hero-content">
          <span className="eyebrow">Сезон 2026/27 · бронювання відкрито</span>
          <h1>
            Гори, сніг і затишний готель —{' '}<br /><em>в одному бронюванні</em>
          </h1>
          <p>
            Буковель, Драгобрат, Яблуниця та Банско — тури з проживанням у готелях зі SPA, басейнами та сніданками. Оберіть дату заїзду, і ми
            покажемо вільні місця та точну ціну для всієї вашої компанії: з дитячими знижками, скі-пасами й розвагами.
          </p>
          <ul className="hero-chips">
            <li>
              <IconCoffee size={18} /> Сніданки включено
            </li>
            <li>
              <IconSki size={18} /> Скі-паси курорту
            </li>
            <li>
              <IconShield size={18} /> Повернення 100 % за 7 днів
            </li>
          </ul>
        </div>
      </section>

      <div className="container search-wrap">
        <SearchForm initial={readSearch(params)} />
      </div>

      <section className="container section" id="resorts">
        <div className="section-head">
          <div>
            <span className="kicker">Напрямки сезону</span>
            <h2>Курорти</h2>
          </div>
          <p>Чотири напрямки з фіксованими датами заїзду — оберіть свій.</p>
        </div>
        <div className="resort-grid">
          {resorts.map((r) => {
            const s = resortStats[r.name]
            return (
              <button key={r.id} className="resort-card" onClick={() => openResort(r)}>
                <ResortPhoto name={r.name} />
                <div className="resort-card-body">
                  <span className="resort-country">{r.country}</span>
                  <h3>{r.name}</h3>
                  <p>{r.description}</p>
                  {s && (
                    <span className="resort-meta">
                      {s.count} {plural(s.count, 'готель', 'готелі', 'готелів')} · від {money(s.min)}
                    </span>
                  )}
                  <span className="resort-link">
                    Найближчі виїзди <IconArrowRight size={16} />
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="container section" id="hotels">
        <div className="section-head">
          <div>
            <span className="kicker">Де жити</span>
            <h2>Готелі сезону</h2>
          </div>
          <div className="chip-tabs" role="tablist" aria-label="Фільтр за курортом">
            {['', ...resorts.map((r) => r.name)].map((name) => (
              <button key={name || 'all'} role="tab" aria-selected={hotelFilter === name} className={hotelFilter === name ? 'active' : ''} onClick={() => setHotelFilter(name)}>
                {name || 'Усі'}
              </button>
            ))}
          </div>
        </div>
        <div className="hotel-grid">
          {shownTours.map((t) => (
            <Link key={t.id} className="hotel-card" to={`/tours/${t.id}?` + new URLSearchParams({ departure: t.next_departure.id, adults: 2, children: 0, infants: 0 })}>
              <div className="hotel-media">
                <ResortPhoto name={t.resort_name} src={t.image_url} />
                <span className="media-tag">
                  <IconMountain size={14} /> {t.resort_name}
                </span>
                <span className="hotel-nights">{nightsText(t.nights)}</span>
              </div>
              <div className="hotel-body">
                <div className="stars" aria-label={`${t.stars} зірки`}>{starsText(t.stars)}</div>
                <h3>{t.hotel_name}</h3>
                <p>{t.description}</p>
                <div className="hotel-foot">
                  <span>
                    <small>найближчий заїзд</small>
                    {formatLong(t.next_departure.start_date, false)}
                  </span>
                  <span className="hotel-price">
                    <small>від</small>
                    {money(t.adult_price)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="how-band" id="how">
        <img src="/images/bukovel-2.jpg" alt="" className="how-bg" loading="lazy" />
        <div className="how-shade" />
        <div className="container how-inner">
          <div className="section-head light">
            <div>
              <span className="kicker">Просто й прозоро</span>
              <h2>Як це працює</h2>
            </div>
            <p>Від пошуку до підтвердження — без дзвінків і переписок.</p>
          </div>
          <ol className="how">
            <li>
              <span className="how-icon">
                <IconSearch />
              </span>
              <h3>Знайдіть виїзд</h3>
              <p>Курорт, дата заїзду та склад групи — і ви бачите лише виїзди з вільними місцями.</p>
            </li>
            <li>
              <span className="how-icon">
                <IconSki />
              </span>
              <h3>Додайте послуги</h3>
              <p>Скі-паси курорту на потрібні дні та активності для тих, хто не катається.</p>
            </li>
            <li>
              <span className="how-icon">
                <IconCard />
              </span>
              <h3>Оплатіть онлайн</h3>
              <p>Місця утримуються 15 хвилин, поки ви оплачуєте замовлення карткою.</p>
            </li>
            <li>
              <span className="how-icon">
                <IconTicket />
              </span>
              <h3>Отримайте код</h3>
              <p>Код бронювання надійде на email — за ним можна змінити чи скасувати поїздку.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="container section">
        <div className="why">
          <div className="why-mosaic" aria-hidden="true">
            <img src="/images/dragobrat-2.jpg" alt="" loading="lazy" />
            <img src="/images/bansko-2.jpg" alt="" loading="lazy" />
            <img src="/images/yablunytsia-2.jpg" alt="" loading="lazy" />
          </div>
          <div className="why-text">
            <span className="kicker">Чому Winterra</span>
            <h2>Відпочинок, у якому все пораховано заздалегідь</h2>
            <div className="why-list">
              <div className="why-item peach">
                <span className="why-icon">
                  <IconUsers />
                </span>
                <div>
                  <h3>Ціна за віком</h3>
                  <p>Дорослі (12+) — повна ціна, діти 4–11 — дитяча, малюки 0–3 живуть безкоштовно.</p>
                </div>
              </div>
              <div className="why-item rose">
                <span className="why-icon">
                  <IconClock />
                </span>
                <div>
                  <h3>Чесні умови</h3>
                  <p>Скасування не пізніше ніж за 7 днів до заїзду — повертаємо 100 % суми.</p>
                </div>
              </div>
              <div className="why-item lavender">
                <span className="why-icon">
                  <IconShield />
                </span>
                <div>
                  <h3>Безпечна оплата</h3>
                  <p>Дані картки обробляє лише платіжний сервіс — ми їх не зберігаємо.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="cta-photo">
          <img src="/images/admin.jpg" alt="" loading="lazy" />
          <div className="cta-content">
            <div>
              <h2>Уже маєте бронювання?</h2>
              <p>Знайдіть його за кодом і email, щоб переглянути, змінити або скасувати.</p>
            </div>
            <Link to="/my-booking" className="btn btn-light btn-lg">
              Моє бронювання <IconArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
