import { LocalStorage } from '@zos/storage'

const KEY = 'rail_cache'
const storage = new LocalStorage()

export function loadCache() {
  return storage.getItem(KEY, null)
}

export function saveCache(payload) {
  storage.setItem(KEY, payload)
}

export function clearCache() {
  storage.removeItem(KEY)
}
