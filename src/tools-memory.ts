/**
 * Agent tools (memory half): trilium_remember, trilium_recall and the
 * weekly-report workflow. These encode the user's memory rules: AI writes
 * default to the memory directory (Agent笔记), recall searches that subtree,
 * and the weekly report follows the 周报撰写规范 style profile.
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { TriliumEtapi } from './etapi.ts'
import { invalidateMemoryIndex } from './memory.ts'
import type { TriliumConfig, TriliumSearchResult } from './protocol.ts'

/** One text content block. */
function text(value: string): ContentBlock[] {
  return [{ type: 'text', text: value }]
}

/** Current date as YYYY-MM-DD in the local timezone (memory titles carry it). */
function today(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
}

/** Write one memory note into the memory directory. */
export function triliumRememberTool(etapi: TriliumEtapi, getConfig: () => TriliumConfig) {
  return defineTool({
    name: 'trilium_remember',
    description: 'Write a durable memory note into the memory directory (Agent笔记) with a date-stamped title. ' +
      'Use for cross-session knowledge: user preferences, project conclusions, solved problems, capability boundaries, decisions. ' +
      'Follows the 写入规则: AI content defaults to Agent笔记 unless the user explicitly says otherwise.',
    parameters: {
      title: { type: 'string', required: true, description: 'Memory title (a date stamp is prepended automatically).' },
      content: { type: 'string', required: true, description: 'Memory content (HTML or plain text).' },
      parentNoteId: { type: 'string', description: 'Override the memory directory (default: configured memoryNoteId).' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Labels to attach (created as #label attributes).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          noteId: { type: 'string', required: true },
          title: { type: 'string', required: true },
          parentNoteId: { type: 'string', required: true },
        },
      },
      render: (_args, value: { noteId: string; title: string; parentNoteId: string }) => text(
        '已记住：「' + value.title + '」\nnoteId: ' + value.noteId + '\n目录: ' + value.parentNoteId,
      ),
    },
    async execute(args) {
      const parentNoteId = args.parentNoteId ?? (getConfig().memoryNoteId || 'root')
      const stamp = today()
      const title = '[' + stamp + '] ' + args.title
      const created = await etapi.createNote({
        parentNoteId,
        title,
        type: 'text',
        content: args.content,
      })
      if (args.tags !== undefined && args.tags.length > 0) {
        for (const tag of args.tags) {
          await etapi.createAttribute({ noteId: created.note.noteId, type: 'label', name: tag, value: '' })
        }
      }
      invalidateMemoryIndex()
      return { noteId: created.note.noteId, title, parentNoteId }
    },
  })
}

/** Recall from the memory directory. */
export function triliumRecallTool(etapi: TriliumEtapi, getConfig: () => TriliumConfig) {
  return defineTool({
    name: 'trilium_recall',
    description: 'Search the memory directory (Agent笔记) only — same syntax as trilium_search but scoped to the memory subtree. ' +
      'Triggers: what do I know about X, recall a past decision/conclusion, find a memory.',
    parameters: {
      search: { type: 'string', required: true, description: 'Search query (Trilium syntax).' },
      limit: { type: 'integer', description: 'Max results (default 30).' },
      includeContent: { type: 'boolean', description: 'Also fetch each hit content (default false; can be heavy).' },
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
                utcDateModified: { type: 'string' },
                content: { type: 'string' },
              },
            },
          },
          count: { type: 'integer', required: true },
        },
      },
      render: (_args, value: { results: Array<{ noteId: string; title: string; type?: string; utcDateModified?: string; content?: string }>; count: number }) => {
        if (value.results.length === 0) return text('记忆库中没有匹配的内容')
        return text(value.results.map(note => {
          const head = note.noteId + '  ' + note.title + (note.type !== undefined && note.type !== 'text' ? '  [' + note.type + ']' : '')
          return note.content !== undefined ? head + '\n' + note.content : head
        }).join('\n\n'))
      },
    },
    async execute(args) {
      const memoryNoteId = getConfig().memoryNoteId || 'root'
      const results = await etapi.searchNotes({
        search: args.search,
        ancestorNoteId: memoryNoteId,
        limit: args.limit ?? 30,
      })
      const out: Array<{ noteId: string; title: string; type?: string; utcDateModified?: string; content?: string }> = []
      for (const hit of results.slice(0, args.includeContent === true ? 10 : results.length)) {
        const entry: { noteId: string; title: string; type?: string; utcDateModified?: string; content?: string } = {
          noteId: hit.noteId,
          title: hit.title,
          type: hit.type,
          utcDateModified: hit.utcDateModified,
        }
        if (args.includeContent === true) {
          try {
            const content = await etapi.getNoteContent(hit.noteId)
            entry.content = content.length > 8000 ? content.slice(0, 8000) + '…（截断）' : content
          } catch {
            entry.content = '（内容读取失败）'
          }
        }
        out.push(entry)
      }
      return { results: out, count: out.length }
    },
  })
}

