/**
 * Agent tools (extended half): clone, attachments, calendar notes, backup/
 * import, and revisions — the ETAPI surface beyond the core note/memory set.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { TriliumEtapi } from './etapi.ts'
import type {
  TriliumAttachment,
  TriliumBranch,
  TriliumNote,
  TriliumRevision,
} from './protocol.ts'

/** One text content block. */
function text(value: string): ContentBlock[] {
  return [{ type: 'text', text: value }]
}

// ================================================================ clone

/** Clone a note to another directory (branch), or remove a clone. */
export function triliumCloneTool(etapi: TriliumEtapi) {
  return defineTool({
    name: 'trilium_clone',
    description: 'Clone a note into another directory (a branch), or remove one clone. A note can live in multiple places; ' +
      'removing the last branch deletes the note. Triggers: clone note, place note in multiple folders, 克隆复用.',
    parameters: {
      action: { type: 'string', required: true, enum: ['clone', 'remove'], description: 'clone (add a branch) or remove (delete a branch).' },
      noteId: { type: 'string', description: 'Source note id (clone).' },
      parentNoteId: { type: 'string', description: 'Target parent note id (clone).' },
      branchId: { type: 'string', description: 'Branch id to delete (remove).' },
      notePosition: { type: 'integer', description: 'Position among siblings (clone).' },
      prefix: { type: 'string', description: 'Placement-specific title prefix (clone).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          branchId: { type: 'string' },
          noteId: { type: 'string' },
          parentNoteId: { type: 'string' },
          message: { type: 'string', required: true },
        },
      },
      render: (_args, value: { ok: boolean; branchId?: string; noteId?: string; parentNoteId?: string; message: string }) => text(
        value.ok ? '✓ ' + value.message + (value.branchId !== undefined ? '（branch ' + value.branchId + '）' : '') : '✗ ' + value.message,
      ),
    },
    async execute(args) {
      if (args.action === 'clone') {
        if (args.noteId === undefined || args.parentNoteId === undefined) throw new Error('clone requires noteId and parentNoteId')
        const branch: TriliumBranch = await etapi.createBranch({
          noteId: args.noteId,
          parentNoteId: args.parentNoteId,
          notePosition: args.notePosition,
          prefix: args.prefix,
        })
        return { ok: true, branchId: branch.branchId, noteId: branch.noteId, parentNoteId: branch.parentNoteId, message: '已克隆笔记到新目录' }
      }
      if (args.action === 'remove') {
        if (args.branchId === undefined) throw new Error('remove requires branchId')
        await etapi.deleteBranch(args.branchId)
        return { ok: true, branchId: args.branchId, message: '已移除克隆（branch）' }
      }
      throw new Error('unknown action: ' + String(args.action))
    },
  })
}

// =========================================================== attachment

