/**
 * Memory integration: what the plugin tells every agent.
 *
 * Static part — the user's durable rules (written rules, weekly-report style,
 * writing-style profile), distilled from the Trilium memory notes the user
 * maintains (Agent笔记/写入规则, 周报撰写规范, 写作风格与目录习惯档案).
 *
 * Dynamic part — the live index of the memory directory (Agent笔记), fetched
 * through ETAPI and cached briefly so session starts stay cheap.
 */

import type { TriliumEtapi } from './etapi.ts'
import type { TriliumConfig } from './protocol.ts'

/** Static guidance: announced to every agent (the plugin's memory contract). */
export const TRILIUM_GUIDANCE = [
  '本机已安装 dsh-trilium 插件（Trilium 记忆知识库）：通过 ETAPI 连接用户的 Trilium 笔记库。',
  '能力：trilium_search 搜索、trilium_get_note/list_children 读写笔记、trilium_remember 记忆写入、trilium_recall 记忆检索、trilium_create_note/update_note/delete_note 管理、trilium_weekly_report 周报工作流、trilium_export 导出、trilium_history 历史、trilium_attribute 属性管理。',
  '记忆规则：AI 写入内容默认归入记忆目录（Agent笔记，noteId 由配置 memoryNoteId 指定），除非用户明确指定其他位置；Trilium 是跨会话记忆库，重要信息、用户偏好、已解决问题、能力边界优先写入并持久保存；回忆时优先查询 Trilium 而非只依赖会话上下文。',
  '周报规范要点：按项目/工作类型分组、编号列出、状态明确（已修复/完成/已部署/等待测试/持续观测/等待排期/待协同排查）；只写事实，不写检查验证类内容（node --check、lint、git diff 等）；复杂排查保留 问题描述→问题定位→处理结果 短段落。',
  '写作风格：周报存「关注项目/日程」并打 startDate/endDate 标签；学习笔记用 概念→实现→缺点 结构；事实纪律——所有进度/状态/结论必须来自素材原文，拿不准标注「待确认」。',
  '限制：token 不写入笔记、不回显给模型；删除笔记需 confirm=true（软删进回收站可恢复）；ETAPI 修改正文必须走 trilium_update_note 的 content 参数（PUT text/plain），PATCH 不支持 content。',
  '用户提到「Trilium / 笔记 / 记忆 / Agent笔记 / 周报 / 本周工作」时即指本插件，请据此协作。',
].join(' ')

/** Memory index cache entry. */
interface IndexCache {
  at: number
  text: string
  failed: boolean
}

const INDEX_TTL_MS = 5 * 60 * 1000
const INDEX_MAX_TITLES = 60

let cache: IndexCache | undefined

/**
 * Build the memory-directory index text (title + type + children count) from
 * ETAPI. Cached 5 minutes; failures are cached briefly too so a flaky server
 * does not hammer the network on every session start.
 */
export async function buildMemoryIndex(etapi: TriliumEtapi, config: TriliumConfig): Promise<string> {
  const now = Date.now()
  if (cache !== undefined && now - cache.at < INDEX_TTL_MS) {
    return cache.failed ? '（记忆索引暂时不可用，可稍后调用 trilium_recall 查询）' : cache.text
  }
  try {
    const noteId = config.memoryNoteId || 'root'
    let rootTitle = ''
    try {
      rootTitle = (await etapi.getNote(noteId)).title
    } catch {
      rootTitle = noteId
    }
    const results = await etapi.searchNotes({ search: '*', ancestorNoteId: noteId, limit: INDEX_MAX_TITLES })
    const lines = results.map(note => {
      const parts = [note.title]
      if (note.type !== 'text') parts.push('[' + note.type + ']')
      if (note.childNoteIds.length > 0) parts.push('(' + note.childNoteIds.length + ' 子项)')
      return '- ' + parts.join(' ')
    })
    const text = [
      'Trilium 记忆目录「' + rootTitle + '」当前索引（' + results.length + ' 条）：',
      lines.join('\n'),
      '需要细节时调用 trilium_recall / trilium_get_note 查询具体笔记。',
    ].join('\n')
    cache = { at: now, text, failed: false }
    return text
  } catch {
    cache = { at: now, text: '', failed: true }
    return '（记忆索引暂时不可用，可稍后调用 trilium_recall 查询）'
  }
}

/** Invalidate the index cache (e.g. after a remember write). */
export function invalidateMemoryIndex(): void {
  cache = undefined
}
/** Synchronous cache read ('' when not ready or failed). */
export function readCachedIndex(): string {
  return cache !== undefined && !cache.failed ? cache.text : ''
}