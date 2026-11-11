// Кадр 2: результати пошуку (FR-01, FR-12). Виїзди згруповано за турами: одна картка — один готель,
// усередині — доступні дати з кількістю вільних місць.
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { groupText, money, nightsText, plural, shortDate, starsText } from '../format.js'
import ResortPhoto, { RESORT_BANNERS } from '../components/ResortPhoto.jsx'
import { formatLong } from '../components/DatePicker.jsx'
import { IconArrowRight, IconBed, IconCoffee, IconMountain } from '../components/icons.jsx'
import { Alert, Loading } from '../components/ui.jsx'
import { readSearch, SearchForm } from './SearchPage.jsx'

const WEEKDAY = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const weekday = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return WEEKDAY[new Date(y, m - 1, d).getDay()]
}

export default function ResultsPage() {
  const [params] = useSearchParams()
  const search = readSearch(params)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [sort, setSort] = useState('date')
  const [resortName, setResortName] = useState('')

  useEffect(() => {
    api('/resorts/')
      .then((list) => setResortName(list.find((r) => String(r.id) === String(search.resort))?.name || ''))
      .catch(() => {})
  }, [search.resort])

  useEffect(() => {
    setData(null)
    setError('')
    api('/departures/search/', { params: search })
      .then(setData)
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()])

  const group = { adults: search.adults, children: search.children, infants: search.infants }

  const tours = useMemo(() => {
    const byTour = new Map()
    for (const r of data?.results || []) {
      if (!byTour.has(r.tour.id)) byTour.set(r.tour.id, { tour: r.tour, price: Number(r.group_price), departures: [] })
      byTour.get(r.tour.id).departures.push(r.departure)
    }
    const list = [...byTour.values()]
    if (sort === 'price') list.sort((a, b) => a.price - b.price)
    return list
  }, [data, sort])

  const depCount = data?.results.length || 0
  const link = (tourId, depId) => `/tours/${tourId}?` + new URLSearchParams({ departure: depId, ...group })

  return (
    <>
      <section className="page-hero">
        <img className="hero-art" src={RESORT_BANNERS[resortName] || '/images/hero.jpg'} alt="" />
        <div className="hero-shade" />
        <div className="container page-hero-content">
          <span className="eyebrow">
            <IconMountain size={16} /> Пошук турів
          </span>
          <h1>{resortName ? `Тури: ${resortName}` : 'Гірськолижні тури'}</h1>
          <p>
            {search.date && `Заїзд від ${formatLong(search.date, false)}`}
            {search.date && ' · '}
            {groupText(group)}
          </p>
        </div>
      </section>
      <div className="container search-wrap">
        <SearchForm initial={search} variant="bar" key={params.toString()} />
      </div>
      <div className="container results-page">
      <div className="results-head">
        <div>
          <h1>
            {!data
              ? 'Шукаємо виїзди…'
              : tours.length
                ? `${tours.length} ${plural(tours.length, 'тур', 'тури', 'турів')} · ${depCount} ${plural(depCount, 'виїзд', 'виїзди', 'виїздів')}`
                : 'Виїздів не знайдено'}
          </h1>
          <span className="muted">Ціни для групи: {groupText(group)}</span>
        </div>
        {tours.length > 1 && (
          <div className="sort-toggle" role="group" aria-label="Сортування">
            <button className={sort === 'date' ? 'active' : ''} onClick={() => setSort('date')}>
              За датою
            </button>
            <button className={sort === 'price' ? 'active' : ''} onClick={() => setSort('price')}>
              Дешевші спочатку
            </button>
          </div>
        )}
      </div>
      <Alert>{error}</Alert>
      {!data && !error && <Loading text="Перевіряємо вільні місця…" />}
      {data?.message && <Alert kind="info">{data.message}</Alert>}

      <div className="results">
        {tours.map(({ tour, price, departures }) => (
          <article className="result" key={tour.id}>
            <Link to={link(tour.id, departures[0].id)} className="result-media" aria-label={tour.hotel_name}>
              <ResortPhoto name={tour.resort_name} src={tour.image_url} />
              <span className="media-tag">
                <IconMountain size={14} /> {tour.resort_name}
              </span>
            </Link>
            <div className="result-body">
              <div className="stars" aria-label={`${tour.stars} зірки`}>
                {starsText(tour.stars)}
              </div>
              <h3>
                <Link to={link(tour.id, departures[0].id)}>{tour.hotel_name}</Link>
              </h3>
              <ul className="chips">
                <li>
                  <IconBed size={16} /> {nightsText(tour.nights)}
                </li>
                <li>
                  <IconCoffee size={16} /> сніданки
                </li>
              </ul>
              {tour.description && <p className="result-desc">{tour.description}</p>}
              <div className="date-pills">
                {departures.map((d) => (
                  <Link key={d.id} to={link(tour.id, d.id)} className={`date-pill ${d.free_seats <= 3 ? 'low' : ''}`}>
                    <strong>
                      {shortDate(d.start_date)}–{shortDate(d.end_date)}
                    </strong>
                    <span>
                      {weekday(d.start_date)} · {d.free_seats <= 3 ? `лише ${d.free_seats}` : d.free_seats}{' '}
                      {plural(d.free_seats, 'місце', 'місця', 'місць')}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="result-price">
              <span className="muted">{money(tour.adult_price)} / дорослий</span>
              <strong>{money(price)}</strong>
              <span className="muted small">проживання для групи</span>
              <Link to={link(tour.id, departures[0].id)} className="btn btn-primary btn-sm">
                Обрати <IconArrowRight size={16} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      </div>
    </>
  )
}
