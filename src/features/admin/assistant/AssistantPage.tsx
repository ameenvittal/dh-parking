import { AssistantChat } from './AssistantChat'

/** Assistant `/admin/assistant` (docs/07 section 5.9, F-ADM-08). Read-only answers from live data. */
export function AssistantPage() {
  return (
    <div className="mx-auto flex h-[calc(100vh-10rem)] min-h-[520px] w-full max-w-assistant flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-raised">
      <AssistantChat />
    </div>
  )
}
