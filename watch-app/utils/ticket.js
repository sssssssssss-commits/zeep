const LIMITS = {
  train_no: 8,
  date: 10,
  from_station: 12,
  to_station: 12,
  depart_time: 5,
  arrive_time: 5,
  gate: 12,
  carriage: 4,
  seat: 8,
  seat_class: 8
}

const TRAIN_RE = /\b([GDCZTK]\s?\d{1,4})\b/i
const DATE_RE = /(20\d{2})[年\-/.](\d{1,2})[月\-/.](\d{1,2})日?/
const TIME_PATTERN = '\\b([01]?\\d|2[0-3])[:：]([0-5]\\d)\\b'
const GATE_RE = /检票口[:：\s]*([A-Za-z0-9\-]+)/
const CAR_SEAT_RE =
  /((?:商务座|特等座|一等座|二等座|硬卧|软卧|硬座|软座|无座))?\s*(\d{1,2})\s*车\s*([A-Za-z0-9]+)\s*号?/
const NOT_STATION =
  /车票|座|支付|购买|改签|退票|变更|检票|餐饮|特产|酒店|租车|约车|复制|有效|申报|添加|发票|本人/
const STATION_ARROW_RE = /([\u4e00-\u9fff]{2,10})\s*[→\-—至到]+\s*([\u4e00-\u9fff]{2,10})/
const FROM_RE = /(?:出发站|始发站)[:：\s]*([\u4e00-\u9fff]{2,10})/
const TO_RE = /(?:到达站|终到站)[:：\s]*([\u4e00-\u9fff]{2,10})/

function pad(value) {
  return value < 10 ? `0${value}` : `${value}`
}

export function cleanTrip(input) {
  const trip = {}
  for (const key of Object.keys(LIMITS)) {
    trip[key] = String((input && input[key]) || '')
      .trim()
      .slice(0, LIMITS[key])
  }
  trip.train_no = trip.train_no.replace(/\s+/g, '').toUpperCase()
  if (trip.train_no && !/^[GDCZTK]\d{1,4}$/.test(trip.train_no)) return null
  if (trip.date && !/^\d{4}-\d{2}-\d{2}$/.test(trip.date)) return null
  if (trip.depart_time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(trip.depart_time)) return null
  if (trip.arrive_time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(trip.arrive_time)) return null
  if (!trip.train_no && !trip.from_station) return null
  return trip
}

export function parseTicketText(text) {
  const source = String(text || '')
  const fields = {
    train_no: '',
    date: '',
    from_station: '',
    to_station: '',
    depart_time: '',
    arrive_time: '',
    gate: '',
    carriage: '',
    seat: ''
  }
  const train = TRAIN_RE.exec(source)
  if (train) fields.train_no = train[1]
  const date = DATE_RE.exec(source)
  if (date) fields.date = `${date[1]}-${pad(Number(date[2]))}-${pad(Number(date[3]))}`
  const times = [...source.matchAll(new RegExp(TIME_PATTERN, 'g'))]
  if (times[0]) fields.depart_time = `${pad(Number(times[0][1]))}:${times[0][2]}`
  if (times[1]) fields.arrive_time = `${pad(Number(times[1][1]))}:${times[1][2]}`
  const gate = GATE_RE.exec(source)
  if (gate) fields.gate = gate[1]
  const seat = CAR_SEAT_RE.exec(source)
  if (seat) {
    fields.seat_class = seat[1] || ''
    fields.carriage = pad(Number(seat[2]))
    fields.seat = seat[3].toUpperCase()
  }
  const stations = STATION_ARROW_RE.exec(source)
  if (stations) {
    fields.from_station = stations[1]
    fields.to_station = stations[2]
  } else {
    const from = FROM_RE.exec(source)
    const to = TO_RE.exec(source)
    if (from) fields.from_station = from[1]
    if (to) fields.to_station = to[1]
  }
  return cleanTrip(fields)
}

export function parseLine(line) {
  const parts = String(line || '')
    .split('|')
    .map((part) => part.trim())
  if (parts.length < 5) return null
  return cleanTrip({
    train_no: parts[0],
    date: parts[1],
    from_station: parts[2],
    to_station: parts[3],
    depart_time: parts[4],
    arrive_time: parts[5],
    gate: parts[6],
    carriage: parts[7],
    seat: parts[8],
    seat_class: parts[9]
  })
}

function isStationName(line) {
  return /^[\u4e00-\u9fff]{2,8}$/.test(line) && !NOT_STATION.test(line)
}

function stationFromLine(line) {
  const value = String(line || '')
    .trim()
    .replace(/^(?:[01]?\d|2[0-3])[:：][0-5]\d\s*/, '')
  const match = value.match(
    /^([\u4e00-\u9fff]{2,8}?)(?=已支付|未支付|成人票|学生票|儿童票|非现金|线上购买|$)/
  )
  return match && isStationName(match[1]) ? match[1] : ''
}

function extractCompactStations(slice) {
  const match = String(slice || '').match(
    /\d{1,2}:\d{2}([\u4e00-\u9fff]{2,8}?)\d{1,2}月\d{1,2}日（[^）]*）([\u4e00-\u9fff]{2,8}?)(?=已支付|未支付|成人票|学生票|儿童票)/
  )
  return match ? [match[1], match[2]] : null
}

