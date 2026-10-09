# dsh-trilium

[![npm](https://img.shields.io/npm/v/dsh-trilium)](https://www.npmjs.com/package/dsh-trilium)
[![DSH](https://img.shields.io/badge/DSH-%3E%3D0.1.0--rc.7%20%3C0.2.0-5b8def)](https://github.com/deepseek-ai/deepseek-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
![awesome · DSH plugin](https://awesome-dsh-plugin.com/badge.svg)
![CI](https://github.com/MineRPi/dsh-trilium/actions/workflows/ci.yml/badge.svg)

DSH Web GUI 的 **Trilium 记忆知识库插件**：通过 ETAPI 把 Trilium 笔记库接入 agent，
提供记忆读写、笔记管理、全文搜索、周报工作流、附件、日历笔记、备份导入等能力，
并在设置页提供独立配置卡片。

## 特性

- **记忆库**：`trilium_remember` 写入（自动归入记忆目录、标题带日期）、`trilium_recall`
  检索（限定记忆子树）、会话开始自动注入记忆索引（可开关）
- **笔记管理**：`trilium_*` 工具集——创建/读取/更新/删除/恢复、树浏览、克隆（多目录复用）、
  属性（label/relation）、修订历史
- **搜索**：Trilium 全文语法（`"精确短语"`、`#标签`、子树限定、排序）
- **周报工作流**：`trilium_weekly_report` 收集本周素材 → 按《周报撰写规范》成文 →
  存档并打 `startDate`/`endDate` 标签
- **附件**：`trilium_attachment` 上传/下载/列出笔记附件（图片、文件）
- **日历笔记**：`trilium_calendar` 获取（自动创建）day/week/month/year/inbox 日记笔记
- **备份与迁移**：`trilium_backup` 数据库备份、`trilium_export`/`trilium_import` 子树导出导入
- **独立设置卡片**：设置 → 插件 → 可配置（服务器地址、token、记忆目录、行为开关、测试连接）
- **安全**：配置落盘 `~/.dsh/dsh-trilium.json`（权限 0600），token 不进入 cordis.yml、
  不回显给模型；删除笔记需 confirm 确认（软删进回收站可恢复）

## 验证安装

```sh
# agent 工具应出现在会话中（或直接问 agent）
# 连接测试：
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/api/dsh-trilium/config
```

## 兼容性

- DSH：`>=0.1.0-rc.7 <0.2.0`（Profile Bundle + 嵌套 `dsh.client` 契约）
- Node.js：`^22.19.0 || >=24.0.0`
- Trilium：ETAPI 服务（TriliumNext 0.10x+，普通 Trilium 亦可）

## 安装

### 从 npm（推荐）

```sh
dsh plugin --profile web add dsh-trilium
```

### 从 GitHub

```sh
dsh plugin --profile web add github:MineRPi/dsh-trilium
```

> 仓库提交了构建产物 `lib/`，git 安装通常无需构建授权；pnpm ≥10 若仍要求
> allowBuilds，按提示把包键加入 profile 的 `pnpm-workspace.yaml`。

激活：重启 `dsh web`。插件通过 `dsh.bundle.patch` 自动挂进插件树，
客户端 bundle 由 `dsh.client` 声明 + `exports["./client"]` 自动加载。

## 使用

1. **配置**：打开 设置 → 插件 → 可配置 → Trilium 记忆库，填入服务器地址
   （如 `https://your-host/etapi`）与 ETAPI token（Trilium 的 Options → ETAPI 生成），
   点「测试连接」验证，再「保存」。
2. **记忆**：告诉 agent「记住 XXX」或直接使用 `trilium_remember`；回忆时 agent 会先查
   自动注入的记忆索引，需要细节时调用 `trilium_recall` / `trilium_get_note`。
3. **浏览笔记**：通过 agent 工具 `trilium_list_children` / `trilium_search` /
   `trilium_get_note` 完成。

## 配置

**设置卡片（存 `~/.dsh/dsh-trilium.json`，0600）**

| 项 | 默认 | 说明 |
|---|---|---|
| baseUrl | （空） | ETAPI 基础地址，如 https://your-host/etapi |
| token | （空） | ETAPI token（GUI 填写，0600 落盘，不回显） |
| memoryNoteId | （空=root） | 默认记忆目录（`trilium_remember` 写入位置） |
| timeoutMs | 15000 | 请求超时 |
| autoInject | true | 会话开始自动注入记忆索引 |
| deleteConfirm | true | 删除笔记需 confirm 确认 |

**cordis.yml config（插件开关）**

| 项 | 默认 | 说明 |
|---|---|---|
| enabled | true | 总开关（工具、路由、提示段） |
| announceToAgent | true | 系统提示中声明插件 |

## 工具清单

`trilium_app_info` `trilium_search` `trilium_get_note` `trilium_list_children`
`trilium_create_note` `trilium_update_note` `trilium_delete_note` `trilium_undelete_note`
`trilium_clone` `trilium_attribute` `trilium_attachment` `trilium_calendar`
`trilium_remember` `trilium_recall` `trilium_weekly_report` `trilium_revisions`
`trilium_backup` `trilium_export` `trilium_import` `trilium_history`

## 开发

```sh
npm install
npm run typecheck   # tsc --noEmit
npm run build       # tsc + tsdown（host lib/ + client bundle）
npm test            # node --test tests/
```

- host 半：`src/index.ts`（ETAPI 客户端、工具、路由、记忆注入）
- 客户端：`src/client/`（独立设置卡片）
- 配置存储：`src/store.ts`（`~/.dsh/dsh-trilium.json`，原子写 + 0600）
- ETAPI 坑位处理：`src/etapi.ts`（PATCH 不含 content、PUT text/plain、子节点逐级 GET、
  附件 base64 上传、ZIP multipart 导入）

## 隐私与卸载

- token 只存本机 `~/.dsh/dsh-trilium.json`（0600）；工具输出原样返回，可能含笔记内容
- 卸载：`dsh plugin --profile web remove dsh-trilium`

## 上架状态

- npm：`dsh-trilium@0.1.2` 已发布 ✅
- awesome-dsh-plugin PR：[#1045](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/1045) 已提交，等待合并（收录中）
- 收录流程：发布 npm → 在 `data/plugins/` 加 YAML 条目 → 运行
  `node scripts/generate-readme.mjs` 生成双 README → 提 PR → 合并后
  dshmarket 自动收录

## License

[MIT](./LICENSE)