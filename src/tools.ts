/**
 * Agent tools (notes/management half): the DSH-native counterpart of the
 * ETAPI surface. Every tool talks to the same ETAPI client the routes use,
 * so a server configured in the GUI is immediately operable by any agent.
 *
 * Memory tools (trilium_remember / trilium_recall / trilium_weekly_report)
 * live in tools-memory.ts.
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { TriliumEtapi } from './etapi.ts'
import type {
  TriliumAppInfo,
  TriliumAttribute,
  TriliumChildSummary,
  TriliumConfig,
  TriliumNote,
  TriliumRecentChange,
  TriliumSearchResult,
} from './protocol.ts'

/** One text content block (the only render shape these tools emit). */
function text(value: string): ContentBlock[] {
  return [{ type: 'text', text: value }]
}

/** Compact single-line note summary. */
function noteLine(note: { noteId: string; title: string; type?: string; childNoteIds?: string[] }): string {
  const parts = [note.noteId, note.title]
  if (note.type !== undefined && note.type !== 'text') parts.push('[' + note.type + ']')
  if (note.childNoteIds !== undefined && note.childNoteIds.length > 0) parts.push('(' + note.childNoteIds.length + ' children)')
  return parts.join('  ')
}

/** Render a note list. */
function renderNotes(notes: Array<{ noteId: string; title: string; type?: string; childNoteIds?: string[] }>): string {
  if (notes.length === 0) return '（无结果）'
  return notes.map(noteLine).join('\n')
}

/** Render attributes. */
function renderAttributes(attributes: TriliumAttribute[]): string {
  if (attributes.length === 0) return '（无属性）'
  return attributes.map(attr => {
    const value = attr.value === undefined || attr.value === '' ? '' : '=' + attr.value
    return attr.attributeId + '  ' + attr.type + ':' + attr.name + value
  }).join('\n')
}

// ================================================================ tools

/** App info / connection test. */
export function triliumAppInfoTool(etapi: TriliumEtapi) {
  return defineTool({
    name: 'trilium_app_info',
    description: 'Get information about the connected Trilium instance (version, build, server time, data directory). Also serves as an ETAPI connection test. ' +
      'Triggers: check Trilium connection, instance info, ETAPI works?',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          appVersion: { type: 'string', required: true },
          dbVersion: { type: 'integer', required: true },
          syncVersion: { type: 'integer', required: true },
          buildDate: { type: 'string' },
          buildRevision: { type: 'string' },
          clipperProtocolVersion: { type: 'string' },
          nodeVersion: { type: 'string' },
          dataDirectory: { type: 'string' },
          utcDateTime: { type: 'string' },
        },
      },
      render: (_args, value: TriliumAppInfo) => text([
        'Trilium ' + value.appVersion,
        'db ' + value.dbVersion + ' / sync ' + value.syncVersion,
        value.buildRevision !== undefined ? 'build ' + value.buildRevision + (value.buildDate !== undefined ? ' (' + value.buildDate + ')' : '') : '',
        value.nodeVersion !== undefined ? 'node ' + value.nodeVersion : '',
        value.dataDirectory !== undefined ? 'data: ' + value.dataDirectory : '',
        value.utcDateTime !== undefined ? 'server time: ' + value.utcDateTime : '',
      ].filter(Boolean).join('\n')),
    },
    async execute() {
      return etapi.appInfo()
    },
  })
}

