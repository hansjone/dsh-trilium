/**
 * dsh-trilium — host half. Mounts the ETAPI client, the /api/dsh-trilium
 * route family (config store + browser helpers), the agent tools
 * (trilium_*), the system-prompt announcement (plugin capabilities + memory
 * rules) and the live memory-index section (auto-injected per session when
 * enabled). The browser half (./client) renders the standalone settings
 * page (设置 → Trilium 记忆库).
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import { TriliumEtapi } from './etapi.ts'
import { buildMemoryIndex, readCachedIndex, TRILIUM_GUIDANCE } from './memory.ts'
import { readConfig } from './store.ts'
import { makeRoutes } from './routes.ts'
import {
  triliumAppInfoTool,
  triliumAttributeTool,
  triliumCreateNoteTool,
  triliumDeleteNoteTool,
  triliumExportTool,
  triliumGetNoteTool,
  triliumHistoryTool,
  triliumListChildrenTool,
  triliumSearchTool,
  triliumUndeleteNoteTool,
  triliumUpdateNoteTool,
} from './tools.ts'
import {
  triliumRecallTool,
  triliumRememberTool,
  triliumWeeklyReportTool,
} from './tools-memory.ts'
import {
  triliumAttachmentTool,
  triliumBackupTool,
  triliumCalendarTool,
  triliumCloneTool,
  triliumImportTool,
  triliumRevisionsTool,
} from './tools-extra.ts'

/** Stable cordis plugin name. */
export const name = 'trilium'

/** Services required before the Trilium surfaces can mount. */
export const inject = ['webServer', 'tools', 'systemPrompt']

/** Settings namespace the browser settings card is keyed by (plugin-config tab). */
export const TRILIUM_SETTINGS_NAMESPACE = 'dsh-trilium'

/**
 * Plugin config (cordis.yml). The ETAPI connection (baseUrl/token/memoryNoteId
 * /timeoutMs) and behavior switches (autoInject/deleteConfirm) live in
 * ~/.dsh/dsh-trilium.json (0600) and are edited on the settings page; only
 * these two cordis-level switches are configurable here.
 */
export interface Config {
  enabled?: boolean
  announceToAgent?: boolean
}

export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  announceToAgent: z.boolean().default(true),
})

/** Schema default, re-read for hand-built test contexts. */
const DEFAULT_ANNOUNCE = true

/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 150

/** Order of the live memory-index section (after the announcement). */
const MEMORY_SECTION_ORDER = 152

/** Prefix line for the injected index section. */
const TRILIUM_GUIDANCE_INDEX_PREFIX = '【Trilium 记忆索引（自动注入，autoInject 可关）】'

