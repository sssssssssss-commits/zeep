import * as hmUI from '@zos/ui'
import { log as Logger } from '@zos/utils'
import { BasePage } from '@zeppos/zml/base-page'
import { layout } from './layout'
import { loadCache, saveCache, clearCache } from '../../utils/storage'
import { pickNextTrip, formatTrip, formatSyncTime } from '../../utils/trip'

const logger = Logger.getLogger('rail-home')

Page(
  BasePage({
    state: {
      body: null,
      status: null,
      cache: null
    },
    onInit() {
      this.state.cache = loadCache()
      // 启动先显示缓存，不阻塞；连接时再请求更新
      this.syncFromPhone(false)
    },
    build() {
      const L = layout()
      hmUI.createWidget(hmUI.widget.TEXT, L.title)
      this.state.body = hmUI.createWidget(hmUI.widget.TEXT, {
        ...L.body,
        text: this.bodyText()
      })
      this.state.status = hmUI.createWidget(hmUI.widget.TEXT, {
        ...L.status,
        text: this.statusText('缓存')
      })
      hmUI.createWidget(hmUI.widget.BUTTON, {
        ...L.refreshBtn,
        click_func: () => this.syncFromPhone(true)
      })
      hmUI.createWidget(hmUI.widget.BUTTON, {
        ...L.clearBtn,
        click_func: () => {
          clearCache()
          this.state.cache = null
          this.renderUI('已清除本地数据')
        }
      })
    },
    bodyText() {
      const trips = (this.state.cache && this.state.cache.trips) || []
      return formatTrip(pickNextTrip(trips))
    },
    statusText(extra) {
      const synced = this.state.cache && this.state.cache.synced_at
      const base = formatSyncTime(synced)
      return extra ? `${base} · ${extra}` : base
    },
    renderUI(extra) {
      if (this.state.body) {
        this.state.body.setProperty(hmUI.prop.TEXT, this.bodyText())
      }
      if (this.state.status) {
        this.state.status.setProperty(hmUI.prop.TEXT, this.statusText(extra))
      }
    },
    syncFromPhone(manual) {
      if (manual) {
        this.renderUI('同步中…')
      }
      this.request({ method: 'SYNC' })
        .then((data) => {
          if (data && data.ok) {
            this.state.cache = {
              trips: data.trips || [],
              synced_at: data.synced_at
            }
            saveCache(this.state.cache)
            this.renderUI('已更新')
            return
          }
          // 同步失败保留旧缓存
          const err = (data && data.error) || '失败'
          logger.log('sync fail', err)
          this.renderUI(manual ? `失败 ${err}` : '离线缓存')
        })
        .catch((err) => {
          logger.log('sync error', err)
          this.renderUI(manual ? '无连接' : '离线缓存')
        })
    }
  })
)
