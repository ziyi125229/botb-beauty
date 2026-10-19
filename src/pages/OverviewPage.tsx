import { useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  Megaphone,
  MessageCircleMore,
  Play,
  RotateCcw,
  Users,
} from 'lucide-react'
import { storeInfo } from '../data/mockData'
import {
  PRESENTATION_STEPS,
  PRESENTATION_SERVICE_NAME,
} from '../data/presentation'
import { useAppData } from '../store/AppDataContext'
import { StatCard } from '../components/ui/StatCard'
import { StatusBadge } from '../components/ui/StatusBadge'
import type { PageKey } from '../types'

interface OverviewPageProps {
  onNavigate: (page: PageKey) => void
}

const quickActions: {
  key: PageKey
  label: string
  description: string
  icon: typeof MessageCircleMore
}[] = [
  {
    key: 'reception',
    label: '开始 AI 接待',
    description: '进入智能接待工作台',
    icon: MessageCircleMore,
  },
  {
    key: 'appointments',
    label: '查看预约',
    description: '管理今日预约排期',
    icon: CalendarDays,
  },
  {
    key: 'customers',
    label: '查看客户',
    description: '跟进意向与客户资料',
    icon: Users,
  },
  {
    key: 'marketing',
    label: '创建营销方案',
    description: '生成门店营销内容',
    icon: Megaphone,
  },
]

