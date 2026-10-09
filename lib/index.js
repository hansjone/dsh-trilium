import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/index.ts
import z from "@deepseek-ai/schemastery";

// src/etapi.ts
import { readFileSync } from "node:fs";

class TriliumApiError extends Error {
  status;
  code;
  constructor(message, status, code) {
    super(message);
    this.name = "TriliumApiError";
    this.status = status;
    this.code = code;
  }
}

class TriliumEtapi {
  getConfig;
  constructor(getConfig) {
    this.getConfig = getConfig;
  }
  base() {
    return this.getConfig().baseUrl.replace(/\/$/, "");
  }
  token() {
    return this.getConfig().token;
  }
  timeoutMs() {
    return this.getConfig().timeoutMs;
  }
  async fetchTimed(url, init, timeoutMs = this.timeoutMs()) {
    const controller = new AbortController;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new TriliumApiError("ETAPI request timed out after " + timeoutMs + "ms");
      }
      throw new TriliumApiError(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }
  }
  async request(method, path, body) {
    const headers = { Authorization: this.token() };
    let payload;
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const response = await this.fetchTimed(this.base() + path, { method, headers, body: payload });
    if (response.status === 204)
      return;
    const text = await response.text();
    if (!response.ok) {
      let status;
      let code;
      let message = "HTTP " + response.status;
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed === "object" && parsed !== null) {
          const p = parsed;
          if (typeof p.message === "string")
            message = p.message;
          if (typeof p.status === "number")
            status = p.status;
          if (typeof p.code === "string")
            code = p.code;
        }
      } catch {}
      throw new TriliumApiError(message, status, code);
    }
    if (text === "")
      return;
    return JSON.parse(text);
  }
  appInfo() {
    return this.request("GET", "/app-info");
  }
  async searchNotes(params) {
    const query = new URLSearchParams;
    query.set("search", params.search);
    if (params.fastSearch !== undefined)
      query.set("fastSearch", String(params.fastSearch));
    if (params.includeArchivedNotes !== undefined)
      query.set("includeArchivedNotes", String(params.includeArchivedNotes));
    if (params.ancestorNoteId !== undefined)
      query.set("ancestorNoteId", params.ancestorNoteId);
    if (params.ancestorDepth !== undefined)
      query.set("ancestorDepth", params.ancestorDepth);
    if (params.orderBy !== undefined)
      query.set("orderBy", params.orderBy);
    if (params.orderDirection !== undefined)
      query.set("orderDirection", params.orderDirection);
    if (params.limit !== undefined)
      query.set("limit", String(params.limit));
    if (params.debug !== undefined)
      query.set("debug", String(params.debug));
    const body = await this.request("GET", "/notes?" + query.toString());
    return body.results;
  }
  getNote(noteId) {
    return this.request("GET", "/notes/" + encodeURIComponent(noteId));
  }
  async getNoteContent(noteId) {
    const response = await this.fetchTimed(this.base() + "/notes/" + encodeURIComponent(noteId) + "/content", {
      headers: { Authorization: this.token() }
    });
    if (!response.ok)
      throw new TriliumApiError("ETAPI HTTP " + response.status, response.status);
    return await response.text();
  }
  createNote(payload) {
    return this.request("POST", "/create-note", payload);
  }
  patchNote(noteId, patch) {
    return this.request("PATCH", "/notes/" + encodeURIComponent(noteId), patch);
  }
  async putNoteContent(noteId, content) {
    const response = await this.fetchTimed(this.base() + "/notes/" + encodeURIComponent(noteId) + "/content", {
      method: "PUT",
      headers: { Authorization: this.token(), "content-type": "text/plain" },
      body: content
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new TriliumApiError("ETAPI HTTP " + response.status + ": " + text.slice(0, 200), response.status);
    }
  }
  deleteNote(noteId) {
    return this.request("DELETE", "/notes/" + encodeURIComponent(noteId));
  }
  undeleteNote(noteId) {
    return this.request("POST", "/notes/" + encodeURIComponent(noteId) + "/undelete");
  }
  getHistory(ancestorNoteId) {
    const query = ancestorNoteId === undefined ? "" : "?ancestorNoteId=" + encodeURIComponent(ancestorNoteId);
    return this.request("GET", "/notes/history" + query);
  }
  getNoteRevisions(noteId) {
    return this.request("GET", "/notes/" + encodeURIComponent(noteId) + "/revisions");
  }
  async getRevisionContent(revisionId) {
    const response = await this.fetchTimed(this.base() + "/revisions/" + encodeURIComponent(revisionId) + "/content", {
      headers: { Authorization: this.token() }
    });
    if (!response.ok)
      throw new TriliumApiError("ETAPI HTTP " + response.status, response.status);
    return await response.text();
  }
  createBranch(payload) {
    return this.request("POST", "/branches", payload);
  }
  getBranch(branchId) {
    return this.request("GET", "/branches/" + encodeURIComponent(branchId));
  }
  deleteBranch(branchId) {
    return this.request("DELETE", "/branches/" + encodeURIComponent(branchId));
  }
  getAttribute(attributeId) {
    return this.request("GET", "/attributes/" + encodeURIComponent(attributeId));
  }
  createAttribute(payload) {
    return this.request("POST", "/attributes", payload);
  }
  patchAttribute(attributeId, patch) {
    return this.request("PATCH", "/attributes/" + encodeURIComponent(attributeId), patch);
  }
  deleteAttribute(attributeId) {
    return this.request("DELETE", "/attributes/" + encodeURIComponent(attributeId));
  }
  getNoteAttachments(noteId) {
    return this.request("GET", "/notes/" + encodeURIComponent(noteId) + "/attachments");
  }
  getAttachment(attachmentId) {
    return this.request("GET", "/attachments/" + encodeURIComponent(attachmentId));
  }
  createAttachment(payload) {
    return this.request("POST", "/attachments", payload);
  }
  deleteAttachment(attachmentId) {
    return this.request("DELETE", "/attachments/" + encodeURIComponent(attachmentId));
  }
  async getAttachmentContent(attachmentId) {
    const response = await this.fetchTimed(this.base() + "/attachments/" + encodeURIComponent(attachmentId) + "/content", {
      headers: { Authorization: this.token() }
    });
    if (!response.ok)
      throw new TriliumApiError("ETAPI HTTP " + response.status, response.status);
    return { buffer: await response.arrayBuffer(), contentType: response.headers.get("content-type") ?? "application/octet-stream" };
  }
  getCalendarNote(type, date) {
    const path = type === "day" ? "/calendar/days/" : type === "week" ? "/calendar/weeks/" : type === "month" ? "/calendar/months/" : "/calendar/years/";
    return this.request("GET", path + encodeURIComponent(date));
  }
  getInboxNote(date) {
    return this.request("GET", "/inbox/" + encodeURIComponent(date));
  }
  createBackup(name) {
    return this.request("PUT", "/backup/" + encodeURIComponent(name));
  }
  async importZip(noteId, zipPath) {
    const bytes = readFileSync(zipPath);
    const boundary = "----dsh-trilium-" + Date.now().toString(36);
    const head = Buffer.from("--" + boundary + `\r
` + `Content-Disposition: form-data; name="export"; filename="export.zip"\r
` + `Content-Type: application/zip\r
\r
`);
    const tail = Buffer.from(`\r
--` + boundary + `--\r
`);
    const body = Buffer.concat([head, bytes, tail]);
    const response = await this.fetchTimed(this.base() + "/notes/" + encodeURIComponent(noteId) + "/import", {
      method: "POST",
      headers: { Authorization: this.token(), "content-type": "multipart/form-data; boundary=" + boundary },
      body
    }, Math.max(this.timeoutMs(), 120000));
    if (!response.ok)
      throw new TriliumApiError("ETAPI HTTP " + response.status, response.status);
    return await response.json();
  }
  async exportNote(noteId, format) {
    const response = await this.fetchTimed(this.base() + "/notes/" + encodeURIComponent(noteId) + "/export?format=" + format, {
      headers: { Authorization: this.token() }
    }, Math.max(this.timeoutMs(), 60000));
    if (!response.ok)
      throw new TriliumApiError("ETAPI HTTP " + response.status, response.status);
    return { buffer: await response.arrayBuffer(), contentType: response.headers.get("content-type") ?? "application/zip" };
  }
  async listChildren(noteId) {
    const note = await this.getNote(noteId);
    const summaries = [];
    for (const childId of note.childNoteIds) {
      try {
        const child = await this.getNote(childId);
        summaries.push({
          noteId: child.noteId,
          title: child.title,
          type: child.type,
          hasChildren: child.childNoteIds.length > 0,
          isProtected: child.isProtected
        });
      } catch {}
    }
    return summaries;
  }
}

