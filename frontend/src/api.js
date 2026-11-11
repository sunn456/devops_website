// Модуль запитів до REST API серверної частини (спільний для сторінок клієнта й адміністратора).

const TOKEN_KEY = 'winterra_admin_token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* сховище недоступне — сеанс триватиме до перезавантаження */
  }
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.status = status
    this.data = data
  }
}

const FIELD_NAMES = {
  first_name: "Ім'я",
  last_name: 'Прізвище',
  phone: 'Телефон',
  email: 'Email',
  code: 'Код бронювання',
  adults: 'Дорослі',
  children: 'Діти',
  infants: 'Малюки',
  date: 'Дата заїзду',
  resort: 'Курорт',
  start_date: 'Дата',
  end_date: 'Дата виїзду',
  ski_passes: 'Скі-паси',
  activities: 'Активності',
  card_number: 'Номер картки',
  expiry: 'Термін дії',
  cvv: 'CVV',
  username: 'Логін',
  password: 'Пароль',
  date_from: 'Початок періоду',
  date_to: 'Кінець періоду',
}

function errorText(data) {
  if (data == null) return ''
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return data.map(errorText).filter(Boolean).join(' ')
  if (data.detail) return errorText(data.detail)
  return Object.entries(data)
    .map(([key, value]) => {
      const text = errorText(value)
      if (!text) return ''
      if (key === 'non_field_errors' || /^\d+$/.test(key)) return text
      return `${FIELD_NAMES[key] || key}: ${text}`
    })
    .filter(Boolean)
    .join(' ')
}

/**
 * Виконує запит до /api/<path>.
 * auth=true додає токен адміністратора (адміністративні запити).
 */
export async function api(path, { method = 'GET', body, params, auth = false } = {}) {
  let url = '/api' + path
  if (params) {
    const entries = Object.entries(params).filter(([, v]) => v !== '' && v != null)
    if (entries.length) url += '?' + new URLSearchParams(entries)
  }
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (auth && token) headers.Authorization = 'Token ' + token

  let res
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  } catch {
    throw new ApiError('Сервер недоступний. Перевірте з’єднання та спробуйте ще раз.', 0)
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (auth && res.status === 401) {
      setToken(null)
      window.dispatchEvent(new Event('winterra:logout'))
    }
    throw new ApiError(errorText(data) || `Помилка сервера (${res.status}).`, res.status, data)
  }
  return data
}

export const adminApi = (path, options = {}) => api('/admin' + path, { ...options, auth: true })
