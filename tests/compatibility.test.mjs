import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFile(resolve(root, path), 'utf8')

test('package declares Desktop 0.2 client contract', async () => {
  const pkg = JSON.parse(await read('package.json'))
  assert.equal(pkg.version, '0.2.0')
  assert.equal(pkg.dsh.client.immediately, false)
  assert.deepEqual(pkg.dsh.client.inject, [
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-locale',
  ])
  assert.ok(!pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-runtime'))
  assert.ok(!Object.keys(pkg.peerDependencies || {}).some((name) => name.includes('dsh-client-runtime')))
  for (const [name, range] of Object.entries(pkg.peerDependencies || {})) {
    if (name.startsWith('@deepseek-ai/')) {
      assert.equal(range, '*', `${name} should be open peer * for 0.2`)
    }
  }
})

test('browser half registers settings.section without legacy slots', async () => {
  const client = await read('lib/client.js')
  assert.match(client, /name:\s*["']settings\.section["']/)
  assert.match(client, /SECTION_ID\s*=\s*["']trilium["']/)
  assert.doesNotMatch(client, /settings\.plugin\.item/)
  assert.doesNotMatch(client, /settingsScope/)
  assert.doesNotMatch(client, /dsh-client-runtime/)
})