/** Full-text search. */
export function triliumSearchTool(etapi: TriliumEtapi) {
  return defineTool({
    name: 'trilium_search',
    description: 'Search notes in the Trilium library (fulltext + attribute syntax). Supports the Trilium search grammar: keywords, "exact phrase", #label, @relation, ancestor scoping. ' +
      'Triggers: find a note, search memory/notes, look up something in the knowledge base.',
    parameters: {
      search: { type: 'string', required: true, description: 'Search query (Trilium syntax, e.g. towers tolkien, "Two Towers", towers #book).' },
      ancestorNoteId: { type: 'string', description: 'Only search inside this note subtree (default: whole library).' },
      ancestorDepth: { type: 'string', description: 'Depth constraint, e.g. eq1 (direct children), lt4, gt2.' },
      orderBy: { type: 'string', description: 'Order field, e.g. title, dateCreated, dateModified, utcDateModified.' },
      orderDirection: { type: 'string', enum: ['asc', 'desc'], description: 'asc or desc (default asc).' },
      limit: { type: 'integer', description: 'Max results (default 50).' },
      fastSearch: { type: 'boolean', description: 'Fulltext without content (faster).' },
      includeArchivedNotes: { type: 'boolean', description: 'Include archived notes (default false).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          results: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                noteId: { type: 'string', required: true },
                title: { type: 'string', required: true },
                type: { type: 'string' },
                isProtected: { type: 'boolean' },
                childNoteIds: { type: 'array', items: { type: 'string' } },
                parentNoteIds: { type: 'array', items: { type: 'string' } },
                utcDateModified: { type: 'string' },
              },
            },
          },
          count: { type: 'integer', required: true },
        },
      },
      render: (_args, value: { results: TriliumSearchResult[]; count: number }) => text(
        '找到 ' + value.count + ' 条：\n' + renderNotes(value.results),
      ),
    },
    async execute(args) {
      const found = await etapi.searchNotes({
        search: args.search,
        ancestorNoteId: args.ancestorNoteId,
        ancestorDepth: args.ancestorDepth,
        orderBy: args.orderBy,
        orderDirection: args.orderDirection,
        limit: args.limit ?? 50,
        fastSearch: args.fastSearch,
        includeArchivedNotes: args.includeArchivedNotes,
      })
      const results = found.map(note => ({
        noteId: note.noteId,
        title: note.title,
        type: note.type,
        isProtected: note.isProtected,
        childNoteIds: note.childNoteIds,
        parentNoteIds: note.parentNoteIds,
        utcDateModified: note.utcDateModified,
      }))
      return { results, count: results.length }
    },
  })
}

/** Get one note (metadata + optional content + attributes). */
export function triliumGetNoteTool(etapi: TriliumEtapi) {
  return defineTool({
    name: 'trilium_get_note',
    description: 'Get a note by ID: metadata (title, type, children, attributes) and optionally its content. ' +
      'Triggers: read a note, inspect children/attributes, fetch note content.',
    parameters: {
      noteId: { type: 'string', required: true, description: 'The note ID (or "root").' },
      includeContent: { type: 'boolean', description: 'Also fetch the note content (default false).' },
      contentMaxChars: { type: 'integer', description: 'Truncate content to this many chars (default 20000).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          noteId: { type: 'string', required: true },
          title: { type: 'string', required: true },
          type: { type: 'string', required: true },
          mime: { type: 'string' },
          isProtected: { type: 'boolean', required: true },
          parentNoteIds: { type: 'array', items: { type: 'string' }, required: true },
          childNoteIds: { type: 'array', items: { type: 'string' }, required: true },
          attributes: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: {} } },
          content: { type: 'string' },
          contentTruncated: { type: 'boolean' },
        },
      },
      render: (_args, value: { title: string; noteId: string; type: string; mime?: string; isProtected: boolean; parentNoteIds: string[]; childNoteIds: string[]; attributes: TriliumAttribute[]; content?: string; contentTruncated?: boolean }) => {
        const lines = [
          '#' + value.title + '  (' + value.noteId + ')',
          'type: ' + value.type + (value.mime !== undefined ? ' / ' + value.mime : '') + (value.isProtected ? ' / 🔒' : ''),
          'parents: ' + (value.parentNoteIds.length > 0 ? value.parentNoteIds.join(', ') : 'root'),
          'children: ' + (value.childNoteIds.length > 0 ? value.childNoteIds.join(', ') : '（无）'),
          'attributes:\n' + renderAttributes(value.attributes),
        ]
        if (value.content !== undefined) {
          lines.push('content' + (value.contentTruncated === true ? '（已截断）' : '') + ':\n' + value.content)
        }
        return text(lines.join('\n'))
      },
    },
    async execute(args): Promise<{
      noteId: string; title: string; type: string; mime?: string; isProtected: boolean;
      parentNoteIds: string[]; childNoteIds: string[]; attributes: TriliumAttribute[];
      content?: string; contentTruncated?: boolean;
    }> {
      const note = await etapi.getNote(args.noteId)
      const result: {
        noteId: string; title: string; type: string; mime?: string; isProtected: boolean;
        parentNoteIds: string[]; childNoteIds: string[]; attributes: TriliumAttribute[];
        content?: string; contentTruncated?: boolean;
      } = {
        noteId: note.noteId,
        title: note.title,
        type: note.type,
        mime: note.mime,
        isProtected: note.isProtected,
        parentNoteIds: note.parentNoteIds,
        childNoteIds: note.childNoteIds,
        attributes: note.attributes,
      }
      if (args.includeContent === true) {
        const content = await etapi.getNoteContent(args.noteId)
        const max = args.contentMaxChars ?? 20000
        if (content.length > max) {
          result.content = content.slice(0, max) + '\n…（内容较长，已截断至 ' + max + ' 字符）'
          result.contentTruncated = true
        } else {
          result.content = content
          result.contentTruncated = false
        }
      }
      return result
    },
  })
}

