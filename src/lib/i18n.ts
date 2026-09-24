import i18n, { type BackendModule, type ReadCallback, type ResourceKey } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { DEFAULTS } from '@/config/app'
import type { Language } from '@/types/domain'

/**
 * docs/10-I18N.md section 1. `common`, `driver` and `errors` are bundled in the
 * main chunk so driver pages render instantly; the rest load on demand.
 * Keys are written `t('ns.key')`: the namespace separator is a dot, and a leading
 * segment is treated as a namespace only when it is one of NAMESPACES.
 */

export const LANGUAGES: readonly Language[] = ['en', 'ml']
export const NAMESPACES = ['common', 'driver', 'gate', 'zone', 'admin', 'map', 'reports', 'errors', 'sim'] as const
export type Namespace = (typeof NAMESPACES)[number]

const BUNDLED: readonly Namespace[] = ['common', 'driver', 'errors']

type JsonModule = { default: ResourceKey }

const eager = import.meta.glob<JsonModule>(
  ['../locales/*/common.json', '../locales/*/driver.json', '../locales/*/errors.json'],
  { eager: true },
)
const lazy = import.meta.glob<JsonModule>([
  '../locales/*/*.json',
  '!../locales/*/common.json',
  '!../locales/*/driver.json',
  '!../locales/*/errors.json',
])

function pathFor(lng: string, ns: string): string {
  return `../locales/${lng}/${ns}.json`
}

const resources: Record<string, Record<string, ResourceKey>> = {}
for (const lng of LANGUAGES) {
  resources[lng] = {}
  for (const ns of BUNDLED) {
    const mod = eager[pathFor(lng, ns)]
    resources[lng][ns] = mod ? mod.default : {}
  }
}

const lazyBackend: BackendModule = {
  type: 'backend',
  init() {},
  read(lng: string, ns: string, callback: ReadCallback) {
    const loader = lazy[pathFor(lng, ns)]
    if (!loader) {
      callback(null, {})
      return
    }
    loader()
      .then((mod) => callback(null, mod.default))
      .catch((err: unknown) => callback(err instanceof Error ? err : new Error(String(err)), null))
  },
}

function applyHtmlLang(lng: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = lng === 'ml' ? 'ml' : 'en'
}

void i18n
  .use(lazyBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    partialBundledLanguages: true,
    supportedLngs: [...LANGUAGES],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    fallbackLng: 'en',
    ns: [...NAMESPACES],
    defaultNS: 'common',
    fallbackNS: 'common',
    nsSeparator: '.',
    keySeparator: '.',
    interpolation: { escapeValue: false },
    returnNull: false,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: DEFAULTS.langStorageKey,
      caches: ['localStorage'],
    },
    react: { useSuspense: true, bindI18n: 'languageChanged loaded', bindI18nStore: 'added' },
  })

applyHtmlLang(i18n.resolvedLanguage ?? 'en')
i18n.on('languageChanged', (lng) => {
  applyHtmlLang(lng)
  try {
    localStorage.setItem(DEFAULTS.langStorageKey, lng)
  } catch {
    /* storage blocked: language still changes for this page */
  }
})

export function currentLanguage(): Language {
  return i18n.resolvedLanguage === 'ml' ? 'ml' : 'en'
}

export function setLanguage(lng: Language): Promise<unknown> {
  return i18n.changeLanguage(lng)
}

/**
 * Apply a language that came from the backend (driver `preferred_language`,
 * staff profile) only when the user has not picked one on this device.
 */
export function applyPreferredLanguage(lng: Language): void {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(DEFAULTS.langStorageKey)
  } catch {
    stored = null
  }
  if (!stored && lng !== currentLanguage()) void i18n.changeLanguage(lng)
}

export { i18n }
