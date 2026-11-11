// Ілюстрація курорту: гірський пейзаж із власною палітрою для кожного курорту.
import { useId } from 'react'

const PALETTES = {
  Буковель: { sky: ['#1b3a8a', '#5d8fe6', '#f6c9a7'], far: '#7d9bd6', mid: '#3c5ba8', near: '#1f2f63', sun: '#ffe3b3' },
  Драгобрат: { sky: ['#0b1d3f', '#2d4f8f', '#9db8e8'], far: '#5e7fbf', mid: '#2c4580', near: '#14214a', sun: '#f4f7ff' },
  Яблуниця: { sky: ['#1f5c6b', '#56a3a6', '#e9e2c7'], far: '#7fb5b0', mid: '#3b7c7f', near: '#1d4a4f', sun: '#fff1c9' },
  Банско: { sky: ['#4a2a6b', '#b0619a', '#ffc48f'], far: '#b07fb5', mid: '#6d3f7f', near: '#3a2150', sun: '#ffe1a6' },
}
const DEFAULT = { sky: ['#123c74', '#3f7fd1', '#cfe4ff'], far: '#7aa3d9', mid: '#36609f', near: '#17325f', sun: '#fff5d6' }

// Псевдовипадкові, але стабільні для назви курорту варіації форми гір.
function seedFrom(text) {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 9973
  return h
}

export default function ResortArt({ name = '', className = '', showSun = true }) {
  const id = useId().replace(/:/g, '')
  const p = PALETTES[name] || DEFAULT
  const s = seedFrom(name)
  const peakX = 150 + (s % 90)
  const sunX = 60 + ((s * 7) % 260)

  return (
    <svg className={`resort-art ${className}`} viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" role="img" aria-label={name}>
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset=".6" stopColor={p.sky[1]} />
          <stop offset="1" stopColor={p.sky[2]} />
        </linearGradient>
        <linearGradient id={`snow${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe9f7" />
        </linearGradient>
      </defs>
      <rect width="400" height="220" fill={`url(#sky${id})`} />
      {showSun && <circle cx={sunX} cy="62" r="22" fill={p.sun} opacity=".85" />}
      {/* дальній хребет */}
      <path
        d={`M0 150 L60 ${95 + (s % 20)} L110 130 L${peakX - 40} 80 L${peakX + 30} 120 L290 ${85 + (s % 25)} L350 125 L400 100 L400 220 L0 220Z`}
        fill={p.far}
        opacity=".75"
      />
      {/* головна вершина зі сніжною шапкою */}
      <path d={`M40 220 L${peakX} 52 L${peakX + 150} 220Z`} fill={p.mid} />
      <path
        d={`M${peakX - 30} 95 L${peakX} 52 L${peakX + 33} 98 L${peakX + 18} 92 L${peakX + 6} 104 L${peakX - 8} 92 L${peakX - 18} 101Z`}
        fill={`url(#snow${id})`}
      />
      {/* ближній пагорб зі снігом */}
      <path d="M0 185 Q100 150 200 178 T400 170 L400 220 L0 220Z" fill={p.near} />
      <path d="M0 205 Q120 182 230 200 T400 196 L400 220 L0 220Z" fill="#f3f7fc" />
      {/* ялинки */}
      {[30, 52, 300, 322, 346].map((x, i) => (
        <g key={x} transform={`translate(${x} ${178 - (i % 2) * 6})`}>
          <path d="M0 -26 L9 -6 L4 -6 L11 6 L-11 6 L-4 -6 L-9 -6Z" fill={p.near} />
          <rect x="-1.5" y="6" width="3" height="5" fill={p.near} />
        </g>
      ))}
      {/* сніжинки */}
      {Array.from({ length: 14 }, (_, i) => (
        <circle key={i} cx={(i * 53 + s) % 400} cy={(i * 37 + s) % 150} r={i % 3 === 0 ? 1.6 : 1} fill="#fff" opacity=".7" />
      ))}
    </svg>
  )
}
