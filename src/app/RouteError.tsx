import { isRouteErrorResponse, useRouteError } from 'react-router'
import { ErrorFallback } from './ErrorFallback'
import { NotFoundPage } from './NotFoundPage'

/** Router errorElement. A failed lazy chunk after a deploy is fixed by one reload. */
export function RouteError() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />
  if (import.meta.env.DEV) console.error(error)
  return <ErrorFallback />
}
