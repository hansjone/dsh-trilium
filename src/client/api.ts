/**
 * Browser-side API client for the /api/dsh-trilium route family. The only
 * data access path the settings card and sidebar panel use — plain fetch,
 * same origin (loopback).
 */

import {
  TRILIUM_API,
  type TriliumChildSummary,
  type TriliumConfigPatch,
  type TriliumConfigView,
  type TriliumNote,
  type TriliumSearchResult,
  type TriliumTestResult,
} from '../protocol.ts'

/** Error carrying the route's JSON error message. */
export class TriliumApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TriliumApiError'
  }
}

/** Parse a JSON response or throw a TriliumApiError. */
async function readJson<T>(response: Response): Promise<T> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new TriliumApiError('HTTP ' + response.status + ': invalid JSON response')
  }
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : 'HTTP ' + response.status
    throw new TriliumApiError(message)
  }
  return body as T
}

/** Query-string helper. */
function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text === '' ? '' : '?' + text
}

/** The browser half's data entry point. */
export class TriliumApi {
  // ------------------------------------------------------------ config
  async getConfig(): Promise<TriliumConfigView> {
    const response = await fetch(TRILIUM_API.config)
    const body = await readJson<{ config: TriliumConfigView }>(response)
    return body.config
  }

  async putConfig(patch: TriliumConfigPatch): Promise<TriliumConfigView> {
    const response = await fetch(TRILIUM_API.config, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const body = await readJson<{ config: TriliumConfigView }>(response)
    return body.config
  }

  /** Test a candidate connection (unsaved values allowed). */
  async test(baseUrl: string, token: string): Promise<TriliumTestResult> {
    const response = await fetch(TRILIUM_API.test, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseUrl, token }),
    })
    const body = await readJson<{ result: TriliumTestResult }>(response)
    return body.result
  }

  // ------------------------------------------------------------- notes
  async search(search: string, ancestorNoteId?: string): Promise<TriliumSearchResult[]> {
    const response = await fetch(TRILIUM_API.search + query({ search, ancestorNoteId }))
    const body = await readJson<{ results: TriliumSearchResult[] }>(response)
    return body.results
  }

  async getNote(noteId: string, withContent = false): Promise<{ note: TriliumNote; content?: string }> {
    const response = await fetch(TRILIUM_API.note + query({ noteId, content: withContent ? 1 : undefined }))
    return readJson<{ note: TriliumNote; content?: string }>(response)
  }

  async getChildren(noteId = 'root'): Promise<TriliumChildSummary[]> {
    const response = await fetch(TRILIUM_API.children + query({ noteId }))
    const body = await readJson<{ noteId: string; children: TriliumChildSummary[] }>(response)
    return body.children
  }
}
