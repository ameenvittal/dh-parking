import { z } from 'zod'

/** Staff sign in (docs 07 section 1.1). Messages are i18n keys. */
export const staffLoginSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'errors.BAD_CREDENTIALS'),
  password: z.string().min(1, 'errors.BAD_CREDENTIALS'),
})
export type StaffLoginValues = z.infer<typeof staffLoginSchema>

/** Driver phone login: 10 digits starting 6 to 9 (docs 07 section 1.3). */
export const driverPhoneSchema = z.object({
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .pipe(z.string().regex(/^[6-9][0-9]{9}$/, 'errors.INVALID_PHONE')),
})
export type DriverPhoneInput = z.input<typeof driverPhoneSchema>
