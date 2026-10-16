import { getDeviceInfo, SCREEN_SHAPE_SQUARE } from '@zos/device'
import { px } from '@zos/utils'
import ui from '@zos/ui'

export function layout() {
  const { width, height, screenShape } = getDeviceInfo()
  const square = screenShape === SCREEN_SHAPE_SQUARE
  const pad = square ? px(18) : px(42)
  const btnY = height - (square ? px(58) : px(74))
  const btnW = Math.floor((width - pad * 2 - px(12)) / 2)
  const listY = square ? px(72) : px(90)
  const listW = width - pad * 2
  const itemHeight = px(88)
  const itemConfig = (typeId, background) => ({
    type_id: typeId,
    item_height: itemHeight,
    item_bg_color: background,
    item_bg_radius: px(14),
    text_view: [
      {
        x: px(14),
        y: px(10),
        w: listW - px(28),
        h: px(31),
        key: 'main',
        action: true,
        color: 0xffffff,
        text_size: px(20),
        align_h: ui.align.CENTER_H
      },
      {
        x: px(14),
        y: px(44),
        w: listW - px(28),
        h: px(28),
        key: 'route',
        action: true,
        color: 0xc7d4dd,
        text_size: px(17),
        align_h: ui.align.CENTER_H
      }
    ],
    text_view_count: 2
  })
  return {
    square,
    width,
    height,
    pad,
    title: {
      x: pad,
      y: square ? px(10) : px(28),
      w: width - pad * 2,
      h: px(34),
      color: 0xffffff,
      text_size: px(26),
      align_h: ui.align.CENTER_H,
      align_v: ui.align.CENTER_V,
      text: '高铁行程'
    },
    subtitle: {
      x: pad,
      y: square ? px(44) : px(62),
      w: width - pad * 2,
      h: px(24),
      color: 0x8aa0b2,
      text_size: px(16),
      align_h: ui.align.CENTER_H,
      align_v: ui.align.CENTER_V
    },
    list: {
      x: pad,
      y: listY,
      w: listW,
      h: btnY - px(38) - listY,
      item_space: px(8),
      item_config: [itemConfig(1, 0x176b68), itemConfig(2, 0x253847)],
      item_config_count: 2,
      data_array: [],
      data_count: 0,
      data_type_config: [],
      data_type_config_count: 0,
      on_page: 0
    },
    detail: {
      x: pad + px(8),
      y: listY + px(4),
      w: width - (pad + px(8)) * 2,
      h: px(205),
      color: 0xffffff,
      text_size: px(24),
      align_h: ui.align.CENTER_H,
      align_v: ui.align.CENTER_V,
      text_style: ui.text_style.WRAP
    },
    backBtn: {
      x: pad + px(28),
      y: listY + px(218),
      w: width - (pad + px(28)) * 2,
      h: px(42),
      radius: px(12),
      normal_color: 0x253847,
      press_color: 0x2bb0a6,
      color: 0xffffff,
      text_size: px(18),
      text: '返回行程列表'
    },
    status: {
      x: pad,
      y: btnY - px(30),
      w: width - pad * 2,
      h: px(22),
      color: 0x8aa0b2,
      text_size: px(14),
      align_h: ui.align.CENTER_H,
      align_v: ui.align.CENTER_V,
      text: ''
    },
    refreshBtn: {
      x: pad,
      y: btnY,
      w: btnW,
      h: px(42),
      radius: px(12),
      normal_color: 0x2bb0a6,
      press_color: 0x1f8f87,
      color: 0xffffff,
      text: '刷新'
    },
    clearBtn: {
      x: pad + btnW + px(12),
      y: btnY,
      w: btnW,
      h: px(42),
      radius: px(12),
      normal_color: 0x3a4654,
      press_color: 0x2a3440,
      color: 0xffffff,
      text: '清除'
    }
  }
}
