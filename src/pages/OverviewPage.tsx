import {
  ArrowRight,
  CalendarDays,
  Megaphone,
  MessageCircleMore,
  Users,
} from 'lucide-react'
import { storeInfo } from '../data/mockData'
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
  } = useAppData()

  const overviewStats = getOverviewStats()
  const todayAppointments = getTodayActiveAppointments()
  const followUpCustomers = getPendingFollowUpCustomers()
  const recentSessions = getRecentReceptionSessions(5)

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 pb-2">
      <section>
        <h2 className="text-xl font-semibold text-text">
          下午好，欢迎回到{storeInfo.name}
        </h2>
        <p className="mt-1.5 text-sm text-text-secondary">
          查看今日门店经营情况，及时跟进客户与预约。数据与各模块实时联动。
        </p>
      </section>

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
        </div>
      </section>
    </div>
  )
}
