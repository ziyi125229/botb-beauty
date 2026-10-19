import type { ChatSession, Customer } from '../types'
import { getTodayDate, nowTimeLabel } from '../lib/dateUtils'

/** 路演贯穿客户（与普通客户同一数据模型） */
export const PRESENTATION_CUSTOMER_ID = 'cus-lin'
export const PRESENTATION_SESSION_ID = 'chat-lin'
export const PRESENTATION_SERVICE_ID = 'svc-clean-hydrate'
export const PRESENTATION_SERVICE_NAME = '基础清洁补水'

export const PRESENTATION_STEPS = [
  {
    step: 1,
    title: '客户咨询',
    detail: '在 AI 接待中询问「基础清洁补水」价格',
  },
  {
    step: 2,
    title: '预约确认',
    detail: '按流程选择日期、时段并确认预约',
  },
  {
    step: 3,
    title: '客户档案',
    detail: '在客户管理中查看林女士的意向与预约历史',
  },
  {
    step: 4,
    title: '营销方案',
    detail: '在营销助手生成基础清洁补水拓客与朋友圈文案',
  },
  {
    step: 5,
    title: '经营概览',
    detail: '返回概览查看咨询量、预约量等真实联动变化',
  },
] as const

export function createPresentationCustomer(): Customer {
  const today = getTodayDate()
  return {
    id: PRESENTATION_CUSTOMER_ID,
    name: '林女士',
    phone: '136****0918',
    firstConsultAt: today,
    focusProjectId: PRESENTATION_SERVICE_ID,
    focusProject: PRESENTATION_SERVICE_NAME,
    intentLevel: '未知',
    intentReason: '新客建档，尚未完成有效咨询，暂无足够信息判定意向',
    tags: ['新客'],
    lastConsultAt: today,
    followUpStatus: '待跟进',
    notes: '关注基础清洁补水，尚未预约。可用于完整业务流程演示。',
  }
}

/** 干净会话：仅欢迎语，便于路演从询价开始 */
export function createPresentationSession(): ChatSession {
  const today = getTodayDate()
  const time = nowTimeLabel()
  return {
    id: PRESENTATION_SESSION_ID,
    customerId: PRESENTATION_CUSTOMER_ID,
    customerName: '林女士',
    lastMessage: '您好，我是悦颜皮肤管理中心的 AI 接待助手。',
    time,
    lastActivityAt: `${today}T${time}:00`,
    status: '进行中',
    unread: 0,
    messages: [
      {
        id: 'chat-lin-m0',
        role: 'assistant',
        content:
          '您好，我是悦颜皮肤管理中心的 AI 接待助手。可以帮您查询项目价格、营业时间，或完成预约。请问想了解哪一项护理？',
        time,
        date: today,
      },
    ],
  }
}

export interface PresentationFocus {
  sessionId?: string
  customerId?: string
  serviceId?: string
  /** 递增 token，确保重复点击「开始演示」仍能触发页面聚焦 */
  token: number
}
