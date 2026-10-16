import { applyClipboardText, htmlToText } from './clipboard-text.js'
import { mergeTrips, parseTicketText, syncNotice, tripsFromText } from './ticket.js'
import { tripKey } from './trip.js'

function pickNextTrip(trips) {
  if (!trips || !trips.length) return null
  const now = Date.parse('2026-10-20T10:00:00')
  let best = null
  let bestTs = Infinity
  for (const trip of trips) {
    const ts = Date.parse(`${trip.date}T${trip.depart_time || '00:00'}:00`)
    if (ts >= now - 30 * 60 * 1000 && ts < bestTs) {
      best = trip
      bestTs = ts
    }
  }
  return best || trips[0]
}

const sample = `
订单号 E123456789
G1234 次
2026年10月20日
北京南 → 上海虹桥
09:00 开 13:28 到
检票口 6A
05车12A号
`
const parsed = parseTicketText(sample)
const expected = {
  train_no: 'G1234',
  date: '2026-10-20',
  from_station: '北京南',
  to_station: '上海虹桥',
  depart_time: '09:00',
  arrive_time: '13:28',
  gate: '6A',
  carriage: '05',
  seat: '12A'
}
for (const [key, value] of Object.entries(expected)) {
  if (parsed[key] !== value) {
    console.error(key, parsed)
    process.exit(1)
  }
}

const ownTickets = `
11:17
51.3
本人车票
只显示当前12306账号本人“苏超凡”的出行车票信息。
乘车日期：2026年10月16日周五
订单号：EC11089431
19:08
G1307
成都东
10月16日（周五）
19:27
简阳南
已支付
成人票
二等座06车18F号
￥28
9.7折
乘车日期：2026年10月22日周四
订单号：EC81123088
13:01
C456
17:01
丽江
10月22日（周四）
昆明
已支付
成人票
二等座06车01F号
￥190
订单号：EC11668646
车票当日当次有效
`
const own = tripsFromText(ownTickets)
if (own.length !== 2) {
  console.error('expected 2 tickets', own)
  process.exit(1)
}
const first = own[0]
if (
  first.train_no !== 'G1307' ||
  first.date !== '2026-10-16' ||
  first.from_station !== '成都东' ||
  first.to_station !== '简阳南' ||
  first.depart_time !== '19:08' ||
  first.arrive_time !== '19:27' ||
  first.carriage !== '06' ||
  first.seat !== '18F' ||
  first.seat_class !== '二等座' ||
  first.gate !== ''
) {
  console.error('first ticket', first)
  process.exit(1)
}
const second = own[1]
if (
  second.train_no !== 'C456' ||
  second.date !== '2026-10-22' ||
  second.from_station !== '丽江' ||
  second.to_station !== '昆明' ||
  second.depart_time !== '13:01' ||
  second.arrive_time !== '17:01' ||
  second.seat !== '01F'
) {
  console.error('second ticket', second)
  process.exit(1)
}
if (JSON.stringify(own).includes('苏超凡') || JSON.stringify(own).includes('11:17')) {
  console.error('kept personal or status-bar text', own)
  process.exit(1)
}

const secondScreenshot = `
11:17
本人车票
订单号：EC11668646
车票当日当次有效
17:19
D8686
17:37
昆明
10月22日（周四）
昆明南
已支付
成人票
二等座05车04F号
￥10.5
乘车日期：2026年10月23日 周五
订单号：EC75455817
车票当日当次有效
09:58
D3904
15:33
昆明南
10月23日（周五）
柳州
已支付
成人票
二等座03车02F号
￥361.5
乘车日期：2026年10月27日 周二
`
const screenshotTrips = tripsFromText(secondScreenshot)
if (
  screenshotTrips.length !== 2 ||
  screenshotTrips[0].train_no !== 'D8686' ||
  screenshotTrips[0].date !== '2026-10-22' ||
  screenshotTrips[0].from_station !== '昆明' ||
  screenshotTrips[0].to_station !== '昆明南' ||
  screenshotTrips[1].train_no !== 'D3904' ||
  screenshotTrips[1].date !== '2026-10-23'
) {
  console.error('second screenshot', screenshotTrips)
  process.exit(1)
}

const compactOcr1 = `
乘车日期：2026年10月16日周五
订单号：EC11089431复制
车票当日当次有效19:08
G1307
19:27成都东
10月16日（周五）
简阳南已支付成人票
非现金支付线上购买二等座06车18F号
改签
退票
变更到站
乘车日期：2026年10月22日周四
订单号：EC81123088复制
车票当日当次有效13:01
C456
17:01丽江
10月22日（周四）
昆明已支付成人票
非现金支付线上购买二等座06车01F号
变更到站
`
const compactOcr2 = `
订单号：EC11668646复制
车票当日当次有效
17:19
D8686
17:37昆明
10月22日（周四）
昆明南已支付成人票
非现金支付线上购买二等座05车04F号
变更到站
乘车日期：2026年10月23日周五
订单号：EC75455817复制
车票当日当次有效
09:58
D3904
15:33昆明南
10月23日（周五）
柳州已支付成人票
非现金支付线上购买二等座03车02F号
变更到站
`
const compactTrips = mergeTrips(tripsFromText(compactOcr1), tripsFromText(compactOcr2))
const compactRoutes = compactTrips
  .map((trip) => `${trip.train_no}:${trip.from_station}-${trip.to_station}`)
  .join(',')
