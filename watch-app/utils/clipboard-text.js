const TICKET_RE = /订单号|乘车日期|\b[GDCZTK]\d{1,4}\b/i

export function htmlToText(value) {
  return String(value || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|tr|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => {
      const number = Number(code)
      return number > 0 ? String.fromCharCode(number) : ''
    })
    .replace(/\u0000/g, '')
    .trim()
}

export function applyClipboardText(current, text) {
  const value = htmlToText(text)
  if (!value) {
    return { raw: current || '', notice: '剪贴板是空的', filled: false }
  }
  const ticket = value.length > 12 && TICKET_RE.test(value)
  return {
    raw: value,
    notice: ticket ? '已从剪贴板填入，请核对后同步' : '已填入剪贴板文字，请核对后同步',
    filled: true
  }
}
