import {
  formatServicePrice,
  matchServiceFromText,
  services,
  storeInfo,
} from '../data/mockData'
import type {
  Appointment,
  BookingDraft,
  ChatAction,
  ChatMessage,
  Customer,
  TimeSlotOption,
} from '../types'
import { getAvailableSlots, getServiceById } from './bookingService'
import {
  formatDisplayDate,
  getTodayDate,
  nowTimeLabel,
  parseUserDate,
  parseUserTime,
  prefersAfternoon,
  prefersMorning,
} from './dateUtils'

export function createEmptyDraft(): BookingDraft {
  return { step: 'idle' }
}

export function isBookingIntent(text: string): boolean {
  if (/改时间|改约|改期|取消预约/.test(text) && !/预约/.test(text)) {
    return false
  }
  return (
    /我想预约|帮我预约|预约一次|预约个|预约一下|想约|有空位|有没有空|帮我约|预约护理|约明|约今|约后/.test(
      text,
    ) ||
    (/预约/.test(text) && /护理|项目|清洁|补水|养护|肩颈|咨询/.test(text)) ||
    (/有空|空位|档期/.test(text) && /明天|今天|后天|下午|上午|点/.test(text))
  )
}

function msg(
  content: string,
  actions?: ChatAction[],
): Omit<ChatMessage, 'id'> {
  return {
    role: 'assistant',
    content,
    time: nowTimeLabel(),
    actions,
  }
}

function serviceActions(): ChatAction[] {
  return services.map((s) => ({
    type: 'select_service' as const,
    serviceId: s.id,
    label: `${s.name}（${formatServicePrice(s)}）`,
  }))
}

function slotActions(slots: TimeSlotOption[]): ChatAction[] {
  return slots.slice(0, 8).map((s) => ({
    type: 'select_slot' as const,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    staffId: s.staffId,
    staffName: s.staffName,
    label: s.label,
  }))
}

function confirmActions(): ChatAction[] {
  return [
    { type: 'confirm_booking' },
    { type: 'reselect_booking' },
    { type: 'cancel_booking_flow' },
  ]
}

function buildSummaryText(draft: BookingDraft, customerName: string): string {
  const service = draft.serviceId ? getServiceById(draft.serviceId) : undefined
  const price = service ? formatServicePrice(service) : '—'
  return [
    '请确认以下预约信息（确认前不会创建正式预约）：',
    `客户：${customerName}`,
    `项目：${service?.name ?? '—'}（${price}）`,
    `日期：${draft.appointmentDate ? formatDisplayDate(draft.appointmentDate) : '—'}`,
    `时间：${draft.startTime ?? '—'}–${draft.endTime ?? '—'}`,
    `技师：${draft.staffName ?? '—'}`,
    '',
    '请点击「确认预约」完成，或「重新选择」调整信息。',
  ].join('\n')
}

