/**
 * ETAPI client: the full Trilium REST surface the tools and routes need.
 * Thin fetch wrapper — every call carries the Authorization token, obeys the
 * configured timeout, and normalizes errors into TriliumApiError.
 *
 * Known ETAPI quirks (encoded here so tools stay simple):
 *  - PATCH /notes/:id rejects a content field (PROPERTY_NOT_ALLOWED);
 *    content goes through PUT /notes/:id/content with text/plain body.
 *  - GET /notes/:id/content returns raw text (not JSON).
 *  - Attachment uploads take base64 in the JSON body; downloads are binary.
 */

import { readFileSync } from 'node:fs'
import type {
  CreateAttachmentPayload,
  CreateBranchPayload,
  CalendarNoteType,
  TriliumAppInfo,
  TriliumAttachment,
  TriliumAttribute,
  TriliumBranch,
  TriliumChildSummary,
  TriliumConfig,
  TriliumNote,
  TriliumRecentChange,
  TriliumRevision,
  TriliumSearchResult,
} from './protocol.ts'

/** Error carrying ETAPI's {status, code, message} shape. */
export class TriliumApiError extends Error {
  readonly status: number | undefined
  readonly code: string | undefined

  constructor(message: string, status?: number, code?: string) {
    super(message)
    this.name = 'TriliumApiError'
    this.status = status
    this.code = code
  }
}

/** Search parameter bag (GET /notes). */
export interface SearchParams {
  search: string
  fastSearch?: boolean
  includeArchivedNotes?: boolean
  ancestorNoteId?: string
  ancestorDepth?: string
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
  limit?: number
  debug?: boolean
}

/** Create-note payload (POST /create-note). */
export interface CreateNotePayload {
  parentNoteId: string
  title: string
  type?: string
  mime?: string
  content?: string
  notePosition?: number
  prefix?: string
  isExpanded?: boolean
  noteId?: string
  branchId?: string
}

/** Attribute create payload (POST /attributes). */
export interface CreateAttributePayload {
  noteId: string
  type: 'label' | 'relation'
  name: string
  value?: string
  position?: number
  isInheritable?: boolean
}

/** The ETAPI client (one instance per plugin load, stateless requests). */
export class TriliumEtapi {
  constructor(private readonly getConfig: () => TriliumConfig) {}

  private base(): string {
    return this.getConfig().baseUrl.replace(/\/$/, '')
  }

  private token(): string {
    return this.getConfig().token
  }

  private timeoutMs(): number {
    return this.getConfig().timeoutMs
  }