/** Manage note attachments (images/files). */
export function triliumAttachmentTool(etapi: TriliumEtapi) {
  return defineTool({
    name: 'trilium_attachment',
    description: 'Manage note attachments (images, files). Actions: list, upload (from a local file), download (to /tmp on the dsh host), delete. ' +
      'Upload reads a local file and base64-encodes it; download returns a text preview for text types or a saved path for binary. ' +
      'Triggers: attach a file/image to a note, download an attachment, list note attachments.',
    parameters: {
      action: { type: 'string', required: true, enum: ['list', 'upload', 'download', 'delete'], description: 'list / upload / download / delete.' },
      noteId: { type: 'string', description: 'Owner note id (list/upload).' },
      attachmentId: { type: 'string', description: 'Attachment id (download/delete).' },
      localPath: { type: 'string', description: 'Absolute local file path to upload (upload).' },
      title: { type: 'string', description: 'Attachment title (upload, default: file basename).' },
      mime: { type: 'string', description: 'MIME type (upload, default: inferred from extension).' },
      role: { type: 'string', description: 'Attachment role (upload, default image for images else file).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          message: { type: 'string', required: true },
          attachments: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { attachmentId: { type: 'string' }, title: { type: 'string' }, mime: { type: 'string' }, role: { type: 'string' } } } },
          path: { type: 'string' },
          content: { type: 'string' },
        },
      },
      render: (_args, value: { ok: boolean; message: string; attachments?: Array<{ attachmentId?: string; title?: string; mime?: string; role?: string }>; path?: string; content?: string }) => {
        if (value.attachments !== undefined) {
          return text(value.attachments.length === 0 ? '（无附件）' : value.attachments.map(a => (a.attachmentId ?? '') + '  ' + (a.title ?? '') + (a.mime !== undefined ? '  [' + a.mime + ']' : '')).join('\n'))
        }
        if (value.content !== undefined) return text(value.content)
        return text((value.ok ? '✓ ' : '✗ ') + value.message + (value.path !== undefined ? ' ' + value.path : ''))
      },
    },
    async execute(args) {
      if (args.action === 'list') {
        if (args.noteId === undefined) throw new Error('list requires noteId')
        const attachments: TriliumAttachment[] = await etapi.getNoteAttachments(args.noteId)
        return {
          ok: true,
          message: 'ok',
          attachments: attachments.map(a => ({ attachmentId: a.attachmentId, title: a.title, mime: a.mime, role: a.role })),
        }
      }
      if (args.action === 'upload') {
        if (args.noteId === undefined || args.localPath === undefined) throw new Error('upload requires noteId and localPath')
        const bytes = readFileSync(args.localPath)
        const title = args.title ?? args.localPath.split('/').pop() ?? 'attachment'
        const mime = args.mime ?? guessMime(args.localPath)
        const role = args.role ?? (mime.startsWith('image/') ? 'image' : 'file')
        const attachment: TriliumAttachment = await etapi.createAttachment({
          ownerId: args.noteId,
          role,
          mime,
          title,
          content: bytes.toString('base64'),
        })
        return { ok: true, message: '已上传附件 ' + attachment.attachmentId }
      }
      if (args.action === 'download') {
        if (args.attachmentId === undefined) throw new Error('download requires attachmentId')
        const { buffer, contentType } = await etapi.getAttachmentContent(args.attachmentId)
        if (contentType.startsWith('text/') || contentType.includes('json')) {
          return { ok: true, message: 'ok', content: Buffer.from(buffer).toString('utf8') }
        }
        const path = '/tmp/trilium-attachment-' + args.attachmentId + '-' + Date.now()
        writeFileSync(path, Buffer.from(buffer))
        return { ok: true, message: '已保存附件', path }
      }
      if (args.action === 'delete') {
        if (args.attachmentId === undefined) throw new Error('delete requires attachmentId')
        await etapi.deleteAttachment(args.attachmentId)
        return { ok: true, message: '已删除附件 ' + args.attachmentId }
      }
      throw new Error('unknown action: ' + String(args.action))
    },
  })
}

/** Guess a MIME type from a file extension (common cases). */
function guessMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const table: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    pdf: 'application/pdf', zip: 'application/zip', json: 'application/json', txt: 'text/plain', md: 'text/markdown',
    html: 'text/html', csv: 'text/csv', mp3: 'audio/mpeg', mp4: 'video/mp4',
  }
  return table[ext] ?? 'application/octet-stream'
}

// ============================================================ calendar

/** Calendar notes (day/week/month/year/inbox). */
export function triliumCalendarTool(etapi: TriliumEtapi) {
  return defineTool({
    name: 'trilium_calendar',
    description: 'Get (or auto-create) a calendar note: day / week / month / year / inbox. Dates use YYYY-MM-DD (or the date Trilium expects). ' +
      'Triggers: journal note, day note, 工作日记, diary entry.',
    parameters: {
      type: { type: 'string', required: true, enum: ['day', 'week', 'month', 'year', 'inbox'], description: 'Calendar note kind.' },
      date: { type: 'string', required: true, description: 'Date (YYYY-MM-DD); for week/month/year any day inside the period works.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          noteId: { type: 'string', required: true },
          title: { type: 'string', required: true },
          type: { type: 'string', required: true },
          childNoteIds: { type: 'array', items: { type: 'string' }, required: true },
        },
      },
      render: (_args, value: { noteId: string; title: string; type: string; childNoteIds: string[] }) => text(
        '「' + value.title + '」 ' + value.noteId + '  [' + value.type + ']' + (value.childNoteIds.length > 0 ? '（' + value.childNoteIds.length + ' 子项）' : ''),
      ),
    },
    async execute(args) {
      const note: TriliumNote = args.type === 'inbox'
        ? await etapi.getInboxNote(args.date)
        : await etapi.getCalendarNote(args.type, args.date)
      return { noteId: note.noteId, title: note.title, type: note.type, childNoteIds: note.childNoteIds }
    },
  })
}