function offerSlots(
  appointments: Appointment[],
  draft: BookingDraft,
  date: string,
  text: string,
): { draft: BookingDraft; reply: Omit<ChatMessage, 'id'> } {
  const timeOfDay = prefersAfternoon(text)
    ? 'afternoon'
    : prefersMorning(text)
      ? 'morning'
      : 'any'
  const preferredTime = parseUserTime(text) ?? undefined

  let slots = getAvailableSlots({
    appointments,
    serviceId: draft.serviceId!,
    date,
    preferredStartTime: preferredTime,
    timeOfDay: preferredTime ? 'any' : timeOfDay,
    limit: 8,
  })

  // 指定时间不可用时，退回当天其他时段
  if (preferredTime && slots.length === 0) {
    slots = getAvailableSlots({
      appointments,
      serviceId: draft.serviceId!,
      date,
      timeOfDay,
      limit: 8,
    })
  }

  if (slots.length === 0) {
    const today = getTodayDate()
    const tomorrowDate = (() => {
      const t = new Date()
      t.setDate(t.getDate() + 1)
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    })()
    const fallbackDate = date === today ? tomorrowDate : today
    const other = getAvailableSlots({
      appointments,
      serviceId: draft.serviceId!,
      date: fallbackDate,
      limit: 6,
    })

    if (other.length === 0) {
      return {
        draft: { ...draft, step: 'collect_date', appointmentDate: undefined },
        reply: msg(
          `「${getServiceById(draft.serviceId!)?.name}」在 ${formatDisplayDate(date)} 暂无可用时段。请换一个日期（如「明天」「后天」），或稍后再试。`,
        ),
      }
    }

    const nextDraft: BookingDraft = {
      ...draft,
      step: 'select_slot',
      appointmentDate: other[0].date,
      offeredSlots: other,
      startTime: undefined,
      endTime: undefined,
      staffId: undefined,
      staffName: undefined,
    }
    return {
      draft: nextDraft,
      reply: msg(
        `「${getServiceById(draft.serviceId!)?.name}」在 ${formatDisplayDate(date)} 暂无空档。以下是 ${formatDisplayDate(other[0].date)} 的可用时段，请选择：`,
        [...slotActions(other), { type: 'cancel_booking_flow' }],
      ),
    }
  }

  const nextDraft: BookingDraft = {
    ...draft,
    step: 'select_slot',
    appointmentDate: date,
    offeredSlots: slots,
    startTime: undefined,
    endTime: undefined,
    staffId: undefined,
    staffName: undefined,
  }

  const hint = preferredTime
    ? `已按您提到的时间优先查询。`
    : timeOfDay === 'afternoon'
      ? '已优先展示下午时段。'
      : timeOfDay === 'morning'
        ? '已优先展示上午时段。'
        : ''

  return {
    draft: nextDraft,
    reply: msg(
      `「${getServiceById(draft.serviceId!)?.name}」在 ${formatDisplayDate(date)} 的可用时段如下。${hint}\n请选择一个时间：`,
      [...slotActions(slots), { type: 'cancel_booking_flow' }],
    ),
  }
}

export interface BookingFlowContext {
  appointments: Appointment[]
  customer?: Customer
  sessionCustomerName: string
}

export interface BookingFlowResult {
  draft: BookingDraft
  replies: Omit<ChatMessage, 'id'>[]
  createdAppointment?: Appointment
  /** 由上层执行真正的 createAppointment */
  pendingCreate?: {
    customerId: string
    customerName: string
    phone?: string
    serviceId: string
    appointmentDate: string
    startTime: string
    staffId: string
  }
}

function afterSlotSelected(
  draft: BookingDraft,
  ctx: BookingFlowContext,
): BookingFlowResult {
  const customer = ctx.customer
  if (customer && customer.id && customer.name) {
    const withCustomer: BookingDraft = {
      ...draft,
      step: 'confirm',
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone,
      isNewCustomer: false,
      confirming: false,
    }
    return {
      draft: withCustomer,
      replies: [
        msg(buildSummaryText(withCustomer, customer.name), confirmActions()),
      ],
    }
  }

  return {
    draft: { ...draft, step: 'collect_customer', isNewCustomer: true },
    replies: [
      msg(
        '当前会话未绑定完整客户档案。请发送：姓名，手机号（例如：张三，13800138000）。',
        [{ type: 'cancel_booking_flow' }],
      ),
    ],
  }
}

/**
 * 处理预约流程中的用户文本。
 */
