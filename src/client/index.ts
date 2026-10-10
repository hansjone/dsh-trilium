/**
 * Browser-half entry for dsh-trilium — runs inside the dsh web GUI.
 *
 * Surfaces (matching dsh-search-mcp / netxops on Desktop 0.2):
 * - Always register `settings.section` (Settings sidebar).
 * - Do NOT use `settings.plugin.item` — missing on Desktop 0.2 and kills boot.
 * - Hard-inject only `slots` + `locale` (never `dsh-client-runtime` /
 *   `settingsScope` — removed in 0.2 and cause loud client-module failure).
 *
 * The card reads/writes the host JSON store through the /api/dsh-trilium
 * routes (no settings-namespace allowlist needed). Failure policy: mounting
 * problems are logged, never thrown — an external plugin must not take the
 * GUI down.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { TriliumApi } from './api.ts'
import { zh, type TriliumKey } from './locales.ts'
import { TriliumSettingsCard, type TriliumSettingsFace } from './TriliumSettingsCard.tsx'

/** Locale namespace this plugin owns. */
const NS = 'dsh-trilium'

/**
 * Settings sidebar section id. Keep distinct from the host Config namespace
 * `dsh-trilium` — colliding ids silently fail register and the nav entry
 * disappears (same lesson as dsh-search-mcp).
 */
const SECTION_ID = 'trilium'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** dsh-trilium surface copy. */
    'dsh-trilium': TriliumKey
  }
}

/**
 * Services that exist on every supported DSH client roster.
 * Do not list removed 0.1 packages (dsh-client-runtime) in package.json
 * `dsh.client.inject` — client-modules treats missing nodes as loud failure.
 */
export const inject = ['slots', 'locale']

/** Type-only surface. */
export type { TriliumSettingsCardProps } from './TriliumSettingsCard.tsx'
export type { TriliumKey } from './locales.ts'

/**
 * Mount the Trilium surfaces.
 * @param ctx - client root context (slots + locale services).
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en: zh }), 'dsh-trilium: dictionaries')

  const api = new TriliumApi()
  const t = ctx.locale.bind(NS) as (key: TriliumKey) => string

  // Settings sidebar — unconditional, same pattern as dsh-search-mcp / netxops.
  // Reads/writes ~/.dsh/dsh-trilium.json via /api/dsh-trilium/config.
  try {
    ctx.slots.inject('settings.section', () => {
      try {
        return ctx.slots.register({
          name: 'settings.section',
          id: SECTION_ID,
          order: 28,
          label: () => t('settings.title'),
          locale: NS,
          inject: (): TriliumSettingsFace => ({ api }),
        }, TriliumSettingsCard)
      } catch (error) {
        ctx.logger?.error?.('dsh-trilium: settings.section register failed: %s', error)
        return () => {}
      }
    })
  } catch (error) {
    ctx.logger?.warn?.('dsh-trilium: settings.section unavailable: %s', error)
  }
}
