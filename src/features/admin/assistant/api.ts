import { askAssistant as ask, getAssistantHistory as history } from '@/lib/demo/assistant'
import { call } from '@/lib/demo/client'
import type { AssistantInput, AssistantReply, AssistantToolUse } from '@/lib/demo/types'
import type { AssistantMessageRow } from '@/types/domain'

export type { AssistantInput, AssistantReply, AssistantToolUse }

/** admin-assistant. Read-only answers from live data, markdown reply plus the tools it used. */
export function askAssistant(input: AssistantInput): Promise<AssistantReply> {
  return call(() => ask(input))
}

/** Stored messages of one chat session, oldest first (user and assistant only). */
export function getAssistantHistory(sessionId: string): Promise<AssistantMessageRow[]> {
  return call(() => history(sessionId))
}
