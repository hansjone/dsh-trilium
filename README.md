# dsh-trilium

[![npm](https://img.shields.io/npm/v/dsh-trilium)](https://www.npmjs.com/package/dsh-trilium)
[![DSH](https://img.shields.io/badge/DSH-%3E%3D0.1.0--rc.7%20%3C0.2.0-5b8def)](https://github.com/deepseek-ai/deepseek-harness)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
![awesome · DSH plugin](https://awesome-dsh-plugin.com/badge.svg)
![CI](https://github.com/MineRPi/dsh-trilium/actions/workflows/ci.yml/badge.svg)

English | [中文](./README.zh.md)

A DeepSeek Harness (DSH) Web GUI plugin that connects your **Trilium** notes to the
agent through the ETAPI: durable memory, note management, full-text search, a weekly
report workflow, attachments, calendar notes, backups, and a settings card.

## Highlights

- **Memory**: `trilium_remember` / `trilium_recall` scoped to a memory directory,
  plus auto-injected memory index at session start (toggleable).
- **Notes**: create / read / update / delete / undelete, tree browsing, cloning
  (multi-folder reuse), attributes (label/relation), revisions.
- **Search**: Trilium full-text syntax (`"exact phrase"`, `#label`, subtree scoping).
- **Weekly report**: `trilium_weekly_report` collects the week's material and stores
  the finished report with `startDate`/`endDate` labels.
- **Attachments & calendar**: `trilium_attachment`, `trilium_calendar`.
- **Backup & migration**: `trilium_backup`, `trilium_export`, `trilium_import`.
- **Settings card**: 设置 → 插件 → 可配置 (server URL, token, memory directory,
  switches, connection test).
- **Safe by default**: config in `~/.dsh/dsh-trilium.json` (0600); token never
  enters cordis.yml or the model context; deletes require `confirm`.

## Install

```sh
dsh plugin --profile web add dsh-trilium      # npm
# or: dsh plugin --profile web add github:MineRPi/dsh-trilium
```

Restart `dsh web`. The repository ships `lib/`, so git installs normally need no
build approval.

## Tools

`trilium_app_info` `trilium_search` `trilium_get_note` `trilium_list_children`
`trilium_create_note` `trilium_update_note` `trilium_delete_note` `trilium_undelete_note`
`trilium_clone` `trilium_attribute` `trilium_attachment` `trilium_calendar`
`trilium_remember` `trilium_recall` `trilium_weekly_report` `trilium_revisions`
`trilium_backup` `trilium_export` `trilium_import` `trilium_history`

## Verify after install

```sh
# the agent tools should be listed in the session (or just ask the agent)
# connection test:
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/api/dsh-trilium/config
```

## Requirements

- DSH `>=0.1.0-rc.7 <0.2.0`, Node `^22.19.0 || >=24.0.0`
- Trilium with ETAPI enabled (TriliumNext 0.10x+ or classic Trilium)

## Development

```sh
npm install
npm run typecheck
npm run build
npm test
```

## Listing status

- npm: `dsh-trilium@0.1.2` published ✅
- awesome-dsh-plugin PR: [#1045](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/1045) open (pending merge)
- Flow: publish to npm → add a YAML entry under `data/plugins/` → run
  `node scripts/generate-readme.mjs` → open a PR → dshmarket picks it up after merge

## License

[MIT](./LICENSE)