if (
  compactRoutes !==
  'G1307:成都东-简阳南,C456:丽江-昆明,D8686:昆明-昆明南,D3904:昆明南-柳州'
) {
  console.error('compact OCR routes', compactTrips)
  process.exit(1)
}
const corrected = mergeTrips(
  [{ ...compactTrips[0], from_station: '变更到站', to_station: '' }],
  [compactTrips[0]]
)
if (corrected.length !== 1 || corrected[0].from_station !== '成都东') {
  console.error('corrected trip did not replace old OCR', corrected)
  process.exit(1)
}

const fourTrips = mergeTrips(own, screenshotTrips)
if (
  fourTrips.length !== 4 ||
  fourTrips.map((trip) => trip.train_no).join(',') !== 'G1307,C456,D8686,D3904'
) {
  console.error('expected 4 merged trips', fourTrips)
  process.exit(1)
}

const line = 'G88|2026-10-21|北京南|上海虹桥|08:00|12:00|1A|02|03F'
const imported = tripsFromText(`${sample}\nignored`)
if (imported.length !== 1 || imported[0].train_no !== 'G1234') {
  console.error('natural text', imported)
  process.exit(1)
}
const merged = mergeTrips(imported, tripsFromText(line))
if (merged.length !== 2 || merged[1].seat !== '03F') {
  console.error('merge', merged)
  process.exit(1)
}
if (mergeTrips(merged, tripsFromText(line)).length !== 2) {
  console.error('duplicate was added')
  process.exit(1)
}

const next = pickNextTrip([
  { date: '2026-10-19', depart_time: '09:00', train_no: 'G1' },
  { date: '2026-10-20', depart_time: '14:00', train_no: 'G2' },
  { date: '2026-10-21', depart_time: '08:00', train_no: 'G3' }
])
if (!next || next.train_no !== 'G2') {
  console.error('expected G2', next)
  process.exit(1)
}
if (tripKey(next) !== 'G2|2026-10-20|14:00') {
  console.error('unexpected trip key', tripKey(next))
  process.exit(1)
}
const pasted = applyClipboardText('', '订单号：EC1\nG1307\n乘车日期：2026年10月16日')
if (!pasted.filled || !pasted.raw.includes('G1307')) {
  console.error('clipboard text was not kept', pasted)
  process.exit(1)
}
if (applyClipboardText('已有', '   ').notice !== '剪贴板是空的') {
  console.error('empty clipboard should be reported')
  process.exit(1)
}
const htmlClip = htmlToText('<div>订单号：EC1</div><div>G1307</div><div>乘车日期：2026年10月16日</div>')
if (!htmlClip.includes('G1307') || htmlClip.includes('<')) {
  console.error('html clipboard was not converted', htmlClip)
  process.exit(1)
}
const pastedScreen = `乘车日期：2026年10月27日周二
订单号：EQ68607764复制
车票当日当次有效
11:23
Z396
21:42柳州
10月27日（周二）
南昌已支付成人票
硬座03车079号
乘车日期：2026年10月30日周五
订单号：EQ18544072复制
09:33
D3194
13:30南昌西
10月30日（周五）
南京南已支付成人票
二等座06车05D号
乘车日期：2026年10月7日周二`
const screenTrips = tripsFromText(pastedScreen)
if (
  screenTrips.length !== 2 ||
  screenTrips[0].seat_class !== '硬座' ||
  screenTrips[0].from_station !== '柳州' ||
  screenTrips[0].to_station !== '南昌' ||
  screenTrips[1].seat !== '05D'
) {
  console.error('screenshot paste', screenTrips)
  process.exit(1)
}
const oneLine = tripsFromText(
  '订单号：EQ68607764车票当日当次有效11:23 Z396 21:42柳州10月27日（周二）南昌已支付成人票硬座03车079号乘车日期：2026年10月30日周五订单号：EQ18544072车票当日当次有效09:33 D3194 13:30南昌西10月30日（周五）南京南已支付成人票二等座06车05D号'
)
if (
  oneLine.length !== 2 ||
  oneLine[0].from_station !== '柳州' ||
  oneLine[0].to_station !== '南昌' ||
  oneLine[0].seat_class !== '硬座' ||
  oneLine[1].from_station !== '南昌西' ||
  oneLine[1].to_station !== '南京南'
) {
  console.error('one-line paste lost stations', oneLine)
  process.exit(1)
}
const kept = mergeTrips(screenTrips, [{ ...screenTrips[0], from_station: '', to_station: '' }])
if (kept[0].from_station !== '柳州' || kept[0].to_station !== '南昌') {
  console.error('empty OCR wiped stations', kept)
  process.exit(1)
}
if (syncNotice(0, 2) !== '已有 2 趟行程' || !syncNotice(0, 0).includes('未识别')) {
  console.error('sync notice', syncNotice(0, 2), syncNotice(0, 0))
  process.exit(1)
}
console.log('ok')
