window.__ModuleLoader__.load({
  id: "dsh-trilium",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap).get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// src/client/index.ts
var exports_client = {};
__export(exports_client, {
  inject: () => inject,
  apply: () => apply
});
module.exports = __toCommonJS(exports_client);

// src/protocol.ts
var TRILIUM_API_BASE = "/api/dsh-trilium";
var TRILIUM_API = {
  config: TRILIUM_API_BASE + "/config",
  test: TRILIUM_API_BASE + "/test",
  search: TRILIUM_API_BASE + "/search",
  note: TRILIUM_API_BASE + "/note",
  children: TRILIUM_API_BASE + "/children"
};

// src/client/api.ts
class TriliumApiError extends Error {
  constructor(message) {
    super(message);
    this.name = "TriliumApiError";
  }
}
async function readJson(response) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new TriliumApiError("HTTP " + response.status + ": invalid JSON response");
  }
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && typeof body.error === "string" ? body.error : "HTTP " + response.status;
    throw new TriliumApiError(message);
  }
  return body;
}
function query(params) {
  const search = new URLSearchParams;
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "")
      search.set(key, String(value));
  }
  const text = search.toString();
  return text === "" ? "" : "?" + text;
}

class TriliumApi {
  async getConfig() {
    const response = await fetch(TRILIUM_API.config);
    const body = await readJson(response);
    return body.config;
  }
  async putConfig(patch) {
    const response = await fetch(TRILIUM_API.config, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch)
    });
    const body = await readJson(response);
    return body.config;
  }
  async test(baseUrl, token) {
    const response = await fetch(TRILIUM_API.test, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseUrl, token })
    });
    const body = await readJson(response);
    return body.result;
  }
  async search(search, ancestorNoteId) {
    const response = await fetch(TRILIUM_API.search + query({ search, ancestorNoteId }));
    const body = await readJson(response);
    return body.results;
  }
  async getNote(noteId, withContent = false) {
    const response = await fetch(TRILIUM_API.note + query({ noteId, content: withContent ? 1 : undefined }));
    return readJson(response);
  }
  async getChildren(noteId = "root") {
    const response = await fetch(TRILIUM_API.children + query({ noteId }));
    const body = await readJson(response);
    return body.children;
  }
}

// src/client/locales.ts
var zh = {
  "settings.expand": "展开设置",
  "settings.collapse": "收起设置",
  "settings.notExposed": "当前 DSH 版本未向设置页暴露本插件的配置命名空间，表单不可用。可编辑 ~/.dsh/settings.yaml 直接配置后重启。",
  "settings.unsaved": "未保存",
  "settings.readOnly": "当前部署的设置只读。",
  "settings.saveFailed": "部署未接受这些值，已保留供你修改。",
  "settings.discard": "放弃",
  "settings.save": "保存",
  "settings.saved": "已保存 ✓",
  "settings.saving": "保存中…",
  "settings.overridden": "已覆盖",
  "settings.reset": "恢复默认",
  "settings.inherit": "继承",
  "settings.on": "开",
  "settings.off": "关",
  "settings.invalidNumber": "请输入数字，留空则使用默认值。",
  "settings.title": "Trilium 记忆库",
  "settings.description": "ETAPI 连接与记忆行为：服务器地址、token、默认记忆目录、自动注入等",
  "settings.baseUrl": "服务器地址 (ETAPI base URL)",
  "settings.baseUrlHint": "例如 https://your-host/etapi",
  "settings.token": "ETAPI token",
  "settings.tokenHint": "在 Trilium 的 Options → ETAPI 生成；留空保存则保持原值不变",
  "settings.memoryNoteId": "默认记忆目录 noteId",
  "settings.memoryNoteIdHint": "AI 记忆默认写入此目录（留空则用 root 根笔记）",
  "settings.timeoutMs": "请求超时（毫秒）",
  "settings.timeoutMsHint": "默认 15000（15 秒）",
  "settings.autoInject": "会话开始自动注入记忆索引",
  "settings.autoInjectHint": "把记忆目录索引摘要注入每次会话开头，可关闭",
  "settings.deleteConfirm": "删除笔记需 confirm 确认",
  "settings.deleteConfirmHint": "删除笔记进回收站，可恢复",
  "settings.announce": "在系统提示中声明本插件",
  "settings.announceHint": "向 agent 说明本插件的能力与记忆规则",
  "settings.enabled": "启用插件",
  "settings.enabledHint": "总开关（工具、路由、提示段）",
  "settings.test": "测试连接",
  "settings.testing": "测试中…",
  "settings.testOk": "连接成功：",
  "settings.testFail": "连接失败：",
  "entry.label": "Trilium",
  "entry.tooltip": "Trilium 笔记浏览器",
  "panel.searchPlaceholder": "搜索笔记（Trilium 语法）…",
  "panel.searching": "搜索中…",
  "panel.noResults": "（无结果）",
  "panel.error": "错误：",
  "panel.loading": "加载中…",
  "panel.empty": "（空）",
  "panel.back": "← 返回",
  "panel.contentEmpty": "（无内容）",
  "panel.notConfigured": "尚未配置 Trilium：请在 设置 → 插件 → Trilium 记忆库 中填写服务器地址与 token。",
  "panel.openSettings": "打开设置"
};