// src/memory.ts
var TRILIUM_GUIDANCE = [
  "本机已安装 dsh-trilium 插件（Trilium 记忆知识库）：通过 ETAPI 连接用户的 Trilium 笔记库。",
  "能力：trilium_search 搜索、trilium_get_note/list_children 读写笔记、trilium_remember 记忆写入、trilium_recall 记忆检索、trilium_create_note/update_note/delete_note 管理、trilium_weekly_report 周报工作流、trilium_export 导出、trilium_history 历史、trilium_attribute 属性管理。",
  "记忆规则：AI 写入内容默认归入记忆目录（Agent笔记，noteId 由配置 memoryNoteId 指定），除非用户明确指定其他位置；Trilium 是跨会话记忆库，重要信息、用户偏好、已解决问题、能力边界优先写入并持久保存；回忆时优先查询 Trilium 而非只依赖会话上下文。",
  "周报规范要点：按项目/工作类型分组、编号列出、状态明确（已修复/完成/已部署/等待测试/持续观测/等待排期/待协同排查）；只写事实，不写检查验证类内容（node --check、lint、git diff 等）；复杂排查保留 问题描述→问题定位→处理结果 短段落。",
  "写作风格：周报存「关注项目/日程」并打 startDate/endDate 标签；学习笔记用 概念→实现→缺点 结构；事实纪律——所有进度/状态/结论必须来自素材原文，拿不准标注「待确认」。",
  "限制：token 不写入笔记、不回显给模型；删除笔记需 confirm=true（软删进回收站可恢复）；ETAPI 修改正文必须走 trilium_update_note 的 content 参数（PUT text/plain），PATCH 不支持 content。",
  "用户提到「Trilium / 笔记 / 记忆 / Agent笔记 / 周报 / 本周工作」时即指本插件，请据此协作。"
].join(" ");
var INDEX_TTL_MS = 5 * 60 * 1000;
var INDEX_MAX_TITLES = 60;
var cache;
async function buildMemoryIndex(etapi, config) {
  const now = Date.now();
  if (cache !== undefined && now - cache.at < INDEX_TTL_MS) {
    return cache.failed ? "（记忆索引暂时不可用，可稍后调用 trilium_recall 查询）" : cache.text;
  }
  try {
    const noteId = config.memoryNoteId || "root";
    let rootTitle = "";
    try {
      rootTitle = (await etapi.getNote(noteId)).title;
    } catch {
      rootTitle = noteId;
    }
    const results = await etapi.searchNotes({ search: "*", ancestorNoteId: noteId, limit: INDEX_MAX_TITLES });
    const lines = results.map((note) => {
      const parts = [note.title];
      if (note.type !== "text")
        parts.push("[" + note.type + "]");
      if (note.childNoteIds.length > 0)
        parts.push("(" + note.childNoteIds.length + " 子项)");
      return "- " + parts.join(" ");
    });
    const text = [
      "Trilium 记忆目录「" + rootTitle + "」当前索引（" + results.length + " 条）：",
      lines.join(`
`),
      "需要细节时调用 trilium_recall / trilium_get_note 查询具体笔记。"
    ].join(`
`);
    cache = { at: now, text, failed: false };
    return text;
  } catch {
    cache = { at: now, text: "", failed: true };
    return "（记忆索引暂时不可用，可稍后调用 trilium_recall 查询）";
  }
}
function invalidateMemoryIndex() {
  cache = undefined;
}
function readCachedIndex() {
  return cache !== undefined && !cache.failed ? cache.text : "";
}

