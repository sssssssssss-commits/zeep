import { getDeviceInfo, SCREEN_SHAPE_SQUARE } from '@zos/device'
import { px } from '@zos/utils'

export function layout() {
  const { width, height, screenShape } = getDeviceInfo()
  const square = screenShape === SCREEN_SHAPE_SQUARE
  const pad = square ? px(16) : px(36)
  const btnY = height - (square ? px(64) : px(90))
  const btnW = Math.floor((width - pad * 2 - px(12)) / 2)
  return {
    square,
    width,
    height,
    pad,
    title: {
      x: pad,
      y: square ? px(12) : px(40),
      w: width - pad * 2,
      h: px(36),
      color: 0xffffff,
      text_size: px(28),
      align_h: 2,
      text: '高铁行程'
    },
    body: {
      x: pad,
      y: square ? px(52) : px(90),
      w: width - pad * 2,
      h: height - (square ? px(160) : px(220)),
      color: 0xe8f1f7,
      text_size: px(22),
      align_h: 2,
      align_v: 1,
      text_style: 2
    },
    status: {
      x: pad,
      y: height - (square ? px(100) : px(130)),
      w: width - pad * 2,
      h: px(28),
      color: 0x8aa0b2,
      text_size: px(16),
      align_h: 2,
      text: ''
    },
    refreshBtn: {
      x: pad,
      y: btnY,
      w: btnW,
      h: px(44),
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
      h: px(44),
      radius: px(12),
      normal_color: 0x3a4654,
      press_color: 0x2a3440,
      color: 0xffffff,
      text: '清除'
    }
  }
}