/** List children (tree browsing). */
export function triliumListChildrenTool(etapi: TriliumEtapi) {
  return defineTool({
    name: 'trilium_list_children',
    description: 'List the direct children of a note (one level of the tree). Use trilium_get_note for metadata or content of a specific note. ' +
      'Triggers: browse the note tree, what is under this folder?',
    parameters: {
      noteId: { type: 'string', required: true, description: 'Parent note ID (or "root").' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          noteId: { type: 'string', required: true },
          children: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                noteId: { type: 'string', required: true },
                title: { type: 'string', required: true },
                type: { type: 'string', required: true },
                hasChildren: { type: 'boolean', required: true },
                isProtected: { type: 'boolean', required: true },
              },
            },
          },
        },
      },
      render: (_args, value: { noteId: string; children: TriliumChildSummary[] }) => text(
        value.children.length === 0
          ? '（' + value.noteId + ' 下没有子笔记）'
          : value.children.map(child =>
            child.noteId + '  ' + child.title + (child.type !== 'text' ? '  [' + child.type + ']' : '') + (child.hasChildren ? '  ▸' : '') + (child.isProtected ? '  🔒' : ''),
          ).join('\n'),
      ),
    },
    async execute(args) {
      const children = await etapi.listChildren(args.noteId)
      return { noteId: args.noteId, children }
    },
  })
}

/** Create a note. */
export function triliumCreateNoteTool(etapi: TriliumEtapi, getConfig: () => TriliumConfig) {
  return defineTool({
    name: 'trilium_create_note',
    description: 'Create a note in the Trilium tree. Default parent is the memory directory (Agent笔记); pass parentNoteId to place it elsewhere. ' +
      'For AI-written content the memory rule says: default to the memory directory unless the user explicitly asks for another location. ' +
      'Triggers: create a note, save something to the knowledge base, write a memory.',
    parameters: {
      title: { type: 'string', required: true, description: 'Note title.' },
      parentNoteId: { type: 'string', description: 'Parent note ID. Default: memory directory (Agent笔记).' },
      content: { type: 'string', description: 'Note content. For text notes: HTML; plain text is also accepted.' },
      type: { type: 'string', enum: ['text', 'code', 'file', 'image', 'search', 'book', 'relationMap', 'render', 'mermaid'], description: 'Note type (default text).' },
      mime: { type: 'string', description: 'MIME for code/file/image types, e.g. application/json, text/plain.' },
      notePosition: { type: 'integer', description: 'Position among siblings (10, 20, 30...; use 5 for first, 1000000 for last).' },
      noteId: { type: 'string', description: 'Force a specific noteId (advanced).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          noteId: { type: 'string', required: true },
          title: { type: 'string', required: true },
          type: { type: 'string', required: true },
          parentNoteId: { type: 'string', required: true },
          branchId: { type: 'string', required: true },
        },
      },
      render: (_args, value: { noteId: string; title: string; type: string; parentNoteId: string; branchId: string }) => text(
        '已创建 ' + value.type + ' 笔记「' + value.title + '」\nnoteId: ' + value.noteId + '\nparent: ' + value.parentNoteId + '\nbranch: ' + value.branchId,
      ),
    },
    async execute(args) {
      const parentNoteId = args.parentNoteId ?? (getConfig().memoryNoteId || 'root')
      const created = await etapi.createNote({
        parentNoteId,
        title: args.title,
        type: args.type ?? 'text',
        mime: args.mime,
        content: args.content,
        notePosition: args.notePosition,
        noteId: args.noteId,
      })
      return {
        noteId: created.note.noteId,
        title: created.note.title,
        type: created.note.type,
        parentNoteId: created.branch.parentNoteId,
        branchId: created.branch.branchId,
      }
    },
  })
}