export function processBookingText(
  text: string,
  draft: BookingDraft,
  ctx: BookingFlowContext,
): BookingFlowResult {
  const trimmed = text.trim()

  if (/^(取消预约流程|退出预约|不约了|取消)$/.test(trimmed)) {
    return {
      draft: createEmptyDraft(),
      replies: [msg('已退出预约流程，不会创建任何预约记录。如需预约可随时再告诉我。')],
    }
  }

  // 确认阶段的文本确认
  if (draft.step === 'confirm') {
    if (/^(确认|确认预约|是的|好的|可以|确定)$/.test(trimmed)) {
      if (draft.confirming) {
        return {
          draft,
          replies: [msg('正在处理中，请勿重复确认。')],
        }
      }
      if (
        !draft.serviceId ||
        !draft.appointmentDate ||
        !draft.startTime ||
        !draft.staffId ||
        !draft.customerName
      ) {
        return {
          draft: { ...draft, step: 'collect_service' },
          replies: [msg('预约信息不完整，请重新选择项目。', serviceActions())],
        }
      }
      return {
        draft: { ...draft, confirming: true },
        replies: [],
        pendingCreate: {
          customerId: draft.customerId || `temp-${Date.now()}`,
          customerName: draft.customerName,
          phone: draft.phone,
          serviceId: draft.serviceId,
          appointmentDate: draft.appointmentDate,
          startTime: draft.startTime,
          staffId: draft.staffId,
        },
      }
    }
    if (/重新选择|重选|换一个/.test(trimmed)) {
      const reset: BookingDraft = {
        step: 'collect_service',
        customerId: draft.customerId,
        customerName: draft.customerName,
        phone: draft.phone,
      }
      return {
        draft: reset,
        replies: [
          msg('好的，我们重新选择。请选择护理项目：', [
            ...serviceActions(),
            { type: 'cancel_booking_flow' },
          ]),
        ],
      }
    }
  }

  // 收集客户
  if (draft.step === 'collect_customer') {
    const parts = trimmed.split(/[,，\s]+/).filter(Boolean)
    const phonePart = parts.find((p) => /\d{7,}/.test(p))
    const namePart = parts.find((p) => !/\d{7,}/.test(p))
    if (!namePart || namePart.length < 2) {
      return {
        draft,
        replies: [msg('请提供有效姓名，格式：姓名，手机号')],
      }
    }
    const withCustomer: BookingDraft = {
      ...draft,
      step: 'confirm',
      customerName: namePart,
      phone: phonePart,
      customerId: draft.customerId,
      isNewCustomer: true,
      confirming: false,
    }
    return {
      draft: withCustomer,
      replies: [
        msg(buildSummaryText(withCustomer, namePart), confirmActions()),
      ],
    }
  }

  // 选择时段：用户直接说时间
  if (draft.step === 'select_slot' && draft.serviceId && draft.appointmentDate) {
    const time = parseUserTime(trimmed)
    if (time && draft.offeredSlots) {
      const hit = draft.offeredSlots.find((s) => s.startTime === time)
      if (hit) {
        const next = {
          ...draft,
          startTime: hit.startTime,
          endTime: hit.endTime,
          staffId: hit.staffId,
          staffName: hit.staffName,
        }
        return afterSlotSelected(next, ctx)
      }
      return {
        draft,
        replies: [
          msg(
            `未在可选列表中找到 ${time}。请点击上方时段按钮，或换一个时间。`,
            [...slotActions(draft.offeredSlots as TimeSlotOption[]), { type: 'cancel_booking_flow' }],
          ),
        ],
      }
    }
  }

  // 解析项目
  let nextDraft = { ...draft }
  const service = matchServiceFromText(trimmed)
  if (service) {
    nextDraft = {
      ...nextDraft,
      serviceId: service.id,
      startTime: undefined,
      endTime: undefined,
      staffId: undefined,
      staffName: undefined,
      offeredSlots: undefined,
    }
  }

  // 解析日期
  const parsedDate = parseUserDate(trimmed)
  if (parsedDate) {
    if (parsedDate.date < getTodayDate()) {
      return {
        draft: { ...nextDraft, step: nextDraft.serviceId ? 'collect_date' : 'collect_service' },
        replies: [msg('不能预约过去的日期，请重新选择（如「明天」「后天」）。')],
      }
    }
    nextDraft = {
      ...nextDraft,
      appointmentDate: parsedDate.date,
      startTime: undefined,
      endTime: undefined,
      staffId: undefined,
      staffName: undefined,
      offeredSlots: undefined,
    }
  } else if (
    /月|周|号/.test(trimmed) &&
    !service &&
    draft.step !== 'idle' &&
    /预约|约|日期|时间/.test(trimmed)
  ) {
    return {
      draft: { ...nextDraft, step: 'collect_date' },
      replies: [
        msg(
          '抱歉，这个日期我无法可靠解析。请使用「今天」「明天」「后天」或「2026-10-20」这类格式。',
        ),
      ],
    }
  }

  // 启动流程
  if (nextDraft.step === 'idle' || !nextDraft.serviceId) {
    if (!nextDraft.serviceId) {
      return {
        draft: { ...nextDraft, step: 'collect_service' },
        replies: [
          msg(
            `好的，我来帮您预约（演示流程，营业时间 ${storeInfo.openTime}–${storeInfo.closeTime}）。请先选择护理项目：`,
            [...serviceActions(), { type: 'cancel_booking_flow' }],
          ),
        ],
      }
    }
  }

  if (nextDraft.serviceId && !nextDraft.appointmentDate) {
    return {
      draft: { ...nextDraft, step: 'collect_date' },
      replies: [
        msg(
          `已选择「${getServiceById(nextDraft.serviceId)?.name}」。请告诉我预约日期，例如「明天」「后天」或具体日期。`,
          [{ type: 'cancel_booking_flow' }],
        ),
      ],
    }
  }

  if (nextDraft.serviceId && nextDraft.appointmentDate) {
    const offered = offerSlots(
      ctx.appointments,
      nextDraft,
      nextDraft.appointmentDate,
      trimmed,
    )
    return { draft: offered.draft, replies: [offered.reply] }
  }

  return {
    draft: nextDraft,
    replies: [msg('请继续补充预约所需的项目或日期信息。')],
  }
}