/**
 * Weekly-report workflow. Two modes:
 *  - no draft: collect the week's source material (本周工作 notes under
 *    关注项目/日程 + daily work logs) and return it for the agent to write
 *    up per the 周报撰写规范.
 *  - with draft: create the weekly report note under the schedule directory
 *    with startDate/endDate labels.
 */
export function triliumWeeklyReportTool(etapi: TriliumEtapi, getConfig: () => TriliumConfig) {
  return defineTool({
    name: 'trilium_weekly_report',
    description: 'Weekly-report workflow. Without draft: collects the weekly source material (本周工作 notes + 工作日报 logs) scoped by date and returns it, ' +
      'so you can write the report per the 周报撰写规范 (group by project, numbered items, explicit status, facts only). ' +
      'With draft + targetNoteId: stores the finished report into the schedule directory with startDate/endDate labels. ' +
      'Triggers: write weekly report, 周报, 本周工作 summary.',
    parameters: {
      startDate: { type: 'string', description: 'Week start (YYYY-MM-DD). Default: Monday of the current week.' },
      endDate: { type: 'string', description: 'Week end (YYYY-MM-DD). Default: Sunday of the current week.' },
      draft: { type: 'string', description: 'Finished report text (HTML). When present the report is stored.' },
      targetNoteId: { type: 'string', description: 'Parent for the stored report (required with draft). Default: 关注项目/日程 (auto-located).' },
      title: { type: 'string', description: 'Report title (default: 本周工作 YYYY-MM-DD).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          mode: { type: 'string', enum: ['material', 'stored'], required: true },
          material: { type: 'string' },
          notesFound: {
            type: 'array',
            items: { type: 'object', additionalProperties: false, properties: { noteId: { type: 'string' }, title: { type: 'string' } } },
          },
          storedNoteId: { type: 'string' },
          storedTitle: { type: 'string' },
          startDate: { type: 'string', required: true },
          endDate: { type: 'string', required: true },
          message: { type: 'string' },
        },
      },
      render: (_args, value: { mode: string; material?: string; notesFound?: unknown[]; storedNoteId?: string; storedTitle?: string; startDate: string; endDate: string; message?: string }) => {
        if (value.mode === 'stored') {
          return text('周报已存档：「' + (value.storedTitle ?? '') + '」(' + (value.storedNoteId ?? '') + ')，' + value.startDate + ' ~ ' + value.endDate)
        }
        return text(
          '周报素材（' + value.startDate + ' ~ ' + value.endDate + '），共 ' + (value.notesFound?.length ?? 0) + ' 条来源：\n\n' + (value.material ?? '（无素材）') +
          '\n\n请按《周报撰写规范》成文：按项目分组、编号列表、状态明确、只写事实。成文后调用本工具 draft=... 存档（将自动加 startDate/endDate 标签）。',
        )
      },
    },
    async execute(args) {
      // Date range defaults: this week (Monday..Sunday).
      const now = new Date()
      const day = (now.getDay() + 6) % 7 // 0 = Monday
      const monday = new Date(now)
      monday.setDate(now.getDate() - day)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      const fmt = (d: Date): string => {
        const pad = (n: number): string => String(n).padStart(2, '0')
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      }
      const startDate = args.startDate ?? fmt(monday)
      const endDate = args.endDate ?? fmt(sunday)

      if (args.draft !== undefined) {
        // ---- store mode -------------------------------------------------
        let targetNoteId = args.targetNoteId
        if (targetNoteId === undefined) {
          targetNoteId = await locateScheduleDirectory(etapi)
        }
        const title = args.title ?? '本周工作 ' + startDate
        const created = await etapi.createNote({
          parentNoteId: targetNoteId,
          title,
          type: 'text',
          content: args.draft,
        })
        await etapi.createAttribute({ noteId: created.note.noteId, type: 'label', name: 'startDate', value: startDate })
        await etapi.createAttribute({ noteId: created.note.noteId, type: 'label', name: 'endDate', value: endDate })
        invalidateMemoryIndex()
        return {
          mode: 'stored' as const,
          storedNoteId: created.note.noteId,
          storedTitle: title,
          startDate,
          endDate,
          message: 'stored under ' + targetNoteId,
        }
      }

      // ---- material mode ------------------------------------------------
      const notesFound: Array<{ noteId: string; title: string }> = []
      const materialParts: string[] = []
      try {
        // 1) 本周工作 notes under 关注项目 (search whole library, filter later).
        const weekly = await etapi.searchNotes({ search: '本周工作', limit: 20 })
        for (const hit of weekly) {
          notesFound.push({ noteId: hit.noteId, title: hit.title })
          const content = await etapi.getNoteContent(hit.noteId)
          materialParts.push('【本周工作】' + hit.title + ' (' + hit.noteId + ')\n' + content.slice(0, 12000))
        }
      } catch {
        // 本周工作 search failed — continue with daily logs.
      }
      try {
        // 2) daily work logs (工作日报): notes under the diary subtree,
        //    matched by the date range in their titles.
        const diary = await etapi.searchNotes({ search: '工作日报', limit: 20 })
        for (const hit of diary) {
          const titleDate = /(\d{4})[-年/](\d{1,2})[-月/](\d{1,2})/.exec(hit.title)
          if (titleDate === null) continue
          const y = Number(titleDate[1]); const m = Number(titleDate[2]); const d = Number(titleDate[3])
          const stamp = String(y).padStart(4, '0') + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0')
          if (stamp < startDate || stamp > endDate) continue
          notesFound.push({ noteId: hit.noteId, title: hit.title })
          const content = await etapi.getNoteContent(hit.noteId)
          materialParts.push('【工作日报】' + hit.title + ' (' + hit.noteId + ')\n' + content.slice(0, 8000))
        }
      } catch {
        // Daily log search failed — material may be partial.
      }

      return {
        mode: 'material' as const,
        material: materialParts.length > 0 ? materialParts.join('\n\n') : '（未找到本周素材：既没有「本周工作」笔记，也没有日期范围内的「工作日报」）',
        notesFound,
        startDate,
        endDate,
      }
    },
  })
}

/**
 * Locate the schedule directory (关注项目/日程). Strategy: find the
 * 关注项目 top-level note, then its child named 日程. Falls back to the
 * memory directory when not found (never throws).
 */
async function locateScheduleDirectory(etapi: TriliumEtapi): Promise<string> {
  try {
    const root = await etapi.getNote('root')
    for (const childId of root.childNoteIds) {
      const child = await etapi.getNote(childId)
      if (child.title === '关注项目') {
        for (const subId of child.childNoteIds) {
          const sub = await etapi.getNote(subId)
          if (sub.title === '日程' || sub.title.includes('日程')) return sub.noteId
        }
        return child.noteId
      }
    }
  } catch {
    // Fall through.
  }
  return 'root'
}