/** Kept identical to the server-side copy described in docs/08-WHATSAPP-AND-AI.md section 3.3. */
const STANDARD = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/
const BH_SERIES = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/

export function normalizePlate(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isValidIndianPlate(plate: string): boolean {
  const p = normalizePlate(plate)
  return STANDARD.test(p) || BH_SERIES.test(p)
}