export function applyBookingAction(
  action: ChatAction,
  draft: BookingDraft,
  ctx: BookingFlowContext,
): BookingFlowResult {
  if (action.type === 'cancel_booking_flow') {
    return {
      draft: createEmptyDraft(),
      replies: [msg('已取消本次预约流程，未创建任何预约。')],
    }
  }

  if (action.type === 'reselect_booking') {
    return {
      draft: {
        step: 'collect_service',
        customerId: draft.customerId,
        customerName: draft.customerName,
        phone: draft.phone,
      },
      replies: [
        msg('好的，请重新选择护理项目：', [
          ...serviceActions(),
          { type: 'cancel_booking_flow' },
        ]),
      ],
    }
  }

  if (action.type === 'select_service') {
    const next: BookingDraft = {
      ...draft,
      step: draft.appointmentDate ? 'select_slot' : 'collect_date',
      serviceId: action.serviceId,
      startTime: undefined,
      endTime: undefined,
      staffId: undefined,
      staffName: undefined,
      offeredSlots: undefined,
    }
    if (next.appointmentDate) {
      const offered = offerSlots(
        ctx.appointments,
        next,
        next.appointmentDate,
        '',
      )
      return { draft: offered.draft, replies: [offered.reply] }
    }
    return {
      draft: next,
      replies: [
        msg(
          `已选择「${getServiceById(action.serviceId)?.name}」。请告诉我预约日期（今天 / 明天 / 后天）。`,
          [{ type: 'cancel_booking_flow' }],
        ),
      ],
    }
  }

  if (action.type === 'select_slot') {
    const next: BookingDraft = {
      ...draft,
      appointmentDate: action.date,
      startTime: action.startTime,
      endTime: action.endTime,
      staffId: action.staffId,
      staffName: action.staffName,
    }
    return afterSlotSelected(next, ctx)
  }

  if (action.type === 'confirm_booking') {
    if (draft.confirming) {
      return {
        draft,
        replies: [msg('正在处理中，请勿重复点击确认。')],
      }
    }
    if (
      !draft.serviceId ||
      !draft.appointmentDate ||
      !draft.startTime ||
      !draft.staffId ||
      !draft.customerName
    ) {
      return {
        draft: { ...draft, step: 'collect_service' },
        replies: [msg('预约信息不完整，请重新选择。', serviceActions())],
      }
    }
    return {
      draft: { ...draft, confirming: true },
      replies: [],
      pendingCreate: {
        customerId: draft.customerId || `temp-${Date.now()}`,
        customerName: draft.customerName,
        phone: draft.phone,
        serviceId: draft.serviceId,
        appointmentDate: draft.appointmentDate,
        startTime: draft.startTime,
        staffId: draft.staffId,
      },
    }
  }

  return { draft, replies: [msg('暂无法处理该操作。')] }
}

export function describeLatestAppointment(apt: Appointment): string {
  return [
    `您有一条预约记录：`,
    `项目：${apt.serviceName}`,
    `日期：${formatDisplayDate(apt.appointmentDate)}`,
    `时间：${apt.startTime}–${apt.endTime}`,
    `技师：${apt.staffName}`,
    `状态：${apt.status === 'booked' ? '已预约' : apt.status === 'pending_confirmation' ? '待确认' : apt.status === 'cancelled' ? '已取消' : '已完成'}`,
  ].join('\n')
}
