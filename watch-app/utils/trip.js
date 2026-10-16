/** Pick the next upcoming trip; fall back to first. */
export function pickNextTrip(trips) {
  if (!trips || !trips.length) return null
  const now = Date.now()
  let best = null
  let bestTs = Infinity
  for (const t of trips) {
    const ts = tripTimestamp(t)
    if (ts >= now - 30 * 60 * 1000 && ts < bestTs) {
      best = t
      bestTs = ts
    }
  }
  return best || trips[0]
}

export function tripTimestamp(t) {
  if (!t || !t.date) return 0
  const time = t.depart_time || '00:00'
  const iso = `${t.date}T${time}:00`
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? 0 : ms
}

export function formatTrip(t) {
  if (!t) return '暂无行程'
  const gate = t.gate ? `检票口 ${t.gate}` : ''
  const seat =
    t.carriage || t.seat
      ? `${t.carriage || ''}车 ${t.seat || ''}`.trim()
      : ''
  return [
    `${t.date || ''}  ${t.train_no || ''}`.trim(),
    `${t.from_station || ''} → ${t.to_station || ''}`,
    `${t.depart_time || ''} - ${t.arrive_time || ''}`.replace(/ - $/, ''),
    gate,
    seat
  ]
    .filter(Boolean)
    .join('\n')
}

export function formatSyncTime(ts) {
  if (!ts) return '尚未同步'
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts)
  if (Number.isNaN(d.getTime())) return '尚未同步'
  const p = (n) => (n < 10 ? `0${n}` : `${n}`)
  return `同步 ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
