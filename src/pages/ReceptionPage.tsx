import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { formatServicePrice, matchServiceFromText, quickQuestions } from '../data/mockData'
import {
  applyBookingAction,
  createEmptyDraft,
  isBookingIntent,
  processBookingText,
} from '../lib/bookingFlow'
import {
  formatAppointmentSummary,
  getServiceById,
} from '../lib/bookingService'
import {
  PRESENTATION_CUSTOMER_ID,
  PRESENTATION_SESSION_ID,
} from '../data/presentation'
import { getTodayDate, nowISO, nowTimeLabel } from '../lib/dateUtils'
import { evaluateIntent } from '../lib/intentRules'
import { generateReply, isMedicalQuery } from '../lib/replyEngine'
import { useAppData } from '../store/AppDataContext'
import { StatusBadge } from '../components/ui/StatusBadge'
import type {
  BookingDraft,
  ChatAction,
  ChatMessage,
  ChatSession,
} from '../types'

function createMessage(
  role: ChatMessage['role'],
  content: string,
  actions?: ChatAction[],
): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    content,
    time: nowTimeLabel(),
    date: getTodayDate(),
    actions,
  }
}

export function ReceptionPage() {
  const {
    appointments,
    chatSessions,
    getCustomerById,
    getAppointmentById,
    getCustomerAppointments,
    createAppointment,
    ensureCustomer,
    updateChatSessions,
    appendReceptionRecord,
    recordCustomerConsult,
    updateCustomer,
    addFollowUpTask,
    presentationFocus,
  } = useAppData()

  const [activeId, setActiveId] = useState(
    () =>
      chatSessions.find((s) => s.id === PRESENTATION_SESSION_ID)?.id ??
      chatSessions[0]?.id ??
      '',
  )
  const [input, setInput] = useState('')
  const [drafts, setDrafts] = useState<Record<string, BookingDraft>>({})
  const [busy, setBusy] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeSession =
    chatSessions.find((s) => s.id === activeId) ?? chatSessions[0]
  const customer = activeSession
    ? getCustomerById(activeSession.customerId)
    : undefined
  const draft = drafts[activeId] ?? createEmptyDraft()
  const latestApt = activeSession?.latestAppointmentId
    ? getAppointmentById(activeSession.latestAppointmentId)
    : getCustomerAppointments(activeSession?.customerId ?? '')[0]

  useEffect(() => {
    if (!presentationFocus?.sessionId) return
    if (chatSessions.some((s) => s.id === presentationFocus.sessionId)) {
      setActiveId(presentationFocus.sessionId)
    }
  }, [presentationFocus?.token, presentationFocus?.sessionId, chatSessions])

  useEffect(() => {
    if (!chatSessions.some((s) => s.id === activeId) && chatSessions[0]) {
      setActiveId(chatSessions[0].id)
    }
  }, [chatSessions, activeId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.id, activeSession?.messages.length])

  const patchSession = (
    sessionId: string,
    updater: (session: ChatSession) => ChatSession,
  ) => {
    updateChatSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? updater(s) : s)),
    )
  }

  const appendMessages = (
    sessionId: string,
    messages: ChatMessage[],
    extra?: Partial<ChatSession>,
  ) => {
    patchSession(sessionId, (session) => {
      const last = messages[messages.length - 1]
      return {
        ...session,
        ...extra,
        status: '进行中',
        unread: 0,
        lastMessage: last?.content ?? session.lastMessage,
        time: last?.time ?? session.time,
        lastActivityAt: nowISO(),
        messages: [...session.messages, ...messages],
      }
    })
  }

  const executePendingCreate = (
    sessionId: string,
    pending: NonNullable<
      ReturnType<typeof processBookingText>['pendingCreate']
    >,
    currentDraft: BookingDraft,
  ) => {
    setBusy(true)

    const ensured = ensureCustomer({
      customerId:
        pending.customerId.startsWith('temp-') || !pending.customerId
          ? undefined
          : pending.customerId,
      name: pending.customerName,
      phone: pending.phone,
      focusProjectId: pending.serviceId,
    })

    const result = createAppointment({
      customerId: ensured.id,
      customerName: ensured.name,
      phone: ensured.phone,
      serviceId: pending.serviceId,
      appointmentDate: pending.appointmentDate,
      startTime: pending.startTime,
      staffId: pending.staffId,
      remark: 'AI 接待创建',
      source: 'ai',
      status: 'booked',
    })

    if (!result.ok) {
      setDrafts((prev) => ({
        ...prev,
        [sessionId]: { ...currentDraft, confirming: false, step: 'select_slot' },
      }))
      appendMessages(sessionId, [
        createMessage(
          'assistant',
          `预约未能创建：${result.error}\n请重新选择可用时段。`,
        ),
      ])
      setBusy(false)
      return
    }

    setDrafts((prev) => ({ ...prev, [sessionId]: createEmptyDraft() }))
    appendMessages(
      sessionId,
      [
        createMessage(
          'assistant',
          `预约成功！\n\n${formatAppointmentSummary(result.appointment)}\n\n预约已写入统一数据源，经营概览与客户档案将同步更新。（前端模拟，未接入真实后端）`,
        ),
      ],
      {
        latestAppointmentId: result.appointment.appointmentId,
        customerId: ensured.id,
        customerName: ensured.name,
      },
    )
    appendReceptionRecord({
      customerId: ensured.id,
      customerName: ensured.name,
      time: nowTimeLabel(),
      summary: `AI 接待完成预约：${result.appointment.serviceName} ${result.appointment.appointmentDate} ${result.appointment.startTime}`,
      topic: '预约意向',
    })
    setBusy(false)
  }

  const handleFlowResult = (
    sessionId: string,
    result: ReturnType<typeof processBookingText>,
  ) => {
    setDrafts((prev) => ({ ...prev, [sessionId]: result.draft }))

    const replies = result.replies.map((r) =>
      createMessage(r.role, r.content, r.actions),
    )
    if (replies.length > 0) {
      appendMessages(sessionId, replies)
    }

    if (result.pendingCreate) {
      executePendingCreate(sessionId, result.pendingCreate, result.draft)
    }
  }

  /** 将会话消息沉淀到客户档案（不破坏预约状态机） */
  const syncProfileFromMessage = (
    session: ChatSession,
    text: string,
    opts?: { bookingStarted?: boolean; serviceChosen?: boolean },
  ) => {
    if (!session.customerId) return

    const matched = matchServiceFromText(text)
    const askedPrice = /多少钱|价格|收费|费用/.test(text)
    const judgement = evaluateIntent({
      text,
      hasBookingIntent: opts?.bookingStarted || isBookingIntent(text),
      choseServiceForExperience: opts?.serviceChosen || Boolean(matched && /体验|预约|想做/.test(text)),
      askedPriceOnly: askedPrice && !isBookingIntent(text),
      comparingOrHesitating: /考虑|比较|再看看|暂时|没时间/.test(text),
    })

    const topic = isBookingIntent(text)
      ? '预约意向'
      : askedPrice
        ? '价格询问'
        : '项目咨询'

    const intentPatch =
      customer?.intentManual
        ? undefined
        : {
            intentLevel: judgement.level,
            intentReason: judgement.reason,
            intentManual: false as const,
          }

    // 有预约意向时，补充标签但不覆盖已有预约标签逻辑
    if (opts?.bookingStarted || isBookingIntent(text)) {
      const tags = Array.from(
        new Set([...(customer?.tags ?? []), '有预约意向']),
      )
      updateCustomer(session.customerId, {
        tags,
        ...(intentPatch ?? {}),
        lastConsultAt: new Date().toISOString().slice(0, 10),
        ...(matched
          ? { focusProjectId: matched.id, focusProject: matched.name }
          : {}),
      })
    }

    recordCustomerConsult({
      customerId: session.customerId,
      focusProjectId: matched?.id,
      summary: text.slice(0, 80),
      topic,
      intentPatch,
    })
  }

  const sendText = (raw: string) => {
    if (!activeSession || busy) return
    const trimmed = raw.trim()
    if (!trimmed) return

    const sessionId = activeSession.id
    const userMsg = createMessage('customer', trimmed)
    appendMessages(sessionId, [userMsg])
    setInput('')

    const ctx = {
      appointments,
      customer,
      sessionCustomerName: activeSession.customerName,
    }

    const currentDraft = drafts[sessionId] ?? createEmptyDraft()
    const inFlow = currentDraft.step !== 'idle'
    const bookingStarted = inFlow || isBookingIntent(trimmed)

    syncProfileFromMessage(activeSession, trimmed, { bookingStarted })

    if (bookingStarted) {
      const result = processBookingText(
        trimmed,
        inFlow ? currentDraft : createEmptyDraft(),
        ctx,
      )
      handleFlowResult(sessionId, result)
      return
    }

    if (isMedicalQuery(trimmed) && activeSession.customerId) {
      addFollowUpTask({
        customerId: activeSession.customerId,
        title: '医疗类问题待人工处理',
        note: `客户咨询：${trimmed.slice(0, 120)}`,
        dueDate: getTodayDate(),
        category: 'manual_review',
      })
    }

    const reply = generateReply(trimmed, { latestAppointment: latestApt })
    appendMessages(sessionId, [createMessage('assistant', reply)])
  }

  const handleAction = (action: ChatAction) => {
    if (!activeSession || busy) return
    const sessionId = activeSession.id
    const currentDraft = drafts[sessionId] ?? createEmptyDraft()
    const ctx = {
      appointments,
      customer,
      sessionCustomerName: activeSession.customerName,
    }

    if (action.type === 'select_service' && activeSession.customerId) {
      const svc = getServiceById(action.serviceId)
      if (svc) {
        updateCustomer(activeSession.customerId, {
          focusProjectId: svc.id,
          focusProject: svc.name,
          lastConsultAt: new Date().toISOString().slice(0, 10),
          ...(customer?.intentManual
            ? {}
            : {
                intentLevel: '高意向' as const,
                intentReason: `在接待中选择体验项目「${svc.name}」`,
              }),
          tags: Array.from(
            new Set([...(customer?.tags ?? []), '有预约意向']),
          ),
        })
      }
    }

    if (action.type === 'select_slot' && activeSession.customerId && !customer?.intentManual) {
      updateCustomer(activeSession.customerId, {
        intentLevel: '高意向',
        intentReason: `主动选择近期到店时间 ${action.date} ${action.startTime}`,
      })
    }

    const result = applyBookingAction(action, currentDraft, ctx)
    handleFlowResult(sessionId, result)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendText(input)
    }
  }

  const renderActionLabel = (action: ChatAction): string => {
    switch (action.type) {
      case 'select_service':
        return action.label
      case 'select_slot':
        return action.label
      case 'confirm_booking':
        return '确认预约'
      case 'reselect_booking':
        return '重新选择'
      case 'cancel_booking_flow':
        return '退出预约'
      default:
        return '操作'
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-7.5rem)] min-h-[520px] max-w-[1280px] overflow-hidden rounded-xl border border-border bg-surface-card shadow-[0_1px_2px_rgba(44,41,38,0.04)]">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border sm:w-64">
        <div className="border-b border-border px-4 py-3.5">
          <h3 className="text-sm font-semibold text-text">会话列表</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            共 {chatSessions.length} 个会话
          </p>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {chatSessions.map((session) => {
            const active = session.id === activeSession?.id
            return (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(session.id)}
                  className={`w-full border-b border-border px-4 py-3.5 text-left transition-colors ${
                    active ? 'bg-brand-50' : 'hover:bg-surface'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-text">
                      {session.customerName}
                    </span>
                    <span className="shrink-0 text-xs text-text-muted">
                      {session.time}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-text-secondary">
                    {session.lastMessage}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`rounded-md border px-1.5 py-0.5 text-[11px] ${
                        session.status === '进行中'
                          ? 'border-brand-200 bg-brand-50 text-brand-700'
                          : 'border-border bg-surface text-text-muted'
                      }`}
                    >
                      {session.status}
                    </span>
                    {drafts[session.id]?.step &&
                    drafts[session.id]?.step !== 'idle' ? (
                      <span className="text-[11px] text-brand-600">预约中</span>
                    ) : null}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-text">
              {activeSession?.customerName ?? '选择会话'}
            </h3>
            {activeSession?.customerId === PRESENTATION_CUSTOMER_ID ? (
              <span className="rounded-md border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[11px] text-brand-700">
                路演客户
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            AI 接待助手 · 规则预约流程（前端模拟，未接入大模型）
            {draft.step !== 'idle' ? ` · 当前步骤：${draft.step}` : ''}
          </p>
          {activeSession?.customerId === PRESENTATION_CUSTOMER_ID ? (
            <p className="mt-1.5 text-xs text-brand-700">
              建议流程：先问「基础清洁补水多少钱？」，再说「我想预约一次护理」完成预约。
            </p>
          ) : null}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-surface/40 px-5 py-5">
          {activeSession?.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'assistant'
                    ? 'rounded-tl-md border border-border bg-white text-text'
                    : 'rounded-tr-md bg-brand-500 text-white'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <p className="mb-1 text-[11px] font-medium text-brand-600">
                    AI 助手
                  </p>
                ) : (
                  <p className="mb-1 text-[11px] font-medium text-brand-100">
                    客户
                  </p>
                )}
                <p>{msg.content}</p>
                {msg.actions && msg.actions.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {msg.actions.map((action, idx) => (
                      <button
                        key={`${msg.id}-act-${idx}`}
                        type="button"
                        disabled={busy}
                        onClick={() => handleAction(action)}
                        className={`rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                          action.type === 'confirm_booking'
                            ? 'border-brand-500 bg-brand-500 text-white hover:bg-brand-600'
                            : action.type === 'cancel_booking_flow'
                              ? 'border-border bg-surface text-text-secondary hover:bg-white'
                              : 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100'
                        }`}
                      >
                        {renderActionLabel(action)}
                      </button>
                    ))}
                  </div>
                ) : null}
                <p
                  className={`mt-1.5 text-[11px] ${
                    msg.role === 'assistant' ? 'text-text-muted' : 'text-brand-100'
                  }`}
                >
                  {msg.time}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border px-4 py-3 sm:px-5">
          <div className="mb-2.5 flex flex-wrap gap-2">
            {quickQuestions.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy}
                onClick={() => sendText(q)}
                className="rounded-full border border-border bg-white px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-2.5 focus-within:border-brand-300">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={busy}
              placeholder="输入问题或预约需求，例如：帮我预约基础清洁补水"
              className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => sendText(input)}
              disabled={!input.trim() || busy}
              className="rounded-md bg-brand-500 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-200"
            >
              发送
            </button>
          </div>
        </div>
      </section>

      <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-surface-card lg:flex">
        <div className="border-b border-border px-4 py-3.5">
          <h3 className="text-sm font-semibold text-text">客户信息</h3>
          <p className="mt-0.5 text-[11px] text-text-muted">
            与客户管理实时联动
          </p>
        </div>
        <div className="space-y-4 overflow-y-auto px-4 py-4 text-sm">
          <div>
            <p className="text-xs text-text-muted">客户姓名</p>
            <p className="mt-1 font-medium text-text">
              {activeSession?.customerName ?? '—'}
            </p>
            <p className="mt-0.5 text-[11px] text-text-muted">
              {activeSession?.customerId}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">联系电话</p>
            <p className="mt-1 text-text-secondary">{customer?.phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">关注项目</p>
            <p className="mt-1 text-text-secondary">
              {customer?.focusProject ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">意向等级</p>
            <div className="mt-1">
              {customer ? (
                <StatusBadge type="intent" status={customer.intentLevel} />
              ) : (
                '—'
              )}
            </div>
            {customer?.intentReason ? (
              <p className="mt-1.5 text-[11px] leading-relaxed text-text-muted">
                {customer.intentReason}
                {customer.intentManual ? '（人工）' : '（规则）'}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-xs text-text-muted">跟进状态</p>
            <div className="mt-1">
              {customer ? (
                <StatusBadge type="followup" status={customer.followUpStatus} />
              ) : (
                '—'
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-text-muted">客户标签</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(customer?.tags ?? []).length === 0 ? (
                <span className="text-text-secondary">暂无标签</span>
              ) : (
                customer?.tags.map((tag) => (
                  <StatusBadge key={tag} type="tag" status={tag} />
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-text-muted">最近预约</p>
            {latestApt ? (
              <div className="mt-1 rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed text-text-secondary">
                <p className="font-medium text-text">{latestApt.serviceName}</p>
                <p className="mt-1">
                  {latestApt.appointmentDate} {latestApt.startTime}–
                  {latestApt.endTime}
                </p>
                <p className="mt-1">技师：{latestApt.staffName}</p>
                <div className="mt-1.5">
                  <StatusBadge type="appointment" status={latestApt.status} />
                </div>
                <p className="mt-1.5">
                  价格：
                  {(() => {
                    const svc = getServiceById(latestApt.serviceId)
                    return svc ? formatServicePrice(svc) : '—'
                  })()}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-text-secondary">暂无预约记录</p>
            )}
          </div>
          {customer?.notes ? (
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs font-medium text-text">跟进备注</p>
              <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                {customer.notes}
              </p>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