/** Update title/content/metadata. */
export function triliumUpdateNoteTool(etapi: TriliumEtapi) {
  return defineTool({
    name: 'trilium_update_note',
    description: 'Update a note: title (PATCH), content (PUT, text/plain — the ETAPI way), or both. ' +
      'Triggers: edit a note, change title, update note content, append to a note.',
    parameters: {
      noteId: { type: 'string', required: true, description: 'Note ID to update.' },
      title: { type: 'string', description: 'New title (renames the note).' },
      content: { type: 'string', description: 'New content — replaces the whole content. For text notes: HTML.' },
      append: { type: 'boolean', description: 'When true, append content to the existing content instead of replacing (content required).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          noteId: { type: 'string', required: true },
          title: { type: 'string', required: true },
          contentUpdated: { type: 'boolean', required: true },
        },
      },
      render: (_args, value: { noteId: string; title: string; contentUpdated: boolean }) => text(
        '已更新「' + value.title + '」(' + value.noteId + ')' + (value.contentUpdated ? '，内容已更新' : ''),
      ),
    },
    async execute(args) {
      let title = args.title
      if (args.title === undefined && args.content === undefined) {
        throw new Error('nothing to update: provide title and/or content')
      }
      let contentUpdated = false
      if (args.content !== undefined) {
        let content = args.content
        if (args.append === true) {
          const existing = await etapi.getNoteContent(args.noteId)
          content = existing + content
        }
        await etapi.putNoteContent(args.noteId, content)
        contentUpdated = true
      }
      if (args.title !== undefined) {
        const note = await etapi.patchNote(args.noteId, { title: args.title })
        title = note.title
      } else {
        const note = await etapi.getNote(args.noteId)
        title = note.title
      }
      return { noteId: args.noteId, title, contentUpdated }
    },
  })
}

/** Delete a note (confirm-gated, soft delete into the trash). */
export function triliumDeleteNoteTool(etapi: TriliumEtapi, getConfig: () => TriliumConfig) {
  return defineTool({
    name: 'trilium_delete_note',
    description: 'Delete a note. The note goes to the Trilium trash (recoverable with trilium_undelete_note). ' +
      'When deleteConfirm is enabled in the plugin config (default), confirm=true is required.',
    parameters: {
      noteId: { type: 'string', required: true, description: 'Note ID to delete.' },
      confirm: { type: 'boolean', required: true, description: 'Must be true to delete (safety gate).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          noteId: { type: 'string', required: true },
          message: { type: 'string', required: true },
        },
      },
      render: (_args, value: { ok: boolean; noteId: string; message: string }) => text(value.ok
        ? '已删除 ' + value.noteId + '（回收站可恢复：trilium_undelete_note）'
        : '删除未执行：' + value.message),
    },
    async execute(args) {
      if (getConfig().deleteConfirm && args.confirm !== true) {
        return { ok: false, noteId: args.noteId, message: '需要 confirm=true 确认删除（软删进回收站，可恢复）' }
      }
      await etapi.deleteNote(args.noteId)
      return { ok: true, noteId: args.noteId, message: 'deleted' }
    },
  })
}

