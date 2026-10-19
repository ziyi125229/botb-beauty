import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  createSeedAppointments,
  createSeedChatSessions,
  createSeedFollowUpTasks,
  seedCustomers,
  seedReceptionRecords,
  services,
  storeInfo,
} from '../data/mockData'
import {
  createPresentationCustomer,
  createPresentationSession,
  PRESENTATION_CUSTOMER_ID,
  PRESENTATION_SERVICE_ID,
  PRESENTATION_SESSION_ID,
  type PresentationFocus,
} from '../data/presentation'
import {
  formatAppointmentSummary,
  getServiceById,
  validateAndBuildAppointment,
  type CreateAppointmentInput,
} from '../lib/bookingService'
import { getTodayDate, nowISO } from '../lib/dateUtils'
import { migrateIntentLevel } from '../lib/intentRules'
import {
  buildOverviewStats,
  filterTodayActiveAppointments,
  getPendingFollowUpCustomers,
  getRecentReceptionSessions,
} from '../lib/overviewStats'
import type {
  Appointment,
  ChatMessage,
  ChatSession,
  Customer,
  CustomerUpdateInput,
  FollowUpTask,
  FollowUpTaskCategory,
  MarketingPlan,
  ReceptionRecord,
  StatCardData,
} from '../types'
import { ACTIVE_APPOINTMENT_STATUSES } from '../types'

const STORAGE_KEY = 'botb-beauty-data-v5'
const LEGACY_KEYS = [
  'botb-beauty-data-v4',
  'botb-demo-data-v4',
  'botb-demo-data-v3',
  'botb-demo-data-v2',
]

interface PersistedState {
  version: 5
  appointments: Appointment[]
  customers: Customer[]
  chatSessions: ChatSession[]
  followUpTasks: FollowUpTask[]
  receptionRecords: ReceptionRecord[]
  marketingPlans: MarketingPlan[]
}

