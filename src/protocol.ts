/**
 * Wire contract between the host half (routes.ts / tools.ts) and the browser
 * half (client/api.ts). Pure types + path constants only — imported by both
 * halves, bundled into each, no runtime identity to share.
 */

/** ETAPI note type enum (Trilium). */
export type TriliumNoteType =
  | 'text' | 'code' | 'file' | 'image' | 'search' | 'book'
  | 'relationMap' | 'render' | 'mermaid' | 'doc' | 'launcher' | 'mindMap'

/** One note attribute (label or relation). */
export interface TriliumAttribute {
  attributeId: string
  noteId: string
  type: 'label' | 'relation'
  name: string
  value?: string
  position?: number
  isInheritable?: boolean
  utcDateModified?: string
}

/** Note metadata as returned by ETAPI GET /notes/:id. */
export interface TriliumNote {
  noteId: string
  title: string
  type: TriliumNoteType
  mime?: string
  isProtected: boolean
  blobId?: string
  attributes: TriliumAttribute[]
  parentNoteIds: string[]
  childNoteIds: string[]
  parentBranchIds: string[]
  childBranchIds: string[]
  dateCreated?: string
  dateModified?: string
  utcDateCreated?: string
  utcDateModified?: string
}

/** Branch (clone placement) record. */
export interface TriliumBranch {
  branchId: string
  noteId: string
  parentNoteId: string
  prefix?: string | null
  notePosition?: number
  isExpanded?: boolean
}

/** App info from GET /app-info. */
export interface TriliumAppInfo {
  appVersion: string
  dbVersion: number
  syncVersion: number
  buildDate?: string
  buildRevision?: string
  clipperProtocolVersion?: string
  utcDateTime?: string
  nodeVersion?: string
  dataDirectory?: string
}

/** One search hit (GET /notes?search=). */
export interface TriliumSearchResult {
  noteId: string
  title: string
  type: TriliumNoteType
  mime?: string
  isProtected: boolean
  attributes: TriliumAttribute[]
  parentNoteIds: string[]
  childNoteIds: string[]
  dateCreated?: string
  dateModified?: string
  utcDateCreated?: string
  utcDateModified?: string
}

/** Recent change entry (GET /notes/history). */
export interface TriliumRecentChange {
  noteId: string
  title?: string
  current_title?: string
  current_isDeleted?: number
  current_deleteId?: string
  current_isProtected?: number
  utcDate: string
  date?: string
  canBeUndeleted?: boolean
}

/** Plugin config persisted at ~/.dsh/dsh-trilium.json. */
export interface TriliumConfig {
  /** ETAPI base URL, e.g. https://host/etapi */
  baseUrl: string
  /** ETAPI token (never returned to the browser; PUT with empty keeps stored). */
  token: string
  /** Default memory directory note id (Agent笔记). */
  memoryNoteId: string
  /** Request timeout in ms. */
  timeoutMs: number
  /** Inject the memory index into every agent session start. */
  autoInject: boolean
  /** Require confirm=true on delete tools. */
  deleteConfirm: boolean
  /** Announce the plugin + memory rules in the system prompt. */
  announceToAgent: boolean
  /** Whether a token has been stored (browser-safe projection). */
  tokenSet: boolean
}

/** Browser-safe config projection (no token value). */
export interface TriliumConfigView {
  baseUrl: string
  memoryNoteId: string
  timeoutMs: number
  autoInject: boolean
  deleteConfirm: boolean
  announceToAgent: boolean
  tokenSet: boolean
}

/** Payload for updating config from the browser (token omitted keeps stored). */
export interface TriliumConfigPatch {
  baseUrl?: string
  token?: string
  memoryNoteId?: string
  timeoutMs?: number
  autoInject?: boolean
  deleteConfirm?: boolean
  announceToAgent?: boolean
}

/** Test-connection outcome. */
export interface TriliumTestResult {
  ok: boolean
  latencyMs?: number
  appInfo?: TriliumAppInfo
  error?: string
}

/** Child summary for the tree browser. */
export interface TriliumChildSummary {
  noteId: string
  title: string
  type: TriliumNoteType
  hasChildren: boolean
  isProtected: boolean
}

/** JSON error body used by every route. */
export interface ApiErrorBody {
  error: string
}

/** Route paths the client calls (shared literals). */
export const TRILIUM_API_BASE = '/api/dsh-trilium' as const

export const TRILIUM_API = {
  config: TRILIUM_API_BASE + '/config',
  test: TRILIUM_API_BASE + '/test',
  search: TRILIUM_API_BASE + '/search',
  note: TRILIUM_API_BASE + '/note',
  children: TRILIUM_API_BASE + '/children',
} as const

/** Default config values (single source for host defaults). */
export const DEFAULT_CONFIG: Omit<TriliumConfig, 'token' | 'tokenSet'> = {
  baseUrl: '',
  memoryNoteId: '',
  timeoutMs: 15000,
  autoInject: true,
  deleteConfirm: true,
  announceToAgent: true,
}
/** One attachment record (GET /attachments/:id or list). */
export interface TriliumAttachment {
  attachmentId: string
  ownerId: string
  role?: string
  mime?: string
  title?: string
  position?: number
  blobId?: string
  dateModified?: string
  utcDateModified?: string
}

/** Attachment create payload (POST /attachments, content is base64). */
export interface CreateAttachmentPayload {
  ownerId: string
  role: string
  mime: string
  title: string
  content: string
  position?: number
}

/** One note revision (GET /notes/:id/revisions). */
export interface TriliumRevision {
  revisionId: string
  noteId: string
  type?: string
  mime?: string
  isProtected?: boolean
  title?: string
  blobId?: string
  dateLastEdited?: string
  dateCreated?: string
  utcDateLastEdited?: string
  utcDateCreated?: string
  utcDateModified?: string
  contentLength?: number
}

/** Branch create payload (POST /branches — clone a note elsewhere). */
export interface CreateBranchPayload {
  noteId: string
  parentNoteId: string
  notePosition?: number
  prefix?: string
  isExpanded?: boolean
}

/** Calendar note kinds. */
export type CalendarNoteType = 'day' | 'week' | 'month' | 'year' | 'inbox'