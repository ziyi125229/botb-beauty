import { storeInfo } from '../../data/mockData'
import { useAppData } from '../../store/AppDataContext'
import type { PageKey } from '../../types'

const pageTitles: Record<PageKey, string> = {
  overview: '经营概览',
  reception: 'AI 智能接待',
  appointments: '预约管理',
  customers: '客户管理',
  marketing: '营销助手',
}

interface TopBarProps {
  currentPage: PageKey
}

export function TopBar({ currentPage }: TopBarProps) {
  const { getOverviewStats, storageError, clearStorageError } = useAppData()
  const pending = getOverviewStats().find((s) => s.id === 'todo')?.value ?? 0

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface-card px-5 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="shrink-0 text-base font-semibold text-text">
          {pageTitles[currentPage]}
        </h1>
        {storageError ? (
          <button
            type="button"
            onClick={clearStorageError}
            className="truncate rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700"
            title={storageError}
          >
            {storageError}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm">
        <span className="hidden text-text-secondary sm:inline">
          {storeInfo.name}
        </span>

        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {storeInfo.businessStatus}
        </span>

        <span className="text-text-secondary">
          待处理
          <span className="ml-1 font-medium text-brand-600">{pending}</span>
        </span>

        <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs text-text-muted">
          Demo 演示版
        </span>
      </div>
    </header>
  )
}
