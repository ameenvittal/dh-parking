/** 10 digits starting 6 to 9, optionally prefixed with +91, 91 or 0. Returns +91XXXXXXXXXX or null. */
export function normalizeIndianPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (!/^[6-9][0-9]{9}$/.test(digits)) return null
  return `+91${digits}`
}

/** `+919876543210` becomes `+91 98xxxxxx10`. */
export function maskPhone(e164: string): string {
  const d = e164.replace(/\D/g, '').slice(-10)
  if (d.length < 10) return e164
  return `+91 ${d.slice(0, 2)}xxxxxx${d.slice(-2)}`
}

/** `+919876543210` becomes `+91 98765 43210`. */
export function formatPhone(e164: string): string {
  const d = e164.replace(/\D/g, '').slice(-10)
  if (d.length < 10) return e164
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`
}

/** Live formatting for the phone input: 5 + 5 digits. */
export function formatPhoneInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10)
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d
}

/** E.164 without the plus, as the WhatsApp Cloud API wants it. */
export function toWaNumber(e164: string): string {
  return e164.replace(/\D/g, '')
}
