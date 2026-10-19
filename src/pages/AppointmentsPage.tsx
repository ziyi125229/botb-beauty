import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { services, technicians } from '../data/mockData'
import { getAvailableSlots } from '../lib/bookingService'
import { getTodayDate } from '../lib/dateUtils'
import { useAppData } from '../store/AppDataContext'
import { StatusBadge } from '../components/ui/StatusBadge'
import {
  APPOINTMENT_STATUS_LABEL,
  type Appointment,
  type AppointmentStatus,
} from '../types'

const statusOptions: Array<AppointmentStatus | '全部'> = [
  '全部',
  'pending_confirmation',
  'booked',
  'completed',
  'cancelled',
]

type ModalMode = 'create' | 'detail' | 'reschedule' | null

export function AppointmentsPage() {
  const {
    appointments,
    customers,
    createAppointment,
    confirmAppointment,
    completeAppointment,
    cancelAppointment,
    rescheduleAppointment,
  } = useAppData()

  const [keyword, setKeyword] = useState('')
  const [date, setDate] = useState('')
  const [status, setStatus] = useState<AppointmentStatus | '全部'>('全部')
  const [modal, setModal] = useState<ModalMode>(null)
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // create form
  const [formCustomerId, setFormCustomerId] = useState(customers[0]?.id ?? '')
  const [formServiceId, setFormServiceId] = useState(services[1]?.id ?? services[0]?.id ?? '')
  const [formDate, setFormDate] = useState(getTodayDate())
  const [formStaffId, setFormStaffId] = useState('')
  const [formStartTime, setFormStartTime] = useState('')
  const [formRemark, setFormRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // reschedule form
  const [rsDate, setRsDate] = useState('')
  const [rsStaffId, setRsStaffId] = useState('')
  const [rsStartTime, setRsStartTime] = useState('')

  const filtered = useMemo(() => {
    return appointments
      .filter((apt) => {
        const matchKeyword =
          !keyword ||
          apt.customerName.includes(keyword) ||
          apt.serviceName.includes(keyword) ||
          apt.staffName.includes(keyword)
        const matchDate = !date || apt.appointmentDate === date
        const matchStatus = status === '全部' || apt.status === status
        return matchKeyword && matchDate && matchStatus
      })
      .sort((a, b) =>
        `${b.appointmentDate}${b.startTime}`.localeCompare(
          `${a.appointmentDate}${a.startTime}`,
        ),
      )
  }, [appointments, keyword, date, status])

  const createSlots = useMemo(() => {
    if (!formServiceId || !formDate) return []
    return getAvailableSlots({
      appointments,
      serviceId: formServiceId,
      date: formDate,
      preferredStaffId: formStaffId || undefined,
      limit: 24,
    })
  }, [appointments, formServiceId, formDate, formStaffId])

  const rescheduleSlots = useMemo(() => {
    if (!selected || !rsDate) return []
    return getAvailableSlots({
      appointments,
      serviceId: selected.serviceId,
      date: rsDate,
      preferredStaffId: rsStaffId || undefined,
      excludeAppointmentId: selected.appointmentId,
      limit: 24,
    })
  }, [appointments, selected, rsDate, rsStaffId])

  const openCreate = () => {
    setError('')
    setSuccess('')
    setFormCustomerId(customers[0]?.id ?? '')
    setFormServiceId(services[1]?.id ?? services[0]?.id ?? '')
    setFormDate(getTodayDate())
    setFormStaffId('')
    setFormStartTime('')
    setFormRemark('')
    setModal('create')
  }

  const openDetail = (apt: Appointment) => {
    setSelected(apt)
    setError('')
    setSuccess('')
    setModal('detail')
  }

  const openReschedule = (apt: Appointment) => {
    setSelected(apt)
    setRsDate(apt.appointmentDate)
    setRsStaffId(apt.staffId)
    setRsStartTime('')
    setError('')
    setSuccess('')
    setModal('reschedule')
  }

  const handleCreate = () => {
    if (submitting) return
    setError('')
    const customer = customers.find((c) => c.id === formCustomerId)
    if (!customer) {
      setError('请选择客户。')
      return
    }
    if (!formStartTime) {
      setError('请选择可预约时间。')
      return
    }
    const slot = createSlots.find((s) => s.startTime === formStartTime)
    const staffId = formStaffId || slot?.staffId
    if (!staffId) {
      setError('请选择技师或可用时段。')
      return
    }

    setSubmitting(true)
    const result = createAppointment({
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone,
      serviceId: formServiceId,
      appointmentDate: formDate,
      startTime: formStartTime,
      staffId,
      remark: formRemark,
      source: 'manual',
      status: 'booked',
    })
    setSubmitting(false)

    if (!result.ok) {
      setError(result.error)
      return
    }
    setSuccess('预约创建成功。')
    setModal(null)
  }

  const handleConfirm = (apt: Appointment) => {
    const result = confirmAppointment(apt.appointmentId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setSuccess('预约已确认。')
    setSelected(result.appointment)
  }

  const handleComplete = (apt: Appointment) => {
    const result = completeAppointment(apt.appointmentId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setSuccess('已标记为完成。')
    setModal(null)
  }

  const handleCancel = (apt: Appointment) => {
    if (!window.confirm(`确认取消「${apt.customerName}」的预约吗？取消后档期将释放。`)) {
      return
    }
    const result = cancelAppointment(apt.appointmentId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setSuccess('预约已取消，档期已释放。')
    setModal(null)
  }

  const handleReschedule = () => {
    if (!selected || submitting) return
    if (!rsStartTime) {
      setError('请选择新的可用时段。')
      return
    }
    const slot = rescheduleSlots.find((s) => s.startTime === rsStartTime)
    const staffId = rsStaffId || slot?.staffId
    if (!staffId) {
      setError('请选择技师或时段。')
      return
    }

    setSubmitting(true)
    const result = rescheduleAppointment(selected.appointmentId, {
      date: rsDate,
      startTime: rsStartTime,
      staffId,
    })
    setSubmitting(false)

    if (!result.ok) {
      setError(result.error)
      return
    }
    setSuccess('改期成功，原时段已释放。')
    setModal(null)
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-5">
      {(error || success) && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-sm ${
            error
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {error || success}
        </div>
      )}

      <section className="rounded-xl border border-border bg-surface-card p-5 shadow-[0_1px_2px_rgba(44,41,38,0.04)]">
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-[220px] flex-1">
            <span className="mb-1.5 block text-xs text-text-muted">搜索</span>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
              <Search size={16} className="text-text-muted" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="客户姓名 / 项目 / 技师"
                className="w-full bg-transparent text-sm outline-none placeholder:text-text-muted"
              />
            </div>
          </label>

          <label>
            <span className="mb-1.5 block text-xs text-text-muted">日期</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs text-text-muted">状态</span>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as AppointmentStatus | '全部')
              }
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none"
            >
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === '全部' ? '全部' : APPOINTMENT_STATUS_LABEL[opt]}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            新建预约
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface-card shadow-[0_1px_2px_rgba(44,41,38,0.04)]">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-text">预约列表</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            共 {filtered.length} 条记录（统一数据源 · 本地持久化）
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-muted">
                <th className="px-5 py-3 font-medium">客户姓名</th>
                <th className="px-5 py-3 font-medium">预约时间</th>
                <th className="px-5 py-3 font-medium">护理项目</th>
                <th className="px-5 py-3 font-medium">服务技师</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-text-muted"
                  >
                    暂无符合条件的预约记录
                  </td>
                </tr>
              ) : (
                filtered.map((apt) => (
                  <tr
                    key={apt.appointmentId}
                    className="border-b border-border last:border-0 hover:bg-surface/60"
                  >
                    <td className="px-5 py-3.5 font-medium text-text">
                      {apt.customerName}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary">
                      {apt.appointmentDate} {apt.startTime}–{apt.endTime}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary">
                      {apt.serviceName}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary">
                      {apt.staffName}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge type="appointment" status={apt.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openDetail(apt)}
                          className="text-xs text-brand-600 hover:text-brand-700"
                        >
                          详情
                        </button>
                        {apt.status === 'pending_confirmation' && (
                          <button
                            type="button"
                            onClick={() => handleConfirm(apt)}
                            className="text-xs text-emerald-600 hover:text-emerald-700"
                          >
                            确认
                          </button>
                        )}
                        {(apt.status === 'booked' ||
                          apt.status === 'pending_confirmation') && (
                          <>
                            <button
                              type="button"
                              onClick={() => openReschedule(apt)}
                              className="text-xs text-text-secondary hover:text-text"
                            >
                              改期
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancel(apt)}
                              className="text-xs text-rose-600 hover:text-rose-700"
                            >
                              取消
                            </button>
                          </>
                        )}
                        {apt.status === 'booked' && (
                          <button
                            type="button"
                            onClick={() => handleComplete(apt)}
                            className="text-xs text-text-secondary hover:text-text"
                          >
                            完成
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-white p-5 shadow-lg">
            {modal === 'create' && (
              <>
                <h3 className="text-base font-semibold text-text">新建预约</h3>
                <p className="mt-1 text-xs text-text-muted">
                  提交前会校验技师档期冲突，失败不会写入记录。
                </p>
                <div className="mt-4 space-y-3 text-sm">
                  <label className="block">
                    <span className="mb-1 block text-xs text-text-muted">客户</span>
                    <select
                      value={formCustomerId}
                      onChange={(e) => setFormCustomerId(e.target.value)}
                      className="w-full rounded-lg border border-border px-3 py-2"
                    >
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}（{c.phone}）
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-text-muted">项目</span>
                    <select
                      value={formServiceId}
                      onChange={(e) => {
                        setFormServiceId(e.target.value)
                        setFormStartTime('')
                      }}
                      className="w-full rounded-lg border border-border px-3 py-2"
                    >
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {s.durationMinutes} 分钟
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-text-muted">日期</span>
                    <input
                      type="date"
                      value={formDate}
                      min={getTodayDate()}
                      onChange={(e) => {
                        setFormDate(e.target.value)
                        setFormStartTime('')
                      }}
                      className="w-full rounded-lg border border-border px-3 py-2"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-text-muted">
                      技师（可选，留空则自动匹配）
                    </span>
                    <select
                      value={formStaffId}
                      onChange={(e) => {
                        setFormStaffId(e.target.value)
                        setFormStartTime('')
                      }}
                      className="w-full rounded-lg border border-border px-3 py-2"
                    >
                      <option value="">自动匹配可用技师</option>
                      {technicians
                        .filter((t) => t.serviceIds.includes(formServiceId))
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-text-muted">
                      可用时段
                    </span>
                    <select
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full rounded-lg border border-border px-3 py-2"
                    >
                      <option value="">请选择</option>
                      {createSlots.map((s) => (
                        <option key={`${s.startTime}-${s.staffId}`} value={s.startTime}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    {createSlots.length === 0 && (
                      <p className="mt-1 text-xs text-rose-600">
                        该日期暂无可用时段，请更换日期或技师。
                      </p>
                    )}
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-text-muted">备注</span>
                    <input
                      value={formRemark}
                      onChange={(e) => setFormRemark(e.target.value)}
                      className="w-full rounded-lg border border-border px-3 py-2"
                      placeholder="可选"
                    />
                  </label>
                  {error && (
                    <p className="text-xs text-rose-600">{error}</p>
                  )}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="rounded-lg border border-border px-4 py-2 text-sm"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCreate}
                    className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    {submitting ? '提交中…' : '创建预约'}
                  </button>
                </div>
              </>
            )}

            {modal === 'detail' && selected && (
              <>
                <h3 className="text-base font-semibold text-text">预约详情</h3>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">客户</dt>
                    <dd>{selected.customerName}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">电话</dt>
                    <dd>{selected.phone ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">项目</dt>
                    <dd>{selected.serviceName}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">时长</dt>
                    <dd>{selected.durationMinutes} 分钟</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">日期时间</dt>
                    <dd>
                      {selected.appointmentDate} {selected.startTime}–
                      {selected.endTime}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">技师</dt>
                    <dd>{selected.staffName}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">状态</dt>
                    <dd>
                      <StatusBadge type="appointment" status={selected.status} />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">备注</dt>
                    <dd>{selected.remark || '—'}</dd>
                  </div>
                </dl>
                {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="rounded-lg border border-border px-4 py-2 text-sm"
                  >
                    关闭
                  </button>
                  {selected.status === 'pending_confirmation' && (
                    <button
                      type="button"
                      onClick={() => handleConfirm(selected)}
                      className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white"
                    >
                      确认预约
                    </button>
                  )}
                </div>
              </>
            )}

            {modal === 'reschedule' && selected && (
              <>
                <h3 className="text-base font-semibold text-text">改期</h3>
                <p className="mt-1 text-xs text-text-muted">
                  原预约：{selected.appointmentDate} {selected.startTime}–
                  {selected.endTime} · {selected.staffName}
                  <br />
                  仅在新时段校验通过后才会更新；失败保留原预约。
                </p>
                <div className="mt-4 space-y-3 text-sm">
                  <label className="block">
                    <span className="mb-1 block text-xs text-text-muted">新日期</span>
                    <input
                      type="date"
                      value={rsDate}
                      min={getTodayDate()}
                      onChange={(e) => {
                        setRsDate(e.target.value)
                        setRsStartTime('')
                      }}
                      className="w-full rounded-lg border border-border px-3 py-2"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-text-muted">技师</span>
                    <select
                      value={rsStaffId}
                      onChange={(e) => {
                        setRsStaffId(e.target.value)
                        setRsStartTime('')
                      }}
                      className="w-full rounded-lg border border-border px-3 py-2"
                    >
                      <option value="">自动匹配</option>
                      {technicians
                        .filter((t) => t.serviceIds.includes(selected.serviceId))
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-text-muted">新时段</span>
                    <select
                      value={rsStartTime}
                      onChange={(e) => setRsStartTime(e.target.value)}
                      className="w-full rounded-lg border border-border px-3 py-2"
                    >
                      <option value="">请选择</option>
                      {rescheduleSlots.map((s) => (
                        <option key={`${s.startTime}-${s.staffId}`} value={s.startTime}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    {rescheduleSlots.length === 0 && (
                      <p className="mt-1 text-xs text-rose-600">
                        暂无可用时段，请更换日期。
                      </p>
                    )}
                  </label>
                  {error && <p className="text-xs text-rose-600">{error}</p>}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="rounded-lg border border-border px-4 py-2 text-sm"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleReschedule}
                    className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {submitting ? '提交中…' : '确认改期'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