// src/client/TriliumSettingsCard.tsx
var import_react = require("react");
var jsx_runtime = require("react/jsx-runtime");
var EMPTY = {
  baseUrl: "",
  token: "",
  memoryNoteId: "",
  timeoutMs: "15000",
  autoInject: true,
  deleteConfirm: true,
  tokenSet: false
};
var fieldStyle = { display: "flex", flexDirection: "column", gap: 6, padding: "12px 0", borderTop: "1px solid var(--dsw-alias-border-l2)" };
var labelStyle = { fontSize: 13, fontWeight: 500, color: "var(--dsw-alias-label-primary)" };
var inputStyle = {
  border: "1px solid var(--dsw-alias-border-l2)",
  background: "var(--dsw-alias-bg-layer-3)",
  height: 34,
  borderRadius: 8,
  padding: "0 12px",
  fontSize: 13,
  color: "var(--dsw-alias-label-primary)"
};
var hintStyle = { color: "var(--dsw-alias-label-tertiary)", margin: 0, fontSize: 12, lineHeight: 1.5 };
var buttonStyle = {
  border: "1px solid var(--dsw-alias-border-l2)",
  background: "var(--dsw-alias-bg-layer-3)",
  color: "var(--dsw-alias-label-primary)",
  borderRadius: 8,
  padding: "6px 16px",
  fontSize: 13,
  cursor: "pointer"
};
function TextField(props) {
  return /* @__PURE__ */ jsx_runtime.jsxs("div", {
    style: fieldStyle,
    children: [
      /* @__PURE__ */ jsx_runtime.jsx("label", {
        style: labelStyle,
        htmlFor: props.id,
        children: props.label
      }),
      /* @__PURE__ */ jsx_runtime.jsx("input", {
        id: props.id,
        style: inputStyle,
        type: props.password === true ? "password" : "text",
        autoComplete: "off",
        placeholder: props.placeholder,
        value: props.value,
        disabled: props.disabled,
        onChange: (event) => {
          props.onEdit(event.target.value);
        }
      }),
      /* @__PURE__ */ jsx_runtime.jsx("p", {
        style: hintStyle,
        children: props.hint
      })
    ]
  });
}
function Toggle(props) {
  return /* @__PURE__ */ jsx_runtime.jsxs("div", {
    style: fieldStyle,
    children: [
      /* @__PURE__ */ jsx_runtime.jsxs("label", {
        style: { ...labelStyle, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
        htmlFor: props.id,
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("input", {
            id: props.id,
            type: "checkbox",
            checked: props.checked,
            disabled: props.disabled,
            onChange: (event) => {
              props.onEdit(event.target.checked);
            }
          }),
          /* @__PURE__ */ jsx_runtime.jsx("span", {
            children: props.label
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime.jsx("p", {
        style: hintStyle,
        children: props.hint
      })
    ]
  });
}
function TriliumSettingsCard(props) {
  const { t, api } = props;
  const [open, setOpen] = import_react.useState(false);
  const [form, setForm] = import_react.useState(EMPTY);
  const [loading, setLoading] = import_react.useState(false);
  const [loaded, setLoaded] = import_react.useState(false);
  const [loadError, setLoadError] = import_react.useState();
  const [saving, setSaving] = import_react.useState(false);
  const [saved, setSaved] = import_react.useState(false);
  const [saveError, setSaveError] = import_react.useState();
  const [busy, setBusy] = import_react.useState(false);
  const [testResult, setTestResult] = import_react.useState("idle");
  const [testMessage, setTestMessage] = import_react.useState();
  import_react.useEffect(() => {
    if (!open || loaded)
      return;
    setLoading(true);
    api.getConfig().then((config) => {
      setForm({
        baseUrl: config.baseUrl,
        token: "",
        memoryNoteId: config.memoryNoteId,
        timeoutMs: String(config.timeoutMs),
        autoInject: config.autoInject,
        deleteConfirm: config.deleteConfirm,
        tokenSet: config.tokenSet
      });
      setLoaded(true);
      setLoading(false);
    }).catch((error) => {
      setLoadError(error instanceof Error ? error.message : String(error));
      setLoading(false);
    });
  }, [open, loaded, api]);
  const save = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(undefined);
    try {
      const config = await api.putConfig({
        baseUrl: form.baseUrl,
        token: form.token,
        memoryNoteId: form.memoryNoteId,
        timeoutMs: Number.parseInt(form.timeoutMs, 10),
        autoInject: form.autoInject,
        deleteConfirm: form.deleteConfirm
      });
      setForm((prev) => ({ ...prev, token: "", tokenSet: config.tokenSet }));
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };
  const runTest = async () => {
    setBusy(true);
    setTestResult("idle");
    setTestMessage(undefined);
    try {
      const outcome = await api.test(form.baseUrl, form.token);
      if (outcome.ok) {
        setTestResult("ok");
        setTestMessage((outcome.appInfo?.appVersion ?? "") + " · " + (outcome.latencyMs ?? 0) + "ms");
      } else {
        setTestResult("fail");
        setTestMessage(outcome.error ?? "unknown");
      }
    } catch (error) {
      setTestResult("fail");
      setTestMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ jsx_runtime.jsxs("li", {
    style: {
      border: "1px solid var(--dsw-alias-border-l2)",
      background: "var(--dsw-alias-bg-layer-3)",
      borderRadius: 12,
      listStyle: "none",
      overflow: "hidden"
    },
    children: [
      /* @__PURE__ */ jsx_runtime.jsxs("button", {
        type: "button",
        style: {
          width: "100%",
          font: "inherit",
          color: "inherit",
          textAlign: "left",
          cursor: "pointer",
          background: "transparent",
          border: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px"
        },
        "aria-expanded": open,
        onClick: () => {
          setOpen(!open);
        },
        children: [
          /* @__PURE__ */ jsx_runtime.jsxs("span", {
            style: { display: "flex", flexDirection: "column", flex: 1, gap: 4, minWidth: 0 },
            children: [
              /* @__PURE__ */ jsx_runtime.jsx("span", {
                style: { color: "var(--dsw-alias-label-primary)", fontSize: 15, fontWeight: 600 },
                children: t("settings.title")
              }),
              /* @__PURE__ */ jsx_runtime.jsx("span", {
                style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 13 },
                children: t("settings.description")
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsx("svg", {
            width: "14",
            height: "14",
            viewBox: "0 0 14 14",
            fill: "none",
            "aria-hidden": "true",
            style: { transform: open ? "rotate(180deg)" : "none", transition: "transform 0.16s", flexShrink: 0 },
            children: /* @__PURE__ */ jsx_runtime.jsx("path", {
              d: "M3.5 5.5 7 9l3.5-3.5",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            })
          })
        ]
      }),
      open ? /* @__PURE__ */ jsx_runtime.jsxs("div", {
        style: { borderTop: "1px solid var(--dsw-alias-border-l2)", margin: "0 16px", paddingBottom: 12 },
        children: [
          loading ? /* @__PURE__ */ jsx_runtime.jsx("p", {
            style: hintStyle,
            children: t("panel.loading")
          }) : null,
          loadError !== undefined ? /* @__PURE__ */ jsx_runtime.jsxs("p", {
            style: { color: "var(--dsw-alias-label-error)", fontSize: 12 },
            children: [
              t("panel.error"),
              loadError
            ]
          }) : null,
          !loading && loadError === undefined ? /* @__PURE__ */ jsx_runtime.jsxs("div", {
            style: { display: "flex", flexDirection: "column" },
            children: [
              /* @__PURE__ */ jsx_runtime.jsx(TextField, {
                id: "tri-base-url",
                label: t("settings.baseUrl"),
                hint: t("settings.baseUrlHint"),
                value: form.baseUrl,
                disabled: saving,
                onEdit: (v) => {
                  setForm((p) => ({ ...p, baseUrl: v }));
                  setSaved(false);
                }
              }),
              /* @__PURE__ */ jsx_runtime.jsx(TextField, {
                id: "tri-token",
                label: t("settings.token"),
                hint: t("settings.tokenHint"),
                value: form.token,
                disabled: saving,
                password: true,
                placeholder: form.tokenSet ? "已配置（留空保持不变）" : "粘贴 ETAPI token",
                onEdit: (v) => {
                  setForm((p) => ({ ...p, token: v }));
                  setSaved(false);
                }
              }),
              /* @__PURE__ */ jsx_runtime.jsx(TextField, {
                id: "tri-memory",
                label: t("settings.memoryNoteId"),
                hint: t("settings.memoryNoteIdHint"),
                value: form.memoryNoteId,
                disabled: saving,
                onEdit: (v) => {
                  setForm((p) => ({ ...p, memoryNoteId: v }));
                  setSaved(false);
                }
              }),
              /* @__PURE__ */ jsx_runtime.jsx(TextField, {
                id: "tri-timeout",
                label: t("settings.timeoutMs"),
                hint: t("settings.timeoutMsHint"),
                value: form.timeoutMs,
                disabled: saving,
                onEdit: (v) => {
                  setForm((p) => ({ ...p, timeoutMs: v }));
                  setSaved(false);
                }
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Toggle, {
                id: "tri-auto-inject",
                label: t("settings.autoInject"),
                hint: t("settings.autoInjectHint"),
                checked: form.autoInject,
                disabled: saving,
                onEdit: (v) => {
                  setForm((p) => ({ ...p, autoInject: v }));
                  setSaved(false);
                }
              }),
              /* @__PURE__ */ jsx_runtime.jsx(Toggle, {
                id: "tri-delete-confirm",
                label: t("settings.deleteConfirm"),
                hint: t("settings.deleteConfirmHint"),
                checked: form.deleteConfirm,
                disabled: saving,
                onEdit: (v) => {
                  setForm((p) => ({ ...p, deleteConfirm: v }));
                  setSaved(false);
                }
              }),
              saved ? /* @__PURE__ */ jsx_runtime.jsx("p", {
                style: { color: "var(--dsw-alias-state-success-primary, #3cb371)", fontSize: 12, margin: "8px 0 0" },
                children: t("settings.saved")
              }) : null,
              saveError !== undefined ? /* @__PURE__ */ jsx_runtime.jsxs("p", {
                style: { color: "var(--dsw-alias-label-error)", fontSize: 12, margin: "8px 0 0" },
                children: [
                  t("settings.saveFailed"),
                  saveError
                ]
              }) : null,
              testResult === "ok" ? /* @__PURE__ */ jsx_runtime.jsxs("p", {
                style: { color: "var(--dsw-alias-state-success-primary, #3cb371)", fontSize: 12, margin: "8px 0 0" },
                children: [
                  t("settings.testOk"),
                  " ",
                  testMessage
                ]
              }) : null,
              testResult === "fail" ? /* @__PURE__ */ jsx_runtime.jsxs("p", {
                style: { color: "var(--dsw-alias-label-error)", fontSize: 12, margin: "8px 0 0" },
                children: [
                  t("settings.testFail"),
                  testMessage
                ]
              }) : null,
              /* @__PURE__ */ jsx_runtime.jsxs("div", {
                style: { display: "flex", gap: 10, padding: "14px 0 4px" },
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx("button", {
                    type: "button",
                    style: buttonStyle,
                    disabled: busy || saving || form.baseUrl.trim() === "",
                    onClick: () => {
                      runTest();
                    },
                    children: busy ? t("settings.testing") : t("settings.test")
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx("button", {
                    type: "button",
                    style: { ...buttonStyle, borderColor: "transparent" },
                    disabled: saving,
                    onClick: () => {
                      save();
                    },
                    children: saving ? t("settings.saving") : t("settings.save")
                  })
                ]
              })
            ]
          }) : null
        ]
      }) : null
    ]
  });
}

// src/client/index.ts
var NS = "dsh-trilium";
var inject = ["slots", "locale"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en: zh }), "dsh-trilium: dictionaries");
  const api = new TriliumApi;
  const disposeSettings = ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
    name: "settings.plugin.item",
    key: "dsh-trilium",
    locale: NS,
    inject: () => ({ api })
  }, TriliumSettingsCard));
  ctx.effect(() => disposeSettings, "dsh-trilium: ui mounts");
}

    return module.exports;
  }
});
