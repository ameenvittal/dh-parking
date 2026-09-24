import { useCallback, useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isInstallEvent(e: Event): e is BeforeInstallPromptEvent {
  return 'prompt' in e && typeof (e as { prompt?: unknown }).prompt === 'function'
}

/** "Install app" in the staff account menu, shown when `beforeinstallprompt` fires (docs 02 section 10). */
export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<void> } {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      if (!isInstallEvent(e)) return
      e.preventDefault()
      setEvent(e)
    }
    const onInstalled = () => setEvent(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!event) return
    await event.prompt()
    await event.userChoice
    setEvent(null)
  }, [event])

  return { canInstall: event !== null, install }
}