/** Undelete a note. */
export function triliumUndeleteNoteTool(etapi: TriliumEtapi) {
  return defineTool({
    name: 'trilium_undelete_note',
    description: 'Restore a deleted note from the trash. The note must be deleted and have at least one undeleted parent. ' +
      'Triggers: recover a deleted note, undo a deletion.',
    parameters: {
      noteId: { type: 'string', required: true, description: 'Deleted note ID to restore.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          success: { type: 'boolean', required: true },
        },
      },
      render: (_args, value: { ok: boolean; success: boolean }) => text(value.ok && value.success ? '已恢复笔记（trash 已还原）' : '恢复失败：请检查 noteId 是否在回收站'),
    },
    async execute(args) {
      try {
        const result = await etapi.undeleteNote(args.noteId)
        return { ok: true, success: result.success === true }
      } catch {
        return { ok: false, success: false }
      }
    },
  })
}

/** Attribute management. */
export function triliumAttributeTool(etapi: TriliumEtapi) {
  return defineTool({
    name: 'trilium_attribute',
    description: 'Manage note attributes (labels and relations). Actions: list, create, update, delete. ' +
      'A relation is an attribute with type=relation and value=target noteId. ' +
      'Triggers: add a label/tag, set #startDate, relate notes, list attributes.',
    parameters: {
      action: { type: 'string', required: true, enum: ['list', 'create', 'update', 'delete'], description: 'list / create / update / delete.' },
      noteId: { type: 'string', description: 'Target note (list/create).' },
      attributeId: { type: 'string', description: 'Attribute ID (update/delete, or list by note).' },
      type: { type: 'string', enum: ['label', 'relation'], description: 'Attribute type (create).' },
      name: { type: 'string', description: 'Attribute name, e.g. startDate, book (create/update).' },
      value: { type: 'string', description: 'Attribute value; for relation = target noteId (create/update).' },
      position: { type: 'integer', description: 'Attribute position among siblings (create/update).' },
      isInheritable: { type: 'boolean', description: 'Inheritable by descendants (create/update).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          message: { type: 'string', required: true },
          attribute: {
            type: 'object',
            additionalProperties: false,
            properties: {
              attributeId: { type: 'string' },
              noteId: { type: 'string' },
              type: { type: 'string' },
              name: { type: 'string' },
              value: { type: 'string' },
              position: { type: 'integer' },
              isInheritable: { type: 'boolean' },
              utcDateModified: { type: 'string' },
            },
          },
          attributes: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                attributeId: { type: 'string' },
                noteId: { type: 'string' },
                type: { type: 'string' },
                name: { type: 'string' },
                value: { type: 'string' },
                position: { type: 'integer' },
                isInheritable: { type: 'boolean' },
                utcDateModified: { type: 'string' },
              },
            },
          },
        },
      },
      render: (_args, value: { ok: boolean; message: string; attribute?: TriliumAttribute; attributes?: TriliumAttribute[] }) => text(
        value.attributes !== undefined
          ? '属性列表：\n' + renderAttributes(value.attributes)
          : (value.ok ? '✓ ' + value.message : '✗ ' + value.message),
      ),
    },
    async execute(args) {
      if (args.action === 'list') {
        if (args.noteId === undefined && args.attributeId === undefined) {
          throw new Error('list requires noteId (or attributeId)')
        }
        if (args.attributeId !== undefined) {
          const attribute = await etapi.getAttribute(args.attributeId)
          return { ok: true, message: 'ok', attribute }
        }
        const note = await etapi.getNote(args.noteId as string)
        return { ok: true, message: 'ok', attributes: note.attributes }
      }
      if (args.action === 'create') {
        if (args.noteId === undefined || args.type === undefined || args.name === undefined) {
          throw new Error('create requires noteId, type (label|relation), and name')
        }
        const attribute = await etapi.createAttribute({
          noteId: args.noteId,
          type: args.type,
          name: args.name,
          value: args.value,
          position: args.position,
          isInheritable: args.isInheritable,
        })
        return { ok: true, message: 'created ' + attribute.attributeId, attribute }
      }
      if (args.action === 'update') {
        if (args.attributeId === undefined) throw new Error('update requires attributeId')
        const attribute = await etapi.patchAttribute(args.attributeId, {
          name: args.name,
          value: args.value,
          position: args.position,
          isInheritable: args.isInheritable,
        })
        return { ok: true, message: 'updated ' + attribute.attributeId, attribute }
      }
      if (args.action === 'delete') {
        if (args.attributeId === undefined) throw new Error('delete requires attributeId')
        await etapi.deleteAttribute(args.attributeId)
        return { ok: true, message: 'deleted ' + args.attributeId }
      }
      throw new Error('unknown action: ' + String(args.action))
    },
  })
}

