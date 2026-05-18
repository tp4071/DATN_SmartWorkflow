import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { AppRouter } from './router/AppRouter'
import { ToastProvider } from './components/ui/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthExpiredListener } from './components/AuthExpiredListener'
import { queryClient } from './lib/queryClient'

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthExpiredListener />
          <AuthProvider>
            <NotificationProvider>
              <BrowserRouter>
                <AppRouter />
              </BrowserRouter>
            </NotificationProvider>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
