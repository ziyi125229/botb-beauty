/** 本地日期 YYYY-MM-DD */
export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getTodayDate(): string {
  return formatDate(new Date())
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function addMinutesToTime(time: string, minutes: number): string {
  return minutesToTime(timeToMinutes(time) + minutes)
}

export function rangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const a0 = timeToMinutes(startA)
  const a1 = timeToMinutes(endA)
  const b0 = timeToMinutes(startB)
  const b1 = timeToMinutes(endB)
  return a0 < b1 && b0 < a1
}

export function isDateBefore(dateA: string, dateB: string): boolean {
  return dateA < dateB
}

export function isPastDateTime(date: string, startTime: string, now = new Date()): boolean {
  const today = formatDate(now)
  if (date < today) return true
  if (date > today) return false
  return timeToMinutes(startTime) <= now.getHours() * 60 + now.getMinutes()
}

export function formatDisplayDate(dateStr: string, today = getTodayDate()): string {
  if (dateStr === today) return `今天（${dateStr}）`
  if (dateStr === addDays(today, 1)) return `明天（${dateStr}）`
  if (dateStr === addDays(today, 2)) return `后天（${dateStr}）`
  return dateStr
}

export function nowTimeLabel(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export function nowISO(): string {
  return new Date().toISOString()
}

/**
 * 解析相对/绝对日期。无法可靠解析时返回 null。
 */
export function parseUserDate(
  text: string,
  today = getTodayDate(),
): { date: string; confidence: 'high' | 'low' } | null {
  const t = text.trim()

  if (/今天|今日/.test(t)) {
    return { date: today, confidence: 'high' }
  }
  if (/明天|明日/.test(t)) {
    return { date: addDays(today, 1), confidence: 'high' }
  }
  if (/后天/.test(t)) {
    return { date: addDays(today, 2), confidence: 'high' }
  }

  const iso = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const y = Number(iso[1])
    const m = String(Number(iso[2])).padStart(2, '0')
    const d = String(Number(iso[3])).padStart(2, '0')
    return { date: `${y}-${m}-${d}`, confidence: 'high' }
  }

  const md = t.match(/(\d{1,2})月(\d{1,2})日/)
  if (md) {
    const y = new Date().getFullYear()
    const m = String(Number(md[1])).padStart(2, '0')
    const d = String(Number(md[2])).padStart(2, '0')
    return { date: `${y}-${m}-${d}`, confidence: 'high' }
  }

  // 「下周一」等暂不猜测
  if (/下周|下个月|周末|周一|周二|周三|周四|周五|周六|周日/.test(t)) {
    return null
  }

  return null
}

/** 从文本提取时间，如 14:00 / 下午四点 / 4点 */
export function parseUserTime(text: string): string | null {
  const colon = text.match(/(\d{1,2}):(\d{2})/)
  if (colon) {
    const h = Number(colon[1])
    const m = Number(colon[2])
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }

  const cnMap: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
    十一: 11,
    十二: 12,
  }

  const afternoon = /下午|傍晚/.test(text)
  const morning = /上午|早上|早晨/.test(text)
  const evening = /晚上|晚/.test(text)

  const cn = text.match(/(十[一二]?|[一二两三四五六七八九十])\s*点/)
  if (cn) {
    let h = cnMap[cn[1]] ?? 0
    if (afternoon && h < 12) h += 12
    if (evening && h < 12 && h !== 12) h += 12
    if (morning && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:00`
  }

  const num = text.match(/(\d{1,2})\s*点/)
  if (num) {
    let h = Number(num[1])
    if (afternoon && h < 12) h += 12
    if (evening && h < 12) h += 12
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, '0')}:00`
  }

  return null
}

export function prefersAfternoon(text: string): boolean {
  return /下午|傍晚|晚上/.test(text)
}

export function prefersMorning(text: string): boolean {
  return /上午|早上|早晨/.test(text)
}
