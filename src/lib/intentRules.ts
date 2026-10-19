import type { IntentLevel } from '../types'
import { isBookingIntent } from './bookingFlow'

export interface IntentSignal {
  text?: string
  hasBookingIntent?: boolean
  selectedRecentSlot?: boolean
  choseServiceForExperience?: boolean
  askedPriceOnly?: boolean
  comparingOrHesitating?: boolean
  noClearNeed?: boolean
}

export interface IntentJudgement {
  level: IntentLevel
  reason: string
}

/**
 * 可解释的本地意向规则。
 * 注意：仅询问一次价格 ≠ 低意向。
 */
export function evaluateIntent(signal: IntentSignal): IntentJudgement {
  const text = signal.text?.trim() ?? ''

  const highByText =
    /我想预约|帮我预约|预约一次|明确预约|希望体验|我想体验|约明|约今|约后|到店体验/.test(
      text,
    ) || isBookingIntent(text)

  if (
    signal.hasBookingIntent ||
    signal.selectedRecentSlot ||
    signal.choseServiceForExperience ||
    highByText
  ) {
    const reasons: string[] = []
    if (signal.hasBookingIntent || highByText) reasons.push('明确表达预约需求')
    if (signal.selectedRecentSlot) reasons.push('主动选择近期到店时间')
    if (signal.choseServiceForExperience) reasons.push('明确希望体验具体项目')
    return {
      level: '高意向',
      reason: reasons.join('；') || '表达了明确的预约/体验意向',
    }
  }

  const watching =
    signal.comparingOrHesitating ||
    /再看看|考虑一下|比较一下|暂时|最近没时间|先了解|对比|贵不贵|多少钱/.test(
      text,
    )

  // 有明确项目兴趣 + 仍在比较/观望
  if (watching && !signal.noClearNeed) {
    return {
      level: '观望',
      reason: '对项目有兴趣，但仍在比较价格、时间或服务内容，或表示暂需考虑',
    }
  }

  // 仅问价格且未表达预约：观望，而不是低意向
  if (signal.askedPriceOnly) {
    return {
      level: '观望',
      reason: '咨询了项目价格，尚无明确预约计划（一次询价不判定为低意向）',
    }
  }

  if (
    signal.noClearNeed ||
    /随便问问|没什么需求|只是看看|路过/.test(text)
  ) {
    return {
      level: '低意向',
      reason: '当前没有明确需求，也未表达预约计划',
    }
  }

  if (!text && !signal.hasBookingIntent) {
    return {
      level: '未知',
      reason: '信息不足，暂无法合理判断意向',
    }
  }

  return {
    level: '未知',
    reason: '已有部分沟通，但线索不足以判定意向等级',
  }
}

/** 将旧版意向标签迁移到新等级 */
export function migrateIntentLevel(raw: unknown): IntentLevel {
  if (raw === '高意向' || raw === '观望' || raw === '低意向' || raw === '未知') {
    return raw
  }
  if (raw === '中意向') return '观望'
  if (raw === '老客复购') return '高意向'
  return '未知'
}
