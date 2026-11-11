// Кадр 12 (довідники): курорти, тури, виїзди, скі-паси, активності та ціни (FR-14).
import { useEffect, useMemo, useState } from 'react'
import { adminApi } from '../../api.js'
import { date, money } from '../../format.js'
import DatePicker from '../../components/DatePicker.jsx'
import { Alert, Field, Hint, Loading } from '../../components/ui.jsx'

const yesNo = (v) => (v ? 'так' : 'ні')

// Опис кожного довідника: шлях API, колонки таблиці й поля форми.
const ENTITIES = {
  resorts: {
    title: 'Курорти',
    empty: { name: '', country: 'Україна', description: '', is_active: true },
    columns: [
      ['Назва', (r) => r.name],
      ['Країна', (r) => r.country],
      ['Активний', (r) => yesNo(r.is_active)],
    ],
    fields: [
      { key: 'name', label: 'Назва' },
      { key: 'country', label: 'Країна' },
      { key: 'description', label: 'Опис', type: 'textarea' },
      { key: 'is_active', label: 'Доступний для бронювання', type: 'checkbox' },
    ],
  },
  tours: {
    title: 'Тури',
    empty: { resort: '', title: '', hotel_name: '', stars: 4, nights: 6, description: '', adult_price: '', child_price: '', image_url: '', is_active: true },
    columns: [
      ['Тур', (t) => t.title],
      ['Курорт', (t) => t.resort_name],
      ['Ночей', (t) => t.nights],
      ['Дорослий', (t) => money(t.adult_price)],
      ['Дитина', (t) => money(t.child_price)],
      ['Активний', (t) => yesNo(t.is_active)],
    ],
    fields: [
      { key: 'resort', label: 'Курорт', type: 'ref', ref: 'resorts' },
      { key: 'title', label: 'Назва туру' },
      { key: 'hotel_name', label: 'Готель' },
      { key: 'stars', label: 'Зірковість (1–5)', type: 'number' },
      { key: 'nights', label: 'Кількість ночей', type: 'number' },
      { key: 'adult_price', label: 'Ціна дорослого, грн', type: 'money' },
      { key: 'child_price', label: 'Ціна дитини (4–11), грн', type: 'money' },
      { key: 'image_url', label: 'Фото туру', hint: 'Посилання https://… або шлях /images/назва.jpg (необов’язково)' },
      { key: 'banner_url', label: 'Банер сторінки туру', hint: 'Зимовий пейзаж, напр. /images/banners/bukovel-1.jpg (необов’язково)', optionalText: true },
      { key: 'description', label: 'Опис', type: 'textarea' },
      { key: 'is_active', label: 'Доступний для бронювання', type: 'checkbox' },
    ],
  },
  departures: {
    title: 'Виїзди',
    empty: { tour: '', start_date: '', end_date: '', total_seats: 12 },
    columns: [
      ['Тур', (d) => d.tour_title],
      ['Заїзд', (d) => date(d.start_date)],
      ['Виїзд', (d) => date(d.end_date)],
      ['Місць', (d) => d.total_seats],
      ['Вільно', (d) => d.free_seats],
      ['Статус', (d) => (d.status === 'active' ? 'активний' : 'скасований')],
    ],
    fields: [
      { key: 'tour', label: 'Тур', type: 'ref', ref: 'tours' },
      { key: 'start_date', label: 'Дата заїзду', type: 'date' },
      { key: 'end_date', label: 'Дата виїзду', type: 'date', hint: 'Різниця дат має дорівнювати кількості ночей туру' },
      { key: 'total_seats', label: 'Кількість місць', type: 'number' },
    ],
    hint: 'Скасувати виїзд з поверненням коштів усім клієнтам можна на вкладці «Місця».',
  },
  'tour-photos': {
    title: 'Фото турів',
    empty: { tour: '', image_url: '', caption: '', position: 0 },
    columns: [
      ['Фото', (p) => <img className="thumb" src={p.image_url} alt="" />],
      ['Готель', (p) => p.tour_title],
      ['Підпис', (p) => p.caption || '—'],
      ['Порядок', (p) => p.position],
    ],
    fields: [
      { key: 'tour', label: 'Тур', type: 'ref', ref: 'tours' },
      { key: 'image_url', label: 'Фото', hint: 'Посилання https://… або шлях /images/hotels/назва.jpg' },
      { key: 'caption', label: 'Підпис', optionalText: true },
      { key: 'position', label: 'Порядок у галереї', type: 'number' },
    ],
    hint: 'Перше фото галереї показується першим на сторінці туру. Фото туру в картках задається полем «Фото туру» у вкладці «Тури».',
  },
  'ski-passes': {
    title: 'Скі-паси',
    empty: { resort: '', category: 'adult', duration_days: 1, price: '', is_active: true },
    columns: [
      ['Курорт', (s, refs) => refs.resorts?.[s.resort]],
      ['Категорія', (s) => s.category_display],
      ['Днів', (s) => s.duration_days],
      ['Ціна', (s) => money(s.price)],
      ['Активний', (s) => yesNo(s.is_active)],
    ],
    fields: [
      { key: 'resort', label: 'Курорт', type: 'ref', ref: 'resorts' },
      { key: 'category', label: 'Категорія', type: 'select', options: [['adult', 'Дорослий'], ['child', 'Дитячий']] },
      { key: 'duration_days', label: 'Тривалість, днів', type: 'number' },
      { key: 'price', label: 'Ціна, грн', type: 'money' },
      { key: 'is_active', label: 'Продається', type: 'checkbox' },
    ],
  },
  activities: {
    title: 'Активності',
    empty: { resort: null, title: '', description: '', price_per_person: '', is_active: true },
    columns: [
      ['Назва', (a) => a.title],
      ['Курорт', (a, refs) => (a.resort ? refs.resorts?.[a.resort] : 'усі курорти')],
      ['Ціна за особу', (a) => money(a.price_per_person)],
      ['Активна', (a) => yesNo(a.is_active)],
    ],
    fields: [
      { key: 'title', label: 'Назва' },
      { key: 'resort', label: 'Курорт', type: 'ref', ref: 'resorts', optional: 'Усі курорти' },
      { key: 'price_per_person', label: 'Ціна за особу, грн', type: 'money' },
      { key: 'description', label: 'Опис', type: 'textarea' },
      { key: 'is_active', label: 'Доступна', type: 'checkbox' },
    ],
  },
}