export function apply(ctx: Context, config?: Config): void {
  let current: () => Config = () => config ?? {}
  const resolve = (): Config => {
    const value = current()
    return {
      announceToAgent: value.announceToAgent ?? DEFAULT_ANNOUNCE,
      enabled: value.enabled ?? true,
    }
  }

  const etapi = new TriliumEtapi(() => readConfig())
  const routes = makeRoutes({ etapi })

  // Warm the memory-index cache in the background so the first session
  // assembly already has an index (the section provider reads cache sync).
  let indexReady = false
  const warmIndex = (): void => {
    if (indexReady) return
    indexReady = true
    void buildMemoryIndex(etapi, readConfig()).catch(() => undefined)
  }
  warmIndex()

  const toolFactories = [
    () => triliumAppInfoTool(etapi),
    () => triliumSearchTool(etapi),
    () => triliumGetNoteTool(etapi),
    () => triliumListChildrenTool(etapi),
    () => triliumCreateNoteTool(etapi, () => readConfig()),
    () => triliumUpdateNoteTool(etapi),
    () => triliumDeleteNoteTool(etapi, () => readConfig()),
    () => triliumUndeleteNoteTool(etapi),
    () => triliumAttributeTool(etapi),
    () => triliumExportTool(etapi),
    () => triliumHistoryTool(etapi),
    () => triliumRememberTool(etapi, () => readConfig()),
    () => triliumRecallTool(etapi, () => readConfig()),
    () => triliumWeeklyReportTool(etapi, () => readConfig()),
    () => triliumCloneTool(etapi),
    () => triliumAttachmentTool(etapi),
    () => triliumCalendarTool(etapi),
    () => triliumBackupTool(etapi),
    () => triliumImportTool(etapi),
    () => triliumRevisionsTool(etapi),
  ]

  let disposeSection: (() => void) | undefined
  let disposeMemorySection: (() => void) | undefined
  let disposeRoutes: (() => void) | undefined
  let disposeTools: (() => void) | undefined

  const sync = (): void => {
    if (disposeSection !== undefined) { disposeSection(); disposeSection = undefined }
    if (disposeMemorySection !== undefined) { disposeMemorySection(); disposeMemorySection = undefined }
    if (disposeRoutes !== undefined) { disposeRoutes(); disposeRoutes = undefined }
    if (disposeTools !== undefined) { disposeTools(); disposeTools = undefined }
    const value = resolve()
    if (!value.enabled) return
    if (value.announceToAgent) {
      disposeSection = ctx.systemPrompt.section({
        name: 'plugin:dsh-trilium',
        order: SECTION_ORDER,
        text: TRILIUM_GUIDANCE,
      })
    }
    disposeMemorySection = ctx.systemPrompt.section({
      name: 'plugin:dsh-trilium:memory-index',
      order: MEMORY_SECTION_ORDER,
      text: () => {
        const cfg = readConfig()
        if (!cfg.autoInject) return ''
        void buildMemoryIndex(etapi, cfg).catch(() => undefined)
        return '\n' + TRILIUM_GUIDANCE_INDEX_PREFIX + '\n' + readCachedIndex()
      },
    })
    disposeRoutes = ctx.effect(
      () => {
        const disposers = routes.map(route => ctx.webServer.register(route))
        return () => { for (const dispose of disposers) dispose() }
      },
      'dsh-trilium: routes',
    )
    disposeTools = ctx.effect(
      () => {
        const disposers = toolFactories.map(factory => ctx.tools.register(factory()))
        return () => { for (const dispose of disposers) dispose() }
      },
      'dsh-trilium: tools',
    )
  }

  // Follow the host Config row (enabled / announceToAgent). The ETAPI
  // connection values live in ~/.dsh/dsh-trilium.json; the browser settings
  // section (settings.section id=trilium) reads/writes them through
  // /api/dsh-trilium routes.
  // DSH ≥0.1.2: installSection on the settings provider.
  // DSH ≥0.1.7 / 0.2.0: no installSection — Config projection via describe().
  ctx.inject(['settings'], (settingsCtx) => {
    const settings = settingsCtx.settings as {
      installSection?: (
        context: Context,
        ns: string,
        schema: z<Config>,
        base: Config,
        hooks: { setSource: (source: () => Config) => void, onChange: () => void },
      ) => void
      describe?: () => unknown
    }
    const hooks = {
      setSource: (source: () => Config) => {
        current = source
        sync()
      },
      onChange: sync,
    }
    if (typeof settings.installSection === 'function') {
      settings.installSection(ctx, TRILIUM_SETTINGS_NAMESPACE, Config, config ?? {}, hooks)
      return
    }
    const describeRows = (describe: unknown): Array<{ ns?: string, value?: unknown }> => {
      if (typeof describe !== 'function') return []
      try {
        const raw = (describe as () => unknown)()
        if (Array.isArray(raw)) return raw as Array<{ ns?: string, value?: unknown }>
        if (raw && typeof raw === 'object' && Array.isArray((raw as { namespaces?: unknown }).namespaces)) {
          return (raw as { namespaces: Array<{ ns?: string, value?: unknown }> }).namespaces
        }
      } catch { /* settling */ }
      return []
    }
    const readLive = (): Config => {
      const row = describeRows(settings.describe).find(item => item.ns === TRILIUM_SETTINGS_NAMESPACE)
      if (row?.value !== null && typeof row?.value === 'object' && !Array.isArray(row.value)) {
        return { ...(config ?? {}), ...(row.value as Partial<Config>) }
      }
      return config ?? {}
    }
    hooks.setSource(readLive)
    hooks.onChange()
    let last = JSON.stringify(readLive())
    const timer = setInterval(() => {
      const next = readLive()
      const fingerprint = JSON.stringify(next)
      if (fingerprint === last) return
      last = fingerprint
      hooks.onChange()
    }, 2_000)
    settingsCtx.effect(() => () => clearInterval(timer), 'dsh-trilium: settings describe poll')
    settingsCtx.logger?.info?.(
      'dsh-trilium: following settings via describe() (no installSection — DSH ≥0.1.7 path)',
    )
  })

  sync()
}