  /** One fetch with the configured timeout; aborts into a TriliumApiError. */
  private async fetchTimed(url: string, init: RequestInit, timeoutMs = this.timeoutMs()): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, { ...init, signal: controller.signal })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TriliumApiError('ETAPI request timed out after ' + timeoutMs + 'ms')
      }
      throw new TriliumApiError(error instanceof Error ? error.message : String(error))
    } finally {
      clearTimeout(timer)
    }
  }

  /** Core request: JSON in, JSON out. */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Authorization: this.token() }
    let payload: string | undefined
    if (body !== undefined) {
      headers['content-type'] = 'application/json'
      payload = JSON.stringify(body)
    }
    const response = await this.fetchTimed(this.base() + path, { method, headers, body: payload })
    if (response.status === 204) return undefined as T
    const text = await response.text()
    if (!response.ok) {
      let status: number | undefined
      let code: string | undefined
      let message = 'HTTP ' + response.status
      try {
        const parsed: unknown = JSON.parse(text)
        if (typeof parsed === 'object' && parsed !== null) {
          const p = parsed as Record<string, unknown>
          if (typeof p.message === 'string') message = p.message
          if (typeof p.status === 'number') status = p.status
          if (typeof p.code === 'string') code = p.code
        }
      } catch {
        // Non-JSON error body.
      }
      throw new TriliumApiError(message, status, code)
    }
    if (text === '') return undefined as T
    return JSON.parse(text) as T
  }

  // ------------------------------------------------------------ app
  appInfo(): Promise<TriliumAppInfo> {
    return this.request<TriliumAppInfo>('GET', '/app-info')
  }

  // --------------------------------------------------------- search
  async searchNotes(params: SearchParams): Promise<TriliumSearchResult[]> {
    const query = new URLSearchParams()
    query.set('search', params.search)
    if (params.fastSearch !== undefined) query.set('fastSearch', String(params.fastSearch))
    if (params.includeArchivedNotes !== undefined) query.set('includeArchivedNotes', String(params.includeArchivedNotes))
    if (params.ancestorNoteId !== undefined) query.set('ancestorNoteId', params.ancestorNoteId)
    if (params.ancestorDepth !== undefined) query.set('ancestorDepth', params.ancestorDepth)
    if (params.orderBy !== undefined) query.set('orderBy', params.orderBy)
    if (params.orderDirection !== undefined) query.set('orderDirection', params.orderDirection)
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    if (params.debug !== undefined) query.set('debug', String(params.debug))
    const body = await this.request<{ results: TriliumSearchResult[] }>('GET', '/notes?' + query.toString())
    return body.results
  }

  // ----------------------------------------------------------- notes
  getNote(noteId: string): Promise<TriliumNote> {
    return this.request<TriliumNote>('GET', '/notes/' + encodeURIComponent(noteId))
  }

  /** Note content as raw text (ETAPI returns text/plain, not JSON). */
  async getNoteContent(noteId: string): Promise<string> {
    const response = await this.fetchTimed(this.base() + '/notes/' + encodeURIComponent(noteId) + '/content', {
      headers: { Authorization: this.token() },
    })
    if (!response.ok) throw new TriliumApiError('ETAPI HTTP ' + response.status, response.status)
    return await response.text()
  }

  createNote(payload: CreateNotePayload): Promise<{ note: TriliumNote; branch: TriliumBranch }> {
    return this.request('POST', '/create-note', payload)
  }

  /** PATCH metadata (title etc.). Never sends content — ETAPI rejects it. */
  patchNote(noteId: string, patch: Partial<Pick<TriliumNote, 'title' | 'type' | 'mime' | 'isProtected'>>): Promise<TriliumNote> {
    return this.request<TriliumNote>('PATCH', '/notes/' + encodeURIComponent(noteId), patch)
  }

  /** Replace note content (text/plain raw body — the ETAPI quirk). */
  async putNoteContent(noteId: string, content: string): Promise<void> {
    const response = await this.fetchTimed(this.base() + '/notes/' + encodeURIComponent(noteId) + '/content', {
      method: 'PUT',
      headers: { Authorization: this.token(), 'content-type': 'text/plain' },
      body: content,
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new TriliumApiError('ETAPI HTTP ' + response.status + ': ' + text.slice(0, 200), response.status)
    }
  }

  deleteNote(noteId: string): Promise<void> {
    return this.request<void>('DELETE', '/notes/' + encodeURIComponent(noteId))
  }

  undeleteNote(noteId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('POST', '/notes/' + encodeURIComponent(noteId) + '/undelete')
  }

  getHistory(ancestorNoteId?: string): Promise<TriliumRecentChange[]> {
    const query = ancestorNoteId === undefined ? '' : '?ancestorNoteId=' + encodeURIComponent(ancestorNoteId)
    return this.request<TriliumRecentChange[]>('GET', '/notes/history' + query)
  }

  // ------------------------------------------------------- revisions
  getNoteRevisions(noteId: string): Promise<TriliumRevision[]> {
    return this.request<TriliumRevision[]>('GET', '/notes/' + encodeURIComponent(noteId) + '/revisions')
  }

  async getRevisionContent(revisionId: string): Promise<string> {
    const response = await this.fetchTimed(this.base() + '/revisions/' + encodeURIComponent(revisionId) + '/content', {
      headers: { Authorization: this.token() },
    })
    if (!response.ok) throw new TriliumApiError('ETAPI HTTP ' + response.status, response.status)
    return await response.text()
  }

  // -------------------------------------------------------- branches
  createBranch(payload: CreateBranchPayload): Promise<TriliumBranch> {
    return this.request<TriliumBranch>('POST', '/branches', payload)
  }

  getBranch(branchId: string): Promise<TriliumBranch> {
    return this.request<TriliumBranch>('GET', '/branches/' + encodeURIComponent(branchId))
  }

  deleteBranch(branchId: string): Promise<void> {
    return this.request<void>('DELETE', '/branches/' + encodeURIComponent(branchId))
  }

  // ------------------------------------------------------ attributes
  getAttribute(attributeId: string): Promise<TriliumAttribute> {
    return this.request<TriliumAttribute>('GET', '/attributes/' + encodeURIComponent(attributeId))
  }

  createAttribute(payload: CreateAttributePayload): Promise<TriliumAttribute> {
    return this.request<TriliumAttribute>('POST', '/attributes', payload)
  }

  patchAttribute(attributeId: string, patch: Partial<Pick<TriliumAttribute, 'name' | 'value' | 'position' | 'isInheritable'>>): Promise<TriliumAttribute> {
    return this.request<TriliumAttribute>('PATCH', '/attributes/' + encodeURIComponent(attributeId), patch)
  }

  deleteAttribute(attributeId: string): Promise<void> {
    return this.request<void>('DELETE', '/attributes/' + encodeURIComponent(attributeId))
  }

  // ------------------------------------------------------ attachments
  getNoteAttachments(noteId: string): Promise<TriliumAttachment[]> {
    return this.request<TriliumAttachment[]>('GET', '/notes/' + encodeURIComponent(noteId) + '/attachments')
  }

  getAttachment(attachmentId: string): Promise<TriliumAttachment> {
    return this.request<TriliumAttachment>('GET', '/attachments/' + encodeURIComponent(attachmentId))
  }

  createAttachment(payload: CreateAttachmentPayload): Promise<TriliumAttachment> {
    return this.request<TriliumAttachment>('POST', '/attachments', payload)
  }

  deleteAttachment(attachmentId: string): Promise<void> {
    return this.request<void>('DELETE', '/attachments/' + encodeURIComponent(attachmentId))
  }

  /** Attachment content (binary; returns the bytes). */
  async getAttachmentContent(attachmentId: string): Promise<{ buffer: ArrayBuffer; contentType: string }> {
    const response = await this.fetchTimed(this.base() + '/attachments/' + encodeURIComponent(attachmentId) + '/content', {
      headers: { Authorization: this.token() },
    })
    if (!response.ok) throw new TriliumApiError('ETAPI HTTP ' + response.status, response.status)
    return { buffer: await response.arrayBuffer(), contentType: response.headers.get('content-type') ?? 'application/octet-stream' }
  }

  // --------------------------------------------------------- calendar
  /** Day/week/month/year note (auto-created by Trilium). */
  getCalendarNote(type: Exclude<CalendarNoteType, 'inbox'>, date: string): Promise<TriliumNote> {
    const path = type === 'day' ? '/calendar/days/' : type === 'week' ? '/calendar/weeks/' : type === 'month' ? '/calendar/months/' : '/calendar/years/'
    return this.request<TriliumNote>('GET', path + encodeURIComponent(date))
  }

  getInboxNote(date: string): Promise<TriliumNote> {
    return this.request<TriliumNote>('GET', '/inbox/' + encodeURIComponent(date))
  }

  // ---------------------------------------------------------- backup
  createBackup(name: string): Promise<void> {
    return this.request<void>('PUT', '/backup/' + encodeURIComponent(name))
  }

  // ----------------------------------------------------------- import
  /** Import a ZIP file from disk into a note (multipart upload). */
  async importZip(noteId: string, zipPath: string): Promise<{ note: TriliumNote; branch: TriliumBranch }> {
    const bytes = readFileSync(zipPath)
    const boundary = '----dsh-trilium-' + Date.now().toString(36)
    const head = Buffer.from(
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="export"; filename="export.zip"\r\n' +
      'Content-Type: application/zip\r\n\r\n',
    )
    const tail = Buffer.from('\r\n--' + boundary + '--\r\n')
    const body = Buffer.concat([head, bytes, tail])
    const response = await this.fetchTimed(this.base() + '/notes/' + encodeURIComponent(noteId) + '/import', {
      method: 'POST',
      headers: { Authorization: this.token(), 'content-type': 'multipart/form-data; boundary=' + boundary },
      body: body as unknown as BodyInit,
    }, Math.max(this.timeoutMs(), 120000))
    if (!response.ok) throw new TriliumApiError('ETAPI HTTP ' + response.status, response.status)
    return await response.json() as { note: TriliumNote; branch: TriliumBranch }
  }

  // ---------------------------------------------------------- export
  /** Export a subtree as a ZIP archive (binary), returns the bytes. */
  async exportNote(noteId: string, format: 'html' | 'markdown' | 'share'): Promise<{ buffer: ArrayBuffer; contentType: string }> {
    const response = await this.fetchTimed(this.base() + '/notes/' + encodeURIComponent(noteId) + '/export?format=' + format, {
      headers: { Authorization: this.token() },
    }, Math.max(this.timeoutMs(), 60000))
    if (!response.ok) throw new TriliumApiError('ETAPI HTTP ' + response.status, response.status)
    return { buffer: await response.arrayBuffer(), contentType: response.headers.get('content-type') ?? 'application/zip' }
  }

  // ---------------------------------------------------------- helpers
  /** Child summaries for the tree browser. */
  async listChildren(noteId: string): Promise<TriliumChildSummary[]> {
    const note = await this.getNote(noteId)
    const summaries: TriliumChildSummary[] = []
    for (const childId of note.childNoteIds) {
      try {
        const child = await this.getNote(childId)
        summaries.push({
          noteId: child.noteId,
          title: child.title,
          type: child.type,
          hasChildren: child.childNoteIds.length > 0,
          isProtected: child.isProtected,
        })
      } catch {
        // A child that vanished mid-browse is skipped, not fatal.
      }
    }
    return summaries
  }
}