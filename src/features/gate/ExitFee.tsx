import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useCurrentEvent } from '@/hooks/useCurrentEvent'
import type { PaymentMethod, VehicleType, VisitorCategory } from '@/types/domain'
import { setVisitFee } from './api'

type FeeVisit = { id: string; vehicle_type: VehicleType; category: VisitorCategory; payment_method: PaymentMethod }

/**
 * Exit fee rule (docs/07 section 3.3): paid parking, no fee recorded yet, a fee rule above 0
 * and a category that is not exempt means the exit dialog asks for the fee first.
 */
export function useExitFee(_eventId: string, visit: FeeVisit | null) {
  const { event } = useCurrentEvent()
  const rule = visit && event ? (event.fee_rules[visit.vehicle_type] ?? 0) : 0
  const exempt = visit && event ? event.fee_exempt_categories.includes(visit.category) : true
  const needed = Boolean(event?.paid_parking && visit && visit.payment_method === 'free' && rule > 0 && !exempt)
  const [amount, setAmount] = useState(rule)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  useEffect(() => {
    setAmount(rule)
    setMethod('cash')
  }, [visit?.id, rule])

  return {
    needed,
    amount,
    method,
    setAmount,
    setMethod,
    save: async (visitId: string) => {
      if (needed) await setVisitFee(visitId, method === 'free' ? 0 : amount, method)
    },
  }
}

export type ExitFeeState = ReturnType<typeof useExitFee>

/** Amount plus Cash, UPI, Free, shown in the exit dialog when a fee is due. */
export function ExitFeeFields({ fee }: { fee: ExitFeeState }) {
  const { t } = useTranslation('gate')
  return (
    <div className="flex flex-col gap-3">
      <Field label={t('gate.fee.amount')} htmlFor="exit-fee" helper={t('gate.fee.dueHelper')}>
        <Input
          id="exit-fee"
          inputMode="numeric"
          value={fee.method === 'free' ? '0' : String(fee.amount)}
          disabled={fee.method === 'free'}
          onChange={(e) => fee.setAmount(Number(e.target.value.replace(/\D/g, '')) || 0)}
        />
      </Field>
      <SegmentedControl<PaymentMethod>
        ariaLabel={t('gate.fee.method')}
        value={fee.method}
        onChange={fee.setMethod}
        options={[
          { value: 'cash', label: t('common.enums.paymentMethod.cash') },
          { value: 'upi', label: t('common.enums.paymentMethod.upi') },
          { value: 'free', label: t('common.enums.paymentMethod.free') },
        ]}
      />
    </div>
  )
}
