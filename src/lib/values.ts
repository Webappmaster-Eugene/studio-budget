const integer = new Intl.NumberFormat('ru-RU')

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(value + 'T00:00:00Z')
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}

export function dateToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: string) => parts.find((item) => item.type === type)?.value
  return [part('year'), part('month'), part('day')].join('-')
}

export function decimalMoney(kopecks: string) {
  const amount = BigInt(kopecks)
  return String(amount / 100n) + '.' + String(amount % 100n).padStart(2, '0')
}

export function humanMoney(kopecks: string) {
  const amount = BigInt(kopecks)
  const fraction = amount % 100n
  return integer.format(amount / 100n) + (fraction === 0n ? '' : ',' + String(fraction).padStart(2, '0'))
}
