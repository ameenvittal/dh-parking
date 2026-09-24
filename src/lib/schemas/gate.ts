import { z } from 'zod'
import { VEHICLE_TYPES, VISITOR_CATEGORIES } from '@/types/domain'

/** Check-in step 2 (docs 07 section 3.2). Plate format is a warning, not a blocker. Messages are i18n keys. */
export const vehicleDetailsSchema = z.object({
  plateRaw: z
    .string()
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .pipe(z.string().min(4, 'gate.details.plateTooShort')),
  vehicleType: z.enum(VEHICLE_TYPES),
  category: z.enum(VISITOR_CATEGORIES),
  needsAccessible: z.boolean(),
  color: z.string().trim().max(40),
  make: z.string().trim().max(60),
  passNumber: z.string().trim().max(40),
  passHolderName: z.string().trim().max(80),
})
export type VehicleDetailsInput = z.input<typeof vehicleDetailsSchema>

/** Check-in step 3: 10 digits starting 6 to 9. */
export const driverPhoneStepSchema = z.object({
  number: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .pipe(z.string().regex(/^[6-9][0-9]{9}$/, 'errors.INVALID_PHONE')),
  name: z.string().trim().max(80),
  language: z.enum(['en', 'ml']),
})
export type DriverPhoneStepInput = z.input<typeof driverPhoneStepSchema>

/** Fee row on the slot step and the exit dialog. */
export const feeSchema = z.object({
  amount: z.number().min(0).max(100000),
  method: z.enum(['free', 'cash', 'upi']),
})
