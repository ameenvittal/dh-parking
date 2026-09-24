import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Label } from './Label'

type FieldProps = {
  label?: ReactNode
  htmlFor?: string
  helper?: ReactNode
  error?: ReactNode
  className?: string
  children: ReactNode
}

/** Label above, control, then helper or error text below (docs 06 section 6). */
export function Field({ label, htmlFor, helper, error, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
      {error ? (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      ) : helper ? (
        <p className="text-body-sm text-muted">{helper}</p>
      ) : null}
    </div>
  )
}
