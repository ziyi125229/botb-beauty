import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { services } from '../data/mockData'
import { PRESENTATION_CUSTOMER_ID } from '../data/presentation'
import { getTodayDate } from '../lib/dateUtils'
import { useAppData } from '../store/AppDataContext'
import { StatusBadge } from '../components/ui/StatusBadge'
import type {
  Customer,
  FollowUpStatus,
  IntentLevel,
} from '../types'

const intentOptions: Array<IntentLevel | '全部'> = [
  '全部',
  '高意向',
  '观望',
  '低意向',
  '未知',
]

const followUpOptions: Array<FollowUpStatus | '全部'> = [
  '全部',
  '待跟进',
  '跟进中',
  '已预约',
  '暂缓',
]

const TAG_PRESETS = ['新客', '老客复购', '价格敏感', '干敏肌', '已预约', '观望中']

export function CustomersPage() {
  const {
    customers,
    getCustomerAppointments,
    getCustomerFollowUps,
    getCustomerConsultSummaries,
    updateCustomer,
    addFollowUpTask,
    completeFollowUpTask,
    presentationFocus,
  } = useAppData()

  const [keyword, setKeyword] = useState('')
  const [projectFilter, setProjectFilter] = useState('全部')
  const [intent, setIntent] = useState<IntentLevel | '全部'>('全部')
  const [followFilter, setFollowFilter] = useState<FollowUpStatus | '全部'>('全部')
  const [selectedId, setSelectedId] = useState<string | null>(
    PRESENTATION_CUSTOMER_ID,
  )
  const [message, setMessage] = useState('')

  // edit form
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editProjectId, setEditProjectId] = useState('')
  const [editIntent, setEditIntent] = useState<IntentLevel>('未知')
  const [editIntentReason, setEditIntentReason] = useState('')
  const [editFollow, setEditFollow] = useState<FollowUpStatus>('待跟进')
  const [editNotes, setEditNotes] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // follow-up form
  const [fuTitle, setFuTitle] = useState('')
  const [fuNote, setFuNote] = useState('')
  const [fuDue, setFuDue] = useState('')

  const selected = useMemo(
    () => customers.find((c) => c.id === selectedId) ?? null,
    [customers, selectedId],
  )

  useEffect(() => {
    if (!presentationFocus?.customerId) return
    if (customers.some((c) => c.id === presentationFocus.customerId)) {
      setSelectedId(presentationFocus.customerId)
      setKeyword('')
      setProjectFilter('全部')
      setIntent('全部')
      setFollowFilter('全部')
    }
  }, [presentationFocus?.token, presentationFocus?.customerId, customers])

  useEffect(() => {
    if (!selected) return
    setEditName(selected.name)
    setEditPhone(selected.phone)
    setEditProjectId(selected.focusProjectId)
    setEditIntent(selected.intentLevel)
    setEditIntentReason(selected.intentReason)
    setEditFollow(selected.followUpStatus)
    setEditNotes(selected.notes ?? '')
    setEditTags([...(selected.tags ?? [])])
  }, [selected])

  const projectOptions = useMemo(() => {
    const names = Array.from(
      new Set(customers.map((c) => c.focusProject).filter(Boolean)),
    )
    return ['全部', ...names]
  }, [customers])

  const filtered = useMemo(() => {
    return customers.filter((customer) => {
      const matchKeyword =
        !keyword ||
        customer.name.includes(keyword) ||
        customer.phone.includes(keyword) ||
        customer.focusProject.includes(keyword)
      const matchProject =
        projectFilter === '全部' || customer.focusProject === projectFilter
      const matchIntent =
        intent === '全部' || customer.intentLevel === intent
      const matchFollow =
        followFilter === '全部' || customer.followUpStatus === followFilter
      return matchKeyword && matchProject && matchIntent && matchFollow
    })
  }, [customers, keyword, projectFilter, intent, followFilter])

  const history = selected ? getCustomerAppointments(selected.id) : []
  const followUps = selected ? getCustomerFollowUps(selected.id) : []
  const consults = selected ? getCustomerConsultSummaries(selected.id) : []

  const openDetail = (customer: Customer) => {
    setSelectedId(customer.id)
    setMessage('')
    setFuTitle('')
    setFuNote('')
    setFuDue('')
  }

  const toggleTag = (tag: string) => {
    setEditTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  const addCustomTag = () => {
    const t = tagInput.trim()
    if (!t) return
    if (!editTags.includes(t)) setEditTags((prev) => [...prev, t])
    setTagInput('')
  }

  const saveCustomer = () => {
    if (!selected) return
    const result = updateCustomer(selected.id, {
      name: editName.trim() || selected.name,
      phone: editPhone.trim() || selected.phone,
      focusProjectId: editProjectId,
      intentLevel: editIntent,
      intentReason: editIntentReason.trim() || '人工修改意向',
      intentManual: true,
      followUpStatus: editFollow,
      notes: editNotes,
      tags: editTags,
    })
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    setMessage('客户信息已保存，AI 接待侧栏将同步显示。')
  }

  const handleAddFollowUp = () => {
    if (!selected) return
    const result = addFollowUpTask({
      customerId: selected.id,
      title: fuTitle,
      note: fuNote,
      dueDate: fuDue || undefined,
    })
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    setFuTitle('')
    setFuNote('')
    setFuDue('')
    setMessage('已添加跟进事项，经营概览待处理统计已更新。')
  }

  const handleCompleteFollowUp = (taskId: string) => {
    const result = completeFollowUpTask(taskId)
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    setMessage('跟进事项已完成，不再计入待处理数量。')
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-5">
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-surface-card p-5 shadow-[0_1px_2px_rgba(44,41,38,0.04)]">
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-[200px] flex-1">
            <span className="mb-1.5 block text-xs text-text-muted">姓名搜索</span>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
              <Search size={16} className="text-text-muted" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="客户姓名 / 电话 / 项目"
                className="w-full bg-transparent text-sm outline-none placeholder:text-text-muted"
              />
            </div>
          </label>

          <label>
            <span className="mb-1.5 block text-xs text-text-muted">关注项目</span>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none"
            >
              {projectOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1.5 block text-xs text-text-muted">意向等级</span>
            <select
              value={intent}
              onChange={(e) => setIntent(e.target.value as IntentLevel | '全部')}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none"
            >
              {intentOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1.5 block text-xs text-text-muted">跟进状态</span>
            <select
              value={followFilter}
              onChange={(e) =>
                setFollowFilter(e.target.value as FollowUpStatus | '全部')
              }
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none"
            >
              {followUpOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface-card shadow-[0_1px_2px_rgba(44,41,38,0.04)]">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-text">客户列表</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            共 {filtered.length} 位客户 · 意向等级与跟进状态分开管理
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-muted">
                <th className="px-5 py-3 font-medium">客户姓名</th>
                <th className="px-5 py-3 font-medium">联系方式</th>
                <th className="px-5 py-3 font-medium">关注项目</th>
                <th className="px-5 py-3 font-medium">意向等级</th>
                <th className="px-5 py-3 font-medium">跟进状态</th>
                <th className="px-5 py-3 font-medium">标签</th>
                <th className="px-5 py-3 font-medium">最近预约</th>
                <th className="px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-sm text-text-muted"
                  >
                    暂无符合条件的客户
                  </td>
                </tr>
              ) : (
                filtered.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-border last:border-0 hover:bg-surface/60"
                  >
                    <td className="px-5 py-3.5 font-medium text-text">
                      {customer.name}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary">
                      {customer.phone}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary">
                      {customer.focusProject || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge type="intent" status={customer.intentLevel} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge
                        type="followup"
                        status={customer.followUpStatus}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {(customer.tags ?? []).slice(0, 2).map((tag) => (
                          <StatusBadge key={tag} type="tag" status={tag} />
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary">
                      {customer.lastAppointmentAt ?? '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => openDetail(customer)}
                        className="text-xs text-brand-600 hover:text-brand-700"
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4">
          <div className="my-6 w-full max-w-3xl rounded-xl border border-border bg-white p-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-text">
                  {selected.name} · 客户详情
                </h3>
                <p className="mt-1 text-xs text-text-muted">
                  customerId: {selected.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                关闭
              </button>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <section className="space-y-3 rounded-lg border border-border p-4">
                <h4 className="text-sm font-semibold text-text">基础资料</h4>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-text-muted">姓名</span>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-text-muted">
                    联系方式
                  </span>
                  <input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-text-muted">
                    关注项目
                  </span>
                  <select
                    value={editProjectId}
                    onChange={(e) => setEditProjectId(e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3 text-xs text-text-secondary">
                  <p>首次咨询：{selected.firstConsultAt ?? '—'}</p>
                  <p>最近咨询：{selected.lastConsultAt ?? '—'}</p>
                  <p>最近预约：{selected.lastAppointmentAt ?? '—'}</p>
                </div>
              </section>

              <section className="space-y-3 rounded-lg border border-border p-4">
                <h4 className="text-sm font-semibold text-text">
                  意向与跟进（分开管理）
                </h4>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-text-muted">
                    意向等级
                  </span>
                  <select
                    value={editIntent}
                    onChange={(e) =>
                      setEditIntent(e.target.value as IntentLevel)
                    }
                    className="w-full rounded-lg border border-border px-3 py-2"
                  >
                    {intentOptions
                      .filter((o) => o !== '全部')
                      .map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-text-muted">
                    判定原因
                  </span>
                  <textarea
                    value={editIntentReason}
                    onChange={(e) => setEditIntentReason(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-border px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-text-muted">
                    跟进状态
                  </span>
                  <select
                    value={editFollow}
                    onChange={(e) =>
                      setEditFollow(e.target.value as FollowUpStatus)
                    }
                    className="w-full rounded-lg border border-border px-3 py-2"
                  >
                    {followUpOptions
                      .filter((o) => o !== '全部')
                      .map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-text-muted">备注</span>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-border px-3 py-2"
                  />
                </label>
              </section>
            </div>

            <section className="mt-4 rounded-lg border border-border p-4">
              <h4 className="text-sm font-semibold text-text">客户标签</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {TAG_PRESETS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      editTags.includes(tag)
                        ? 'border-brand-300 bg-brand-50 text-brand-700'
                        : 'border-border text-text-secondary'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="自定义标签"
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={addCustomTag}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  添加
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {editTags.map((tag) => (
                  <StatusBadge key={tag} type="tag" status={tag} />
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={saveCustomer}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600"
                >
                  保存客户信息
                </button>
              </div>
            </section>

            <section className="mt-4 rounded-lg border border-border p-4">
              <h4 className="text-sm font-semibold text-text">历史咨询摘要</h4>
              <ul className="mt-2 divide-y divide-border">
                {consults.length === 0 ? (
                  <li className="py-4 text-sm text-text-muted">暂无咨询记录</li>
                ) : (
                  consults.slice(0, 5).map((r) => (
                    <li key={r.id} className="py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <StatusBadge type="topic" status={r.topic} />
                        <span className="text-xs text-text-muted">{r.time}</span>
                      </div>
                      <p className="mt-1 text-text-secondary">{r.summary}</p>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="mt-4 rounded-lg border border-border p-4">
              <h4 className="text-sm font-semibold text-text">
                历史预约（统一预约数据源）
              </h4>
              <ul className="mt-2 divide-y divide-border">
                {history.length === 0 ? (
                  <li className="py-4 text-sm text-text-muted">暂无预约记录</li>
                ) : (
                  history.map((apt) => (
                    <li key={apt.appointmentId} className="py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-text">{apt.serviceName}</p>
                        <StatusBadge type="appointment" status={apt.status} />
                      </div>
                      <p className="mt-1 text-xs text-text-secondary">
                        {apt.appointmentDate} {apt.startTime}–{apt.endTime} ·{' '}
                        {apt.staffName}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="mt-4 rounded-lg border border-border p-4">
              <h4 className="text-sm font-semibold text-text">待跟进事项</h4>
              <ul className="mt-2 divide-y divide-border">
                {followUps.length === 0 ? (
                  <li className="py-4 text-sm text-text-muted">暂无跟进事项</li>
                ) : (
                  followUps.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-start justify-between gap-3 py-2.5 text-sm"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-text">{task.title}</p>
                          <StatusBadge type="task" status={task.status} />
                          {task.category === 'manual_review' ? (
                            <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800">
                              转人工
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-text-secondary">
                          {task.note || '无备注'}
                          {task.dueDate ? ` · 计划 ${task.dueDate}` : ''}
                        </p>
                      </div>
                      {task.status === '待跟进' ? (
                        <button
                          type="button"
                          onClick={() => handleCompleteFollowUp(task.id)}
                          className="shrink-0 text-xs text-brand-600"
                        >
                          完成跟进
                        </button>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>

              <div className="mt-4 space-y-2 border-t border-border pt-4">
                <p className="text-xs font-medium text-text">添加跟进事项</p>
                <input
                  value={fuTitle}
                  onChange={(e) => setFuTitle(e.target.value)}
                  placeholder="跟进事项"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
                <input
                  value={fuNote}
                  onChange={(e) => setFuNote(e.target.value)}
                  placeholder="备注（可选）"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={fuDue}
                  min={getTodayDate()}
                  onChange={(e) => setFuDue(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddFollowUp}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600"
                >
                  添加跟进
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
