import { services, storeInfo, technicians } from '../data/mockData'
import type {
  Appointment,
  AppointmentStatus,
  ServiceItem,
  Technician,
  TimeSlotOption,
} from '../types'
import { ACTIVE_APPOINTMENT_STATUSES } from '../types'
import {
  addMinutesToTime,
  getTodayDate,
  isPastDateTime,
  rangesOverlap,
  timeToMinutes,
} from './dateUtils'

const SLOT_INTERVAL = 30

export function getServiceById(id: string): ServiceItem | undefined {
  return services.find((s) => s.id === id)
}

export function getTechnicianById(id: string): Technician | undefined {
  return technicians.find((t) => t.id === id)
}

export function techniciansForService(serviceId: string): Technician[] {
  return technicians.filter((t) => t.serviceIds.includes(serviceId))
}

export function isActiveStatus(status: AppointmentStatus): boolean {
  return ACTIVE_APPOINTMENT_STATUSES.includes(status)
}

export function findConflicts(
  appointments: Appointment[],
  params: {
    staffId: string
    date: string
    startTime: string
    endTime: string
    excludeAppointmentId?: string
  },
): Appointment[] {
  return appointments.filter((apt) => {
    if (!isActiveStatus(apt.status)) return false
    if (apt.staffId !== params.staffId) return false
    if (apt.appointmentDate !== params.date) return false
    if (
      params.excludeAppointmentId &&
      apt.appointmentId === params.excludeAppointmentId
    ) {
      return false
    }
    return rangesOverlap(
      apt.startTime,
      apt.endTime,
      params.startTime,
      params.endTime,
    )
  })
}

export function canStaffServe(staffId: string, serviceId: string): boolean {
  const tech = getTechnicianById(staffId)
  return Boolean(tech?.serviceIds.includes(serviceId))
}

function clampWorkWindow(
  tech: Technician,
  open: string,
  close: string,
): { start: number; end: number } {
  const start = Math.max(timeToMinutes(tech.workStart), timeToMinutes(open))
  const end = Math.min(timeToMinutes(tech.workEnd), timeToMinutes(close))
  return { start, end }
}

/**
 * 查询某日某项目的可预约时段（30 分钟间隔，需容纳完整服务时长）。
 */
export function getAvailableSlots(params: {
  appointments: Appointment[]
  serviceId: string
  date: string
  preferredStaffId?: string
  preferredStartTime?: string
  timeOfDay?: 'morning' | 'afternoon' | 'any'
  excludeAppointmentId?: string
  limit?: number
}): TimeSlotOption[] {
  const service = getServiceById(params.serviceId)
  if (!service) return []

  if (params.date < getTodayDate()) return []

  let staffList = techniciansForService(params.serviceId)
  if (params.preferredStaffId) {
    staffList = staffList.filter((t) => t.id === params.preferredStaffId)
  }
  if (staffList.length === 0) return []

  const open = storeInfo.openTime
  const close = storeInfo.closeTime
  const duration = service.durationMinutes
  const options: TimeSlotOption[] = []

  for (const tech of staffList) {
    const { start, end } = clampWorkWindow(tech, open, close)
    if (end - start < duration) continue

    for (let t = start; t + duration <= end; t += SLOT_INTERVAL) {
      const startTime = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
      const endTime = addMinutesToTime(startTime, duration)

      if (isPastDateTime(params.date, startTime)) continue

      if (params.timeOfDay === 'morning' && t >= 12 * 60) continue
      if (params.timeOfDay === 'afternoon' && t < 12 * 60) continue

      if (params.preferredStartTime && startTime !== params.preferredStartTime) {
        continue
      }

      const conflicts = findConflicts(params.appointments, {
        staffId: tech.id,
        date: params.date,
        startTime,
        endTime,
        excludeAppointmentId: params.excludeAppointmentId,
      })
      if (conflicts.length > 0) continue

      options.push({
        date: params.date,
        startTime,
        endTime,
        staffId: tech.id,
        staffName: tech.name,
        label: `${startTime}–${endTime} · ${tech.name}`,
      })
    }
  }

  // 同一开始时间优先保留一位技师，避免列表过长
  const byStart = new Map<string, TimeSlotOption>()
  for (const opt of options) {
    if (!byStart.has(opt.startTime)) {
      byStart.set(opt.startTime, opt)
    }
  }

  const deduped = [...byStart.values()].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
  )

  return params.limit ? deduped.slice(0, params.limit) : deduped
}

