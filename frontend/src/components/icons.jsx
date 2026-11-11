// Набір іконок інтерфейсу (inline SVG, колір успадковується від тексту).
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

const make = (paths) =>
  function Icon({ size = 20, ...rest }) {
    return (
      <svg {...base} width={size} height={size} {...rest}>
        {paths}
      </svg>
    )
  }

export const IconMountain = make(
  <>
    <path d="m3 20 6-11 4 7 2-3 6 7H3Z" />
    <path d="m7.5 11.8 1.5.9 1.6-1" />
  </>,
)
export const IconCalendar = make(
  <>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </>,
)
export const IconUsers = make(
  <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
    <path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.4a5.6 5.6 0 0 1 3.2 5.6" />
  </>,
)
export const IconBed = make(
  <>
    <path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" />
    <circle cx="7" cy="10.5" r="1.8" />
  </>,
)
export const IconCoffee = make(
  <>
    <path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" />
    <path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3" />
  </>,
)
export const IconSki = make(
  <>
    <circle cx="16" cy="4.5" r="1.8" />
    <path d="m3 15 18 6M7 9l4 2 1.5 4.5M11 11l3-3 2.5 3.5L20 13" />
  </>,
)
export const IconShield = make(
  <>
    <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6L12 3Z" />
    <path d="m9 12 2 2 4-4" />
  </>,
)
export const IconClock = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
)
export const IconCheck = make(<path d="m5 12.5 4.5 4.5L19 7.5" />)
export const IconArrowRight = make(<path d="M5 12h14M13 6l6 6-6 6" />)
export const IconArrowLeft = make(<path d="M19 12H5M11 6l-6 6 6 6" />)
export const IconCard = make(
  <>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M2.5 10h19M6.5 15h3" />
  </>,
)
export const IconSearch = make(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </>,
)
export const IconChart = make(
  <>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </>,
)
export const IconList = make(
  <>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="18" r="1" />
  </>,
)
export const IconSeat = make(
  <>
    <path d="M6 4v9a2 2 0 0 0 2 2h8a2 2 0 0 1 2 2v3" />
    <path d="M6 20v-3M10 15v5M18 11h-6" />
  </>,
)
export const IconBook = make(
  <>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
    <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
  </>,
)
export const IconLogout = make(
  <>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />
  </>,
)
export const IconTicket = make(
  <>
    <path d="M3 8a2 2 0 0 0 0 4v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0 0-4V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2Z" transform="translate(0 1)" />
    <path d="M14 5v14" strokeDasharray="2 2.5" />
  </>,
)
export const IconSpa = make(
  <>
    <path d="M12 20c-4.5 0-8-3-8-7 3 0 6 1.5 8 4 2-2.5 5-4 8-4 0 4-3.5 7-8 7Z" />
    <path d="M12 17c-1.5-2-2-4.5-1-8 .5-1.8 1.3-3 1-5 1.5 1.5 3 3.5 2.5 7-.3 2.3-1.2 4-2.5 6Z" />
  </>,
)
export const IconSnow = make(
  <>
    <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" />
    <path d="m9.5 3.5 2.5 2 2.5-2M9.5 20.5l2.5-2 2.5 2M4 10.4l3.1-.5L6 7M20 13.6l-3.1.5L18 17M4 13.6l3.1.5L6 17M20 10.4l-3.1-.5L18 7" />
  </>,
)
export const IconPhone = make(
  <path d="M5 4h3.5l1.5 4.5-2.2 1.3a11 11 0 0 0 6.4 6.4L15.5 14l4.5 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
)
export const IconMail = make(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
  </>,
)
export const IconPlus = make(<path d="M12 5v14M5 12h14" />)
export const IconTrash = make(<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />)

/** Логотип Winterra: гірська вершина зі сніжною шапкою. */
export function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5cc6ff" />
          <stop offset="1" stopColor="#1d5fd1" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#logo-g)" />
      <path d="M6 30 16 13l5 8 3-4 10 13H6Z" fill="#fff" opacity=".95" />
      <path d="m13 18 3-5 3 4.8-1.6-.8-1.4 1.4-1.4-1.3L13 18Z" fill="#cfe6ff" />
    </svg>
  )
}
