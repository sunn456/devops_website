// Кадр 12 (звіти): бронювання за період, дохід, популярні тури й курорти (FR-17).
import { useState } from 'react'
import { adminApi } from '../../api.js'
import { isoToday, money } from '../../format.js'
import DatePicker from '../../components/DatePicker.jsx'
import { Alert, Field } from '../../components/ui.jsx'

const TYPES = {
  bookings: 'Бронювання за період',
  revenue: 'Дохід',
  tours: 'Популярні тури',
  resorts: 'Популярні курорти',
}

export default function AdminReports() {
  const [params, setParams] = useState({ type: 'bookings', date_from: isoToday(-30), date_to: isoToday() })
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  const run = async (e) => {
    e.preventDefault()
    setError('')
    try {
      setReport(await adminApi('/reports/', { params }))
    } catch (err) {
      setReport(null)
      setError(err.message)
    }
  }

  return (
    <>
      <h1>Звіти</h1>
      <form className="filters" onSubmit={run}>
        <Field label="Вид звіту">
          <select value={params.type} onChange={(e) => setParams({ ...params, type: e.target.value })}>
            {Object.entries(TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <DatePicker label="Від" compact value={params.date_from} max={params.date_to} onChange={(d) => setParams({ ...params, date_from: d })} />
        <DatePicker label="До" compact value={params.date_to} min={params.date_from} onChange={(d) => setParams({ ...params, date_to: d })} />
        <button className="btn btn-primary">Сформувати звіт</button>
      </form>
      <Alert>{error}</Alert>
      {report && (
        <div className="card">
          <h2>{TYPES[report.type]}</h2>
          <ReportBody type={report.type} data={report.data} />
        </div>
      )}
    </>
  )
}

function Bars({ rows, value, label }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(Number(value(r)))))
  return (
    <div className="bars">
      {rows.map((r, i) => (
        <div className="bar-row" key={i}>
          <span className="bar-label">{label(r)}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(Math.abs(Number(value(r))) / max) * 100}%` }} />
          </span>
        </div>
      ))}
    </div>
  )
}

function ReportBody({ type, data }) {
  if (type === 'bookings') {
    return (
      <>
        <div className="stats">
          <div className="stat">
            <span>Усього бронювань</span>
            <strong>{data.total}</strong>
          </div>
          <div className="stat">
            <span>Учасників (оплачені й підтверджені)</span>
            <strong>{data.participants}</strong>
          </div>
        </div>
        <table className="simple">
          <tbody>
            {Object.entries(data.by_status).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className="num">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    )
  }
  if (type === 'revenue') {
    return (
      <>
        <div className="stats">
          <div className="stat">
            <span>Отримано</span>
            <strong>{money(data.received)}</strong>
          </div>
          <div className="stat">
            <span>Повернено</span>
            <strong>{money(data.refunded)}</strong>
          </div>
          <div className="stat">
            <span>Чистий дохід</span>
            <strong>{money(data.net)}</strong>
          </div>
        </div>
        {data.by_month.length > 0 && (
          <table className="simple">
            <thead>
              <tr>
                <th>Місяць</th>
                <th className="num">Чистий дохід</th>
              </tr>
            </thead>
            <tbody>
              {data.by_month.map((m) => (
                <tr key={m.month}>
                  <td>{m.month}</td>
                  <td className="num">{money(m.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    )
  }
  const rows = data
  if (rows.length === 0) return <p className="muted">За період немає оплачених бронювань.</p>
  const name = (r) => (type === 'tours' ? `${r.tour} (${r.resort})` : r.resort)
  return (
    <>
      <Bars rows={rows} value={(r) => r.bookings} label={name} />
      <table className="simple">
        <thead>
          <tr>
            <th>{type === 'tours' ? 'Тур' : 'Курорт'}</th>
            <th className="num">Бронювань</th>
            <th className="num">Учасників</th>
            <th className="num">Сума</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{name(r)}</td>
              <td className="num">{r.bookings}</td>
              <td className="num">{r.participants}</td>
              <td className="num">{money(r.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