/** Export a subtree as ZIP (via routes, saved to /tmp on the host). */
export function triliumExportTool(etapi: TriliumEtapi) {
  return defineTool({
    name: 'trilium_export',
    description: 'Export a note subtree as a ZIP archive (html or markdown). The archive is saved to /tmp on the dsh host and the path is returned. ' +
      'Triggers: export notes, backup a subtree, download notes as markdown.',
    parameters: {
      noteId: { type: 'string', required: true, description: 'Subtree root note ID (use "root" for the whole library).' },
      format: { type: 'string', enum: ['html', 'markdown', 'share'], description: 'Export format (default html).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          path: { type: 'string', required: true },
          bytes: { type: 'integer', required: true },
          error: { type: 'string' },
          contentType: { type: 'string' },
        },
      },
      render: (_args, value: { ok: boolean; path: string; bytes: number; error?: string; contentType?: string }) => text(
        value.ok ? '已导出 ZIP：' + value.path + ' (' + value.bytes + ' bytes)' : '导出失败：' + (value.error ?? 'unknown'),
      ),
    },
    async execute(args) {
      const format = args.format ?? 'html'
      const { buffer, contentType } = await etapi.exportNote(args.noteId, format)
      const fs = await import('node:fs')
      const path = '/tmp/trilium-export-' + args.noteId + '-' + Date.now() + '.zip'
      fs.writeFileSync(path, Buffer.from(buffer))
      return { ok: true, path, bytes: buffer.byteLength, contentType }
    },
  })
}

/** Recent changes. */
export function triliumHistoryTool(etapi: TriliumEtapi) {
  return defineTool({
    name: 'trilium_history',
    description: 'List recent changes in the library (note creations, modifications, deletions) with timestamps. ' +
      'Triggers: what changed recently, recent activity, audit.',
    parameters: {
      ancestorNoteId: { type: 'string', description: 'Limit to this subtree (default: whole library).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          changes: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                noteId: { type: 'string', required: true },
                title: { type: 'string' },
                current_title: { type: 'string' },
                current_isDeleted: { type: 'integer' },
                canBeUndeleted: { type: 'boolean' },
                utcDate: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value: { changes: TriliumRecentChange[] }) => text(
        value.changes.length === 0
          ? '（无变更记录）'
          : value.changes.map(change => {
            const title = change.current_title ?? change.title ?? change.noteId
            const state = change.current_isDeleted === 1 ? (change.canBeUndeleted === true ? '🗑 已删除(可恢复)' : '🗑 已删除') : ''
            return change.utcDate + '  ' + title + '  (' + change.noteId + ')  ' + state
          }).join('\n'),
      ),
    },
    async execute(args) {
      const found = await etapi.getHistory(args.ancestorNoteId)
      const changes = found.map(change => ({
        noteId: change.noteId,
        title: change.title,
        current_title: change.current_title,
        current_isDeleted: change.current_isDeleted,
        canBeUndeleted: change.canBeUndeleted,
        utcDate: change.utcDate,
      }))
      return { changes }
    },
  })
}