export default function AdminCatalog() {
  const [tab, setTab] = useState('resorts')
  return (
    <>
      <h1>Довідники</h1>
      <div className="subtabs">
        {Object.entries(ENTITIES).map(([key, e]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {e.title}
          </button>
        ))}
      </div>
      <CrudTable key={tab} path={tab} config={ENTITIES[tab]} />
    </>
  )
}

function CrudTable({ path, config }) {
  const [rows, setRows] = useState(null)
  const [refs, setRefs] = useState({})
  const [editing, setEditing] = useState(null) // об’єкт форми; id === undefined — новий запис
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = () =>
    adminApi(`/${path}/`)
      .then(setRows)
      .catch((e) => setError(e.message))

  useEffect(() => {
    load()
    const needed = [...new Set(['resorts', ...config.fields.filter((f) => f.type === 'ref').map((f) => f.ref)])]
    Promise.all(needed.map((r) => adminApi(`/${r}/`).then((list) => [r, list])))
      .then((pairs) => setRefs(Object.fromEntries(pairs)))
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  const refNames = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(refs).map(([k, list]) => [k, Object.fromEntries(list.map((x) => [x.id, x.name || x.title]))]),
      ),
    [refs],
  )

  const save = async (e) => {
    e.preventDefault()
    setError('')
    const { id, ...body } = editing
    try {
      if (id) await adminApi(`/${path}/${id}/`, { method: 'PUT', body })
      else await adminApi(`/${path}/`, { method: 'POST', body })
      setEditing(null)
      setNotice('Збережено.')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const remove = async (row) => {
    if (!window.confirm('Видалити запис? Якщо він уже використовується, система не дозволить видалення — тоді зробіть його неактивним.')) return
    setError('')
    try {
      await adminApi(`/${path}/${row.id}/`, { method: 'DELETE' })
      setNotice('Видалено.')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const startEdit = (row) => {
    const form = { id: row.id }
    config.fields.forEach((f) => (form[f.key] = row[f.key]))
    setEditing(form)
    setNotice('')
  }

  return (
    <>
      {config.hint && <Hint>{config.hint}</Hint>}
      <Alert>{error}</Alert>
      <Alert kind="success">{notice}</Alert>
      {!editing && (
        <button className="btn btn-primary" onClick={() => setEditing({ ...config.empty })}>
          + Додати
        </button>
      )}
      {editing && (
        <form className="card panel-admin" onSubmit={save}>
          <h2>{editing.id ? 'Редагування' : 'Новий запис'}</h2>
          <div className="grid-2">
            {config.fields.map((f) => (
              <FormField key={f.key} field={f} value={editing[f.key]} refs={refs} onChange={(v) => setEditing({ ...editing, [f.key]: v })} />
            ))}
          </div>
          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Скасувати
            </button>
            <button className="btn btn-primary">Зберегти</button>
          </div>
        </form>
      )}
      {!rows ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {config.columns.map(([title]) => (
                  <th key={title}>{title}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {config.columns.map(([title, render]) => (
                    <td key={title}>{render(row, refNames)}</td>
                  ))}
                  <td className="row-actions">
                    <button className="btn-link" onClick={() => startEdit(row)}>
                      Змінити
                    </button>
                    <button className="btn-link danger" onClick={() => remove(row)}>
                      Видалити
                    </button>
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

function FormField({ field, value, refs, onChange }) {
  const { label, type, hint } = field
  if (type === 'checkbox') {
    return (
      <label className="check field">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
    )
  }
  if (type === 'date') {
    return <DatePicker label={label} hint={hint} compact value={value || ''} onChange={onChange} />
  }
  let input
  if (type === 'textarea') input = <textarea rows="3" value={value || ''} onChange={(e) => onChange(e.target.value)} />
  else if (type === 'ref' || type === 'select') {
    const options =
      type === 'ref' ? (refs[field.ref] || []).map((x) => [x.id, x.name || x.title]) : field.options
    input = (
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : type === 'ref' ? Number(e.target.value) : e.target.value)}
        required={type === 'ref' && !field.optional}
      >
        <option value="">{field.optional || 'Оберіть…'}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    )
  } else {
    const htmlType = type === 'number' || type === 'money' ? 'number' : type === 'date' ? 'date' : 'text'
    input = (
      <input
        type={htmlType}
        step={type === 'money' ? '0.01' : undefined}
        min={type === 'number' || type === 'money' ? '0' : undefined}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        required={field.key !== 'image_url' && !field.optionalText}
      />
    )
  }
  return (
    <Field label={label} hint={hint}>
      {input}
    </Field>
  )
}
