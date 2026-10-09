/**
 * Build lib/client.js as a DSH ModuleLoader factory (same pattern as netxops).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(root, 'src/client/index.ts')
const outFile = join(root, 'lib', 'client.js')
const id = 'dsh-trilium'

const external = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
]

const result = await Bun.build({
  entrypoints: [entry],
  target: 'browser',
  format: 'cjs',
  sourcemap: 'none',
  minify: false,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  external,
})

if (!result.success) {
  console.error(result.logs)
  throw new Error('Bun.build failed')
}

const raw = await result.outputs[0].text()
const body = raw
  .replace(/^"use strict";\s*/m, '')
  .replace(/Object\.defineProperty\(exports,\s*"__esModule"[\s\S]*?;\s*/m, '')

const artifact = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(id)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body}
    return module.exports;
  }
});
`

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, artifact)
console.log(`wrote ${outFile} (${artifact.length} bytes)`)