function extractCardStations(slice, trainNo) {
  const compact = extractCompactStations(slice)
  if (compact) return compact
  const arrow = STATION_ARROW_RE.exec(slice)
  if (arrow) return [arrow[1], arrow[2]]

  const lines = slice
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const trainIndex = lines.findIndex((line) =>
    line.replace(/\s+/g, '').toUpperCase().includes(trainNo.replace(/\s+/g, '').toUpperCase())
  )
  if (trainIndex < 0) return ['', '']

  const afterTrain = lines.slice(trainIndex + 1)
  const dateIndex = afterTrain.findIndex((line) => /\d{1,2}月\d{1,2}日/.test(line))
  const beforeDate = dateIndex >= 0 ? afterTrain.slice(0, dateIndex) : afterTrain
  const afterDate = dateIndex >= 0 ? afterTrain.slice(dateIndex + 1) : []

  const fromStation = beforeDate.map(stationFromLine).find(Boolean) || ''
  const toStation = afterDate.map(stationFromLine).find(Boolean) || ''
  return [fromStation, toStation]
}

function timeText(match) {
  return `${pad(Number(match[1]))}:${match[2]}`
}

function closestYear(source, position) {
  const matches = [...source.matchAll(/20\d{2}/g)]
  if (!matches.length) return new Date().getFullYear()
  const before = matches.filter((match) => match.index <= position)
  return Number((before.length ? before[before.length - 1] : matches[0])[0])
}

function cardStart(source, trainIndex) {
  const prefix = source.slice(0, trainIndex)
  const order = Math.max(prefix.lastIndexOf('订单号：'), prefix.lastIndexOf('订单号:'))
  return order >= 0 ? order : Math.max(0, trainIndex - 100)
}

function cardEnd(source, trainIndex) {
  const candidates = ['订单号：', '订单号:']
    .map((marker) => source.indexOf(marker, trainIndex + 1))
    .filter((index) => index >= 0)
  return candidates.length ? Math.min(...candidates) : source.length
}

// ponytail: tuned for 12306「本人车票」cards. Cards are anchored by train
// numbers rather than date headings, so overlapping screenshots still merge.
function parse12306Page(text) {
  const source = String(text || '')
  const trips = []
  const trains = [...source.matchAll(/\b([GDCZTK]\s?\d{1,4})\b/gi)]
  for (const train of trains) {
    const start = cardStart(source, train.index)
    const end = cardEnd(source, train.index)
    const slice = source.slice(start, end)
    const localDate = slice.match(/(\d{1,2})月(\d{1,2})日/)
    if (!localDate) continue
    const year = closestYear(source, train.index)
    const date = `${year}-${pad(Number(localDate[1]))}-${pad(Number(localDate[2]))}`
    const times = [...slice.matchAll(new RegExp(TIME_PATTERN, 'g'))]
    const stations = extractCardStations(slice, train[1])
    const seat = CAR_SEAT_RE.exec(slice)
    const gate = GATE_RE.exec(slice)
    trips.push(
      cleanTrip({
        train_no: train[1],
        date,
        from_station: stations[0] || '',
        to_station: stations[1] || '',
        depart_time: times[0] ? timeText(times[0]) : '',
        arrive_time: times[1] ? timeText(times[1]) : '',
        gate: gate ? gate[1] : '',
        seat_class: seat && seat[1] ? seat[1] : '',
        carriage: seat ? pad(Number(seat[2])) : '',
        seat: seat ? seat[3].toUpperCase() : ''
      })
    )
  }
  return trips.filter(Boolean)
}

// ponytail: regex extraction handles common 12306 text, not every screenshot layout.
// Upgrade path is correcting the one-line form before saving.
export function tripsFromText(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const pipeLines = lines.filter((line) => line.includes('|'))
  if (pipeLines.length) {
    return pipeLines.map(parseLine).filter(Boolean)
  }
  const page = parse12306Page(text)
  if (page.length) return page
  const trip = parseTicketText(text)
  return trip ? [trip] : []
}

export function syncNotice(foundCount, savedCount) {
  if (!foundCount) {
    return savedCount
      ? `已有 ${savedCount} 趟行程`
      : '未识别到行程，请确认已复制白描的全部文字'
  }
  return `已保存 ${savedCount} 趟，手表连接后自动更新`
}

export function mergeTrips(existing, incoming) {
  const merged = new Map()
  for (const item of [...(existing || []), ...(incoming || [])]) {
    const trip = cleanTrip(item)
    if (!trip) continue
    // Same train/date/time is the same ticket; a new OCR pass replaces bad
    // station text from an earlier import instead of creating a duplicate.
    const key = [trip.train_no, trip.date, trip.depart_time].join('|')
    const previous = merged.get(key)
    if (previous) {
      for (const field of Object.keys(trip)) {
        if (!trip[field] && previous[field]) trip[field] = previous[field]
      }
    }
    merged.set(key, trip)
  }
  return [...merged.values()]
    .sort((a, b) => {
      const aTime = Date.parse(`${a.date || ''}T${a.depart_time || '00:00'}:00`)
      const bTime = Date.parse(`${b.date || ''}T${b.depart_time || '00:00'}:00`)
      return (Number.isNaN(aTime) ? Infinity : aTime) - (Number.isNaN(bTime) ? Infinity : bTime)
    })
    .slice(-10)
}