// src/store.ts
import { chmodSync, existsSync, mkdirSync, readFileSync as readFileSync2, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// src/protocol.ts
var TRILIUM_API_BASE = "/api/dsh-trilium";
var TRILIUM_API = {
  config: TRILIUM_API_BASE + "/config",
  test: TRILIUM_API_BASE + "/test",
  search: TRILIUM_API_BASE + "/search",
  note: TRILIUM_API_BASE + "/note",
  children: TRILIUM_API_BASE + "/children"
};
var DEFAULT_CONFIG = {
  baseUrl: "",
  memoryNoteId: "",
  timeoutMs: 15000,
  autoInject: true,
  deleteConfirm: true,
  announceToAgent: true
};

// src/store.ts
var FORMAT_VERSION = 1;
function storePath() {
  return join(homedir(), ".dsh", "dsh-trilium.json");
}
function normalize(partial) {
  const p = partial ?? {};
  const pick = (key, fallback) => {
    const value = p[key];
    return value === undefined ? fallback : value;
  };
  return {
    baseUrl: pick("baseUrl", DEFAULT_CONFIG.baseUrl),
    token: pick("token", ""),
    memoryNoteId: pick("memoryNoteId", DEFAULT_CONFIG.memoryNoteId),
    timeoutMs: pick("timeoutMs", DEFAULT_CONFIG.timeoutMs),
    autoInject: pick("autoInject", DEFAULT_CONFIG.autoInject),
    deleteConfirm: pick("deleteConfirm", DEFAULT_CONFIG.deleteConfirm),
    announceToAgent: pick("announceToAgent", DEFAULT_CONFIG.announceToAgent),
    tokenSet: false
  };
}
function readConfig() {
  const path = storePath();
  try {
    if (!existsSync(path))
      return { ...normalize(undefined), tokenSet: false };
    const parsed = JSON.parse(readFileSync2(path, "utf8"));
    if (typeof parsed !== "object" || parsed === null)
      return { ...normalize(undefined), tokenSet: false };
    const file = parsed;
    const config = normalize(file.config);
    return { ...config, tokenSet: config.token !== "" };
  } catch {
    return { ...normalize(undefined), tokenSet: false };
  }
}
function writeConfig(config) {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  const file = { version: FORMAT_VERSION, config: { ...config } };
  const tmp = path + ".tmp";
  writeFileSync(tmp, JSON.stringify(file, null, 2) + `
`, { mode: 384 });
  renameSync(tmp, path);
  try {
    chmodSync(path, 384);
  } catch {}
}
function patchConfig(current, patch) {
  const next = { ...current };
  if (patch.baseUrl !== undefined)
    next.baseUrl = patch.baseUrl.trim();
  if (patch.token !== undefined && patch.token !== "")
    next.token = patch.token.trim();
  if (patch.memoryNoteId !== undefined)
    next.memoryNoteId = patch.memoryNoteId.trim();
  if (patch.timeoutMs !== undefined && Number.isFinite(patch.timeoutMs) && patch.timeoutMs > 0) {
    next.timeoutMs = Math.floor(patch.timeoutMs);
  }
  if (patch.autoInject !== undefined)
    next.autoInject = patch.autoInject;
  if (patch.deleteConfirm !== undefined)
    next.deleteConfirm = patch.deleteConfirm;
  if (patch.announceToAgent !== undefined)
    next.announceToAgent = patch.announceToAgent;
  return next;
}
function toView(config) {
  return {
    baseUrl: config.baseUrl,
    memoryNoteId: config.memoryNoteId,
    timeoutMs: config.timeoutMs,
    autoInject: config.autoInject,
    deleteConfirm: config.deleteConfirm,
    announceToAgent: config.announceToAgent,
    tokenSet: config.token !== ""
  };
}
function validatePatch(patch) {
  if (typeof patch !== "object" || patch === null)
    return "body must be a JSON object";
  const p = patch;
  if (p.baseUrl !== undefined && (typeof p.baseUrl !== "string" || p.baseUrl.trim() === "")) {
    return "baseUrl must be a non-empty string";
  }
  if (p.token !== undefined && typeof p.token !== "string")
    return "token must be a string";
  if (p.memoryNoteId !== undefined && (typeof p.memoryNoteId !== "string" || p.memoryNoteId.trim() === "")) {
    return "memoryNoteId must be a non-empty string";
  }
  if (p.timeoutMs !== undefined && (typeof p.timeoutMs !== "number" || !Number.isFinite(p.timeoutMs) || p.timeoutMs < 1 || p.timeoutMs > 120000)) {
    return "timeoutMs must be an integer in 1..120000";
  }
  for (const key of ["autoInject", "deleteConfirm", "announceToAgent"]) {
    if (p[key] !== undefined && typeof p[key] !== "boolean")
      return key + " must be a boolean";
  }
  return;
}

// src/routes.ts
var MAX_JSON_BODY_BYTES = 1 << 20;
function isLoopbackRequest(req) {
  const address = req.socket.remoteAddress;
  if (address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1")
    return false;
  if (req.headers["sec-fetch-site"] === "cross-site")
    return false;
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin !== undefined && host !== undefined) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return true;
}
function writeJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "referrer-policy": "no-referrer" });
  res.end(payload);
}
async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk;
    size += buffer.length;
    if (size > MAX_JSON_BODY_BYTES)
      return;
    chunks.push(buffer);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return typeof parsed === "object" && parsed !== null ? parsed : undefined;
  } catch {
    return;
  }
}
function queryParam(url, name) {
  const value = url.searchParams.get(name);
  return value === null ? undefined : value;
}
function makeRoutes(deps) {
  const { etapi } = deps;
  const routes = [
    {
      kind: "exact",
      path: TRILIUM_API.config,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: "forbidden: loopback-only" });
          return;
        }
        const method = req.method ?? "GET";
        if (method === "GET") {
          writeJson(res, 200, { config: toView(readConfig()) });
          return;
        }
        if (method !== "PUT") {
          writeJson(res, 405, { error: "method not allowed: " + method });
          return;
        }
        const body = await readJsonBody(req);
        if (body === undefined) {
          writeJson(res, 400, { error: "invalid JSON body" });
          return;
        }
        const problem = validatePatch(body);
        if (problem !== undefined) {
          writeJson(res, 400, { error: problem });
          return;
        }
        const current = readConfig();
        const next = patchConfig(current, body);
        writeConfig(next);
        writeJson(res, 200, { config: toView(next) });
      }
    },
    {
      kind: "exact",
      path: TRILIUM_API.test,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: "forbidden: loopback-only" });
          return;
        }
        if ((req.method ?? "GET") !== "POST") {
          writeJson(res, 405, { error: "method not allowed: " + req.method });
          return;
        }
        const body = await readJsonBody(req);
        const baseUrl = typeof body?.baseUrl === "string" && body.baseUrl !== "" ? body.baseUrl : undefined;
        const token = typeof body?.token === "string" && body.token !== "" ? body.token : undefined;
        const config = readConfig();
        const probeBase = (baseUrl ?? config.baseUrl).replace(/\/$/, "");
        const probeToken = token ?? config.token;
        const probe = { ok: false };
        const controller = new AbortController;
        const timer = setTimeout(() => controller.abort(), config.timeoutMs);
        const start = Date.now();
        try {
          const response = await fetch(probeBase + "/app-info", {
            headers: { Authorization: probeToken },
            signal: controller.signal
          });
          const latencyMs = Date.now() - start;
          if (response.ok) {
            probe.ok = true;
            probe.latencyMs = latencyMs;
            probe.appInfo = await response.json();
          } else {
            probe.error = "HTTP " + response.status + ": " + (await response.text()).slice(0, 200);
          }
        } catch (error) {
          probe.error = error instanceof Error ? error.message : String(error);
        } finally {
          clearTimeout(timer);
        }
        writeJson(res, probe.ok ? 200 : 502, { result: probe });
      }
    },
    {
      kind: "exact",
      path: TRILIUM_API.search,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: "forbidden: loopback-only" });
          return;
        }
        if ((req.method ?? "GET") !== "GET") {
          writeJson(res, 405, { error: "method not allowed: " + req.method });
          return;
        }
        const url = new URL(req.url ?? "/", "http://localhost");
        const search = queryParam(url, "search");
        if (search === undefined || search === "") {
          writeJson(res, 400, { error: "search query parameter is required" });
          return;
        }
        try {
          const results = await etapi.searchNotes({
            search,
            ancestorNoteId: queryParam(url, "ancestorNoteId"),
            limit: Number.parseInt(queryParam(url, "limit") ?? "50", 10)
          });
          writeJson(res, 200, { results });
        } catch (error) {
          writeJson(res, 502, { error: error instanceof Error ? error.message : String(error) });
        }
      }
    },
    {
      kind: "exact",
      path: TRILIUM_API.note,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: "forbidden: loopback-only" });
          return;
        }
        if ((req.method ?? "GET") !== "GET") {
          writeJson(res, 405, { error: "method not allowed: " + req.method });
          return;
        }
        const url = new URL(req.url ?? "/", "http://localhost");
        const noteId = queryParam(url, "noteId");
        if (noteId === undefined || noteId === "") {
          writeJson(res, 400, { error: "noteId query parameter is required" });
          return;
        }
        const withContent = queryParam(url, "content") === "1";
        try {
          const note = await etapi.getNote(noteId);
          const body = { note };
          if (withContent) {
            body.content = await etapi.getNoteContent(noteId);
          }
          writeJson(res, 200, body);
        } catch (error) {
          writeJson(res, 404, { error: error instanceof Error ? error.message : String(error) });
        }
      }
    },
    {
      kind: "exact",
      path: TRILIUM_API.children,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: "forbidden: loopback-only" });
          return;
        }
        if ((req.method ?? "GET") !== "GET") {
          writeJson(res, 405, { error: "method not allowed: " + req.method });
          return;
        }
        const url = new URL(req.url ?? "/", "http://localhost");
        const noteId = queryParam(url, "noteId") ?? "root";
        try {
          const children = await etapi.listChildren(noteId);
          writeJson(res, 200, { noteId, children });
        } catch (error) {
          writeJson(res, 404, { error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
  ];
  return routes;
}

// src/tools.ts
import { defineTool } from "@deepseek-ai/dsh-tools";
function text(value) {
  return [{ type: "text", text: value }];
}
function noteLine(note) {
  const parts = [note.noteId, note.title];
  if (note.type !== undefined && note.type !== "text")
    parts.push("[" + note.type + "]");
  if (note.childNoteIds !== undefined && note.childNoteIds.length > 0)
    parts.push("(" + note.childNoteIds.length + " children)");
  return parts.join("  ");
}
function renderNotes(notes) {
  if (notes.length === 0)
    return "（无结果）";
  return notes.map(noteLine).join(`
`);
}
function renderAttributes(attributes) {
  if (attributes.length === 0)
    return "（无属性）";
  return attributes.map((attr) => {
    const value = attr.value === undefined || attr.value === "" ? "" : "=" + attr.value;
    return attr.attributeId + "  " + attr.type + ":" + attr.name + value;
  }).join(`
`);
}
function triliumAppInfoTool(etapi) {
  return defineTool({
    name: "trilium_app_info",
    description: "Get information about the connected Trilium instance (version, build, server time, data directory). Also serves as an ETAPI connection test. " + "Triggers: check Trilium connection, instance info, ETAPI works?",
    parameters: {},
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          appVersion: { type: "string", required: true },
          dbVersion: { type: "integer", required: true },
          syncVersion: { type: "integer", required: true },
          buildDate: { type: "string" },
          buildRevision: { type: "string" },
          clipperProtocolVersion: { type: "string" },
          nodeVersion: { type: "string" },
          dataDirectory: { type: "string" },
          utcDateTime: { type: "string" }
        }
      },
      render: (_args, value) => text([
        "Trilium " + value.appVersion,
        "db " + value.dbVersion + " / sync " + value.syncVersion,
        value.buildRevision !== undefined ? "build " + value.buildRevision + (value.buildDate !== undefined ? " (" + value.buildDate + ")" : "") : "",
        value.nodeVersion !== undefined ? "node " + value.nodeVersion : "",
        value.dataDirectory !== undefined ? "data: " + value.dataDirectory : "",
        value.utcDateTime !== undefined ? "server time: " + value.utcDateTime : ""
      ].filter(Boolean).join(`
`))
    },
    async execute() {
      return etapi.appInfo();
    }
  });
}
function triliumSearchTool(etapi) {
  return defineTool({
    name: "trilium_search",
    description: 'Search notes in the Trilium library (fulltext + attribute syntax). Supports the Trilium search grammar: keywords, "exact phrase", #label, @relation, ancestor scoping. ' + "Triggers: find a note, search memory/notes, look up something in the knowledge base.",
    parameters: {
      search: { type: "string", required: true, description: 'Search query (Trilium syntax, e.g. towers tolkien, "Two Towers", towers #book).' },
      ancestorNoteId: { type: "string", description: "Only search inside this note subtree (default: whole library)." },
      ancestorDepth: { type: "string", description: "Depth constraint, e.g. eq1 (direct children), lt4, gt2." },
      orderBy: { type: "string", description: "Order field, e.g. title, dateCreated, dateModified, utcDateModified." },
      orderDirection: { type: "string", enum: ["asc", "desc"], description: "asc or desc (default asc)." },
      limit: { type: "integer", description: "Max results (default 50)." },
      fastSearch: { type: "boolean", description: "Fulltext without content (faster)." },
      includeArchivedNotes: { type: "boolean", description: "Include archived notes (default false)." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          results: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                noteId: { type: "string", required: true },
                title: { type: "string", required: true },
                type: { type: "string" },
                isProtected: { type: "boolean" },
                childNoteIds: { type: "array", items: { type: "string" } },
                parentNoteIds: { type: "array", items: { type: "string" } },
                utcDateModified: { type: "string" }
              }
            }
          },
          count: { type: "integer", required: true }
        }
      },
      render: (_args, value) => text("找到 " + value.count + ` 条：
` + renderNotes(value.results))
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
        includeArchivedNotes: args.includeArchivedNotes
      });
      const results = found.map((note) => ({
        noteId: note.noteId,
        title: note.title,
        type: note.type,
        isProtected: note.isProtected,
        childNoteIds: note.childNoteIds,
        parentNoteIds: note.parentNoteIds,
        utcDateModified: note.utcDateModified
      }));
      return { results, count: results.length };
    }
  });
}
function triliumGetNoteTool(etapi) {
  return defineTool({
    name: "trilium_get_note",
    description: "Get a note by ID: metadata (title, type, children, attributes) and optionally its content. " + "Triggers: read a note, inspect children/attributes, fetch note content.",
    parameters: {
      noteId: { type: "string", required: true, description: 'The note ID (or "root").' },
      includeContent: { type: "boolean", description: "Also fetch the note content (default false)." },
      contentMaxChars: { type: "integer", description: "Truncate content to this many chars (default 20000)." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          noteId: { type: "string", required: true },
          title: { type: "string", required: true },
          type: { type: "string", required: true },
          mime: { type: "string" },
          isProtected: { type: "boolean", required: true },
          parentNoteIds: { type: "array", items: { type: "string" }, required: true },
          childNoteIds: { type: "array", items: { type: "string" }, required: true },
          attributes: { type: "array", required: true, items: { type: "object", additionalProperties: false, properties: {} } },
          content: { type: "string" },
          contentTruncated: { type: "boolean" }
        }
      },
      render: (_args, value) => {
        const lines = [
          "#" + value.title + "  (" + value.noteId + ")",
          "type: " + value.type + (value.mime !== undefined ? " / " + value.mime : "") + (value.isProtected ? " / \uD83D\uDD12" : ""),
          "parents: " + (value.parentNoteIds.length > 0 ? value.parentNoteIds.join(", ") : "root"),
          "children: " + (value.childNoteIds.length > 0 ? value.childNoteIds.join(", ") : "（无）"),
          `attributes:
` + renderAttributes(value.attributes)
        ];
        if (value.content !== undefined) {
          lines.push("content" + (value.contentTruncated === true ? "（已截断）" : "") + `:
` + value.content);
        }
        return text(lines.join(`
`));
      }
    },
    async execute(args) {
      const note = await etapi.getNote(args.noteId);
      const result = {
        noteId: note.noteId,
        title: note.title,
        type: note.type,
        mime: note.mime,
        isProtected: note.isProtected,
        parentNoteIds: note.parentNoteIds,
        childNoteIds: note.childNoteIds,
        attributes: note.attributes
      };
      if (args.includeContent === true) {
        const content = await etapi.getNoteContent(args.noteId);
        const max = args.contentMaxChars ?? 20000;
        if (content.length > max) {
          result.content = content.slice(0, max) + `
…（内容较长，已截断至 ` + max + " 字符）";
          result.contentTruncated = true;
        } else {
          result.content = content;
          result.contentTruncated = false;
        }
      }
      return result;
    }
  });
}
function triliumListChildrenTool(etapi) {
  return defineTool({
    name: "trilium_list_children",
    description: "List the direct children of a note (one level of the tree). Use trilium_get_note for metadata or content of a specific note. " + "Triggers: browse the note tree, what is under this folder?",
    parameters: {
      noteId: { type: "string", required: true, description: 'Parent note ID (or "root").' }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          noteId: { type: "string", required: true },
          children: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                noteId: { type: "string", required: true },
                title: { type: "string", required: true },
                type: { type: "string", required: true },
                hasChildren: { type: "boolean", required: true },
                isProtected: { type: "boolean", required: true }
              }
            }
          }
        }
      },
      render: (_args, value) => text(value.children.length === 0 ? "（" + value.noteId + " 下没有子笔记）" : value.children.map((child) => child.noteId + "  " + child.title + (child.type !== "text" ? "  [" + child.type + "]" : "") + (child.hasChildren ? "  ▸" : "") + (child.isProtected ? "  \uD83D\uDD12" : "")).join(`
`))
    },
    async execute(args) {
      const children = await etapi.listChildren(args.noteId);
      return { noteId: args.noteId, children };
    }
  });
}
function triliumCreateNoteTool(etapi, getConfig) {
  return defineTool({
    name: "trilium_create_note",
    description: "Create a note in the Trilium tree. Default parent is the memory directory (Agent笔记); pass parentNoteId to place it elsewhere. " + "For AI-written content the memory rule says: default to the memory directory unless the user explicitly asks for another location. " + "Triggers: create a note, save something to the knowledge base, write a memory.",
    parameters: {
      title: { type: "string", required: true, description: "Note title." },
      parentNoteId: { type: "string", description: "Parent note ID. Default: memory directory (Agent笔记)." },
      content: { type: "string", description: "Note content. For text notes: HTML; plain text is also accepted." },
      type: { type: "string", enum: ["text", "code", "file", "image", "search", "book", "relationMap", "render", "mermaid"], description: "Note type (default text)." },
      mime: { type: "string", description: "MIME for code/file/image types, e.g. application/json, text/plain." },
      notePosition: { type: "integer", description: "Position among siblings (10, 20, 30...; use 5 for first, 1000000 for last)." },
      noteId: { type: "string", description: "Force a specific noteId (advanced)." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          noteId: { type: "string", required: true },
          title: { type: "string", required: true },
          type: { type: "string", required: true },
          parentNoteId: { type: "string", required: true },
          branchId: { type: "string", required: true }
        }
      },
      render: (_args, value) => text("已创建 " + value.type + " 笔记「" + value.title + `」
noteId: ` + value.noteId + `
parent: ` + value.parentNoteId + `
branch: ` + value.branchId)
    },
    async execute(args) {
      const parentNoteId = args.parentNoteId ?? (getConfig().memoryNoteId || "root");
      const created = await etapi.createNote({
        parentNoteId,
        title: args.title,
        type: args.type ?? "text",
        mime: args.mime,
        content: args.content,
        notePosition: args.notePosition,
        noteId: args.noteId
      });
      return {
        noteId: created.note.noteId,
        title: created.note.title,
        type: created.note.type,
        parentNoteId: created.branch.parentNoteId,
        branchId: created.branch.branchId
      };
    }
  });
}
function triliumUpdateNoteTool(etapi) {
  return defineTool({
    name: "trilium_update_note",
    description: "Update a note: title (PATCH), content (PUT, text/plain — the ETAPI way), or both. " + "Triggers: edit a note, change title, update note content, append to a note.",
    parameters: {
      noteId: { type: "string", required: true, description: "Note ID to update." },
      title: { type: "string", description: "New title (renames the note)." },
      content: { type: "string", description: "New content — replaces the whole content. For text notes: HTML." },
      append: { type: "boolean", description: "When true, append content to the existing content instead of replacing (content required)." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          noteId: { type: "string", required: true },
          title: { type: "string", required: true },
          contentUpdated: { type: "boolean", required: true }
        }
      },
      render: (_args, value) => text("已更新「" + value.title + "」(" + value.noteId + ")" + (value.contentUpdated ? "，内容已更新" : ""))
    },
    async execute(args) {
      let title = args.title;
      if (args.title === undefined && args.content === undefined) {
        throw new Error("nothing to update: provide title and/or content");
      }
      let contentUpdated = false;
      if (args.content !== undefined) {
        let content = args.content;
        if (args.append === true) {
          const existing = await etapi.getNoteContent(args.noteId);
          content = existing + content;
        }
        await etapi.putNoteContent(args.noteId, content);
        contentUpdated = true;
      }
      if (args.title !== undefined) {
        const note = await etapi.patchNote(args.noteId, { title: args.title });
        title = note.title;
      } else {
        const note = await etapi.getNote(args.noteId);
        title = note.title;
      }
      return { noteId: args.noteId, title, contentUpdated };
    }
  });
}
function triliumDeleteNoteTool(etapi, getConfig) {
  return defineTool({
    name: "trilium_delete_note",
    description: "Delete a note. The note goes to the Trilium trash (recoverable with trilium_undelete_note). " + "When deleteConfirm is enabled in the plugin config (default), confirm=true is required.",
    parameters: {
      noteId: { type: "string", required: true, description: "Note ID to delete." },
      confirm: { type: "boolean", required: true, description: "Must be true to delete (safety gate)." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ok: { type: "boolean", required: true },
          noteId: { type: "string", required: true },
          message: { type: "string", required: true }
        }
      },
      render: (_args, value) => text(value.ok ? "已删除 " + value.noteId + "（回收站可恢复：trilium_undelete_note）" : "删除未执行：" + value.message)
    },
    async execute(args) {
      if (getConfig().deleteConfirm && args.confirm !== true) {
        return { ok: false, noteId: args.noteId, message: "需要 confirm=true 确认删除（软删进回收站，可恢复）" };
      }
      await etapi.deleteNote(args.noteId);
      return { ok: true, noteId: args.noteId, message: "deleted" };
    }
  });
}
function triliumUndeleteNoteTool(etapi) {
  return defineTool({
    name: "trilium_undelete_note",
    description: "Restore a deleted note from the trash. The note must be deleted and have at least one undeleted parent. " + "Triggers: recover a deleted note, undo a deletion.",
    parameters: {
      noteId: { type: "string", required: true, description: "Deleted note ID to restore." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ok: { type: "boolean", required: true },
          success: { type: "boolean", required: true }
        }
      },
      render: (_args, value) => text(value.ok && value.success ? "已恢复笔记（trash 已还原）" : "恢复失败：请检查 noteId 是否在回收站")
    },
    async execute(args) {
      try {
        const result = await etapi.undeleteNote(args.noteId);
        return { ok: true, success: result.success === true };
      } catch {
        return { ok: false, success: false };
      }
    }
  });
}
function triliumAttributeTool(etapi) {
  return defineTool({
    name: "trilium_attribute",
    description: "Manage note attributes (labels and relations). Actions: list, create, update, delete. " + "A relation is an attribute with type=relation and value=target noteId. " + "Triggers: add a label/tag, set #startDate, relate notes, list attributes.",
    parameters: {
      action: { type: "string", required: true, enum: ["list", "create", "update", "delete"], description: "list / create / update / delete." },
      noteId: { type: "string", description: "Target note (list/create)." },
      attributeId: { type: "string", description: "Attribute ID (update/delete, or list by note)." },
      type: { type: "string", enum: ["label", "relation"], description: "Attribute type (create)." },
      name: { type: "string", description: "Attribute name, e.g. startDate, book (create/update)." },
      value: { type: "string", description: "Attribute value; for relation = target noteId (create/update)." },
      position: { type: "integer", description: "Attribute position among siblings (create/update)." },
      isInheritable: { type: "boolean", description: "Inheritable by descendants (create/update)." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ok: { type: "boolean", required: true },
          message: { type: "string", required: true },
          attribute: {
            type: "object",
            additionalProperties: false,
            properties: {
              attributeId: { type: "string" },
              noteId: { type: "string" },
              type: { type: "string" },
              name: { type: "string" },
              value: { type: "string" },
              position: { type: "integer" },
              isInheritable: { type: "boolean" },
              utcDateModified: { type: "string" }
            }
          },
          attributes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                attributeId: { type: "string" },
                noteId: { type: "string" },
                type: { type: "string" },
                name: { type: "string" },
                value: { type: "string" },
                position: { type: "integer" },
                isInheritable: { type: "boolean" },
                utcDateModified: { type: "string" }
              }
            }
          }
        }
      },
      render: (_args, value) => text(value.attributes !== undefined ? `属性列表：
` + renderAttributes(value.attributes) : value.ok ? "✓ " + value.message : "✗ " + value.message)
    },
    async execute(args) {
      if (args.action === "list") {
        if (args.noteId === undefined && args.attributeId === undefined) {
          throw new Error("list requires noteId (or attributeId)");
        }
        if (args.attributeId !== undefined) {
          const attribute = await etapi.getAttribute(args.attributeId);
          return { ok: true, message: "ok", attribute };
        }
        const note = await etapi.getNote(args.noteId);
        return { ok: true, message: "ok", attributes: note.attributes };
      }
      if (args.action === "create") {
        if (args.noteId === undefined || args.type === undefined || args.name === undefined) {
          throw new Error("create requires noteId, type (label|relation), and name");
        }
        const attribute = await etapi.createAttribute({
          noteId: args.noteId,
          type: args.type,
          name: args.name,
          value: args.value,
          position: args.position,
          isInheritable: args.isInheritable
        });
        return { ok: true, message: "created " + attribute.attributeId, attribute };
      }
      if (args.action === "update") {
        if (args.attributeId === undefined)
          throw new Error("update requires attributeId");
        const attribute = await etapi.patchAttribute(args.attributeId, {
          name: args.name,
          value: args.value,
          position: args.position,
          isInheritable: args.isInheritable
        });
        return { ok: true, message: "updated " + attribute.attributeId, attribute };
      }
      if (args.action === "delete") {
        if (args.attributeId === undefined)
          throw new Error("delete requires attributeId");
        await etapi.deleteAttribute(args.attributeId);
        return { ok: true, message: "deleted " + args.attributeId };
      }
      throw new Error("unknown action: " + String(args.action));
    }
  });
}
function triliumExportTool(etapi) {
  return defineTool({
    name: "trilium_export",
    description: "Export a note subtree as a ZIP archive (html or markdown). The archive is saved to /tmp on the dsh host and the path is returned. " + "Triggers: export notes, backup a subtree, download notes as markdown.",
    parameters: {
      noteId: { type: "string", required: true, description: 'Subtree root note ID (use "root" for the whole library).' },
      format: { type: "string", enum: ["html", "markdown", "share"], description: "Export format (default html)." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ok: { type: "boolean", required: true },
          path: { type: "string", required: true },
          bytes: { type: "integer", required: true },
          error: { type: "string" },
          contentType: { type: "string" }
        }
      },
      render: (_args, value) => text(value.ok ? "已导出 ZIP：" + value.path + " (" + value.bytes + " bytes)" : "导出失败：" + (value.error ?? "unknown"))
    },
    async execute(args) {
      const format = args.format ?? "html";
      const { buffer, contentType } = await etapi.exportNote(args.noteId, format);
      const fs = await import("node:fs");
      const path = "/tmp/trilium-export-" + args.noteId + "-" + Date.now() + ".zip";
      fs.writeFileSync(path, Buffer.from(buffer));
      return { ok: true, path, bytes: buffer.byteLength, contentType };
    }
  });
}
function triliumHistoryTool(etapi) {
  return defineTool({
    name: "trilium_history",
    description: "List recent changes in the library (note creations, modifications, deletions) with timestamps. " + "Triggers: what changed recently, recent activity, audit.",
    parameters: {
      ancestorNoteId: { type: "string", description: "Limit to this subtree (default: whole library)." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          changes: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                noteId: { type: "string", required: true },
                title: { type: "string" },
                current_title: { type: "string" },
                current_isDeleted: { type: "integer" },
                canBeUndeleted: { type: "boolean" },
                utcDate: { type: "string", required: true }
              }
            }
          }
        }
      },
      render: (_args, value) => text(value.changes.length === 0 ? "（无变更记录）" : value.changes.map((change) => {
        const title = change.current_title ?? change.title ?? change.noteId;
        const state = change.current_isDeleted === 1 ? change.canBeUndeleted === true ? "\uD83D\uDDD1 已删除(可恢复)" : "\uD83D\uDDD1 已删除" : "";
        return change.utcDate + "  " + title + "  (" + change.noteId + ")  " + state;
      }).join(`
`))
    },
    async execute(args) {
      const found = await etapi.getHistory(args.ancestorNoteId);
      const changes = found.map((change) => ({
        noteId: change.noteId,
        title: change.title,
        current_title: change.current_title,
        current_isDeleted: change.current_isDeleted,
        canBeUndeleted: change.canBeUndeleted,
        utcDate: change.utcDate
      }));
      return { changes };
    }
  });
}

