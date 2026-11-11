// Контроль платежів і повернень коштів (FR-16).
import { useEffect, useState } from 'react'
import { adminApi } from '../../api.js'
import { PAYMENT_STATUS, REFUND_REASON, REFUND_STATUS, dateTime, money } from '../../format.js'
import { Alert, Hint, Loading } from '../../components/ui.jsx'

export default function AdminPayments() {
  const [payments, setPayments] = useState(null)
  const [refunds, setRefunds] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = () => {
    adminApi('/payments/').then(setPayments).catch((e) => setError(e.message))
    adminApi('/refunds/').then(setRefunds).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  const retry = async (id) => {
    setError('')
    try {
      const r = await adminApi(`/refunds/${id}/retry/`, { method: 'POST' })
      setNotice(r.status === 'succeeded' ? 'Повернення виконано.' : `Повернення знову не вдалося: ${r.error_message}`)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const failed = refunds?.filter((r) => r.status === 'failed') || []

  return (
    <>
      <h1>Платежі та повернення</h1>
      <Alert>{error}</Alert>
      <Alert kind="success">{notice}</Alert>
      {failed.length > 0 && <Alert kind="warning">Невдалих повернень: {failed.length}. Повторіть їх нижче.</Alert>}

      <h2>Повернення коштів</h2>
      {!refunds ? (
        <Loading />
      ) : refunds.length === 0 ? (
        <p className="muted">Повернень ще не було.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Бронювання</th>
                <th>Причина</th>
                <th>Статус</th>
                <th className="num">Сума</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {refunds.map((r) => (
                <tr key={r.id}>
                  <td>{dateTime(r.processed_at || r.created_at)}</td>
                  <td>{r.booking_code || `#${r.booking}`}</td>
                  <td>{REFUND_REASON[r.reason]}</td>
                  <td className={r.status === 'failed' ? 'bad' : ''}>
                    {REFUND_STATUS[r.status]}
                    {r.error_message && <small className="muted"> · {r.error_message}</small>}
                  </td>
                  <td className="num">{money(r.amount)}</td>
                  <td>
                    {r.status === 'failed' && (
                      <button className="btn-link" onClick={() => retry(r.id)}>
                        Повторити
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Платежі</h2>
      <Hint>Дані банківських карток система не зберігає — лише суму, статус і ідентифікатор у платіжному сервісі.</Hint>
      {!payments ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Бронювання</th>
                <th>Вид</th>
                <th>Статус</th>
                <th className="num">Сума</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{dateTime(p.paid_at || p.created_at)}</td>
                  <td>{p.booking_code || `#${p.booking}`}</td>
                  <td>{p.kind === 'surcharge' ? 'Доплата за зміну' : 'Оплата'}</td>
                  <td>{PAYMENT_STATUS[p.status]}</td>
                  <td className="num">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
