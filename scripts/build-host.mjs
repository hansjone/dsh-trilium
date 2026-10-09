/**
 * Build lib/index.js host bundle with Bun (external @deepseek-ai/*).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(root, 'src/index.ts')
const outFile = join(root, 'lib', 'index.js')

const result = await Bun.build({
  entrypoints: [entry],
  target: 'node',
  format: 'esm',
  sourcemap: 'none',
  minify: false,
  packages: 'external',
})

if (!result.success) {
  console.error(result.logs)
  throw new Error('Bun.build host failed')
}

mkdirSync(dirname(outFile), { recursive: true })
const text = await result.outputs[0].text()
writeFileSync(outFile, text)
console.log(`wrote ${outFile} (${text.length} bytes)`)
