import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import SearchPage from './pages/SearchPage.jsx'
import ResultsPage from './pages/ResultsPage.jsx'
import TourPage from './pages/TourPage.jsx'
import BookingPage from './pages/BookingPage.jsx'
import PaymentPage from './pages/PaymentPage.jsx'
import ConfirmationPage from './pages/ConfirmationPage.jsx'
import MyBookingPage from './pages/MyBookingPage.jsx'
import PhotoCreditsPage from './pages/PhotoCreditsPage.jsx'
import AdminLayout, { AdminLogin } from './pages/admin/AdminLayout.jsx'
import AdminBookings from './pages/admin/AdminBookings.jsx'
import AdminSeats from './pages/admin/AdminSeats.jsx'
import AdminPayments from './pages/admin/AdminPayments.jsx'
import AdminCatalog from './pages/admin/AdminCatalog.jsx'
import AdminReports from './pages/admin/AdminReports.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<SearchPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/tours/:id" element={<TourPage />} />
        <Route path="/book" element={<BookingPage />} />
        <Route path="/pay/:ref" element={<PaymentPage />} />
        <Route path="/booking/:publicId" element={<ConfirmationPage />} />
        <Route path="/my-booking" element={<MyBookingPage />} />
        <Route path="/photos" element={<PhotoCreditsPage />} />
        <Route path="*" element={<p>Сторінку не знайдено.</p>} />
      </Route>
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="bookings" replace />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="seats" element={<AdminSeats />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="catalog" element={<AdminCatalog />} />
        <Route path="reports" element={<AdminReports />} />
      </Route>
    </Routes>
  )
}
