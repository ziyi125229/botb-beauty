import {
  CalendarCheck,
  ClipboardList,
  MessageSquareText,
  UserRoundSearch,
} from 'lucide-react'
import type { StatCardData } from '../../types'

const iconMap = {
  consult: MessageSquareText,
  appointment: CalendarCheck,
  followup: UserRoundSearch,
  todo: ClipboardList,
}

interface StatCardProps {
  data: StatCardData
}

export function StatCard({ data }: StatCardProps) {
  const Icon = iconMap[data.icon]

  return (
    <div className="rounded-xl border border-border bg-surface-card p-5 shadow-[0_1px_2px_rgba(44,41,38,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">{data.label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-text">
            {data.value}
          </p>
          <p className="mt-2 text-xs text-text-muted">{data.description}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon size={20} strokeWidth={1.75} />
        </div>
      </div>
    </div>
  )
}
