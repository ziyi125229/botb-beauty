import { useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { OverviewPage } from './pages/OverviewPage'
import { ReceptionPage } from './pages/ReceptionPage'
import { AppointmentsPage } from './pages/AppointmentsPage'
import { CustomersPage } from './pages/CustomersPage'
import { MarketingPage } from './pages/MarketingPage'
import { AppDataProvider } from './store/AppDataContext'
import type { PageKey } from './types'

function AppShell() {
  const [currentPage, setCurrentPage] = useState<PageKey>('overview')

  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewPage onNavigate={setCurrentPage} />
      case 'reception':
        return <ReceptionPage />
      case 'appointments':
        return <AppointmentsPage />
      case 'customers':
        return <CustomersPage />
      case 'marketing':
        return <MarketingPage />
      default:
        return <OverviewPage onNavigate={setCurrentPage} />
    }
  }

  return (
    <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </AppLayout>
  )
}

export default function App() {
  return (
    <AppDataProvider>
      <AppShell />
    </AppDataProvider>
  )
}
