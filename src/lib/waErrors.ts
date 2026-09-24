/** Maps Meta error codes to gate UI copy keys (docs/08-WHATSAPP-AND-AI.md section 2.7). */
export function waErrorKey(code: string | null): string {
  switch (code) {
    case '131026':
      return 'gate.done.waErrors.notOnWhatsapp'
    case '132000':
    case '132001':
      return 'gate.done.waErrors.setup'
    case '130429':
    case '131056':
      return 'gate.done.waErrors.busy'
    default:
      return 'gate.done.waErrors.other'
  }
}
