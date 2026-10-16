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
  const seat = [t.seat_class, t.carriage ? `${t.carriage}车` : '', t.seat]
    .filter(Boolean)
    .join(' ')
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

export function orderTrips(trips) {
  return [...(trips || [])].sort((a, b) => tripTimestamp(a) - tripTimestamp(b))
}

export function tripKey(trip) {
  trip = trip || {}
  return [trip.train_no, trip.date, trip.depart_time].join('|')
}

export function formatTripRow(trip, index) {
  const date = (trip.date || '').slice(5).replace('-', '/')
  return `${index + 1} · ${date} ${trip.depart_time || '--:--'}  ${trip.train_no || ''}`
}

export function formatTripRoute(trip) {
  return `${trip.from_station || '待补充'}  →  ${trip.to_station || '待补充'}`
}

export function formatTripDetail(trip) {
  if (!trip) return '暂无行程'
  const seat = [trip.seat_class, trip.carriage ? `${trip.carriage}车` : '', trip.seat]
    .filter(Boolean)
    .join(' ')
  return [
    `${trip.date || ''}  ${trip.train_no || ''}`,
    `${trip.from_station || ''}  →  ${trip.to_station || ''}`,
    `${trip.depart_time || '--:--'}  —  ${trip.arrive_time || '--:--'}`,
    seat,
    trip.gate ? `检票口 ${trip.gate}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

export function formatTripList(trips) {
  if (!trips || !trips.length) return '暂无行程'
  const next = pickNextTrip(trips)
  const more = trips
    .filter((trip) => trip !== next)
    .sort((a, b) => tripTimestamp(a) - tripTimestamp(b))
    .slice(0, 2)
    .map(
      (trip) =>
        `${(trip.date || '').slice(5)} ${trip.train_no || ''} ${trip.from_station || ''}→${trip.to_station || ''} ${trip.depart_time || ''}`
    )
  return [formatTrip(next), ...more].join('\n')
}

export function formatSyncTime(ts) {
  if (!ts) return '尚未同步'
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts)
  if (Number.isNaN(d.getTime())) return '尚未同步'
  const p = (n) => (n < 10 ? `0${n}` : `${n}`)
  return `同步 ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
