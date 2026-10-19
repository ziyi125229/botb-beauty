export type PageKey =
  | 'overview'
  | 'reception'
  | 'appointments'
  | 'customers'
  | 'marketing'

/** 统一预约状态（英文枚举，UI 展示中文标签） */
export type AppointmentStatus =
  | 'pending_confirmation'
  | 'booked'
  | 'completed'
  | 'cancelled'

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending_confirmation: '待确认',
  booked: '已预约',
  completed: '已完成',
  cancelled: '已取消',
}

/** 占用档期的有效状态 */
export const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'pending_confirmation',
  'booked',
]

/** 跟进工作状态（与意向等级分开） */
export type FollowUpStatus = '待跟进' | '跟进中' | '已预约' | '暂缓'

/** 客户意向等级 */
export type IntentLevel = '高意向' | '观望' | '低意向' | '未知'

/** @deprecated 兼容旧字段名，等同 IntentLevel */
export type IntentTag = IntentLevel

export interface StatCardData {
  id: string
  label: string
  value: number
  description: string
  icon: 'consult' | 'appointment' | 'followup' | 'todo'
}

export interface ServiceItem {
  id: string
  name: string
  price: number
  durationMinutes: number
  description: string
  aliases?: string[]
}

export interface Technician {
  id: string
  name: string
  specialty: string
  serviceIds: string[]
  workStart: string
  workEnd: string
}

export interface Appointment {
  appointmentId: string
  customerId: string
  customerName: string
  serviceId: string
  serviceName: string
  durationMinutes: number
  appointmentDate: string
  startTime: string
  endTime: string
  staffId: string
  staffName: string
  status: AppointmentStatus
  createdAt: string
  remark: string
  phone?: string
  source?: 'ai' | 'manual'
}

export interface Customer {
  /** 即 customerId */
  id: string
  name: string
  phone: string
  /** 首次咨询时间 */
  firstConsultAt?: string
  focusProjectId: string
  focusProject: string
  /** 意向等级（与跟进状态分离） */
  intentLevel: IntentLevel
  /** 意向判定原因 */
  intentReason: string
  /** 人工修改过意向则不再被规则覆盖 */
  intentManual?: boolean
  /** 客户标签 */
  tags: string[]
  /** 最近咨询时间 */
  lastConsultAt?: string
  lastVisit?: string
  lastAppointmentAt?: string
  followUpStatus: FollowUpStatus
  notes?: string
}

export type FollowUpTaskStatus = '待跟进' | '已完成'

/** 跟进事项来源分类，避免与客户意向混淆 */
export type FollowUpTaskCategory = 'customer_followup' | 'manual_review'

export interface FollowUpTask {
  id: string
  customerId: string
  customerName: string
  /** 跟进事项标题 */
  title: string
  /** 备注 / 原因说明 */
  note: string
  createdAt: string
  /** 计划跟进日期（可选） */
  dueDate?: string
  status: FollowUpTaskStatus
  /** 默认客户跟进；医疗类问题为转人工 */
  category?: FollowUpTaskCategory
}

export interface ReceptionRecord {
  id: string
  customerId: string
  customerName: string
  time: string
  summary: string
  topic: '项目咨询' | '价格询问' | '预约意向' | '售后跟进'
}

export type ChatAction =
  | { type: 'select_service'; serviceId: string; label: string }
  | {
      type: 'select_slot'
      date: string
      startTime: string
      endTime: string
      staffId: string
      staffName: string
      label: string
    }
  | { type: 'confirm_booking' }
  | { type: 'reselect_booking' }
  | { type: 'cancel_booking_flow' }

export interface ChatMessage {
  id: string
  role: 'customer' | 'assistant'
  content: string
  /** HH:mm */
  time: string
  /** YYYY-MM-DD，用于今日咨询统计 */
  date?: string
  actions?: ChatAction[]
}

export interface ChatSession {
  id: string
  customerId: string
  customerName: string
  lastMessage: string
  /** HH:mm 展示用 */
  time: string
  /** ISO 或可排序时间戳，用于最近接待排序 */
  lastActivityAt?: string
  unread?: number
  status: '进行中' | '已结束'
  messages: ChatMessage[]
  latestAppointmentId?: string
}

export interface StoreInfo {
  name: string
  brand: string
  businessStatus: '营业中' | '休息中'
  address: string
  phone: string
  businessHours: string
  openTime: string
  closeTime: string
}

export type BookingFlowStep =
  | 'idle'
  | 'collect_service'
  | 'collect_date'
  | 'select_slot'
  | 'collect_customer'
  | 'confirm'

export interface BookingDraft {
  step: BookingFlowStep
  serviceId?: string
  appointmentDate?: string
  startTime?: string
  endTime?: string
  staffId?: string
  staffName?: string
  customerId?: string
  customerName?: string
  phone?: string
  isNewCustomer?: boolean
  offeredSlots?: Array<{
    date: string
    startTime: string
    endTime: string
    staffId: string
    staffName: string
  }>
  confirming?: boolean
}

export interface TimeSlotOption {
  date: string
  startTime: string
  endTime: string
  staffId: string
  staffName: string
  label: string
}

export interface CustomerUpdateInput {
  name?: string
  phone?: string
  focusProjectId?: string
  focusProject?: string
  intentLevel?: IntentLevel
  intentReason?: string
  intentManual?: boolean
  tags?: string[]
  followUpStatus?: FollowUpStatus
  notes?: string
  lastConsultAt?: string
  firstConsultAt?: string
  lastAppointmentAt?: string
  lastVisit?: string
}

/** 营销场景类型 */
export type MarketingSceneType =
  | 'new_customer_campaign'
  | 'moments_copy'
  | 'old_customer_revisit'
  | 'new_customer_invite'
  | 'festival_campaign'

export type MarketingTone = '专业可信' | '亲切温和' | '轻松活泼'

export interface MarketingSection {
  key: string
  title: string
  content: string
}

export interface MarketingGenerateInput {
  scene: MarketingSceneType
  prompt: string
  goal?: string
  audience?: string
  serviceId?: string
  activityDate?: string
  promoRule?: string
  tone?: MarketingTone
  customerId?: string
  variant?: number
}

export interface MarketingGeneratedContent {
  scene: MarketingSceneType
  sceneLabel: string
  serviceId?: string
  serviceName?: string
  sections: MarketingSection[]
  fullText: string
  warnings: string[]
  generatedAt: string
}

/** 已保存的营销方案 */
export interface MarketingPlan {
  planId: string
  createdAt: string
  updatedAt: string
  scene: MarketingSceneType
  sceneLabel: string
  serviceId?: string
  serviceName?: string
  originalPrompt: string
  /** 原始生成全文 */
  generatedContent: string
  /** 用户编辑后的全文；有值时优先展示 */
  editedContent?: string
  sections: MarketingSection[]
  warnings: string[]
  customerId?: string
  customerName?: string
  goal?: string
  audience?: string
  activityDate?: string
  promoRule?: string
  tone?: MarketingTone
}