interface AppDataContextValue {
  appointments: Appointment[]
  customers: Customer[]
  chatSessions: ChatSession[]
  followUpTasks: FollowUpTask[]
  receptionRecords: ReceptionRecord[]
  storageError: string | null
  clearStorageError: () => void
  getOverviewStats: () => StatCardData[]
  /** @deprecated 使用 getTodayActiveAppointments；保留别名兼容 */
  getTodayBookedAppointments: () => Appointment[]
  getTodayActiveAppointments: () => Appointment[]
  getPendingFollowUpCustomers: () => Customer[]
  getRecentReceptionSessions: (limit?: number) => ChatSession[]
  getCustomerAppointments: (customerId: string) => Appointment[]
  getCustomerFollowUps: (customerId: string) => FollowUpTask[]
  getCustomerConsultSummaries: (customerId: string) => ReceptionRecord[]
  getCustomerById: (id: string) => Customer | undefined
  getAppointmentById: (id: string) => Appointment | undefined
  createAppointment: (
    input: CreateAppointmentInput,
  ) => { ok: true; appointment: Appointment } | { ok: false; error: string }
  confirmAppointment: (
    appointmentId: string,
  ) => { ok: true; appointment: Appointment } | { ok: false; error: string }
  completeAppointment: (
    appointmentId: string,
  ) => { ok: true } | { ok: false; error: string }
  cancelAppointment: (
    appointmentId: string,
  ) => { ok: true } | { ok: false; error: string }
  rescheduleAppointment: (
    appointmentId: string,
    next: { date: string; startTime: string; staffId: string },
  ) => { ok: true; appointment: Appointment } | { ok: false; error: string }
  upsertCustomer: (customer: Customer) => Customer
  updateCustomer: (
    customerId: string,
    patch: CustomerUpdateInput,
  ) => { ok: true; customer: Customer } | { ok: false; error: string }
  ensureCustomer: (params: {
    customerId?: string
    name: string
    phone?: string
    focusProjectId?: string
  }) => Customer
  recordCustomerConsult: (params: {
    customerId: string
    focusProjectId?: string
    summary: string
    topic: ReceptionRecord['topic']
    intentPatch?: CustomerUpdateInput
  }) => void
  addFollowUpTask: (input: {
    customerId: string
    title: string
    note?: string
    dueDate?: string
    category?: FollowUpTaskCategory
  }) => { ok: true; task: FollowUpTask } | { ok: false; error: string }
  completeFollowUpTask: (
    taskId: string,
  ) => { ok: true } | { ok: false; error: string }
  updateChatSessions: (
    updater: (prev: ChatSession[]) => ChatSession[],
  ) => void
  appendReceptionRecord: (record: Omit<ReceptionRecord, 'id'>) => void
  resolveFollowUpForCustomer: (customerId: string) => void
  marketingPlans: MarketingPlan[]
  saveMarketingPlan: (
    plan: Omit<MarketingPlan, 'planId' | 'createdAt' | 'updatedAt'> & {
      planId?: string
    },
  ) => { ok: true; plan: MarketingPlan } | { ok: false; error: string }
  updateMarketingPlan: (
    planId: string,
    patch: Partial<Pick<MarketingPlan, 'editedContent' | 'sections' | 'generatedContent'>>,
  ) => { ok: true; plan: MarketingPlan } | { ok: false; error: string }
  deleteMarketingPlan: (
    planId: string,
  ) => { ok: true } | { ok: false; error: string }
  /** 路演聚焦：接待会话 / 客户详情 / 营销项目 */
  presentationFocus: PresentationFocus | null
  startPresentationFocus: () => void
  clearPresentationFocus: () => void
  /** 二次确认后由 UI 调用：恢复默认虚拟门店数据 */
  resetLocalData: () => void
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

function normalizeCustomer(raw: Record<string, unknown>): Customer {
  const tags = Array.isArray(raw.tags)
    ? (raw.tags as string[])
    : raw.intentTag === '老客复购'
      ? ['老客复购']
      : []

  const intentLevel = migrateIntentLevel(
    raw.intentLevel ?? raw.intentTag ?? '未知',
  )

  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    phone: String(raw.phone ?? ''),
    firstConsultAt: raw.firstConsultAt
      ? String(raw.firstConsultAt)
      : raw.lastVisit
        ? String(raw.lastVisit)
        : undefined,
    focusProjectId: String(raw.focusProjectId ?? ''),
    focusProject: String(raw.focusProject ?? ''),
    intentLevel,
    intentReason: String(
      raw.intentReason ??
        (raw.notes ? `历史备注：${raw.notes}` : '初始数据判定'),
    ),
    intentManual: Boolean(raw.intentManual),
    tags,
    lastConsultAt: raw.lastConsultAt
      ? String(raw.lastConsultAt)
      : raw.lastVisit
        ? String(raw.lastVisit)
        : undefined,
    lastVisit: raw.lastVisit ? String(raw.lastVisit) : undefined,
    lastAppointmentAt: raw.lastAppointmentAt
      ? String(raw.lastAppointmentAt)
      : undefined,
    followUpStatus: (raw.followUpStatus as Customer['followUpStatus']) ?? '待跟进',
    notes: raw.notes ? String(raw.notes) : undefined,
  }
}

function normalizeFollowUp(raw: Record<string, unknown>): FollowUpTask {
  const legacyStatus = raw.status
  const status =
    legacyStatus === '已完成' || legacyStatus === '已处理'
      ? '已完成'
      : '待跟进'

  const category: FollowUpTaskCategory =
    raw.category === 'manual_review' ? 'manual_review' : 'customer_followup'

  return {
    id: String(raw.id),
    customerId: String(raw.customerId),
    customerName: String(raw.customerName ?? ''),
    title: String(raw.title ?? ''),
    note: String(raw.note ?? raw.reason ?? ''),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    dueDate: raw.dueDate ? String(raw.dueDate) : undefined,
    status,
    category,
  }
}

/** 兼容旧会话：补齐 message.date / lastActivityAt，避免今日咨询量永久为 0 */
function normalizeChatSession(raw: ChatSession): ChatSession {
  const today = getTodayDate()
  const activityHint =
    typeof raw.lastActivityAt === 'string' && raw.lastActivityAt.length >= 10
      ? raw.lastActivityAt.slice(0, 10)
      : raw.status === '进行中'
        ? today
        : undefined

  const messages: ChatMessage[] = (raw.messages ?? []).map((m) => {
    if (m.date) return m
    return activityHint ? { ...m, date: activityHint } : m
  })

  const lastMsg = messages[messages.length - 1]
  const lastActivityAt =
    raw.lastActivityAt ??
    (lastMsg?.date && lastMsg.time
      ? `${lastMsg.date}T${lastMsg.time}:00`
      : undefined)

  return {
    ...raw,
    messages,
    lastActivityAt,
  }
}

