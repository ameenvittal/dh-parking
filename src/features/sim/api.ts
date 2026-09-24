import { call } from '@/lib/demo/client'
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