// src/tools-memory.ts
import { defineTool as defineTool2 } from "@deepseek-ai/dsh-tools";
function text2(value) {
  return [{ type: "text", text: value }];
}
function today() {
  const now = new Date;
  const pad = (n) => String(n).padStart(2, "0");
  return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
}
function triliumRememberTool(etapi, getConfig) {
  return defineTool2({
    name: "trilium_remember",
    description: "Write a durable memory note into the memory directory (Agent笔记) with a date-stamped title. " + "Use for cross-session knowledge: user preferences, project conclusions, solved problems, capability boundaries, decisions. " + "Follows the 写入规则: AI content defaults to Agent笔记 unless the user explicitly says otherwise.",
    parameters: {
      title: { type: "string", required: true, description: "Memory title (a date stamp is prepended automatically)." },
      content: { type: "string", required: true, description: "Memory content (HTML or plain text)." },
      parentNoteId: { type: "string", description: "Override the memory directory (default: configured memoryNoteId)." },
      tags: { type: "array", items: { type: "string" }, description: "Labels to attach (created as #label attributes)." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          noteId: { type: "string", required: true },
          title: { type: "string", required: true },
          parentNoteId: { type: "string", required: true }
        }
      },
      render: (_args, value) => text2("已记住：「" + value.title + `」
noteId: ` + value.noteId + `
目录: ` + value.parentNoteId)
    },
    async execute(args) {
      const parentNoteId = args.parentNoteId ?? (getConfig().memoryNoteId || "root");
      const stamp = today();
      const title = "[" + stamp + "] " + args.title;
      const created = await etapi.createNote({
        parentNoteId,
        title,
        type: "text",
        content: args.content
      });
      if (args.tags !== undefined && args.tags.length > 0) {
        for (const tag of args.tags) {
          await etapi.createAttribute({ noteId: created.note.noteId, type: "label", name: tag, value: "" });
        }
      }
      invalidateMemoryIndex();
      return { noteId: created.note.noteId, title, parentNoteId };
    }
  });
}
function triliumRecallTool(etapi, getConfig) {
  return defineTool2({
    name: "trilium_recall",
    description: "Search the memory directory (Agent笔记) only — same syntax as trilium_search but scoped to the memory subtree. " + "Triggers: what do I know about X, recall a past decision/conclusion, find a memory.",
    parameters: {
      search: { type: "string", required: true, description: "Search query (Trilium syntax)." },
      limit: { type: "integer", description: "Max results (default 30)." },
      includeContent: { type: "boolean", description: "Also fetch each hit content (default false; can be heavy)." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          results: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                noteId: { type: "string", required: true },
                title: { type: "string", required: true },
                type: { type: "string" },
                utcDateModified: { type: "string" },
                content: { type: "string" }
              }
            }
          },
          count: { type: "integer", required: true }
        }
      },
      render: (_args, value) => {
        if (value.results.length === 0)
          return text2("记忆库中没有匹配的内容");
        return text2(value.results.map((note) => {
          const head = note.noteId + "  " + note.title + (note.type !== undefined && note.type !== "text" ? "  [" + note.type + "]" : "");
          return note.content !== undefined ? head + `
` + note.content : head;
        }).join(`

`));
      }
    },
    async execute(args) {
      const memoryNoteId = getConfig().memoryNoteId || "root";
      const results = await etapi.searchNotes({
        search: args.search,
        ancestorNoteId: memoryNoteId,
        limit: args.limit ?? 30
      });
      const out = [];
      for (const hit of results.slice(0, args.includeContent === true ? 10 : results.length)) {
        const entry = {
          noteId: hit.noteId,
          title: hit.title,
          type: hit.type,
          utcDateModified: hit.utcDateModified
        };
        if (args.includeContent === true) {
          try {
            const content = await etapi.getNoteContent(hit.noteId);
            entry.content = content.length > 8000 ? content.slice(0, 8000) + "…（截断）" : content;
          } catch {
            entry.content = "（内容读取失败）";
          }
        }
        out.push(entry);
      }
      return { results: out, count: out.length };
    }
  });
}
function triliumWeeklyReportTool(etapi, getConfig) {
  return defineTool2({
    name: "trilium_weekly_report",
    description: "Weekly-report workflow. Without draft: collects the weekly source material (本周工作 notes + 工作日报 logs) scoped by date and returns it, " + "so you can write the report per the 周报撰写规范 (group by project, numbered items, explicit status, facts only). " + "With draft + targetNoteId: stores the finished report into the schedule directory with startDate/endDate labels. " + "Triggers: write weekly report, 周报, 本周工作 summary.",
    parameters: {
      startDate: { type: "string", description: "Week start (YYYY-MM-DD). Default: Monday of the current week." },
      endDate: { type: "string", description: "Week end (YYYY-MM-DD). Default: Sunday of the current week." },
      draft: { type: "string", description: "Finished report text (HTML). When present the report is stored." },
      targetNoteId: { type: "string", description: "Parent for the stored report (required with draft). Default: 关注项目/日程 (auto-located)." },
      title: { type: "string", description: "Report title (default: 本周工作 YYYY-MM-DD)." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          mode: { type: "string", enum: ["material", "stored"], required: true },
          material: { type: "string" },
          notesFound: {
            type: "array",
            items: { type: "object", additionalProperties: false, properties: { noteId: { type: "string" }, title: { type: "string" } } }
          },
          storedNoteId: { type: "string" },
          storedTitle: { type: "string" },
          startDate: { type: "string", required: true },
          endDate: { type: "string", required: true },
          message: { type: "string" }
        }
      },
      render: (_args, value) => {
        if (value.mode === "stored") {
          return text2("周报已存档：「" + (value.storedTitle ?? "") + "」(" + (value.storedNoteId ?? "") + ")，" + value.startDate + " ~ " + value.endDate);
        }
        return text2("周报素材（" + value.startDate + " ~ " + value.endDate + "），共 " + (value.notesFound?.length ?? 0) + ` 条来源：

` + (value.material ?? "（无素材）") + `

请按《周报撰写规范》成文：按项目分组、编号列表、状态明确、只写事实。成文后调用本工具 draft=... 存档（将自动加 startDate/endDate 标签）。`);
      }
    },
    async execute(args) {
      const now = new Date;
      const day = (now.getDay() + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const fmt = (d) => {
        const pad = (n) => String(n).padStart(2, "0");
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      };
      const startDate = args.startDate ?? fmt(monday);
      const endDate = args.endDate ?? fmt(sunday);
      if (args.draft !== undefined) {
        let targetNoteId = args.targetNoteId;
        if (targetNoteId === undefined) {
          targetNoteId = await locateScheduleDirectory(etapi);
        }
        const title = args.title ?? "本周工作 " + startDate;
        const created = await etapi.createNote({
          parentNoteId: targetNoteId,
          title,
          type: "text",
          content: args.draft
        });
        await etapi.createAttribute({ noteId: created.note.noteId, type: "label", name: "startDate", value: startDate });
        await etapi.createAttribute({ noteId: created.note.noteId, type: "label", name: "endDate", value: endDate });
        invalidateMemoryIndex();
        return {
          mode: "stored",
          storedNoteId: created.note.noteId,
          storedTitle: title,
          startDate,
          endDate,
          message: "stored under " + targetNoteId
        };
      }
      const notesFound = [];
      const materialParts = [];
      try {
        const weekly = await etapi.searchNotes({ search: "本周工作", limit: 20 });
        for (const hit of weekly) {
          notesFound.push({ noteId: hit.noteId, title: hit.title });
          const content = await etapi.getNoteContent(hit.noteId);
          materialParts.push("【本周工作】" + hit.title + " (" + hit.noteId + `)
` + content.slice(0, 12000));
        }
      } catch {}
      try {
        const diary = await etapi.searchNotes({ search: "工作日报", limit: 20 });
        for (const hit of diary) {
          const titleDate = /(\d{4})[-年/](\d{1,2})[-月/](\d{1,2})/.exec(hit.title);
          if (titleDate === null)
            continue;
          const y = Number(titleDate[1]);
          const m = Number(titleDate[2]);
          const d = Number(titleDate[3]);
          const stamp = String(y).padStart(4, "0") + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
          if (stamp < startDate || stamp > endDate)
            continue;
          notesFound.push({ noteId: hit.noteId, title: hit.title });
          const content = await etapi.getNoteContent(hit.noteId);
          materialParts.push("【工作日报】" + hit.title + " (" + hit.noteId + `)
` + content.slice(0, 8000));
        }
      } catch {}
      return {
        mode: "material",
        material: materialParts.length > 0 ? materialParts.join(`

`) : "（未找到本周素材：既没有「本周工作」笔记，也没有日期范围内的「工作日报」）",
        notesFound,
        startDate,
        endDate
      };
    }
  });
}
async function locateScheduleDirectory(etapi) {
  try {
    const root = await etapi.getNote("root");
    for (const childId of root.childNoteIds) {
      const child = await etapi.getNote(childId);
      if (child.title === "关注项目") {
        for (const subId of child.childNoteIds) {
          const sub = await etapi.getNote(subId);
          if (sub.title === "日程" || sub.title.includes("日程"))
            return sub.noteId;
        }
        return child.noteId;
      }
    }
  } catch {}
  return "root";
}

