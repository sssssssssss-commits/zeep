import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'

const DEFAULT_BASE = 'http://127.0.0.1:8787'

function getBaseUrl() {
  return (settingsLib.getItem('serverUrl') || DEFAULT_BASE).replace(/\/$/, '')
}

function getToken() {
  return settingsLib.getItem('pairToken') || ''
}

function setStatus(text) {
  settingsLib.setItem('syncStatus', text)
}

function parseBody(response) {
  if (!response) return {}
  if (typeof response.body !== 'string') return response.body || {}
  try {
    return JSON.parse(response.body)
  } catch (_) {
    return {}
  }
}

function responseError(response, body, fallback) {
  if (!response || typeof response.status !== 'number') return ''
  if (response.status >= 200 && response.status < 300) return ''
  return (body && body.detail) || fallback
}

async function claimIfNeeded() {
  let token = getToken()
  if (token) return token
  const code = (settingsLib.getItem('pairCode') || '').trim()
  if (!code || code.length !== 6) {
    throw new Error('请在设置页输入 6 位配对码')
  }
  const response = await fetch({
    url: `${getBaseUrl()}/api/pair/claim`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  })
  const body = parseBody(response)
  const error = responseError(response, body, '配对失败')
  if (error) throw new Error(error)
  if (!body || !body.token) {
    throw new Error('配对失败')
  }
  settingsLib.setItem('pairToken', body.token)
  return body.token
}

async function fetchTrips() {
  const token = await claimIfNeeded()
  const response = await fetch({
    url: `${getBaseUrl()}/api/trips`,
    method: 'GET',
    headers: { 'X-Pair-Token': token }
  })
  const body = parseBody(response)
  const error = responseError(response, body, '同步请求失败')
  if (error) {
    if (response && response.status === 401) {
      settingsLib.setItem('pairToken', '')
    }
    throw new Error(error)
  }
  if (!body || !Array.isArray(body.trips)) {
    throw new Error('同步数据无效')
  }
  return body
}

AppSideService(
  BaseSideService({
    onInit() {},
    onRun() {},
    onDestroy() {},
    onSettingsChange({ key }) {
      if (key === 'pairCode' || key === 'serverUrl') {
        // 配对码变更时清掉旧 token，下次同步重新 claim
        if (key === 'pairCode') {
          settingsLib.setItem('pairToken', '')
        }
        setStatus('设置已更新，请在手表刷新')
      }
    },
    onRequest(req, res) {
      if (req.method === 'SYNC') {
        fetchTrips()
          .then((data) => {
            setStatus(`同步成功 ${new Date().toLocaleString()}`)
            res(null, {
              ok: true,
              trips: data.trips,
              synced_at: data.synced_at || Date.now() / 1000
            })
          })
          .catch((err) => {
            const msg = (err && err.message) || String(err)
            setStatus(`同步失败: ${msg}`)
            // 失败不擦手表缓存：只回报错误
            res(null, { ok: false, error: msg })
          })
        return
      }
      res('unknown method')
    }
  })
)
