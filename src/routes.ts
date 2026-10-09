/**
 * Host HTTP routes: the /api/dsh-trilium family the browser half calls.
 * Loopback-only (same trust model as dsh-ssh) — the config endpoint handles
 * the ETAPI token, so it must never be reachable from another origin.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { TriliumEtapi } from './etapi.ts'
import { TRILIUM_API, type ApiErrorBody, type TriliumConfigPatch, type TriliumConfigView, type TriliumTestResult } from './protocol.ts'
import { patchConfig, readConfig, toView, validatePatch, writeConfig } from './store.ts'

const MAX_JSON_BODY_BYTES = 1 << 20

/**
 * Same-origin + loopback guard. The remote address must be loopback (dsh web
 * binds loopback; an nginx reverse proxy therefore lands here as 127.0.0.1),
 * and a browser request must be same-origin (origin matches Host) and not
 * cross-site. The Host header itself is NOT required to be localhost, because
 * the GUI is commonly served through a reverse proxy on a public hostname.
 */
function isLoopbackRequest(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers.origin
  const host = req.headers.host
  if (origin !== undefined && host !== undefined) {
    try {
      return new URL(origin).host === host
    } catch {
      return false
    }
  }
  return true
}

/** One JSON response. */
function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'referrer-policy': 'no-referrer' })
  res.end(payload)
}

/** Read a JSON request body (undefined when too large or unparseable). */
async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > MAX_JSON_BODY_BYTES) return undefined
    chunks.push(buffer)
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

/** URL query helper (first value, decoded). */
function queryParam(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name)
  return value === null ? undefined : value
}

/** Route family dependencies. */
export interface TriliumRoutesDeps {
  etapi: TriliumEtapi
}

/**
 * Build every /api/dsh-trilium route (exact paths).
 * @param deps - the ETAPI client (config read through it stays live).
 * @returns the routes array.
 */
export function makeRoutes(deps: TriliumRoutesDeps): WebRoute[] {
  const { etapi } = deps

  const routes: WebRoute[] = [
    // ---------------------------------------------------------- config
    {
      kind: 'exact',
      path: TRILIUM_API.config,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: 'forbidden: loopback-only' })
          return
        }
        const method = req.method ?? 'GET'
        if (method === 'GET') {
          writeJson(res, 200, { config: toView(readConfig()) })
          return
        }
        if (method !== 'PUT') {
          writeJson(res, 405, { error: 'method not allowed: ' + method })
          return
        }
        const body = await readJsonBody(req)
        if (body === undefined) {
          writeJson(res, 400, { error: 'invalid JSON body' })
          return
        }
        const problem = validatePatch(body)
        if (problem !== undefined) {
          writeJson(res, 400, { error: problem })
          return
        }
        const current = readConfig()
        const next = patchConfig(current, body as unknown as TriliumConfigPatch)
        writeConfig(next)
        writeJson(res, 200, { config: toView(next) })
      },
    },
    // ------------------------------------------------------------ test
    {
      kind: 'exact',
      path: TRILIUM_API.test,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: 'forbidden: loopback-only' })
          return
        }
        if ((req.method ?? 'GET') !== 'POST') {
          writeJson(res, 405, { error: 'method not allowed: ' + req.method })
          return
        }
        const body = await readJsonBody(req)
        const baseUrl = typeof body?.baseUrl === 'string' && body.baseUrl !== '' ? body.baseUrl : undefined
        const token = typeof body?.token === 'string' && body.token !== '' ? body.token : undefined
        // Probe against the given (unsaved) values; fall back to the store.
        const config = readConfig()
        const probeBase = (baseUrl ?? config.baseUrl).replace(/\/$/, '')
        const probeToken = token ?? config.token
        const probe: TriliumTestResult = { ok: false }
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), config.timeoutMs)
        const start = Date.now()
        try {
          const response = await fetch(probeBase + '/app-info', {
            headers: { Authorization: probeToken },
            signal: controller.signal,
          })
          const latencyMs = Date.now() - start
          if (response.ok) {
            probe.ok = true
            probe.latencyMs = latencyMs
            probe.appInfo = await response.json()
          } else {
            probe.error = 'HTTP ' + response.status + ': ' + (await response.text()).slice(0, 200)
          }
        } catch (error) {
          probe.error = error instanceof Error ? error.message : String(error)
        } finally {
          clearTimeout(timer)
        }
        writeJson(res, probe.ok ? 200 : 502, { result: probe })
      },
    },
    // ---------------------------------------------------------- search
    {
      kind: 'exact',
      path: TRILIUM_API.search,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: 'forbidden: loopback-only' })
          return
        }
        if ((req.method ?? 'GET') !== 'GET') {
          writeJson(res, 405, { error: 'method not allowed: ' + req.method })
          return
        }
        const url = new URL(req.url ?? '/', 'http://localhost')
        const search = queryParam(url, 'search')
        if (search === undefined || search === '') {
          writeJson(res, 400, { error: 'search query parameter is required' })
          return
        }
        try {
          const results = await etapi.searchNotes({
            search,
            ancestorNoteId: queryParam(url, 'ancestorNoteId'),
            limit: Number.parseInt(queryParam(url, 'limit') ?? '50', 10),
          })
          writeJson(res, 200, { results })
        } catch (error) {
          writeJson(res, 502, { error: error instanceof Error ? error.message : String(error) } satisfies ApiErrorBody)
        }
      },
    },
    // ------------------------------------------------------------ note
    {
      kind: 'exact',
      path: TRILIUM_API.note,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: 'forbidden: loopback-only' })
          return
        }
        if ((req.method ?? 'GET') !== 'GET') {
          writeJson(res, 405, { error: 'method not allowed: ' + req.method })
          return
        }
        const url = new URL(req.url ?? '/', 'http://localhost')
        const noteId = queryParam(url, 'noteId')
        if (noteId === undefined || noteId === '') {
          writeJson(res, 400, { error: 'noteId query parameter is required' })
          return
        }
        const withContent = queryParam(url, 'content') === '1'
        try {
          const note = await etapi.getNote(noteId)
          const body: Record<string, unknown> = { note }
          if (withContent) {
            body.content = await etapi.getNoteContent(noteId)
          }
          writeJson(res, 200, body)
        } catch (error) {
          writeJson(res, 404, { error: error instanceof Error ? error.message : String(error) } satisfies ApiErrorBody)
        }
      },
    },
    // -------------------------------------------------------- children
    {
      kind: 'exact',
      path: TRILIUM_API.children,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: 'forbidden: loopback-only' })
          return
        }
        if ((req.method ?? 'GET') !== 'GET') {
          writeJson(res, 405, { error: 'method not allowed: ' + req.method })
          return
        }
        const url = new URL(req.url ?? '/', 'http://localhost')
        const noteId = queryParam(url, 'noteId') ?? 'root'
        try {
          const children = await etapi.listChildren(noteId)
          writeJson(res, 200, { noteId, children })
        } catch (error) {
          writeJson(res, 404, { error: error instanceof Error ? error.message : String(error) } satisfies ApiErrorBody)
        }
      },
    },
  ]

  return routes
}

export type { TriliumConfigView }