// ============================================================ backup

/** Create a database backup. */
export function triliumBackupTool(etapi: TriliumEtapi) {
  return defineTool({
    name: 'trilium_backup',
    description: 'Create a database backup on the Trilium server under a given name. Triggers: backup Trilium, snapshot the database.',
    parameters: {
      name: { type: 'string', required: true, description: 'Backup name.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, message: { type: 'string', required: true } } },
      render: (_args, value: { ok: boolean; message: string }) => text(value.ok ? '✓ 备份已创建：' + value.message : '✗ ' + value.message),
    },
    async execute(args) {
      await etapi.createBackup(args.name)
      return { ok: true, message: args.name }
    },
  })
}

// ============================================================ import

/** Import a ZIP archive into a note. */
export function triliumImportTool(etapi: TriliumEtapi) {
  return defineTool({
    name: 'trilium_import',
    description: 'Import a ZIP export (from trilium_export) into a note subtree. Triggers: restore notes, migrate a subtree, import backup.',
    parameters: {
      noteId: { type: 'string', required: true, description: 'Target note id the archive imports into.' },
      localPath: { type: 'string', required: true, description: 'Absolute local path to the ZIP archive.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          noteId: { type: 'string' },
          title: { type: 'string' },
          message: { type: 'string', required: true },
        },
      },
      render: (_args, value: { ok: boolean; noteId?: string; title?: string; message: string }) => text(
        value.ok ? '✓ 已导入：' + (value.title ?? value.noteId ?? '') : '✗ ' + value.message,
      ),
    },
    async execute(args) {
      const result = await etapi.importZip(args.noteId, args.localPath)
      return { ok: true, noteId: result.note.noteId, title: result.note.title, message: 'imported' }
    },
  })
}

// ========================================================== revisions

/** List/read note revisions. */
export function triliumRevisionsTool(etapi: TriliumEtapi) {
  return defineTool({
    name: 'trilium_revisions',
    description: 'List note revisions or read one revision content. Triggers: view note history, restore from a previous version, audit changes.',
    parameters: {
      action: { type: 'string', required: true, enum: ['list', 'content'], description: 'list (note revisions) or content (one revision).' },
      noteId: { type: 'string', description: 'Note id (list).' },
      revisionId: { type: 'string', description: 'Revision id (content).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          revisions: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { revisionId: { type: 'string' }, noteId: { type: 'string' }, title: { type: 'string' }, utcDateCreated: { type: 'string' } } } },
          content: { type: 'string' },
          message: { type: 'string', required: true },
        },
      },
      render: (_args, value: { ok: boolean; revisions?: Array<{ revisionId?: string; title?: string; utcDateCreated?: string }>; content?: string; message: string }) => {
        if (value.revisions !== undefined) {
          return text(value.revisions.length === 0 ? '（无修订）' : value.revisions.map(r => (r.revisionId ?? '') + '  ' + (r.title ?? '') + (r.utcDateCreated !== undefined ? '  ' + r.utcDateCreated : '')).join('\n'))
        }
        if (value.content !== undefined) return text(value.content)
        return text(value.message)
      },
    },
    async execute(args) {
      if (args.action === 'list') {
        if (args.noteId === undefined) throw new Error('list requires noteId')
        const revisions: TriliumRevision[] = await etapi.getNoteRevisions(args.noteId)
        return { ok: true, message: 'ok', revisions: revisions.map(r => ({ revisionId: r.revisionId, noteId: r.noteId, title: r.title, utcDateCreated: r.utcDateCreated })) }
      }
      if (args.action === 'content') {
        if (args.revisionId === undefined) throw new Error('content requires revisionId')
        const content = await etapi.getRevisionContent(args.revisionId)
        return { ok: true, message: 'ok', content }
      }
      throw new Error('unknown action: ' + String(args.action))
    },
  })
}