// src/tools-extra.ts
import { readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "node:fs";
import { defineTool as defineTool3 } from "@deepseek-ai/dsh-tools";
function text3(value) {
  return [{ type: "text", text: value }];
}
function triliumCloneTool(etapi) {
  return defineTool3({
    name: "trilium_clone",
    description: "Clone a note into another directory (a branch), or remove one clone. A note can live in multiple places; " + "removing the last branch deletes the note. Triggers: clone note, place note in multiple folders, 克隆复用.",
    parameters: {
      action: { type: "string", required: true, enum: ["clone", "remove"], description: "clone (add a branch) or remove (delete a branch)." },
      noteId: { type: "string", description: "Source note id (clone)." },
      parentNoteId: { type: "string", description: "Target parent note id (clone)." },
      branchId: { type: "string", description: "Branch id to delete (remove)." },
      notePosition: { type: "integer", description: "Position among siblings (clone)." },
      prefix: { type: "string", description: "Placement-specific title prefix (clone)." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ok: { type: "boolean", required: true },
          branchId: { type: "string" },
          noteId: { type: "string" },
          parentNoteId: { type: "string" },
          message: { type: "string", required: true }
        }
      },
      render: (_args, value) => text3(value.ok ? "✓ " + value.message + (value.branchId !== undefined ? "（branch " + value.branchId + "）" : "") : "✗ " + value.message)
    },
    async execute(args) {
      if (args.action === "clone") {
        if (args.noteId === undefined || args.parentNoteId === undefined)
          throw new Error("clone requires noteId and parentNoteId");
        const branch = await etapi.createBranch({
          noteId: args.noteId,
          parentNoteId: args.parentNoteId,
          notePosition: args.notePosition,
          prefix: args.prefix
        });
        return { ok: true, branchId: branch.branchId, noteId: branch.noteId, parentNoteId: branch.parentNoteId, message: "已克隆笔记到新目录" };
      }
      if (args.action === "remove") {
        if (args.branchId === undefined)
          throw new Error("remove requires branchId");
        await etapi.deleteBranch(args.branchId);
        return { ok: true, branchId: args.branchId, message: "已移除克隆（branch）" };
      }
      throw new Error("unknown action: " + String(args.action));
    }
  });
}
function triliumAttachmentTool(etapi) {
  return defineTool3({
    name: "trilium_attachment",
    description: "Manage note attachments (images, files). Actions: list, upload (from a local file), download (to /tmp on the dsh host), delete. " + "Upload reads a local file and base64-encodes it; download returns a text preview for text types or a saved path for binary. " + "Triggers: attach a file/image to a note, download an attachment, list note attachments.",
    parameters: {
      action: { type: "string", required: true, enum: ["list", "upload", "download", "delete"], description: "list / upload / download / delete." },
      noteId: { type: "string", description: "Owner note id (list/upload)." },
      attachmentId: { type: "string", description: "Attachment id (download/delete)." },
      localPath: { type: "string", description: "Absolute local file path to upload (upload)." },
      title: { type: "string", description: "Attachment title (upload, default: file basename)." },
      mime: { type: "string", description: "MIME type (upload, default: inferred from extension)." },
      role: { type: "string", description: "Attachment role (upload, default image for images else file)." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ok: { type: "boolean", required: true },
          message: { type: "string", required: true },
          attachments: { type: "array", items: { type: "object", additionalProperties: false, properties: { attachmentId: { type: "string" }, title: { type: "string" }, mime: { type: "string" }, role: { type: "string" } } } },
          path: { type: "string" },
          content: { type: "string" }
        }
      },
      render: (_args, value) => {
        if (value.attachments !== undefined) {
          return text3(value.attachments.length === 0 ? "（无附件）" : value.attachments.map((a) => (a.attachmentId ?? "") + "  " + (a.title ?? "") + (a.mime !== undefined ? "  [" + a.mime + "]" : "")).join(`
`));
        }
        if (value.content !== undefined)
          return text3(value.content);
        return text3((value.ok ? "✓ " : "✗ ") + value.message + (value.path !== undefined ? " " + value.path : ""));
      }
    },
    async execute(args) {
      if (args.action === "list") {
        if (args.noteId === undefined)
          throw new Error("list requires noteId");
        const attachments = await etapi.getNoteAttachments(args.noteId);
        return {
          ok: true,
          message: "ok",
          attachments: attachments.map((a) => ({ attachmentId: a.attachmentId, title: a.title, mime: a.mime, role: a.role }))
        };
      }
      if (args.action === "upload") {
        if (args.noteId === undefined || args.localPath === undefined)
          throw new Error("upload requires noteId and localPath");
        const bytes = readFileSync3(args.localPath);
        const title = args.title ?? args.localPath.split("/").pop() ?? "attachment";
        const mime = args.mime ?? guessMime(args.localPath);
        const role = args.role ?? (mime.startsWith("image/") ? "image" : "file");
        const attachment = await etapi.createAttachment({
          ownerId: args.noteId,
          role,
          mime,
          title,
          content: bytes.toString("base64")
        });
        return { ok: true, message: "已上传附件 " + attachment.attachmentId };
      }
      if (args.action === "download") {
        if (args.attachmentId === undefined)
          throw new Error("download requires attachmentId");
        const { buffer, contentType } = await etapi.getAttachmentContent(args.attachmentId);
        if (contentType.startsWith("text/") || contentType.includes("json")) {
          return { ok: true, message: "ok", content: Buffer.from(buffer).toString("utf8") };
        }
        const path = "/tmp/trilium-attachment-" + args.attachmentId + "-" + Date.now();
        writeFileSync2(path, Buffer.from(buffer));
        return { ok: true, message: "已保存附件", path };
      }
      if (args.action === "delete") {
        if (args.attachmentId === undefined)
          throw new Error("delete requires attachmentId");
        await etapi.deleteAttachment(args.attachmentId);
        return { ok: true, message: "已删除附件 " + args.attachmentId };
      }
      throw new Error("unknown action: " + String(args.action));
    }
  });
}
function guessMime(path) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const table = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    zip: "application/zip",
    json: "application/json",
    txt: "text/plain",
    md: "text/markdown",
    html: "text/html",
    csv: "text/csv",
    mp3: "audio/mpeg",
    mp4: "video/mp4"
  };
  return table[ext] ?? "application/octet-stream";
}
function triliumCalendarTool(etapi) {
  return defineTool3({
    name: "trilium_calendar",
    description: "Get (or auto-create) a calendar note: day / week / month / year / inbox. Dates use YYYY-MM-DD (or the date Trilium expects). " + "Triggers: journal note, day note, 工作日记, diary entry.",
    parameters: {
      type: { type: "string", required: true, enum: ["day", "week", "month", "year", "inbox"], description: "Calendar note kind." },
      date: { type: "string", required: true, description: "Date (YYYY-MM-DD); for week/month/year any day inside the period works." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          noteId: { type: "string", required: true },
          title: { type: "string", required: true },
          type: { type: "string", required: true },
          childNoteIds: { type: "array", items: { type: "string" }, required: true }
        }
      },
      render: (_args, value) => text3("「" + value.title + "」 " + value.noteId + "  [" + value.type + "]" + (value.childNoteIds.length > 0 ? "（" + value.childNoteIds.length + " 子项）" : ""))
    },
    async execute(args) {
      const note = args.type === "inbox" ? await etapi.getInboxNote(args.date) : await etapi.getCalendarNote(args.type, args.date);
      return { noteId: note.noteId, title: note.title, type: note.type, childNoteIds: note.childNoteIds };
    }
  });
}
function triliumBackupTool(etapi) {
  return defineTool3({
    name: "trilium_backup",
    description: "Create a database backup on the Trilium server under a given name. Triggers: backup Trilium, snapshot the database.",
    parameters: {
      name: { type: "string", required: true, description: "Backup name." }
    },
    output: {
      schema: { type: "object", additionalProperties: false, properties: { ok: { type: "boolean", required: true }, message: { type: "string", required: true } } },
      render: (_args, value) => text3(value.ok ? "✓ 备份已创建：" + value.message : "✗ " + value.message)
    },
    async execute(args) {
      await etapi.createBackup(args.name);
      return { ok: true, message: args.name };
    }
  });
}
function triliumImportTool(etapi) {
  return defineTool3({
    name: "trilium_import",
    description: "Import a ZIP export (from trilium_export) into a note subtree. Triggers: restore notes, migrate a subtree, import backup.",
    parameters: {
      noteId: { type: "string", required: true, description: "Target note id the archive imports into." },
      localPath: { type: "string", required: true, description: "Absolute local path to the ZIP archive." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ok: { type: "boolean", required: true },
          noteId: { type: "string" },
          title: { type: "string" },
          message: { type: "string", required: true }
        }
      },
      render: (_args, value) => text3(value.ok ? "✓ 已导入：" + (value.title ?? value.noteId ?? "") : "✗ " + value.message)
    },
    async execute(args) {
      const result = await etapi.importZip(args.noteId, args.localPath);
      return { ok: true, noteId: result.note.noteId, title: result.note.title, message: "imported" };
    }
  });
}
function triliumRevisionsTool(etapi) {
  return defineTool3({
    name: "trilium_revisions",
    description: "List note revisions or read one revision content. Triggers: view note history, restore from a previous version, audit changes.",
    parameters: {
      action: { type: "string", required: true, enum: ["list", "content"], description: "list (note revisions) or content (one revision)." },
      noteId: { type: "string", description: "Note id (list)." },
      revisionId: { type: "string", description: "Revision id (content)." }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ok: { type: "boolean", required: true },
          revisions: { type: "array", items: { type: "object", additionalProperties: false, properties: { revisionId: { type: "string" }, noteId: { type: "string" }, title: { type: "string" }, utcDateCreated: { type: "string" } } } },
          content: { type: "string" },
          message: { type: "string", required: true }
        }
      },
      render: (_args, value) => {
        if (value.revisions !== undefined) {
          return text3(value.revisions.length === 0 ? "（无修订）" : value.revisions.map((r) => (r.revisionId ?? "") + "  " + (r.title ?? "") + (r.utcDateCreated !== undefined ? "  " + r.utcDateCreated : "")).join(`
`));
        }
        if (value.content !== undefined)
          return text3(value.content);
        return text3(value.message);
      }
    },
    async execute(args) {
      if (args.action === "list") {
        if (args.noteId === undefined)
          throw new Error("list requires noteId");
        const revisions = await etapi.getNoteRevisions(args.noteId);
        return { ok: true, message: "ok", revisions: revisions.map((r) => ({ revisionId: r.revisionId, noteId: r.noteId, title: r.title, utcDateCreated: r.utcDateCreated })) };
      }
      if (args.action === "content") {
        if (args.revisionId === undefined)
          throw new Error("content requires revisionId");
        const content = await etapi.getRevisionContent(args.revisionId);
        return { ok: true, message: "ok", content };
      }
      throw new Error("unknown action: " + String(args.action));
    }
  });
}

