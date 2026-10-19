import {
  CalendarDays,
  LayoutDashboard,
  MessageCircleMore,
  Megaphone,
  Sparkles,
  Users,
} from 'lucide-react'
import type { PageKey } from '../../types'
import { storeInfo } from '../../data/mockData'

interface NavItem {
  key: PageKey
  label: string
  icon: typeof LayoutDashboard
}

const navItems: NavItem[] = [
  { key: 'overview', label: '经营概览', icon: LayoutDashboard },
  { key: 'reception', label: 'AI 智能接待', icon: MessageCircleMore },
  { key: 'appointments', label: '预约管理', icon: CalendarDays },
  { key: 'customers', label: '客户管理', icon: Users },
  { key: 'marketing', label: '营销助手', icon: Megaphone },
]

interface SidebarProps {
  currentPage: PageKey
  onNavigate: (page: PageKey) => void
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface-card">
      <div className="border-b border-border px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
            <Sparkles size={18} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">BotB</p>
            <p className="truncate text-xs text-text-muted">{storeInfo.name}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = currentPage === item.key

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-brand-50 font-medium text-brand-700'
                  : 'text-text-secondary hover:bg-surface hover:text-text'
              }`}
            >
              <Icon
                size={18}
                strokeWidth={active ? 2 : 1.75}
                className={active ? 'text-brand-600' : 'text-text-muted'}
              />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-border px-5 py-4">
        <span className="inline-flex items-center rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text-muted">
          本地模拟版
        </span>
      </div>
    </aside>
  )
}
