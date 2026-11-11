// Адміністративна частина: вхід (кадр 10) і спільна оболонка з навігацією (FR-13).
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api, getToken, setToken } from '../../api.js'
import { IconBook, IconCard, IconChart, IconList, IconLogout, IconSeat, Logo } from '../../components/icons.jsx'
import { Alert, Field } from '../../components/ui.jsx'

export function AdminLogin() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await api('/auth/login/', { method: 'POST', body: form })
      setToken(res.token)
      navigate('/admin/bookings')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-art">
        <img className="resort-photo" src="/images/banners/dragobrat-1.jpg" alt="" />
        <div className="login-art-text">
          <Logo size={44} />
          <h2>Панель адміністратора Winterra</h2>
          <p>Довідники, бронювання, місця, платежі та звіти — в одному місці.</p>
        </div>
      </div>
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <Link to="/" className="muted small">
            ← На сайт
          </Link>
          <h1>Вхід адміністратора</h1>
          <p className="muted">Доступ лише для адміністратора бронювань.</p>
          <Field label="Логін">
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required autoComplete="username" />
          </Field>
          <Field label="Пароль">
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              autoComplete="current-password"
            />
          </Field>
          <Alert>{error}</Alert>
          <button className="btn btn-primary btn-wide btn-lg" disabled={busy}>
            Увійти
          </button>
        </form>
      </div>
    </div>
  )
}

const NAV = [
  ['/admin/bookings', 'Бронювання', <IconBook size={19} />],
  ['/admin/seats', 'Місця', <IconSeat size={19} />],
  ['/admin/payments', 'Платежі', <IconCard size={19} />],
  ['/admin/catalog', 'Довідники', <IconList size={19} />],
  ['/admin/reports', 'Звіти', <IconChart size={19} />],
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (!getToken()) {
      navigate('/admin/login', { replace: true })
      return
    }
    api('/auth/me/', { auth: true })
      .then(setUser)
      .catch(() => navigate('/admin/login', { replace: true }))
    const onLogout = () => navigate('/admin/login', { replace: true })
    window.addEventListener('winterra:logout', onLogout)
    return () => window.removeEventListener('winterra:logout', onLogout)
  }, [navigate])

  const logout = async () => {
    try {
      await api('/auth/logout/', { method: 'POST', auth: true })
    } catch {
      /* токен міг уже стати недійсним */
    }
    setToken(null)
    navigate('/admin/login')
  }

  if (!user) return null

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Link to="/admin/bookings" className="brand light">
          <Logo size={30} />
          <span>
            Winterra
            <small>адміністратор</small>
          </span>
        </Link>
        <nav>
          {NAV.map(([to, label, icon]) => (
            <NavLink key={to} to={to}>
              {icon} <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span>
          <span className="who">
            {user.username}
            <small>адміністратор бронювань</small>
          </span>
          <button className="icon-btn light" onClick={logout} aria-label="Вийти" title="Вийти">
            <IconLogout size={19} />
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
