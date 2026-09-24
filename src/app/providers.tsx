import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { Toaster } from '@/components/ui/Toaster'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { i18n } from '@/lib/i18n'
import { AuthProvider } from './AuthProvider'
import { ErrorBoundary } from './ErrorBoundary'
import { queryClient } from './queryClient'

/** QueryClient, i18n, Toaster, AuthProvider (docs 02 section 4). */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider delayDuration={300}>
              {children}
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </I18nextProvider>
    </ErrorBoundary>
  )
}
