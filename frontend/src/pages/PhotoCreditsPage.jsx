// Авторство фотографій (умова ліцензій Creative Commons BY / BY-SA).
import credits from '../photoCredits.json'

export default function PhotoCreditsPage() {
  return (
    <>
      <h1>Фото та ліцензії</h1>
      <p className="muted">
        Фото головної сторінки — автор Олександр Котенко. Фото готелів узято з їхніх галерей на сайті туроператора «Поїхали з нами» (права належать готелям). Пейзажі — з Wikimedia Commons за вільними ліцензіями. Зображення стиснуто для вебу.
      </p>
      <div className="credits">
        {credits.map((c) => (
          <figure className="credit" key={c.key}>
            <img src={`/images/${c.key}.jpg`} alt={c.caption} loading="lazy" />
            <figcaption>
              <strong>{c.caption}</strong>
              <span>Автор: {c.author || 'невідомий'}</span>
              <span>
                Ліцензія:{' '}
                {c.license_url ? (
                  <a href={c.license_url} target="_blank" rel="noreferrer">
                    {c.license}
                  </a>
                ) : (
                  c.license
                )}
              </span>
              {c.source && (
                <a href={c.source} target="_blank" rel="noreferrer">
                  {c.source_label || 'Сторінка файлу на Wikimedia Commons'}
                </a>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </>
  )
}
