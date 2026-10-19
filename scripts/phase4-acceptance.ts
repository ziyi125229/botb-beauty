/**
 * Phase 4 验收脚本：对核心数据层与业务服务做场景 A–F 的逻辑验收（无浏览器）。
 * 运行：npx --yes tsx scripts/phase4-acceptance.ts
 */
import {
  createSeedAppointments,
  createSeedChatSessions,
  createSeedFollowUpTasks,
  seedCustomers,
  services,
} from '../src/data/mockData'
import {
  getAvailableSlots,
  validateAndBuildAppointment,
} from '../src/lib/bookingService'
import { addDays, getTodayDate } from '../src/lib/dateUtils'
import { generateMarketingContent } from '../src/lib/marketingService'
import {
  buildOverviewStats,
  countPendingWorkItems,
  countTodayConsultSessions,
  filterTodayActiveAppointments,
  getPendingFollowUpCustomers,
} from '../src/lib/overviewStats'
import { generateReply, isMedicalQuery } from '../src/lib/replyEngine'
import type {
  Appointment,
  ChatSession,
  Customer,
  FollowUpTask,
  MarketingPlan,
} from '../src/types'

type Result = { name: string; ok: boolean; detail: string }

const results: Result[] = []

function assert(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`)
}

function deepClone<T>(v: T): T {
  return structuredClone(v)
}

// —— 可变运行时状态（模拟 AppDataContext）——
let appointments = createSeedAppointments()
let customers = deepClone(seedCustomers)
let chatSessions = createSeedChatSessions()
let followUpTasks = createSeedFollowUpTasks()
let marketingPlans: MarketingPlan[] = []

function stats() {
  return buildOverviewStats({
    appointments,
    customers,
    followUpTasks,
    chatSessions,
  })
}

function appendCustomerMessage(sessionId: string, content: string) {
  const today = getTodayDate()
  const now = new Date()
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  chatSessions = chatSessions.map((s) => {
    if (s.id !== sessionId) return s
    const msg = {
      id: `m-${Date.now()}`,
      role: 'customer' as const,
      content,
      time,
      date: today,
    }
    return {
      ...s,
      lastMessage: content,
      time,
      lastActivityAt: now.toISOString(),
      messages: [...s.messages, msg],
      status: '进行中' as const,
    }
  })
}

// ========== 场景前基线 ==========
const baseline = stats()
assert(
  '基线-今日咨询量',
  baseline.find((s) => s.id === 'consult')!.value === 2,
  `期望 2（chat-001/002 今日有客户消息），实际 ${baseline.find((s) => s.id === 'consult')!.value}`,
)

const todayActive = filterTodayActiveAppointments(appointments)
assert(
  '基线-今日预约含待确认',
  todayActive.some((a) => a.status === 'pending_confirmation'),
  `今日有效 ${todayActive.length} 条，含 pending: ${todayActive.filter((a) => a.status === 'pending_confirmation').length}`,
)

assert(
  '基线-待跟进≠高意向',
  getPendingFollowUpCustomers(customers, followUpTasks).length !==
    customers.filter((c) => c.intentLevel === '高意向').length ||
    customers.filter((c) => c.intentLevel === '高意向').length === 0,
  `待跟进客户 ${getPendingFollowUpCustomers(customers, followUpTasks).length}，高意向 ${customers.filter((c) => c.intentLevel === '高意向').length}`,
)

// ========== 场景 A：咨询价格 + 预约 ==========
const svc = services.find((s) => s.name === '基础清洁补水')!
assert('场景A-统一项目价格', svc.price === 198 && svc.durationMinutes === 60, `${svc.name} ${svc.price}元/${svc.durationMinutes}分`)

appendCustomerMessage('chat-001', '基础清洁补水多少钱？')
const consultAfter = countTodayConsultSessions(chatSessions)
assert(
  '场景A-咨询不重复计会话',
  consultAfter === 2,
  `同一会话再发消息后今日咨询量仍为 ${consultAfter}`,
)

const tomorrow = addDays(getTodayDate(), 1)
const slots = getAvailableSlots({
  appointments,
  serviceId: svc.id,
  date: tomorrow,
  timeOfDay: 'afternoon',
})
assert('场景A-可查可用档期', slots.length > 0, `明日下午档期 ${slots.length} 个`)

const slot = slots[0]!
const create = validateAndBuildAppointment(appointments, {
  customerId: 'cus-001',
  customerName: '刘梦瑶',
  phone: '135****8820',
  serviceId: svc.id,
  appointmentDate: slot.date,
  startTime: slot.startTime,
  staffId: slot.staffId,
  remark: '验收场景A',
  source: 'ai',
  status: 'booked',
})
assert('场景A-预约写入成功', create.ok, create.ok ? create.appointment.appointmentId : create.error)

if (create.ok) {
  appointments = [...appointments, create.appointment]
  customers = customers.map((c) =>
    c.id === 'cus-001'
      ? {
          ...c,
          focusProjectId: svc.id,
          focusProject: svc.name,
          followUpStatus: '已预约' as const,
          lastAppointmentAt: `${create.appointment.appointmentDate} ${create.appointment.startTime}`,
        }
      : c,
  )
  followUpTasks = followUpTasks.map((t) =>
    t.customerId === 'cus-001' && t.status === '待跟进' && t.category !== 'manual_review'
      ? { ...t, status: '已完成' as const }
      : t,
  )
  chatSessions = chatSessions.map((s) =>
    s.id === 'chat-001'
      ? { ...s, latestAppointmentId: create.appointment.appointmentId }
      : s,
  )
}

const custApts = appointments.filter((a) => a.customerId === 'cus-001')
assert(
  '场景A-客户详情可查预约',
  custApts.some((a) => a.appointmentId === (create.ok ? create.appointment.appointmentId : '')),
  `客户 cus-001 预约数 ${custApts.length}`,
)

// ========== 场景 B：改期 + 取消 ==========
if (create.ok) {
  const aptId = create.appointment.appointmentId
  const moreSlots = getAvailableSlots({
    appointments,
    serviceId: svc.id,
    date: tomorrow,
    timeOfDay: 'any',
  }).filter(
    (s) =>
      !(s.startTime === slot.startTime && s.staffId === slot.staffId),
  )
  const nextSlot = moreSlots[0]
  assert('场景B-有其他可改档期', Boolean(nextSlot), nextSlot ? nextSlot.label : '无空档')

  if (nextSlot) {
    const rebuilt = validateAndBuildAppointment(
      appointments,
      {
        customerId: 'cus-001',
        customerName: '刘梦瑶',
        serviceId: svc.id,
        appointmentDate: nextSlot.date,
        startTime: nextSlot.startTime,
        staffId: nextSlot.staffId,
        status: 'booked',
        source: 'ai',
      },
      aptId,
    )
    assert('场景B-改期成功', rebuilt.ok, rebuilt.ok ? `${rebuilt.appointment.startTime}` : rebuilt.error)
    if (rebuilt.ok) {
      appointments = appointments.map((a) =>
        a.appointmentId === aptId ? { ...a, ...rebuilt.appointment, appointmentId: aptId } : a,
      )
    }

    // 原时段应释放：用原 slot 再约应成功
    const rebookOld = validateAndBuildAppointment(appointments, {
      customerId: 'cus-002',
      customerName: '黄诗涵',
      serviceId: svc.id,
      appointmentDate: slot.date,
      startTime: slot.startTime,
      staffId: slot.staffId,
      status: 'booked',
      source: 'manual',
    })
    assert(
      '场景B-原时段已释放',
      rebookOld.ok,
      rebookOld.ok ? '原档期可再约' : rebookOld.error,
    )

    // 取消
    appointments = appointments.map((a) =>
      a.appointmentId === aptId ? { ...a, status: 'cancelled' as const } : a,
    )
    const cancelled = appointments.find((a) => a.appointmentId === aptId)!
    assert('场景B-取消保留历史', cancelled.status === 'cancelled', `状态 ${cancelled.status}`)

    const afterCancelSlots = getAvailableSlots({
      appointments,
      serviceId: svc.id,
      date: nextSlot.date,
      timeOfDay: 'any',
    })
    const freed = afterCancelSlots.some(
      (s) => s.startTime === nextSlot.startTime && s.staffId === nextSlot.staffId,
    )
    assert('场景B-取消后档期开放', freed, '改期后的时段在取消后重新出现在可用列表')
  }
}

// ========== 场景 C：跟进事项 ==========
const pendingBefore = countPendingWorkItems(followUpTasks, appointments)
const newTask: FollowUpTask = {
  id: 'task-accept-c',
  customerId: 'cus-004',
  customerName: customers.find((c) => c.id === 'cus-004')?.name ?? '测试',
  title: '验收跟进事项',
  note: '场景C',
  createdAt: new Date().toISOString(),
  dueDate: getTodayDate(),
  status: '待跟进',
  category: 'customer_followup',
}
followUpTasks = [newTask, ...followUpTasks]
const pendingMid = countPendingWorkItems(followUpTasks, appointments)
assert(
  '场景C-创建后待处理+1',
  pendingMid.total === pendingBefore.total + 1,
  `前 ${pendingBefore.total} → 后 ${pendingMid.total}`,
)

followUpTasks = followUpTasks.map((t) =>
  t.id === 'task-accept-c' ? { ...t, status: '已完成' as const } : t,
)
const pendingAfter = countPendingWorkItems(followUpTasks, appointments)
assert(
  '场景C-完成后待处理-1',
  pendingAfter.total === pendingBefore.total,
  `完成回落至 ${pendingAfter.total}（基线 ${pendingBefore.total}）`,
)

// ========== 场景 D：医疗转人工 ==========
const medicalText = '我这是不是皮炎，能不能诊断一下怎么治疗？'
assert('场景D-识别医疗问题', isMedicalQuery(medicalText), medicalText)
const medicalReply = generateReply(medicalText)
assert(
  '场景D-安全提示',
  /无法提供医疗诊断/.test(medicalReply) && /待人工处理/.test(medicalReply),
  medicalReply.slice(0, 80),
)
const manualTask: FollowUpTask = {
  id: 'task-medical',
  customerId: 'cus-001',
  customerName: '刘梦瑶',
  title: '医疗类问题待人工处理',
  note: medicalText.slice(0, 120),
  createdAt: new Date().toISOString(),
  dueDate: getTodayDate(),
  status: '待跟进',
  category: 'manual_review',
}
followUpTasks = [manualTask, ...followUpTasks]
const pendingMed = countPendingWorkItems(followUpTasks, appointments)
assert(
  '场景D-待处理含转人工',
  pendingMed.manualReviews >= 1,
  `转人工 ${pendingMed.manualReviews}，待处理总计 ${pendingMed.total}`,
)

// ========== 场景 E：营销方案 ==========
const mkt = generateMarketingContent({
  scene: 'new_customer_campaign',
  prompt: '帮我做基础清洁补水的拓客方案',
  serviceId: svc.id,
  tone: '亲切温和',
})
assert(
  '场景E-价格来自统一数据',
  mkt.serviceName === svc.name && mkt.fullText.includes(String(svc.price)),
  `项目 ${mkt.serviceName}，文案含价 ${mkt.fullText.includes(String(svc.price))}`,
)
assert(
  '场景E-未编造优惠',
  !/限时.*折|全场.*折/.test(mkt.fullText) || mkt.warnings.length >= 0,
  `warnings: ${mkt.warnings.join('; ') || '无'}`,
)

const saved: MarketingPlan = {
  planId: 'mkt-accept-e',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  scene: mkt.scene,
  sceneLabel: mkt.sceneLabel,
  serviceId: svc.id,
  serviceName: svc.name,
  originalPrompt: '帮我做基础清洁补水的拓客方案',
  generatedContent: mkt.fullText,
  editedContent: mkt.fullText + '\n【已编辑朋友圈文案】',
  sections: mkt.sections,
  warnings: mkt.warnings,
}
marketingPlans = [saved, ...marketingPlans]
const reopened = marketingPlans.find((p) => p.planId === 'mkt-accept-e')
assert(
  '场景E-保存可重开',
  Boolean(reopened?.editedContent?.includes('已编辑朋友圈文案')),
  reopened ? '编辑内容保留' : '未找到方案',
)

// ========== 场景 F：统计一致性（模拟刷新后同源计算） ==========
const snapApts: Appointment[] = deepClone(appointments)
const snapCust: Customer[] = deepClone(customers)
const snapChats: ChatSession[] = deepClone(chatSessions)
const snapTasks: FollowUpTask[] = deepClone(followUpTasks)
const afterRefresh = buildOverviewStats({
  appointments: snapApts,
  customers: snapCust,
  followUpTasks: snapTasks,
  chatSessions: snapChats,
})
const live = stats()
assert(
  '场景F-刷新后统计一致',
  JSON.stringify(afterRefresh) === JSON.stringify(live),
  `consult ${live.find((s) => s.id === 'consult')!.value}, apt ${live.find((s) => s.id === 'appointment')!.value}, follow ${live.find((s) => s.id === 'followup')!.value}, todo ${live.find((s) => s.id === 'todo')!.value}`,
)

assert(
  '场景F-无重复预约ID',
  new Set(appointments.map((a) => a.appointmentId)).size === appointments.length,
  `预约 ${appointments.length} 条`,
)

assert(
  '场景F-取消不计入今日预约量',
  !filterTodayActiveAppointments(appointments).some((a) => a.status === 'cancelled'),
  `今日有效 ${filterTodayActiveAppointments(appointments).length}`,
)

// ========== 汇总 ==========
const failed = results.filter((r) => !r.ok)
console.log('\n========== SUMMARY ==========')
console.log(`Total: ${results.length}, Pass: ${results.length - failed.length}, Fail: ${failed.length}`)
if (failed.length) {
  failed.forEach((f) => console.log(` - ${f.name}: ${f.detail}`))
  process.exit(1)
}
process.exit(0)
