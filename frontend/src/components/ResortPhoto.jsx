// Фото курорту: власне фото туру (image_url) → фото курорту з /public/images → ілюстрація.
import ResortArt from './ResortArt.jsx'

export const RESORT_PHOTOS = {
  Буковель: '/images/bukovel.jpg',
  Драгобрат: '/images/dragobrat.jpg',
  Яблуниця: '/images/yablunytsia.jpg',
  Банско: '/images/bansko.jpg',
}

// Зимові пейзажі курортів у високій роздільності (банери сторінок результатів і турів).
export const RESORT_BANNERS = {
  Буковель: '/images/banners/bukovel-1.jpg',
  Драгобрат: '/images/banners/dragobrat-1.jpg',
  Яблуниця: '/images/banners/yablunytsia-1.jpg',
  Банско: '/images/banners/bansko-1.jpg',
}

export default function ResortPhoto({ name, src, className = '', eager = false }) {
  const url = src || RESORT_PHOTOS[name]
  if (!url) return <ResortArt name={name} className={className} />
  return <img className={`resort-photo ${className}`} src={url} alt={name || ''} loading={eager ? 'eager' : 'lazy'} />
}
