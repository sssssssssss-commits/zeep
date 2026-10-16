import * as hmUI from '@zos/ui'
import { log as Logger } from '@zos/utils'
import { BasePage } from '@zeppos/zml/base-page'
import { layout } from './layout'
import { loadCache, saveCache } from '../../utils/storage'
import {
  formatTripDetail,
  formatTripRoute,
  formatTripRow,
  formatSyncTime,
  orderTrips,
  tripKey
} from '../../utils/trip'

const logger = Logger.getLogger('rail-home')

Page(
  BasePage({
    state: {
      body: null,
      subtitle: null,
      tripList: null,
      detail: null,
      back: null,
      status: null,
      refreshBtn: null,
      deleteBtn: null,
      cache: null,
      visibleTrips: [],
      selected: null,
      deleteMode: false,
      deleteKeys: {}
    },
    onInit() {
      this.state.cache = loadCache()
      // 启动先显示缓存，不阻塞；连接时再请求更新
      this.syncFromPhone(false)
    },
    build() {
      const L = layout()
      this.state.visibleTrips = orderTrips(
        (this.state.cache && this.state.cache.trips) || []
      )
      hmUI.createWidget(hmUI.widget.TEXT, L.title)
      this.state.subtitle = hmUI.createWidget(hmUI.widget.TEXT, {
        ...L.subtitle,
        text: ''
      })
      this.state.tripList = hmUI.createWidget(hmUI.widget.SCROLL_LIST, {
        ...L.list,
        item_click_func: (_list, index) => this.onTripClick(index)
      })
      this.state.detail = hmUI.createWidget(hmUI.widget.TEXT, {
        ...L.detail,
        text: ''
      })
      this.state.back = hmUI.createWidget(hmUI.widget.BUTTON, {
        ...L.backBtn,
        click_func: () => this.showList()
      })
      this.state.status = hmUI.createWidget(hmUI.widget.TEXT, {
        ...L.status,
        text: this.statusText(this.state.cache ? '缓存' : '')
      })
      this.state.refreshBtn = hmUI.createWidget(hmUI.widget.BUTTON, {
        ...L.refreshBtn,
        click_func: () =>
          this.state.deleteMode ? this.showList() : this.syncFromPhone(true)
      })
      this.state.deleteBtn = hmUI.createWidget(hmUI.widget.BUTTON, {
        ...L.clearBtn,
        click_func: () => this.onDeleteButton()
      })
      this.showList()
    },
    statusText(extra) {
      const synced = this.state.cache && this.state.cache.synced_at
      const base = formatSyncTime(synced)
      return extra ? `${base} · ${extra}` : base
    },
    renderUI(extra) {
      if (this.state.status) {
        this.state.status.setProperty(hmUI.prop.TEXT, this.statusText(extra))
      }
      if (!this.state.subtitle) return
      if (this.state.selected == null) this.showList()
      else this.showDetail(this.state.selected)
    },
    showList() {
      this.state.selected = null
      this.state.deleteMode = false
      this.state.deleteKeys = {}
      const trips = orderTrips((this.state.cache && this.state.cache.trips) || [])
      this.state.visibleTrips = trips
      const count = trips.length
      this.state.subtitle.setProperty(
        hmUI.prop.TEXT,
        count ? `${count} 趟行程 · 点击查看详情` : '请在 Zepp 设置中添加行程'
      )
      this.state.detail.setProperty(hmUI.prop.VISIBLE, false)
      this.state.back.setProperty(hmUI.prop.VISIBLE, false)
      this.state.refreshBtn.setProperty(hmUI.prop.TEXT, '刷新')
      this.state.deleteBtn.setProperty(hmUI.prop.TEXT, '选择删除')
      this.updateTripList(true)
      this.state.tripList.setProperty(hmUI.prop.VISIBLE, true)
    },
    updateTripList(resetPage) {
      const trips = this.state.visibleTrips
      const data = trips.map((trip, index) => ({
        main: `${this.state.deleteMode ? (this.state.deleteKeys[tripKey(trip)] ? '✓ ' : '○ ') : ''}${formatTripRow(trip, index)}`,
        route: formatTripRoute(trip)
      }))
      const dataTypes = data.map((_, index) => ({
        start: index,
        end: index,
        type_id:
          (this.state.deleteMode && this.state.deleteKeys[tripKey(trips[index])]) ||
          (!this.state.deleteMode && index === 0)
            ? 1
            : 2
      }))
      const update = {
        data_array: data,
        data_count: data.length,
        data_type_config: dataTypes,
        data_type_config_count: dataTypes.length
      }
      if (resetPage) update.on_page = 0
      this.state.tripList.setProperty(hmUI.prop.UPDATE_DATA, update)
    },
    onTripClick(index) {
      if (!this.state.deleteMode) {
        this.showDetail(index)
        return
      }
      const trip = this.state.visibleTrips[index]
      if (!trip) return
      const key = tripKey(trip)
      if (this.state.deleteKeys[key]) delete this.state.deleteKeys[key]
      else this.state.deleteKeys[key] = true
      const count = Object.keys(this.state.deleteKeys).length
      this.state.subtitle.setProperty(hmUI.prop.TEXT, `已勾选 ${count} 趟`)
      this.state.deleteBtn.setProperty(hmUI.prop.TEXT, count ? `删除(${count})` : '删除')
      this.updateTripList(false)
    },
    onDeleteButton() {
      if (!this.state.deleteMode) {
        if (!this.state.visibleTrips.length) {
          this.state.status.setProperty(hmUI.prop.TEXT, '暂无可删除行程')
          return
        }
        this.state.deleteMode = true
        this.state.deleteKeys = {}
        this.state.subtitle.setProperty(hmUI.prop.TEXT, '点击行程进行勾选')
        this.state.refreshBtn.setProperty(hmUI.prop.TEXT, '取消')
        this.state.deleteBtn.setProperty(hmUI.prop.TEXT, '删除')
        this.updateTripList(false)
        return
      }
      const keys = Object.keys(this.state.deleteKeys)
      if (!keys.length) {
        this.state.status.setProperty(hmUI.prop.TEXT, '请先勾选要删除的行程')
        return
      }
      this.state.status.setProperty(hmUI.prop.TEXT, '删除中…')
      this.request({ method: 'DELETE_TRIPS', keys })
        .then((data) => {
          if (data && data.ok) {
            this.applyTrips(data.trips, data.synced_at, `已删除 ${keys.length} 趟`)
            return
          }
          this.state.status.setProperty(
            hmUI.prop.TEXT,
            (data && data.error) || '删除失败'
          )
        })
        .catch(() => {
          this.state.status.setProperty(hmUI.prop.TEXT, '请连接手机后删除')
        })
    },
    showDetail(index) {
      const trip = this.state.visibleTrips[index]
      if (!trip) return
      this.state.selected = index
      this.state.subtitle.setProperty(hmUI.prop.TEXT, `第 ${index + 1} 趟 · 行程详情`)
      this.state.tripList.setProperty(hmUI.prop.VISIBLE, false)
      this.state.detail.setProperty(hmUI.prop.TEXT, formatTripDetail(trip))
      this.state.detail.setProperty(hmUI.prop.VISIBLE, true)
      this.state.back.setProperty(hmUI.prop.VISIBLE, true)
    },
    onCall(data) {
      if (!data || data.method !== 'TRIPS') return
      this.applyTrips(data.trips, data.synced_at, '已更新')
    },
    applyTrips(trips, syncedAt, extra) {
      this.state.cache = {
        trips: trips || [],
        synced_at: syncedAt
      }
      this.state.selected = null
      saveCache(this.state.cache)
      this.renderUI(extra)
    },
    syncFromPhone(manual) {
      if (manual) {
        this.renderUI('同步中…')
      }
      this.request({ method: 'SYNC' })
        .then((data) => {
          if (data && data.ok) {
            this.applyTrips(data.trips, data.synced_at, '已更新')
            return
          }
          // 同步失败保留旧缓存
          const err = (data && data.error) || '失败'
          logger.log('sync fail', err)
          this.renderUI(manual ? err : this.state.cache ? '离线缓存' : '待添加')
        })
        .catch((err) => {
          logger.log('sync error', err)
          this.renderUI(manual ? '无连接' : this.state.cache ? '离线缓存' : '待添加')
        })
    }
  })
)
