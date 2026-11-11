// Галерея фото готелю: велике фото + 4 мініатюри, кнопка «Усі фото», перегляд на весь екран зі стрічкою мініатюр.
import { useCallback, useEffect, useRef, useState } from 'react'
import { plural } from '../format.js'

export default function Gallery({ photos, title, skipCover = false }) {
  const [open, setOpen] = useState(null) // індекс відкритого фото
  const stripRef = useRef(null)

  const close = useCallback(() => setOpen(null), [])
  const step = useCallback((d) => setOpen((i) => (i + d + photos.length) % photos.length), [photos.length])

  useEffect(() => {
    if (open === null) return
    const onKey = (e) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, close, step])

  useEffect(() => {
    if (open === null || !stripRef.current) return
    stripRef.current.children[open]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [open])

  if (!photos?.length) return null
  // обкладинка вже показана на банері — плитки починаються з наступного фото (у перегляді доступні всі)
  const offset = skipCover && photos.length > 5 ? 1 : 0
  const shown = photos.slice(offset, offset + 5)
  const n = photos.length

  return (
    <>
      <div className={`gallery g-${shown.length}`}>
        {shown.map((p, i) => (
          <button key={p.id ?? i} type="button" className="gallery-item" onClick={() => setOpen(i + offset)} aria-label={`Відкрити фото: ${p.caption || title}`}>
            <img src={p.image_url} alt={p.caption || title} loading="lazy" />
            {p.caption && !(i === shown.length - 1 && n > 1) && <span className="gallery-caption">{p.caption}</span>}
          </button>
        ))}
        {n > 1 && (
          <button type="button" className="gallery-all" onClick={() => setOpen(0)}>
            ▦ Усі {n} {plural(n, 'фото', 'фото', 'фото')}
          </button>
        )}
      </div>
      {open !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={title} onClick={close}>
          <div className="lb-top" onClick={(e) => e.stopPropagation()}>
            <strong>{title}</strong>
            <span>
              {open + 1} / {n}
              {photos[open].caption && ` · ${photos[open].caption}`}
            </span>
          </div>
          <figure onClick={(e) => e.stopPropagation()}>
            <img key={open} src={photos[open].image_url} alt={photos[open].caption || title} />
          </figure>
          <div className="lb-strip" ref={stripRef} onClick={(e) => e.stopPropagation()}>
            {photos.map((p, i) => (
              <button key={p.id ?? i} type="button" className={i === open ? 'active' : ''} onClick={() => setOpen(i)} aria-label={`Фото ${i + 1}`}>
                <img src={p.image_url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
          <button type="button" className="lb-btn lb-prev" onClick={(e) => (e.stopPropagation(), step(-1))} aria-label="Попереднє фото">
            ‹
          </button>
          <button type="button" className="lb-btn lb-next" onClick={(e) => (e.stopPropagation(), step(1))} aria-label="Наступне фото">
            ›
          </button>
          <button type="button" className="lb-close" onClick={close} aria-label="Закрити">
            ×
          </button>
        </div>
      )}
    </>
  )
}
