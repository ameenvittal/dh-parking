import { QueryClient } from '@tanstack/react-query'
import { AppError } from '@/lib/errors'

const NO_RETRY = new Set(['FORBIDDEN', 'NOT_FOUND', 'TOKEN_INVALID', 'NO_LIVE_EVENT', 'BAD_REQUEST', 'INVALID_STATE'])

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof AppError && NO_RETRY.has(err.code)) && count < 2,
    },
    mutations: { retry: false },
  },
})
