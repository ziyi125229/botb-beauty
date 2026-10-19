import { getTodayDate } from './dateUtils'
import type {
  Appointment,
  ChatSession,
  Customer,
  FollowUpTask,
  StatCardData,
} from '../types'

/** 当天有效待到店预约：待确认 + 已预约 */
export function filterTodayActiveAppointments(
  appointments: Appointment[],
  today = getTodayDate(),
): Appointment[] {
  return appointments
    .filter(
      (a) =>
        a.appointmentDate === today &&
        (a.status === 'booked' || a.status === 'pending_confirmation'),
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

/**
 * 今日咨询量：当天至少有一条客户消息的独立会话数。
 * 同一会话多条消息只计 1。
 */
export function countTodayConsultSessions(
  sessions: ChatSession[],
  today = getTodayDate(),
): number {
  return sessions.filter((session) =>
    session.messages.some(
      (m) => m.role === 'customer' && (m.date ? m.date === today : false),
    ),
  ).length
}

/**
 * 待跟进客户：跟进状态为待跟进/跟进中，或存在未完成跟进事项的客户（去重）。
 * 不把「高意向」直接等同于待跟进。
 */
export function getPendingFollowUpCustomers(
  customers: Customer[],
  followUpTasks: FollowUpTask[],
): Customer[] {
  const pendingCustomerIds = new Set(
    followUpTasks
      .filter((t) => t.status === '待跟进')
      .map((t) => t.customerId),
  )

  return customers.filter(
    (c) =>
      c.followUpStatus === '待跟进' ||
      c.followUpStatus === '跟进中' ||
      pendingCustomerIds.has(c.id),
  )
}

/**
 * 待处理事项（去重口径，按事项条目计）：
 * - 未完成跟进事项（含转人工）
 * - 待确认预约
 * 不因同一客户出现在多个列表而重复计事项。
 */
export function countPendingWorkItems(
  followUpTasks: FollowUpTask[],
  appointments: Appointment[],
): { total: number; followUps: number; pendingApts: number; manualReviews: number } {
  const followUps = followUpTasks.filter((t) => t.status === '待跟进')
  const manualReviews = followUps.filter((t) => t.category === 'manual_review')
  const pendingApts = appointments.filter(
    (a) => a.status === 'pending_confirmation',
  )
  return {
    total: followUps.length + pendingApts.length,
    followUps: followUps.length,
    pendingApts: pendingApts.length,
    manualReviews: manualReviews.length,
  }
}

export function getRecentReceptionSessions(
  sessions: ChatSession[],
  limit = 5,
): ChatSession[] {
  return [...sessions]
    .sort((a, b) => {
      const ta = a.lastActivityAt ?? a.time
      const tb = b.lastActivityAt ?? b.time
      return tb.localeCompare(ta)
    })
    .slice(0, limit)
}

export function buildOverviewStats(params: {
  appointments: Appointment[]
  customers: Customer[]
  followUpTasks: FollowUpTask[]
  chatSessions: ChatSession[]
}): StatCardData[] {
  const today = getTodayDate()
  const todayApts = filterTodayActiveAppointments(params.appointments, today)
  const consults = countTodayConsultSessions(params.chatSessions, today)
  const followCustomers = getPendingFollowUpCustomers(
    params.customers,
    params.followUpTasks,
  )
  const pending = countPendingWorkItems(
    params.followUpTasks,
    params.appointments,
  )

  return [
    {
      id: 'consult',
      label: '今日咨询量',
      value: consults,
      description: '当天有客户消息的独立会话数',
      icon: 'consult',
    },
    {
      id: 'appointment',
      label: '今日预约量',
      value: todayApts.length,
      description: '当日待确认 + 已预约（不含取消/完成）',
      icon: 'appointment',
    },
    {
      id: 'followup',
      label: '待跟进客户',
      value: followCustomers.length,
      description: '待跟进/跟进中或有未完成事项（非高意向数）',
      icon: 'followup',
    },
    {
      id: 'todo',
      label: '待处理事项',
      value: pending.total,
      description: `跟进${pending.followUps}（含转人工${pending.manualReviews}）+ 待确认预约${pending.pendingApts}`,
      icon: 'todo',
    },
  ]
}
