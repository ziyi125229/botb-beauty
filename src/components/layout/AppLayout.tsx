import type { ReactNode } from 'react'
import type { PageKey } from '../../types'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

interface AppLayoutProps {
  currentPage: PageKey
  onNavigate: (page: PageKey) => void
  children: ReactNode
}

export function AppLayout({ currentPage, onNavigate, children }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar currentPage={currentPage} />
        <main className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