// src/index.ts
var name = "trilium";
var inject = ["webServer", "tools", "systemPrompt"];
var TRILIUM_SETTINGS_NAMESPACE = "dsh-trilium";
var Config = z.object({
  enabled: z.boolean().default(true),
  announceToAgent: z.boolean().default(true)
});
var DEFAULT_ANNOUNCE = true;
var SECTION_ORDER = 150;
var MEMORY_SECTION_ORDER = 152;
var TRILIUM_GUIDANCE_INDEX_PREFIX = "【Trilium 记忆索引（自动注入，autoInject 可关）】";
function apply(ctx, config) {
  let current = () => config ?? {};
  const resolve = () => {
    const value = current();
    return {
      announceToAgent: value.announceToAgent ?? DEFAULT_ANNOUNCE,
      enabled: value.enabled ?? true
    };
  };
  const etapi = new TriliumEtapi(() => readConfig());
  const routes = makeRoutes({ etapi });
  let indexReady = false;
  const warmIndex = () => {
    if (indexReady)
      return;
    indexReady = true;
    buildMemoryIndex(etapi, readConfig()).catch(() => {
      return;
    });
  };
  warmIndex();
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
    () => triliumRevisionsTool(etapi)
  ];
  let disposeSection;
  let disposeMemorySection;
  let disposeRoutes;
  let disposeTools;
  const sync = () => {
    if (disposeSection !== undefined) {
      disposeSection();
      disposeSection = undefined;
    }
    if (disposeMemorySection !== undefined) {
      disposeMemorySection();
      disposeMemorySection = undefined;
    }
    if (disposeRoutes !== undefined) {
      disposeRoutes();
      disposeRoutes = undefined;
    }
    if (disposeTools !== undefined) {
      disposeTools();
      disposeTools = undefined;
    }
    const value = resolve();
    if (!value.enabled)
      return;
    if (value.announceToAgent) {
      disposeSection = ctx.systemPrompt.section({
        name: "plugin:dsh-trilium",
        order: SECTION_ORDER,
        text: TRILIUM_GUIDANCE
      });
    }
    disposeMemorySection = ctx.systemPrompt.section({
      name: "plugin:dsh-trilium:memory-index",
      order: MEMORY_SECTION_ORDER,
      text: () => {
        const cfg = readConfig();
        if (!cfg.autoInject)
          return "";
        buildMemoryIndex(etapi, cfg).catch(() => {
          return;
        });
        return `
` + TRILIUM_GUIDANCE_INDEX_PREFIX + `
` + readCachedIndex();
      }
    });
    disposeRoutes = ctx.effect(() => {
      const disposers = routes.map((route) => ctx.webServer.register(route));
      return () => {
        for (const dispose of disposers)
          dispose();
      };
    }, "dsh-trilium: routes");
    disposeTools = ctx.effect(() => {
      const disposers = toolFactories.map((factory) => ctx.tools.register(factory()));
      return () => {
        for (const dispose of disposers)
          dispose();
      };
    }, "dsh-trilium: tools");
  };
  ctx.inject(["settings"], (settingsCtx) => {
    const settings = settingsCtx.settings;
    const hooks = {
      setSource: (source) => {
        current = source;
        sync();
      },
      onChange: sync
    };
    if (typeof settings.installSection === "function") {
      settings.installSection(ctx, TRILIUM_SETTINGS_NAMESPACE, Config, config ?? {}, hooks);
      return;
    }
    const describeRows = (describe) => {
      if (typeof describe !== "function")
        return [];
      try {
        const raw = describe();
        if (Array.isArray(raw))
          return raw;
        if (raw && typeof raw === "object" && Array.isArray(raw.namespaces)) {
          return raw.namespaces;
        }
      } catch {}
      return [];
    };
    const readLive = () => {
      const row = describeRows(settings.describe).find((item) => item.ns === TRILIUM_SETTINGS_NAMESPACE);
      if (row?.value !== null && typeof row?.value === "object" && !Array.isArray(row.value)) {
        return { ...config ?? {}, ...row.value };
      }
      return config ?? {};
    };
    hooks.setSource(readLive);
    hooks.onChange();
    let last = JSON.stringify(readLive());
    const timer = setInterval(() => {
      const next = readLive();
      const fingerprint = JSON.stringify(next);
      if (fingerprint === last)
        return;
      last = fingerprint;
      hooks.onChange();
    }, 2000);
    settingsCtx.effect(() => () => clearInterval(timer), "dsh-trilium: settings describe poll");
    settingsCtx.logger?.info?.("dsh-trilium: following settings via describe() (no installSection — DSH ≥0.1.7 path)");
  });
  sync();
}
export {
  name,
  inject,
  apply,
  TRILIUM_SETTINGS_NAMESPACE,
  Config
};
