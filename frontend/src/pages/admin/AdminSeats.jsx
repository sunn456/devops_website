// Відомість наявності місць по виїздах і скасування виїзду агенцією (FR-14, FR-16).
import { useEffect, useState } from 'react'
import { adminApi } from '../../api.js'
import { date, money } from '../../format.js'
import { Alert, Hint, Loading } from '../../components/ui.jsx'

export default function AdminSeats() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = () =>
    adminApi('/departures/availability/')
      .then(setRows)
      .catch((e) => setError(e.message))

  useEffect(() => {
    load()
  }, [])

  const cancelDeparture = async (row) => {
    const reason = window.prompt(
      `Скасувати виїзд «${row.tour}» ${date(row.start_date)}?\nУсі бронювання буде скасовано з повним поверненням коштів.\n\nПричина:`,
      'Виїзд скасовано агенцією',
    )
    if (reason === null) return
    setError('')
    try {
      const res = await adminApi(`/departures/${row.id}/cancel/`, { method: 'POST', body: { reason } })
      setNotice(
        `Виїзд скасовано. Скасовано бронювань: ${res.cancelled_bookings}, повернено ${money(res.refunded)}` +
          (res.failed_refunds ? `, невдалих повернень: ${res.failed_refunds} (див. «Платежі»).` : '.'),
      )
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <h1>Наявність місць</h1>
      <Hint>Враховуються дорослі та діти (малюки місця не займають). Зайняті = закріплені після оплати + утримані на час оплати.</Hint>
      <Alert>{error}</Alert>
      <Alert kind="success">{notice}</Alert>
      {!rows && !error && <Loading />}
      {rows && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Тур</th>
                <th>Заїзд</th>
                <th className="num">Усього</th>
                <th className="num">Зайнято</th>
                <th className="num">Вільно</th>
                <th>Заповненість</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.status === 'cancelled' ? 'dim' : ''}>
                  <td>{r.tour}</td>
                  <td>{date(r.start_date)}</td>
                  <td className="num">{r.total}</td>
                  <td className="num">{r.occupied}</td>
                  <td className="num">{r.status === 'cancelled' ? '—' : r.free}</td>
                  <td>
                    <div className="meter" aria-label={`${r.occupied} з ${r.total}`}>
                      <span style={{ width: `${Math.min(100, (r.occupied / r.total) * 100)}%` }} />
                    </div>
                  </td>
                  <td>
                    {r.status === 'cancelled' ? (
                      <span className="muted">скасовано</span>
                    ) : (
                      <button className="btn-link danger" onClick={() => cancelDeparture(r)}>
                        Скасувати виїзд
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
