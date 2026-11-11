// Кадр 3: сторінка туру — склад, ціни, умови скасування та зміни, вільні місця (FR-02).
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { date, money, nightsText, plural, starsText } from '../format.js'
import Gallery from '../components/Gallery.jsx'
import ResortPhoto from '../components/ResortPhoto.jsx'
import {
  IconArrowLeft, IconArrowRight, IconBed, IconCalendar, IconClock, IconCoffee, IconMountain, IconShield, IconSki, IconSpa,
} from '../components/icons.jsx'
import { Alert, GroupFields, Loading } from '../components/ui.jsx'

export default function TourPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [tour, setTour] = useState(null)
  const [error, setError] = useState('')
  const [departureId, setDepartureId] = useState(params.get('departure') || '')
  const [group, setGroup] = useState({
    adults: parseInt(params.get('adults') || '2', 10),
    children: parseInt(params.get('children') || '0', 10),
    infants: parseInt(params.get('infants') || '0', 10),
  })

  useEffect(() => {
    api(`/tours/${id}/`)
      .then((t) => {
        setTour(t)
        if (!params.get('departure') && t.departures[0]) setDepartureId(String(t.departures[0].id))
      })
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (error) return <Alert>{error}</Alert>
  if (!tour) return <Loading />

  const departure = tour.departures.find((d) => String(d.id) === String(departureId))
  const seatsNeeded = group.adults + group.children
  const enough = departure && departure.free_seats >= seatsNeeded
  const perGroup = group.adults * Number(tour.adult_price) + group.children * Number(tour.child_price)
  const next = () => navigate('/book?' + new URLSearchParams({ tour: tour.id, departure: departure.id, ...group }))

  return (
    <>
      <button className="back-link" onClick={() => navigate(-1)}>
        <IconArrowLeft size={18} /> До результатів
      </button>
      <section className="tour-banner">
        <ResortPhoto name={tour.resort_name} src={tour.banner_url || tour.image_url} eager />
        <div className="tour-banner-shade" />
        <div className="tour-banner-text">
          <span className="eyebrow">
            <IconMountain size={16} /> {tour.resort_name}
          </span>
          <h1>{tour.hotel_name}</h1>
          <div className="stars light">{starsText(tour.stars)} · {nightsText(tour.nights)} · сніданки</div>
        </div>
      </section>

      <div className="tour-layout">
        <div className="tour-main">
          {tour.photos?.length > 0 && (
            <section className="card">
              <h2>Фото готелю</h2>
              <Gallery photos={tour.photos} title={tour.hotel_name} skipCover={!tour.banner_url && tour.photos[0]?.image_url === tour.image_url} />
            </section>
          )}
          <section className="card">
            <h2>Що входить у тур</h2>
            <div className="includes">
              <div>
                <IconBed />
                <span>
                  <strong>Готель {tour.stars}★</strong>
                  {tour.hotel_name}
                </span>
              </div>
              <div>
                <IconCoffee />
                <span>
                  <strong>Сніданки</strong>щодня
                </span>
              </div>
              <div>
                <IconCalendar />
                <span>
                  <strong>{nightsText(tour.nights)}</strong>фіксовані дати
                </span>
              </div>
              <div>
                <IconSki />
                <span>
                  <strong>Скі-паси</strong>за бажанням
                </span>
              </div>
            </div>
            {tour.description && <p className="lead">{tour.description}</p>}
            <p className="muted small">Трансфер до курорту не входить — клієнт добирається самостійно.</p>
          </section>

          <section className="card">
            <h2>Ціни за особу</h2>
            <div className="price-tiles">
              <div>
                <span>Дорослий</span>
                <strong>{money(tour.adult_price)}</strong>
                <small>від 12 років</small>
              </div>
              <div>
                <span>Дитина</span>
                <strong>{money(tour.child_price)}</strong>
                <small>4–11 років</small>
              </div>
              <div className="free">
                <span>Малюк</span>
                <strong>0 грн</strong>
                <small>0–3 роки, без окремого місця</small>
              </div>
            </div>
          </section>

          {(tour.ski_passes.length > 0 || tour.activities.length > 0) && (
            <section className="card">
              <h2>Додаткові послуги</h2>
              <div className="extras-preview">
                {tour.ski_passes.length > 0 && (
                  <div>
                    <h3>
                      <IconSki size={18} /> Скі-паси {tour.resort_name}
                    </h3>
                    <ul>
                      {tour.ski_passes.map((s) => (
                        <li key={s.id}>
                          <span>
                            {s.category_display}, {s.duration_days} {plural(s.duration_days, 'день', 'дні', 'днів')}
                          </span>
                          <span>{money(s.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {tour.activities.length > 0 && (
                  <div>
                    <h3>
                      <IconSpa size={18} /> Активності
                    </h3>
                    <ul>
                      {tour.activities.map((a) => (
                        <li key={a.id}>
                          <span>{a.title}</span>
                          <span>{money(a.price_per_person)} / ос.</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="card">
            <h2>Умови скасування та зміни</h2>
            <ul className="rules">
              <li>
                <IconShield /> <span>Скасування не пізніше ніж за 7 днів до заїзду — повернення <strong>100 %</strong> суми; пізніше кошти не повертаються.</span>
              </li>
              <li>
                <IconCalendar /> <span>Зміна дати виїзду або складу групи — не пізніше ніж за 7 днів до заїзду, за наявності місць; різниця доплачується або повертається.</span>
              </li>
              <li>
                <IconClock /> <span>Після оформлення місця утримуються <strong>15 хвилин</strong> на час оплати.</span>
              </li>
            </ul>
          </section>
        </div>

        <aside className="booking-widget">
          <div className="widget-price">
            <span>від</span> <strong>{money(tour.adult_price)}</strong> <span>/ особа</span>
          </div>
          {tour.departures.length === 0 ? (
            <Alert kind="info">Найближчих виїздів немає.</Alert>
          ) : (
            <>
              <span className="field-label">Дата заїзду</span>
              <div className="dep-list">
                {tour.departures.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`dep ${String(d.id) === String(departureId) ? 'active' : ''} ${d.free_seats < seatsNeeded ? 'full' : ''}`}
                    onClick={() => setDepartureId(String(d.id))}
                  >
                    <span>
                      {date(d.start_date)} – {date(d.end_date)}
                    </span>
                    <small>{d.free_seats > 0 ? `вільно ${d.free_seats}` : 'немає місць'}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          <span className="field-label">Склад групи</span>
          <GroupFields value={group} onChange={setGroup} compact />
          {departure && !enough && <Alert>Недостатньо вільних місць. Оберіть іншу дату або змініть склад групи.</Alert>}
          <div className="widget-total">
            <span>Проживання для групи</span>
            <strong>{money(perGroup)}</strong>
          </div>
          <button className="btn btn-primary btn-wide btn-lg" disabled={!enough || group.adults < 1} onClick={next}>
            Обрати скі-паси й активності <IconArrowRight size={18} />
          </button>
          <p className="muted small center">Оплата на наступних кроках · <Link to="/my-booking">Моє бронювання</Link></p>
        </aside>
      </div>
    </>
  )
}
