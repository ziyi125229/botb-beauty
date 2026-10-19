/**
 * Phase 5：路演客户贯穿 + 重置 + 营销一致性
 * 运行：npx --yes tsx scripts/phase5-acceptance.ts
 */
import {
  createSeedAppointments,
  createSeedChatSessions,
  createSeedFollowUpTasks,
  seedCustomers,
  services,
} from '../src/data/mockData'
import {
  createPresentationCustomer,
  PRESENTATION_CUSTOMER_ID,
  PRESENTATION_SERVICE_ID,
  PRESENTATION_SESSION_ID,
} from '../src/data/presentation'
import {
  getAvailableSlots,
  validateAndBuildAppointment,
} from '../src/lib/bookingService'
import { addDays, getTodayDate } from '../src/lib/dateUtils'
import { generateMarketingContent } from '../src/lib/marketingService'
import {
  buildOverviewStats,
  countTodayConsultSessions,
} from '../src/lib/overviewStats'
const results: { name: string; ok: boolean; detail: string }[] = []

function assert(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`)
}

function createFreshState() {
  return {
    appointments: createSeedAppointments(),
    customers: [
      createPresentationCustomer(),
      ...structuredClone(seedCustomers).filter(
        (c) => c.id !== PRESENTATION_CUSTOMER_ID,
      ),
    ],
    chatSessions: createSeedChatSessions(),
    followUpTasks: createSeedFollowUpTasks(),
  }
}

let state = createFreshState()

const lin = state.customers.find((c) => c.id === PRESENTATION_CUSTOMER_ID)!
assert(
  '林女士种子存在',
  Boolean(lin) &&
    lin.name === '林女士' &&
    lin.focusProject === '基础清洁补水' &&
    lin.followUpStatus === '待跟进' &&
    !state.appointments.some((a) => a.customerId === PRESENTATION_CUSTOMER_ID),
  `意向 ${lin?.intentLevel}，关注 ${lin?.focusProject}`,
)

const session = state.chatSessions.find((s) => s.id === PRESENTATION_SESSION_ID)!
assert(
  '林女士会话在列表前部',
  state.chatSessions[0]?.id === PRESENTATION_SESSION_ID &&
    session.customerId === PRESENTATION_CUSTOMER_ID,
  `首位会话 ${state.chatSessions[0]?.customerName}`,
)

const stats0 = buildOverviewStats({
  appointments: state.appointments,
  customers: state.customers,
  followUpTasks: state.followUpTasks,
  chatSessions: state.chatSessions,
})
const consult0 = stats0.find((s) => s.id === 'consult')!.value

// 询价
const today = getTodayDate()
state.chatSessions = state.chatSessions.map((s) => {
  if (s.id !== PRESENTATION_SESSION_ID) return s
  return {
    ...s,
    lastMessage: '基础清洁补水多少钱？',
    time: '10:00',
    lastActivityAt: `${today}T10:00:00`,
    messages: [
      ...s.messages,
      {
        id: 't1',
        role: 'customer' as const,
        content: '基础清洁补水多少钱？',
        time: '10:00',
        date: today,
      },
    ],
  }
})
state.customers = state.customers.map((c) =>
  c.id === PRESENTATION_CUSTOMER_ID
    ? {
        ...c,
        intentLevel: '观望' as const,
        intentReason: '主动询价基础清洁补水，尚未确认预约',
        lastConsultAt: today,
      }
    : c,
)

const consult1 = countTodayConsultSessions(state.chatSessions)
assert(
  '询价后今日咨询量+1',
  consult1 === consult0 + 1,
  `${consult0} → ${consult1}`,
)

const svc = services.find((s) => s.id === PRESENTATION_SERVICE_ID)!
const tomorrow = addDays(today, 1)
const slots = getAvailableSlots({
  appointments: state.appointments,
  serviceId: svc.id,
  date: tomorrow,
  timeOfDay: 'afternoon',
})
assert('可查档期', slots.length > 0, `${slots.length} 个`)

const slot = slots[0]!
const created = validateAndBuildAppointment(state.appointments, {
  customerId: PRESENTATION_CUSTOMER_ID,
  customerName: '林女士',
  phone: lin.phone,
  serviceId: svc.id,
  appointmentDate: slot.date,
  startTime: slot.startTime,
  staffId: slot.staffId,
  remark: '路演预约',
  source: 'ai',
  status: 'booked',
})
assert('预约成功', created.ok, created.ok ? created.appointment.appointmentId : created.error)

if (created.ok) {
  state.appointments = [...state.appointments, created.appointment]
  state.customers = state.customers.map((c) =>
    c.id === PRESENTATION_CUSTOMER_ID
      ? {
          ...c,
          followUpStatus: '已预约' as const,
          intentLevel: '高意向' as const,
          intentReason: `已成功预约「${created.appointment.serviceName}」${created.appointment.appointmentDate} ${created.appointment.startTime}`,
          focusProjectId: svc.id,
          focusProject: svc.name,
          lastAppointmentAt: `${created.appointment.appointmentDate} ${created.appointment.startTime}`,
          tags: Array.from(new Set([...(c.tags ?? []), '已预约'])),
        }
      : c,
  )
  state.chatSessions = state.chatSessions.map((s) =>
    s.id === PRESENTATION_SESSION_ID
      ? { ...s, latestAppointmentId: created.appointment.appointmentId }
      : s,
  )
}

const history = state.appointments.filter(
  (a) => a.customerId === PRESENTATION_CUSTOMER_ID,
)
assert(
  '客户档案同源预约',
  history.length === 1 && history[0]!.customerId === PRESENTATION_CUSTOMER_ID,
  `预约数 ${history.length}，id=${history[0]?.appointmentId}`,
)

const mkt = generateMarketingContent({
  scene: 'new_customer_campaign',
  prompt: '基础清洁补水拓客与朋友圈',
  serviceId: PRESENTATION_SERVICE_ID,
  tone: '亲切温和',
})
assert(
  '营销价格一致',
  mkt.serviceName === svc.name && mkt.fullText.includes(String(svc.price)),
  `${mkt.serviceName} / ${svc.price}`,
)

// 重复确认：已 booked 再 validate 同槽位应冲突
const dup = validateAndBuildAppointment(state.appointments, {
  customerId: 'cus-001',
  customerName: '刘梦瑶',
  serviceId: svc.id,
  appointmentDate: slot.date,
  startTime: slot.startTime,
  staffId: slot.staffId,
  status: 'booked',
  source: 'manual',
})
assert('重复占档失败', !dup.ok, dup.ok ? '不应成功' : dup.error)

// 取消后释放
if (created.ok) {
  state.appointments = state.appointments.map((a) =>
    a.appointmentId === created.appointment.appointmentId
      ? { ...a, status: 'cancelled' as const }
      : a,
  )
  const freed = validateAndBuildAppointment(state.appointments, {
    customerId: 'cus-002',
    customerName: '黄诗涵',
    serviceId: svc.id,
    appointmentDate: slot.date,
    startTime: slot.startTime,
    staffId: slot.staffId,
    status: 'booked',
    source: 'manual',
  })
  assert('取消后档期释放', freed.ok, freed.ok ? '可再约' : freed.error)
}

// 重置
state = createFreshState()
const afterReset = state.customers.find((c) => c.id === PRESENTATION_CUSTOMER_ID)!
assert(
  '重置后林女士回到未预约',
  afterReset.followUpStatus === '待跟进' &&
    !state.appointments.some((a) => a.customerId === PRESENTATION_CUSTOMER_ID) &&
    state.chatSessions.some((s) => s.id === PRESENTATION_SESSION_ID),
  `跟进 ${afterReset.followUpStatus}`,
)

const failed = results.filter((r) => !r.ok)
console.log('\n========== SUMMARY ==========')
console.log(
  `Total: ${results.length}, Pass: ${results.length - failed.length}, Fail: ${failed.length}`,
)
if (failed.length) {
  failed.forEach((f) => console.log(` - ${f.name}: ${f.detail}`))
  process.exit(1)
}
process.exit(0)
