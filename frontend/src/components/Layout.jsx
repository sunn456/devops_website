import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { IconMail, IconMountain, IconPhone, IconTicket, Logo } from './icons.jsx'

export default function Layout() {
  const { pathname } = useLocation()
  const home = pathname === '/'
  const heroPage = home || pathname === '/results' || pathname === '/my-booking'  // сторінки з повноширинним фото під шапкою
  return (
    <div className="app">
      <header className={`topbar ${heroPage ? 'over-hero' : ''}`}>
        <div className="container topbar-inner">
          <Link to="/" className="brand">
            <Logo />
            <span>
              Winterra
              <small>гірськолижні тури</small>
            </span>
          </Link>
          <nav className="topnav">
            <NavLink to="/" end className="nav-wide">
              <IconMountain size={18} /> Тури
            </NavLink>
            <Link to="/#resorts" className="nav-wide">
              Курорти
            </Link>
            <Link to="/#hotels" className="nav-wide">
              Готелі
            </Link>
            <Link to="/#how" className="nav-wide">
              Як це працює
            </Link>
            <a href="tel:+380440000000" className="nav-phone">
              <IconPhone size={17} /> +380 44 000 00 00
            </a>
            <NavLink to="/my-booking" className="nav-cta">
              <IconTicket size={18} /> Моє бронювання
            </NavLink>
          </nav>
        </div>
      </header>
      <main className={heroPage ? 'main home' : 'main container'}>
        <Outlet />
      </main>
      <footer className="footer">
        <svg className="footer-ridge" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 120 L0 70 L90 32 L160 58 L270 6 L390 66 L470 36 L600 84 L710 22 L850 92 L940 58 L1060 100 L1170 42 L1290 88 L1440 58 L1440 120 Z" fill="currentColor" opacity=".35" />
          <path d="M0 120 L0 92 L120 62 L210 84 L350 40 L460 80 L590 54 L740 96 L860 60 L1000 90 L1100 72 L1250 106 L1340 92 L1440 80 L1440 120 Z" fill="currentColor" />
        </svg>
        <div className="container footer-grid">
          <div>
            <Link to="/" className="brand light">
              <Logo size={28} />
              <span>Winterra</span>
            </Link>
            <p>Гірськолижні тури з проживанням у перевірених готелях: Буковель, Драгобрат, Яблуниця, Банско.</p>
          </div>
          <div>
            <h4>Клієнтам</h4>
            <Link to="/">Пошук туру</Link>
            <Link to="/my-booking">Моє бронювання</Link>
          </div>
          <div>
            <h4>Умови</h4>
            <span>Повернення 100 % — до 7 днів до заїзду</span>
            <span>Зміна дати чи складу групи</span>
            <span>Оплата карткою (тестовий режим)</span>
          </div>
          <div>
            <h4>Контакти</h4>
            <span>
              <IconPhone size={16} /> +380 44 000 00 00
            </span>
            <span>
              <IconMail size={16} /> hello@winterra.test
            </span>
            <Link to="/admin" className="footer-admin">
              Вхід для адміністратора
            </Link>
          </div>
        </div>
        <div className="container footer-bottom">
          © {new Date().getFullYear()} Winterra. Умовне підприємство, створене для дипломної роботи. ·{' '}
          <Link to="/photos">Фото: автори та ліцензії</Link>
        </div>
      </footer>
    </div>
  )
}