export interface CreateAppointmentInput {
  customerId: string
  customerName: string
  phone?: string
  serviceId: string
  appointmentDate: string
  startTime: string
  staffId: string
  remark?: string
  source?: 'ai' | 'manual'
  status?: AppointmentStatus
}

export type BookingResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; error: string }

export function validateAndBuildAppointment(
  appointments: Appointment[],
  input: CreateAppointmentInput,
  excludeAppointmentId?: string,
): BookingResult {
  const service = getServiceById(input.serviceId)
  if (!service) {
    return { ok: false, error: '未找到对应护理项目，请重新选择。' }
  }

  const staff = getTechnicianById(input.staffId)
  if (!staff) {
    return { ok: false, error: '未找到对应技师，请重新选择。' }
  }

  if (!canStaffServe(input.staffId, input.serviceId)) {
    return {
      ok: false,
      error: `技师 ${staff.name} 暂不支持「${service.name}」，请选择其他技师或时段。`,
    }
  }

  if (!input.customerName.trim()) {
    return { ok: false, error: '客户姓名不完整，请补充后再预约。' }
  }

  if (input.appointmentDate < getTodayDate()) {
    return { ok: false, error: '不能预约过去的日期，请重新选择。' }
  }

  if (isPastDateTime(input.appointmentDate, input.startTime)) {
    return { ok: false, error: '不能预约已经过去的时间，请重新选择。' }
  }

  const endTime = addMinutesToTime(input.startTime, service.durationMinutes)

  if (timeToMinutes(endTime) > timeToMinutes(storeInfo.closeTime)) {
    return {
      ok: false,
      error: '该时段无法在营业时间内完成完整护理，请选择更早的时间。',
    }
  }

  if (
    timeToMinutes(input.startTime) < timeToMinutes(staff.workStart) ||
    timeToMinutes(endTime) > timeToMinutes(staff.workEnd)
  ) {
    return {
      ok: false,
      error: `所选时间不在技师 ${staff.name} 的工作时间内（${staff.workStart}–${staff.workEnd}）。`,
    }
  }

  const conflicts = findConflicts(appointments, {
    staffId: input.staffId,
    date: input.appointmentDate,
    startTime: input.startTime,
    endTime,
    excludeAppointmentId,
  })

  if (conflicts.length > 0) {
    const c = conflicts[0]
    return {
      ok: false,
      error: `该时段已被占用（${c.customerName} ${c.startTime}–${c.endTime}），请选择其他时间。`,
    }
  }

  const appointment: Appointment = {
    appointmentId: `apt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    customerId: input.customerId,
    customerName: input.customerName.trim(),
    serviceId: service.id,
    serviceName: service.name,
    durationMinutes: service.durationMinutes,
    appointmentDate: input.appointmentDate,
    startTime: input.startTime,
    endTime,
    staffId: staff.id,
    staffName: staff.name,
    status: input.status ?? 'booked',
    createdAt: new Date().toISOString(),
    remark: input.remark ?? '',
    phone: input.phone,
    source: input.source ?? 'manual',
  }

  return { ok: true, appointment }
}

export function formatAppointmentSummary(
  apt: Appointment,
  priceLabel?: string,
): string {
  const price =
    priceLabel ??
    (() => {
      const svc = getServiceById(apt.serviceId)
      if (!svc) return '—'
      return svc.price === 0 ? '免费' : `${svc.price} 元`
    })()

  return [
    `客户：${apt.customerName}`,
    `项目：${apt.serviceName}（${price}）`,
    `日期：${apt.appointmentDate}`,
    `时间：${apt.startTime}–${apt.endTime}`,
    `技师：${apt.staffName}`,
    `状态：${apt.status === 'booked' ? '已预约' : apt.status === 'pending_confirmation' ? '待确认' : apt.status}`,
  ].join('\n')
}
