import { call } from '@/lib/demo/client'
import * as sample from '@/lib/demo/sample'
import * as wa from '@/lib/demo/whatsapp'
import type { SimChat, SimMessage } from '@/lib/demo/types'

export type { SimChat, SimMessage }

/** Every phone number that received a message, newest chat first. */
export function listChats(): Promise<SimChat[]> {
  return call(() => wa.listChats())
}

export function getChat(phone: string): Promise<SimMessage[]> {
  return call(() => wa.getChat(phone))
}

/** Opening a chat marks its delivered messages as read. */
export function markChatRead(phone: string): Promise<void> {
  return call(() => wa.markChatRead(phone))
}

/** Tapping the template button marks that message read. */
export function markMessageRead(messageId: string): Promise<void> {
  return call(() => wa.markMessageRead(messageId))
}

/** A driver typing to the business number: triggers the webhook auto-reply. */
export function sendInbound(phone: string, text: string): Promise<void> {
  return call(() => wa.receiveInbound(phone, text))
}

/** DemoDock: about 120 visits across the event window. */
export function addSampleTraffic(count = 120): Promise<{ added: number }> {
  return call(() => sample.addSampleTraffic(count))
}

/** DemoDock: back to the seed in every tab. */
export function resetDemo(): Promise<void> {
  return call(() => sample.resetDemoData())
}

/** DemoDock GPS shortcuts. */
export function getDemoPlaces(): Promise<{ gate: [number, number] | null; mySlot: [number, number] | null }> {
  return call(() => sample.demoPlaces())
}
