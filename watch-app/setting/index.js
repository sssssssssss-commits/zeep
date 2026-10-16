import { mergeTrips, syncNotice, tripsFromText } from '../utils/ticket'

const BAIMIAO_URL = 'https://web.baimiaoapp.com/'
const BAIMIAO_INTENT =
  'intent://web.baimiaoapp.com/#Intent;scheme=https;action=android.intent.action.VIEW;end'

function readJson(storage, key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null')
    return value == null ? fallback : value
  } catch (err) {
    return fallback
  }
}

AppSettingsPage({
  state: {
    storage: null,
    raw: '',
    trips: [],
    notice: '尚未保存行程',
    handledPaste: ''
  },
  load(props) {
    const storage = props.settingsStorage
    const meta = readJson(storage, 'meta', {})
    this.state.storage = storage
    this.state.raw = meta.raw || ''
    this.state.notice = meta.notice || '尚未保存行程'
    this.state.handledPaste = meta.handledPaste || this.state.handledPaste || ''
    this.state.trips = readJson(storage, 'trips', [])
    if (!Array.isArray(this.state.trips)) this.state.trips = []
    this.acceptPaste(storage.getItem('pasteText') || '')
  },
  saveMeta(raw, notice) {
    this.state.storage.setItem(
      'meta',
      JSON.stringify({
        raw,
        notice,
        handledPaste: this.state.handledPaste || ''
      })
    )
  },
  saveTrips(trips, notice) {
    this.saveMeta('', notice)
    this.state.storage.setItem('trips', JSON.stringify(trips))
  },
  addFromRaw() {
    const pasted = this.state.storage ? this.state.storage.getItem('pasteText') || '' : ''
    const source = String(this.state.raw || pasted).trim()
    const found = tripsFromText(source)
    if (!found.length) {
      this.saveMeta(this.state.raw, syncNotice(0, this.state.trips.length))
      return
    }
    this.state.handledPaste = source
    const trips = mergeTrips(this.state.trips, found)
    this.saveTrips(trips, syncNotice(found.length, trips.length))
  },
  deleteTrip(index) {
    const trips = this.state.trips.filter((_, tripIndex) => tripIndex !== index)
    this.saveTrips(trips, trips.length ? '已删除' : '行程已清空')
  },
  acceptPaste(text) {
    const value = String(text || '').trim()
    if (!value || value === this.state.handledPaste) return
    if (value.length < 12 || !/订单号|乘车日期|\b[GDCZTK]\d{1,4}\b/i.test(value)) return
    this.state.handledPaste = value
    this.state.raw = value
    const found = tripsFromText(value)
    if (!found.length) {
      this.saveMeta(value, '已粘贴，但没识别到行程，请确认复制的是全部识别文字')
      return
    }
    const trips = mergeTrips(this.state.trips, found)
    this.saveTrips(trips, `已识别 ${found.length} 趟，手表连接后自动更新`)
  },
  build(props) {
    this.load(props)
    const tripViews = this.state.trips.map((trip, index) =>
      View(
        {
          style: {
            background: '#fff',
            border: '1px solid #e7eaee',
            borderRadius: '12px',
            padding: '12px',
            marginBottom: '8px'
          }
        },
        [
          View(
            {
              style: {
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center'
              }
            },
            [
              Text(
                {
                  style: {
                    flex: 1,
                    fontSize: '15px',
                    fontWeight: '700',
                    color: '#17212b'
                  }
                },
                [`${trip.date || ''}  ${trip.train_no || ''}`]
              ),
              Button({
                label: '删除',
                style: {
                  fontSize: '12px',
                  color: '#c6493d',
                  background: '#fff1ef',
                  borderRadius: '16px',
                  padding: '5px 11px'
                },
                onClick: () => this.deleteTrip(index)
              })
            ]
          ),
          Text(
            {
              style: {
                display: 'block',
                fontSize: '14px',
                color: '#273849',
                marginTop: '7px'
              }
            },
            [`${trip.from_station || ''}  →  ${trip.to_station || ''}`]
          ),
          Text(
            {
              style: {
                display: 'block',
                fontSize: '12px',
                color: '#7b8794',
                marginTop: '5px'
              }
            },
            [
              `${trip.depart_time || '--:--'} - ${trip.arrive_time || '--:--'}  ${trip.seat_class || ''} ${trip.carriage || ''}车 ${trip.seat || ''}`
            ]
          )
        ]
      )
    )

    return View(
      { style: { padding: '14px 16px 28px', background: '#f5f7f9' } },
      [
        Text(
          {
            style: {
              display: 'block',
              fontSize: '18px',
              fontWeight: '700',
              color: '#17212b',
              marginBottom: '4px'
            }
          },
          ['添加行程']
        ),
        Text(
          {
            style: {
              display: 'block',
              fontSize: '13px',
              color: '#687583',
              lineHeight: '1.5',
              marginBottom: '12px'
            }
          },
          ['① 打开白描并复制全部文字  ② 点下面绿色一行  ③ 在弹出框里长按，选择“粘贴”，再点确定']
        ),
        Link(
          { source: BAIMIAO_INTENT },
          [
            Text(
              {
                style: {
                  display: 'block',
                  textAlign: 'center',
                  color: '#fff',
                  background: '#177b77',
                  borderRadius: '12px',
                  padding: '13px',
                  marginBottom: '8px',
                  fontSize: '15px',
                  fontWeight: '700'
                }
              },
              ['用手机浏览器打开白描']
            )
          ]
        ),
        Link(
          { source: BAIMIAO_URL },
          [
            Text(
              {
                style: {
                  display: 'block',
                  textAlign: 'center',
                  color: '#177b77',
                  fontSize: '13px',
                  marginBottom: '14px'
                }
              },
              ['浏览器打不开时，再点这里']
            )
          ]
        ),
        TextInput({
          label: '点这里粘贴识别文字',
          settingsKey: 'pasteText',
          multiline: true,
          rows: 8,
          placeholder: '弹出输入框后，长按并选择“粘贴”，再点确定',
          maxLength: 4000,
          labelStyle: {
            color: '#177b77',
            fontSize: '18px',
            fontWeight: '700'
          },
          subStyle: {
            color: '#687583',
            fontSize: '13px',
            marginTop: '8px',
            marginBottom: '14px'
          },
          onChange: (value) => this.acceptPaste(value)
        }),
        Button({
          label: '解析并同步到手表',
          style: {
            width: '100%',
            marginBottom: '12px',
            color: '#fff',
            background: '#2bb0a6',
            borderRadius: '10px',
            padding: '11px',
            fontSize: '14px',
            fontWeight: '700'
          },
          onClick: () => this.addFromRaw()
        }),
        Text(
          {
            style: {
              display: 'block',
              fontSize: '13px',
              lineHeight: '1.4',
              marginBottom: '14px',
              padding: '10px 12px',
              color: '#23665f',
              background: '#eaf7f5',
              borderRadius: '10px'
            }
          },
          [this.state.notice]
        ),
        Text(
          {
            style: {
              display: 'block',
              fontSize: '16px',
              fontWeight: '700',
              color: '#17212b',
              marginBottom: '9px'
            }
          },
          [`已保存行程 · ${this.state.trips.length}`]
        ),
        tripViews.length
          ? View({}, tripViews)
          : Text(
              {
                style: {
                  display: 'block',
                  textAlign: 'center',
                  color: '#8995a1',
                  background: '#fff',
                  borderRadius: '12px',
                  padding: '22px'
                }
              },
              ['还没有行程']
            )
      ]
    )
  }
})