export function OverviewPage({ onNavigate }: OverviewPageProps) {
  const {
    getOverviewStats,
    getTodayActiveAppointments,
    getPendingFollowUpCustomers,
    getRecentReceptionSessions,
    startPresentationFocus,
    resetLocalData,
  } = useAppData()

  const [showGuide, setShowGuide] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetToast, setResetToast] = useState('')

  const overviewStats = getOverviewStats()
  const todayAppointments = getTodayActiveAppointments()
  const followUpCustomers = getPendingFollowUpCustomers()
  const recentSessions = getRecentReceptionSessions(5)

  const handleStartPresentation = () => {
    startPresentationFocus()
    setShowGuide(false)
    onNavigate('reception')
  }

  const handleReset = () => {
    resetLocalData()
    setConfirmReset(false)
    setResetToast('已恢复默认虚拟门店数据，各页面已同步更新。')
    window.setTimeout(() => setResetToast(''), 2800)
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 pb-2">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text">
            下午好，欢迎回到{storeInfo.name}
          </h2>
          <p className="mt-1.5 text-sm text-text-secondary">
            查看今日门店经营情况，及时跟进客户与预约。数据与各模块实时联动。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <Play size={16} fill="currentColor" />
          开始演示
        </button>
      </section>

      {resetToast ? (
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-800">
          {resetToast}
        </div>
      ) : null}

      {showGuide ? (
        <section className="rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50/80 to-surface-card p-5 shadow-[0_1px_2px_rgba(44,41,38,0.04)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text">路演演示流程</h3>
              <p className="mt-1 text-xs text-text-secondary">
                贯穿客户：林女士 · 关注「{PRESENTATION_SERVICE_NAME}」·
                初始为新客尚未预约。全程使用真实联动数据，不伪造统计。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="text-xs text-text-muted hover:text-text"
            >
              收起
            </button>
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {PRESENTATION_STEPS.map((item) => (
              <li
                key={item.step}
                className="rounded-lg border border-border bg-surface-card px-3 py-3"
              >
                <p className="text-[11px] font-medium text-brand-600">
                  步骤 {item.step}
                </p>
                <p className="mt-1 text-sm font-medium text-text">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                  {item.detail}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleStartPresentation}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Play size={15} fill="currentColor" />
              开始演示
            </button>
            <p className="text-xs text-text-muted">
              将进入 AI 接待，并自动打开林女士会话
            </p>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewStats.map((stat) => (
          <StatCard key={stat.id} data={stat} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-xl border border-border bg-surface-card shadow-[0_1px_2px_rgba(44,41,38,0.04)]">
          <div className="flex h-12 items-center justify-between border-b border-border px-5">
            <h3 className="text-sm font-semibold text-text">今日预约</h3>
            <button
              type="button"
              onClick={() => onNavigate('appointments')}
              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
            >
              查看全部
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="px-5 py-2.5 font-medium">客户姓名</th>
                  <th className="px-5 py-2.5 font-medium">预约时间</th>
                  <th className="px-5 py-2.5 font-medium">护理项目</th>
                  <th className="px-5 py-2.5 font-medium">服务技师</th>
                  <th className="px-5 py-2.5 font-medium">预约状态</th>
                </tr>
              </thead>
              <tbody>
                {todayAppointments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-sm text-text-muted"
                    >
                      今日暂无待确认或已预约记录
                    </td>
                  </tr>
                ) : (
                  todayAppointments.slice(0, 5).map((apt) => (
                    <tr
                      key={apt.appointmentId}
                      className="border-b border-border last:border-0 hover:bg-surface/60"
                    >
                      <td className="px-5 py-3 font-medium text-text">
                        {apt.customerName}
                      </td>
                      <td className="px-5 py-3 text-text-secondary">
                        {apt.startTime}–{apt.endTime}
                      </td>
                      <td className="px-5 py-3 text-text-secondary">
                        {apt.serviceName}
                      </td>
                      <td className="px-5 py-3 text-text-secondary">
                        {apt.staffName}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge type="appointment" status={apt.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-card shadow-[0_1px_2px_rgba(44,41,38,0.04)]">
          <div className="flex h-12 items-center justify-between border-b border-border px-5">
            <h3 className="text-sm font-semibold text-text">待跟进客户</h3>
            <button
              type="button"
              onClick={() => onNavigate('customers')}
              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
            >
              查看全部
              <ArrowRight size={14} />
            </button>
          </div>
          <ul className="divide-y divide-border">
            {followUpCustomers.slice(0, 3).map((customer) => (
              <li key={customer.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text">{customer.name}</p>
                    <p className="mt-1 truncate text-xs text-text-secondary">
                      关注：{customer.focusProject}
                    </p>
                  </div>
                  <StatusBadge type="intent" status={customer.intentLevel} />
                </div>
                <div className="mt-2">
                  <StatusBadge type="followup" status={customer.followUpStatus} />
                </div>
              </li>
            ))}
            {followUpCustomers.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-text-muted">
                暂无待跟进客户
              </li>
            )}
          </ul>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-xl border border-border bg-surface-card shadow-[0_1px_2px_rgba(44,41,38,0.04)]">
          <div className="flex h-12 items-center justify-between border-b border-border px-5">
            <h3 className="text-sm font-semibold text-text">最近接待记录</h3>
            <button
              type="button"
              onClick={() => onNavigate('reception')}
              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
            >
              进入接待台
              <ArrowRight size={14} />
            </button>
          </div>
          <ul className="divide-y divide-border">
            {recentSessions.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-text-muted">
                暂无接待会话
              </li>
            ) : (
              recentSessions.map((session) => (
                <li key={session.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <p className="shrink-0 text-sm font-medium text-text">
                        {session.customerName}
                      </p>
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[11px] ${
                          session.status === '进行中'
                            ? 'border-brand-200 bg-brand-50 text-brand-700'
                            : 'border-border bg-surface text-text-muted'
                        }`}
                      >
                        {session.status}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-text-muted">
                      {session.time}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-sm leading-relaxed text-text-secondary">
                    {session.lastMessage}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface-card shadow-[0_1px_2px_rgba(44,41,38,0.04)]">
          <div className="flex h-12 items-center border-b border-border px-5">
            <h3 className="text-sm font-semibold text-text">快捷操作</h3>
          </div>
          <div className="space-y-1 p-2.5">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => onNavigate(action.key)}
                  className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-surface"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Icon size={18} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">{action.label}</p>
                    <p className="text-xs text-text-muted">{action.description}</p>
                  </div>
                  <ArrowRight size={16} className="shrink-0 text-text-muted" />
                </button>
              )
            })}
          </div>

          <div className="border-t border-border px-4 py-3">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-text-secondary transition-colors hover:border-border hover:bg-surface hover:text-text"
              >
                <RotateCcw size={14} />
                重置演示数据
              </button>
            ) : (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="text-xs leading-relaxed text-amber-900">
                  将清空当前本地变更，并恢复默认虚拟门店数据。此操作不可撤销，且不影响任何外部真实系统。
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex-1 rounded-md bg-amber-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
                  >
                    确认重置
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="flex-1 rounded-md border border-border bg-surface-card px-2 py-1.5 text-xs text-text-secondary hover:bg-surface"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
