/** Node self-check for trip helpers (no Zepp runtime). */
function pickNextTrip(trips) {
  if (!trips || !trips.length) return null
  const now = Date.parse('2026-10-20T10:00:00')
  let best = null
  let bestTs = Infinity
  for (const t of trips) {
    const ts = Date.parse(`${t.date}T${t.depart_time || '00:00'}:00`)
    if (ts >= now - 30 * 60 * 1000 && ts < bestTs) {
      best = t
      bestTs = ts
    }
  }
  return best || trips[0]
}

const trips = [
  { date: '2026-10-19', depart_time: '09:00', train_no: 'G1' },
  { date: '2026-10-20', depart_time: '14:00', train_no: 'G2' },
  { date: '2026-10-21', depart_time: '08:00', train_no: 'G3' }
]
const next = pickNextTrip(trips)
if (!next || next.train_no !== 'G2') {
  console.error('expected G2', next)
  process.exit(1)
}
console.log('ok')