function createInitialState(): PersistedState {
  return {
    version: 5,
    appointments: createSeedAppointments(),
    customers: [
      createPresentationCustomer(),
      ...structuredClone(seedCustomers).filter(
        (c) => c.id !== PRESENTATION_CUSTOMER_ID,
      ),
    ],
    chatSessions: createSeedChatSessions(),
    followUpTasks: createSeedFollowUpTasks(),
    receptionRecords: structuredClone(seedReceptionRecords),
    marketingPlans: [],
  }
}

/** 旧本地数据缺少路演客户时补齐，不清空用户已有业务数据 */
function ensurePresentationAssets(state: PersistedState): PersistedState {
  let customers = state.customers
  let chatSessions = state.chatSessions

  if (!customers.some((c) => c.id === PRESENTATION_CUSTOMER_ID)) {
    customers = [createPresentationCustomer(), ...customers]
  }
  if (!chatSessions.some((s) => s.id === PRESENTATION_SESSION_ID)) {
    chatSessions = [createPresentationSession(), ...chatSessions]
  }

  return { ...state, customers, chatSessions }
}

function migrateLegacy(raw: unknown): PersistedState | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  if (!Array.isArray(data.appointments)) return null

  return {
    version: 5,
    appointments: data.appointments as Appointment[],
    customers: Array.isArray(data.customers)
      ? data.customers.map((c) =>
          normalizeCustomer(c as Record<string, unknown>),
        )
      : structuredClone(seedCustomers),
    chatSessions: Array.isArray(data.chatSessions)
      ? (data.chatSessions as ChatSession[]).map(normalizeChatSession)
      : createSeedChatSessions(),
    followUpTasks: Array.isArray(data.followUpTasks)
      ? data.followUpTasks.map((t) =>
          normalizeFollowUp(t as Record<string, unknown>),
        )
      : createSeedFollowUpTasks(),
    receptionRecords: Array.isArray(data.receptionRecords)
      ? (data.receptionRecords as ReceptionRecord[])
      : structuredClone(seedReceptionRecords),
    marketingPlans: Array.isArray(data.marketingPlans)
      ? (data.marketingPlans as MarketingPlan[])
      : [],
  }
}

function loadState(): { state: PersistedState; error: string | null } {
  try {
    const current = localStorage.getItem(STORAGE_KEY)
    if (current) {
      const parsed = JSON.parse(current) as PersistedState
      if (
        (parsed?.version === 5 || parsed?.version === 4) &&
        Array.isArray(parsed.appointments)
      ) {
        return {
          state: ensurePresentationAssets({
            ...parsed,
            version: 5,
            customers: (parsed.customers ?? []).map((c) =>
              normalizeCustomer(c as unknown as Record<string, unknown>),
            ),
            chatSessions: (parsed.chatSessions ?? []).map(normalizeChatSession),
            followUpTasks: (parsed.followUpTasks ?? []).map((t) =>
              normalizeFollowUp(t as unknown as Record<string, unknown>),
            ),
            marketingPlans: Array.isArray(parsed.marketingPlans)
              ? parsed.marketingPlans
              : [],
          }),
          error: null,
        }
      }
    }

    for (const key of LEGACY_KEYS) {
      const legacy = localStorage.getItem(key)
      if (!legacy) continue
      const migrated = migrateLegacy(JSON.parse(legacy))
      if (migrated) {
        return { state: ensurePresentationAssets(migrated), error: null }
      }
    }

    return { state: createInitialState(), error: null }
  } catch {
    return {
      state: createInitialState(),
      error: '本地数据读取失败，已使用初始模拟数据。',
    }
  }
}

