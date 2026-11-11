// Вибір скі-пасів курорту та додаткових активностей (FR-03, FR-04).
import { addDays, money } from '../format.js'
import { IconMountain, IconPlus, IconSki, IconSnow, IconSpa, IconTrash } from './icons.jsx'
import DatePicker from './DatePicker.jsx'
import { Field, Hint } from './ui.jsx'

export function emptyExtras() {
  return { ski_passes: [], activities: [] }
}

export default function Extras({ tour, departure, group, value, onChange }) {
  const skiPasses = tour.ski_passes || []
  const activities = tour.activities || []
  const lastDay = departure.end_date
  const stayDays = Math.round((new Date(departure.end_date) - new Date(departure.start_date)) / 86400000) + 1

  const updatePass = (i, patch) =>
    onChange({ ...value, ski_passes: value.ski_passes.map((p, j) => (j === i ? { ...p, ...patch } : p)) })
  const removePass = (i) => onChange({ ...value, ski_passes: value.ski_passes.filter((_, j) => j !== i) })
  const addPass = (sp = skiPasses[0]) => {
    if (!sp) return
    const qty = sp.category === 'child' ? Math.max(1, group.children) : Math.max(1, group.adults)
    onChange({
      ...value,
      ski_passes: [...value.ski_passes, { ski_pass_id: sp.id, start_date: departure.start_date, quantity: qty }],
    })
  }

  const activityOf = (id) => value.activities.find((a) => a.activity_id === id)
  const toggleActivity = (id, checked) => {
    const rest = value.activities.filter((a) => a.activity_id !== id)
    const persons = Math.max(1, group.adults + group.children)
    onChange({ ...value, activities: checked ? [...rest, { activity_id: id, persons }] : rest })
  }
  const setPersons = (id, persons) =>
    onChange({
      ...value,
      activities: value.activities.map((a) => (a.activity_id === id ? { ...a, persons: Math.max(1, persons) } : a)),
    })

  return (
    <div className="extras">
      <section>
        <h3 className="extras-title">
          <span className="title-icon"><IconSki size={18} /></span> Скі-паси курорту
        </h3>
        <Hint>
          Необов’язково. Період дії скі-паса має бути в межах перебування (до {lastDay.split('-').reverse().join('.')}{' '}
          включно). Для малюків скі-пас не оформлюється; скі-пасів може бути менше, ніж учасників.
        </Hint>
        {value.ski_passes.map((item, i) => {
          const sp = skiPasses.find((s) => s.id === item.ski_pass_id)
          const maxStart = sp ? addDays(lastDay, -(sp.duration_days - 1)) : lastDay
          return (
            <div className="pass-row" key={i}>
              <Field label="Категорія і тривалість">
                <select value={item.ski_pass_id} onChange={(e) => updatePass(i, { ski_pass_id: Number(e.target.value) })}>
                  {skiPasses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.category_display}, {s.duration_days} дн. — {money(s.price)}
                    </option>
                  ))}
                </select>
              </Field>
              <DatePicker
                label="Дата початку дії"
                compact
                value={item.start_date}
                min={departure.start_date}
                max={maxStart}
                onChange={(d) => updatePass(i, { start_date: d })}
              />
              <Field label="Кількість">
                <input
                  type="number"
                  min="1"
                  max={group.adults + group.children}
                  value={item.quantity}
                  onChange={(e) => updatePass(i, { quantity: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                />
              </Field>
              <button type="button" className="icon-btn danger" onClick={() => removePass(i)} aria-label="Прибрати скі-пас">
                <IconTrash size={18} />
              </button>
            </div>
          )
        })}
        {skiPasses.length > 0 ? (
          <div className="pass-options">
            {skiPasses
              // лише ті, що вкладаються в перебування (днів = ночей + 1) і категорії, яким є кому видати
              .filter((s) => s.duration_days <= stayDays && (s.category !== 'child' || group.children > 0))
              .map((s) => (
                <button type="button" key={s.id} className={`pass-option ${s.category}`} onClick={() => addPass(s)}>
                  <span className="pass-days">
                    <strong>{s.duration_days}</strong>
                    {s.duration_days === 1 ? 'день' : s.duration_days < 5 ? 'дні' : 'днів'}
                  </span>
                  <span className="pass-info">
                    <span>{s.category_display}</span>
                    <strong>{money(s.price)}</strong>
                    <small>{money(Number(s.price) / s.duration_days)} / день</small>
                  </span>
                  <span className="pass-add">
                    <IconPlus size={18} />
                  </span>
                </button>
              ))}
          </div>
        ) : (
          <p className="muted">Для цього курорту скі-паси не продаються.</p>
        )}
      </section>

      <section>
        <h3 className="extras-title">
          <span className="title-icon"><IconSpa size={18} /></span> Додаткові активності
        </h3>
        <Hint>Для тих, хто не катається. Ціна вказана за одну особу.</Hint>
        {activities.length === 0 && <p className="muted">Активностей немає.</p>}
        <div className="activity-grid">
          {activities.map((a, i) => {
            const chosen = activityOf(a.id)
            const look = activityLook(a.title, i)
            return (
              <div className={`activity-tile ${look.tone} ${chosen ? 'chosen' : ''}`} key={a.id}>
                <label className="activity-main">
                  <input type="checkbox" checked={!!chosen} onChange={(e) => toggleActivity(a.id, e.target.checked)} />
                  <span className="activity-icon">{look.icon}</span>
                  <span className="activity-text">
                    <strong>{a.title}</strong>
                    <small>{a.description || look.text}</small>
                  </span>
                  <span className="activity-price">
                    {money(a.price_per_person)}
                    <small>/ особа</small>
                  </span>
                </label>
                {chosen && (
                  <label className="persons">
                    Скільки осіб
                    <input
                      type="number"
                      min="1"
                      max={group.adults + group.children + group.infants}
                      value={chosen.persons}
                      onChange={(e) => setPersons(a.id, parseInt(e.target.value || '1', 10))}
                    />
                  </label>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

// Іконка, колір і короткий опис плитки активності.
function activityLook(title, i) {
  const t = title.toLowerCase()
  if (t.includes('spa') || t.includes('басейн')) return { icon: <IconSpa />, tone: 'rose', text: 'Басейн, сауни та зона відпочинку після катання.' }
  if (t.includes('тюбінг')) return { icon: <IconSnow />, tone: 'ice', text: 'Спуск на надувних «ватрушках» — весело для дітей і дорослих.' }
  if (t.includes('екскурс')) return { icon: <IconMountain />, tone: 'peach', text: 'Прогулянка з гідом найцікавішими місцями поруч із курортом.' }
  return { icon: <IconSpa />, tone: ['rose', 'ice', 'peach'][i % 3], text: 'Додаткова розвага для тих, хто не катається.' }
}
