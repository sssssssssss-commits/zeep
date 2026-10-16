import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'
import { tripKey } from '../utils/trip'

function readTrips() {
  const raw = settingsLib.getItem('trips')
  if (!raw) return null
  try {
    const trips = JSON.parse(raw)
    return Array.isArray(trips) ? trips : null
  } catch (err) {
    return null
  }
}

function pushTrips(side) {
  const trips = readTrips()
  if (!trips) return
  try {
    const result = side.call({
      method: 'TRIPS',
      trips,
      synced_at: Date.now()
    })
    if (result && typeof result.catch === 'function') result.catch(() => {})
  } catch (err) {
    // 手表页面未打开时推送可能失败；下次打开会主动拉取。
  }
}

AppSideService(
  BaseSideService({
    onInit() {},
    onRun() {},
    onDestroy() {},
    onSettingsChange({ key }) {
      if (key === 'trips') pushTrips(this)
    },
    onRequest(req, res) {
      if (req.method === 'DELETE_TRIPS') {
        const keys = Array.isArray(req.keys)
          ? req.keys.filter((key) => typeof key === 'string').slice(0, 50)
          : []
        if (!keys.length) {
          res(null, { ok: false, error: '未选择行程' })
          return
        }
        const trips = readTrips() || []
        const remaining = trips.filter((trip) => keys.indexOf(tripKey(trip)) < 0)
        settingsLib.setItem('trips', JSON.stringify(remaining))
        res(null, { ok: true, trips: remaining, synced_at: Date.now() })
        return
      }
      if (req.method !== 'SYNC') {
        res('unknown method')
        return
      }
      const trips = readTrips()
      if (!trips) {
        res(null, { ok: false, error: '请先添加行程' })
        return
      }
      res(null, { ok: true, trips, synced_at: Date.now() })
    }
  })
)