function syncCustomerAfterBooking(
  customers: Customer[],
  apt: Appointment,
): Customer[] {
  const service = getServiceById(apt.serviceId)
  return customers.map((c) => {
    if (c.id !== apt.customerId) return c
    const next: Customer = {
      ...c,
      name: apt.customerName || c.name,
      phone: apt.phone || c.phone,
      focusProjectId: apt.serviceId,
      focusProject: service?.name ?? apt.serviceName,
      followUpStatus: '已预约',
      lastAppointmentAt: `${apt.appointmentDate} ${apt.startTime}`,
      lastVisit: apt.appointmentDate,
      lastConsultAt: getTodayDate(),
      tags: Array.from(
        new Set([...(c.tags ?? []), '已预约'].filter(Boolean)),
      ),
    }
    if (!c.intentManual) {
      next.intentLevel = '高意向'
      next.intentReason = `已成功预约「${apt.serviceName}」${apt.appointmentDate} ${apt.startTime}`
    }
    return next
  })
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const initial = useRef(loadState())
  const [appointments, setAppointments] = useState(
    initial.current.state.appointments,
  )
  const [customers, setCustomers] = useState(initial.current.state.customers)
  const [chatSessions, setChatSessions] = useState(
    initial.current.state.chatSessions,
  )
  const [followUpTasks, setFollowUpTasks] = useState(
    initial.current.state.followUpTasks,
  )
  const [receptionRecords, setReceptionRecords] = useState(
    initial.current.state.receptionRecords,
  )
  const [marketingPlans, setMarketingPlans] = useState(
    initial.current.state.marketingPlans ?? [],
  )
  const [storageError, setStorageError] = useState<string | null>(
    initial.current.error,
  )
  const [presentationFocus, setPresentationFocus] =
    useState<PresentationFocus | null>(null)
  const focusTokenRef = useRef(0)

  const startPresentationFocus = useCallback(() => {
    focusTokenRef.current += 1
    setPresentationFocus({
      sessionId: PRESENTATION_SESSION_ID,
      customerId: PRESENTATION_CUSTOMER_ID,
      serviceId: PRESENTATION_SERVICE_ID,
      token: focusTokenRef.current,
    })
  }, [])

  const clearPresentationFocus = useCallback(() => {
    setPresentationFocus(null)
  }, [])

  const resetLocalData = useCallback(() => {
    const fresh = createInitialState()
    setAppointments(fresh.appointments)
    setCustomers(fresh.customers)
    setChatSessions(fresh.chatSessions)
    setFollowUpTasks(fresh.followUpTasks)
    setReceptionRecords(fresh.receptionRecords)
    setMarketingPlans(fresh.marketingPlans)
    setPresentationFocus(null)
    setStorageError(null)
  }, [])

  useEffect(() => {
    try {
      const payload: PersistedState = {
        version: 5,
        appointments,
        customers,
        chatSessions,
        followUpTasks,
        receptionRecords,
        marketingPlans,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      setStorageError(null)
    } catch {
      setStorageError('本地数据保存失败，刷新后变更可能丢失。')
    }
  }, [
    appointments,
    customers,
    chatSessions,
    followUpTasks,
    receptionRecords,
    marketingPlans,
  ])

  const getCustomerById = useCallback(
    (id: string) => customers.find((c) => c.id === id),
    [customers],
  )

  const getAppointmentById = useCallback(
    (id: string) => appointments.find((a) => a.appointmentId === id),
    [appointments],
  )

  const getTodayActiveAppointments = useCallback(
    () => filterTodayActiveAppointments(appointments),
    [appointments],
  )

  /** 兼容旧调用：现已返回今日有效预约（待确认 + 已预约） */
  const getTodayBookedAppointments = getTodayActiveAppointments

  const getPendingFollowUpCustomersList = useCallback(
    () => getPendingFollowUpCustomers(customers, followUpTasks),
    [customers, followUpTasks],
  )

  const getRecentReceptionSessionsList = useCallback(
    (limit = 5) => getRecentReceptionSessions(chatSessions, limit),
    [chatSessions],
  )

  const getCustomerAppointments = useCallback(
    (customerId: string) =>
      appointments
        .filter((a) => a.customerId === customerId)
        .sort((a, b) =>
          `${b.appointmentDate}${b.startTime}`.localeCompare(
            `${a.appointmentDate}${a.startTime}`,
          ),
        ),
    [appointments],
  )

  const getCustomerFollowUps = useCallback(
    (customerId: string) =>
      followUpTasks
        .filter((t) => t.customerId === customerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [followUpTasks],
  )

  const getCustomerConsultSummaries = useCallback(
    (customerId: string) =>
      receptionRecords.filter((r) => r.customerId === customerId),
    [receptionRecords],
  )

  const getOverviewStats = useCallback((): StatCardData[] => {
    return buildOverviewStats({
      appointments,
      customers,
      followUpTasks,
      chatSessions,
    })
  }, [appointments, customers, followUpTasks, chatSessions])

  const resolveFollowUpForCustomer = useCallback((customerId: string) => {
    // 预约成功只自动完成客户跟进类事项，保留医疗转人工待办
    setFollowUpTasks((prev) =>
      prev.map((t) =>
        t.customerId === customerId &&
        t.status === '待跟进' &&
        (t.category ?? 'customer_followup') === 'customer_followup'
          ? { ...t, status: '已完成' as const }
          : t,
      ),
    )
  }, [])

  const upsertCustomer = useCallback((customer: Customer) => {
    setCustomers((prev) => {
      const idx = prev.findIndex((c) => c.id === customer.id)
      if (idx === -1) return [...prev, customer]
      const next = [...prev]
      next[idx] = { ...next[idx], ...customer }
      return next
    })
    return customer
  }, [])

  const updateCustomer = useCallback(
    (customerId: string, patch: CustomerUpdateInput) => {
      const existing = customers.find((c) => c.id === customerId)
      if (!existing) return { ok: false as const, error: '未找到客户。' }

      let focusProjectId = patch.focusProjectId ?? existing.focusProjectId
      let focusProject = patch.focusProject ?? existing.focusProject
      if (patch.focusProjectId) {
        const svc = services.find((s) => s.id === patch.focusProjectId)
        if (svc) {
          focusProjectId = svc.id
          focusProject = svc.name
        }
      }

      const updated: Customer = {
        ...existing,
        ...patch,
        focusProjectId,
        focusProject,
        tags: patch.tags ?? existing.tags,
        intentLevel: patch.intentLevel ?? existing.intentLevel,
        intentReason: patch.intentReason ?? existing.intentReason,
        intentManual:
          patch.intentManual ??
          (patch.intentLevel !== undefined ? true : existing.intentManual),
      }
      upsertCustomer(updated)
      return { ok: true as const, customer: updated }
    },
    [customers, upsertCustomer],
  )

  const ensureCustomer = useCallback(
    (params: {
      customerId?: string
      name: string
      phone?: string
      focusProjectId?: string
    }) => {
      if (params.customerId) {
        const existing = customers.find((c) => c.id === params.customerId)
        if (existing) {
          const service = params.focusProjectId
            ? services.find((s) => s.id === params.focusProjectId)
            : undefined
          const updated: Customer = {
            ...existing,
            name: params.name || existing.name,
            phone: params.phone || existing.phone,
            focusProjectId: service?.id ?? existing.focusProjectId,
            focusProject: service?.name ?? existing.focusProject,
            lastConsultAt: getTodayDate(),
            firstConsultAt: existing.firstConsultAt ?? getTodayDate(),
          }
          upsertCustomer(updated)
          return updated
        }
      }

      const byName = customers.find(
        (c) =>
          c.name === params.name &&
          (!params.phone || c.phone === params.phone),
      )
      if (byName) return byName

      const service = params.focusProjectId
        ? services.find((s) => s.id === params.focusProjectId)
        : services[0]

      const created: Customer = {
        id: `cus-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: params.name,
        phone: params.phone || '未填写',
        firstConsultAt: getTodayDate(),
        focusProjectId: service?.id ?? '',
        focusProject: service?.name ?? '',
        intentLevel: '未知',
        intentReason: '新客户建档，信息仍不足',
        tags: ['新客'],
        lastConsultAt: getTodayDate(),
        followUpStatus: '跟进中',
        notes: '由 AI 接待 / 预约流程新建',
      }
      upsertCustomer(created)
      return created
    },
    [customers, upsertCustomer],
  )

  const recordCustomerConsult = useCallback(
    (params: {
      customerId: string
      focusProjectId?: string
      summary: string
      topic: ReceptionRecord['topic']
      intentPatch?: CustomerUpdateInput
    }) => {
      const customer = customers.find((c) => c.id === params.customerId)
      if (!customer) return

      const service = params.focusProjectId
        ? services.find((s) => s.id === params.focusProjectId)
        : undefined

      const patch: CustomerUpdateInput = {
        lastConsultAt: getTodayDate(),
        firstConsultAt: customer.firstConsultAt ?? getTodayDate(),
        ...(service
          ? { focusProjectId: service.id, focusProject: service.name }
          : {}),
        ...params.intentPatch,
      }

      // 不因单次询价覆盖人工意向
      if (customer.intentManual && params.intentPatch?.intentLevel) {
        delete patch.intentLevel
        delete patch.intentReason
        delete patch.intentManual
      }

      updateCustomer(params.customerId, patch)
      setReceptionRecords((prev) => [
        {
          id: `rec-${Date.now()}`,
          customerId: params.customerId,
          customerName: customer.name,
          time: new Date().toTimeString().slice(0, 5),
          summary: params.summary,
          topic: params.topic,
        },
        ...prev,
      ])
    },
    [customers, updateCustomer],
  )

  const addFollowUpTask = useCallback(
    (input: {
      customerId: string
      title: string
      note?: string
      dueDate?: string
      category?: FollowUpTaskCategory
    }) => {
      const customer = customers.find((c) => c.id === input.customerId)
      if (!customer) return { ok: false as const, error: '未找到客户。' }
      if (!input.title.trim()) {
        return { ok: false as const, error: '请填写跟进事项。' }
      }

      const category: FollowUpTaskCategory =
        input.category ?? 'customer_followup'

      // 同一客户仍有未完成转人工事项时不重复创建
      if (category === 'manual_review') {
        const dup = followUpTasks.find(
          (t) =>
            t.customerId === customer.id &&
            t.category === 'manual_review' &&
            t.status === '待跟进',
        )
        if (dup) return { ok: true as const, task: dup }
      }

      const task: FollowUpTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        customerId: customer.id,
        customerName: customer.name,
        title: input.title.trim(),
        note: input.note?.trim() ?? '',
        createdAt: nowISO(),
        dueDate: input.dueDate || undefined,
        status: '待跟进',
        category,
      }

      setFollowUpTasks((prev) => [task, ...prev])

      // 转人工不强制改客户跟进状态；普通跟进才同步
      if (category === 'customer_followup') {
        if (
          customer.followUpStatus === '暂缓' ||
          customer.followUpStatus === '待跟进'
        ) {
          updateCustomer(customer.id, { followUpStatus: '待跟进' })
        } else if (customer.followUpStatus !== '已预约') {
          updateCustomer(customer.id, { followUpStatus: '跟进中' })
        }
      }

      return { ok: true as const, task }
    },
    [customers, followUpTasks, updateCustomer],
  )

  const completeFollowUpTask = useCallback(
    (taskId: string) => {
      const task = followUpTasks.find((t) => t.id === taskId)
      if (!task) return { ok: false as const, error: '未找到跟进事项。' }

      setFollowUpTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: '已完成' as const } : t,
        ),
      )

      const remaining = followUpTasks.filter(
        (t) =>
          t.customerId === task.customerId &&
          t.id !== taskId &&
          t.status === '待跟进',
      )
      const customer = customers.find((c) => c.id === task.customerId)
      if (customer && remaining.length === 0 && customer.followUpStatus !== '已预约') {
        updateCustomer(task.customerId, { followUpStatus: '跟进中' })
      }

      return { ok: true as const }
    },
    [followUpTasks, customers, updateCustomer],
  )

  const createAppointment = useCallback(
    (input: CreateAppointmentInput) => {
      const result = validateAndBuildAppointment(appointments, input)
      if (!result.ok) return result

      setAppointments((prev) => [...prev, result.appointment])
      setCustomers((prev) => syncCustomerAfterBooking(prev, result.appointment))
      resolveFollowUpForCustomer(result.appointment.customerId)

      return result
    },
    [appointments, resolveFollowUpForCustomer],
  )

  const confirmAppointment = useCallback(
    (appointmentId: string) => {
      const current = appointments.find((a) => a.appointmentId === appointmentId)
      if (!current) return { ok: false as const, error: '未找到该预约。' }
      if (current.status === 'cancelled') {
        return { ok: false as const, error: '已取消的预约无法确认。' }
      }
      if (current.status === 'completed') {
        return { ok: false as const, error: '已完成的预约无需确认。' }
      }

      const recheck = validateAndBuildAppointment(
        appointments,
        {
          customerId: current.customerId,
          customerName: current.customerName,
          phone: current.phone,
          serviceId: current.serviceId,
          appointmentDate: current.appointmentDate,
          startTime: current.startTime,
          staffId: current.staffId,
          remark: current.remark,
          source: current.source,
          status: 'booked',
        },
        current.appointmentId,
      )
      if (!recheck.ok) return recheck

      const updated: Appointment = {
        ...current,
        status: 'booked',
        endTime: recheck.appointment.endTime,
      }

      setAppointments((prev) =>
        prev.map((a) => (a.appointmentId === appointmentId ? updated : a)),
      )
      setCustomers((prev) => syncCustomerAfterBooking(prev, updated))
      resolveFollowUpForCustomer(updated.customerId)
      return { ok: true as const, appointment: updated }
    },
    [appointments, resolveFollowUpForCustomer],
  )

  const completeAppointment = useCallback(
    (appointmentId: string) => {
      const current = appointments.find((a) => a.appointmentId === appointmentId)
      if (!current) return { ok: false as const, error: '未找到该预约。' }
      if (current.status === 'cancelled') {
        return { ok: false as const, error: '已取消的预约无法标记完成。' }
      }
      setAppointments((prev) =>
        prev.map((a) =>
          a.appointmentId === appointmentId
            ? { ...a, status: 'completed' as const }
            : a,
        ),
      )
      return { ok: true as const }
    },
    [appointments],
  )

  const cancelAppointment = useCallback(
    (appointmentId: string) => {
      const current = appointments.find((a) => a.appointmentId === appointmentId)
      if (!current) return { ok: false as const, error: '未找到该预约。' }
      if (current.status === 'cancelled') {
        return { ok: false as const, error: '该预约已取消。' }
      }

      setAppointments((prev) =>
        prev.map((a) =>
          a.appointmentId === appointmentId
            ? { ...a, status: 'cancelled' as const }
            : a,
        ),
      )

      // 保留客户档案；若无其他有效预约，回退跟进状态
      const hasOtherActive = appointments.some(
        (a) =>
          a.appointmentId !== appointmentId &&
          a.customerId === current.customerId &&
          ACTIVE_APPOINTMENT_STATUSES.includes(a.status),
      )
      if (!hasOtherActive) {
        setCustomers((prev) =>
          prev.map((c) => {
            if (c.id !== current.customerId) return c
            return {
              ...c,
              followUpStatus:
                c.followUpStatus === '已预约' ? '待跟进' : c.followUpStatus,
              tags: (c.tags ?? []).filter((t) => t !== '已预约'),
              notes: c.notes
                ? `${c.notes}；预约 ${current.appointmentDate} ${current.startTime} 已取消（历史保留）`
                : `预约 ${current.appointmentDate} ${current.startTime} 已取消（历史保留）`,
            }
          }),
        )
      }

      return { ok: true as const }
    },
    [appointments],
  )

  const rescheduleAppointment = useCallback(
    (
      appointmentId: string,
      next: { date: string; startTime: string; staffId: string },
    ) => {
      const current = appointments.find((a) => a.appointmentId === appointmentId)
      if (!current) return { ok: false as const, error: '未找到该预约。' }
      if (current.status === 'cancelled' || current.status === 'completed') {
        return { ok: false as const, error: '已完成或已取消的预约不可改期。' }
      }

      const built = validateAndBuildAppointment(
        appointments,
        {
          customerId: current.customerId,
          customerName: current.customerName,
          phone: current.phone,
          serviceId: current.serviceId,
          appointmentDate: next.date,
          startTime: next.startTime,
          staffId: next.staffId,
          remark: current.remark,
          source: current.source,
          status:
            current.status === 'pending_confirmation'
              ? 'pending_confirmation'
              : 'booked',
        },
        current.appointmentId,
      )
      if (!built.ok) return built

      const updated: Appointment = {
        ...current,
        appointmentDate: built.appointment.appointmentDate,
        startTime: built.appointment.startTime,
        endTime: built.appointment.endTime,
        staffId: built.appointment.staffId,
        staffName: built.appointment.staffName,
        status: built.appointment.status,
      }

      setAppointments((prev) =>
        prev.map((a) => (a.appointmentId === appointmentId ? updated : a)),
      )
      setCustomers((prev) => syncCustomerAfterBooking(prev, updated))
      return { ok: true as const, appointment: updated }
    },
    [appointments],
  )

  const updateChatSessions = useCallback(
    (updater: (prev: ChatSession[]) => ChatSession[]) => {
      setChatSessions(updater)
    },
    [],
  )

  const appendReceptionRecord = useCallback(
    (record: Omit<ReceptionRecord, 'id'>) => {
      setReceptionRecords((prev) => [
        { ...record, id: `rec-${Date.now()}` },
        ...prev,
      ])
    },
    [],
  )

  const saveMarketingPlan = useCallback(
    (
      plan: Omit<MarketingPlan, 'planId' | 'createdAt' | 'updatedAt'> & {
        planId?: string
      },
    ) => {
      if (!plan.originalPrompt?.trim() && !plan.generatedContent?.trim()) {
        return { ok: false as const, error: '无法保存空方案。' }
      }
      const now = new Date().toISOString()
      if (plan.planId) {
        const existing = marketingPlans.find((p) => p.planId === plan.planId)
        if (!existing) return { ok: false as const, error: '未找到要更新的方案。' }
        const updated: MarketingPlan = {
          ...existing,
          ...plan,
          planId: existing.planId,
          createdAt: existing.createdAt,
          updatedAt: now,
        }
        setMarketingPlans((prev) =>
          prev.map((p) => (p.planId === updated.planId ? updated : p)),
        )
        return { ok: true as const, plan: updated }
      }

      const created: MarketingPlan = {
        ...plan,
        planId: `mkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now,
        updatedAt: now,
      }
      setMarketingPlans((prev) => [created, ...prev])
      return { ok: true as const, plan: created }
    },
    [marketingPlans],
  )

  const updateMarketingPlan = useCallback(
    (
      planId: string,
      patch: Partial<
        Pick<MarketingPlan, 'editedContent' | 'sections' | 'generatedContent'>
      >,
    ) => {
      const existing = marketingPlans.find((p) => p.planId === planId)
      if (!existing) return { ok: false as const, error: '未找到该方案。' }
      const updated: MarketingPlan = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      }
      setMarketingPlans((prev) =>
        prev.map((p) => (p.planId === planId ? updated : p)),
      )
      return { ok: true as const, plan: updated }
    },
    [marketingPlans],
  )

  const deleteMarketingPlan = useCallback(
    (planId: string) => {
      if (!marketingPlans.some((p) => p.planId === planId)) {
        return { ok: false as const, error: '未找到该方案。' }
      }
      setMarketingPlans((prev) => prev.filter((p) => p.planId !== planId))
      return { ok: true as const }
    },
    [marketingPlans],
  )

  const value = useMemo<AppDataContextValue>(
    () => ({
      appointments,
      customers,
      chatSessions,
      followUpTasks,
      receptionRecords,
      marketingPlans,
      storageError,
      clearStorageError: () => setStorageError(null),
      getOverviewStats,
      getTodayBookedAppointments,
      getTodayActiveAppointments,
      getPendingFollowUpCustomers: getPendingFollowUpCustomersList,
      getRecentReceptionSessions: getRecentReceptionSessionsList,
      getCustomerAppointments,
      getCustomerFollowUps,
      getCustomerConsultSummaries,
      getCustomerById,
      getAppointmentById,
      createAppointment,
      confirmAppointment,
      completeAppointment,
      cancelAppointment,
      rescheduleAppointment,
      upsertCustomer,
      updateCustomer,
      ensureCustomer,
      recordCustomerConsult,
      addFollowUpTask,
      completeFollowUpTask,
      updateChatSessions,
      appendReceptionRecord,
      resolveFollowUpForCustomer,
      saveMarketingPlan,
      updateMarketingPlan,
      deleteMarketingPlan,
      presentationFocus,
      startPresentationFocus,
      clearPresentationFocus,
      resetLocalData,
    }),
    [
      appointments,
      customers,
      chatSessions,
      followUpTasks,
      receptionRecords,
      marketingPlans,
      storageError,
      presentationFocus,
      getOverviewStats,
      getTodayBookedAppointments,
      getTodayActiveAppointments,
      getPendingFollowUpCustomersList,
      getRecentReceptionSessionsList,
      getCustomerAppointments,
      getCustomerFollowUps,
      getCustomerConsultSummaries,
      getCustomerById,
      getAppointmentById,
      createAppointment,
      confirmAppointment,
      completeAppointment,
      cancelAppointment,
      rescheduleAppointment,
      upsertCustomer,
      updateCustomer,
      ensureCustomer,
      recordCustomerConsult,
      addFollowUpTask,
      completeFollowUpTask,
      updateChatSessions,
      appendReceptionRecord,
      resolveFollowUpForCustomer,
      saveMarketingPlan,
      updateMarketingPlan,
      deleteMarketingPlan,
      startPresentationFocus,
      clearPresentationFocus,
      resetLocalData,
    ],
  )

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  )
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) {
    throw new Error('useAppData must be used within AppDataProvider')
  }
  return ctx
}

export { formatAppointmentSummary, storeInfo }
