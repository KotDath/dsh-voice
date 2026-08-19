// Builds the flat Cordis plugin function bodies (dist/host.js, dist/client.js)
// from the modular sources under src/, with the model catalog generated from
// models.json (single source of truth).
//
//   node scripts/build-plugin.mjs
//
// Output: plain-JS function bodies for cordis_define's code.host / code.client
// (no import/require, no TS, no JSX).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(root, p), 'utf8')

const HOST_MODULES = [
  'src/host/shell.js',
  'src/host/schema.js',
  'src/host/catalog.js',
  'src/host/platform.js',
  'src/host/hfcache.js',
  'src/host/downloads.js',
  'src/host/engine.js',
  'src/host/models.js',
  'src/host/providers/tcpp.js',
  'src/host/providers/whisper.js',
  'src/host/providers/api.js',
  'src/host/rpc.js',
]

const CLIENT_MODULES = [
  'src/client/style.js',
  'src/client/state.js',
  'src/client/icons.js',
  'src/client/recorder.js',
  'src/client/waveform.js',
  'src/client/components.js',
  'src/client/settings.js',
  'src/client/slots.js',
]

function buildCatalogArray() {
  const models = JSON.parse(read('models.json'))
  const streamingRe = /stream|realtime|voxtral/i
  const rows = models.map((m) => {
    const name = m.name || ''
    const windowSec = /whisper/i.test(name) ? 30 : 25
    const streaming = streamingRe.test(name) ? 1 : 0
    return `  [${JSON.stringify(m.id)}, ${JSON.stringify(m.name)}, ${JSON.stringify(m.repo)}, ${JSON.stringify(m.file)}, ${Number(m.size) || 0}, ${m.recommended ? 1 : 0}, ${windowSec}, ${streaming}]`
  })
  return `[\n${rows.join(',\n')}\n]`
}

function build(side, modules, extra) {
  const body = modules.map(read).join('\n\n')
  const template = read(`src/${side}/index.js`)
  // split/join on the exact literal marker is deterministic (a string replacement
  // value, unlike the function form which can behave unexpectedly on some engines).
  const out = template.split('/* __BODY__ */').join(body)
  return extra ? out.split('/* __CATALOG__ */').join(extra) : out
}

mkdirSync(resolve(root, 'dist'), { recursive: true })

const catalog = buildCatalogArray()
const hostJs = build('host', HOST_MODULES, catalog)
const clientJs = build('client', CLIENT_MODULES, null)
writeFileSync(resolve(root, 'dist/host.js'), hostJs)
writeFileSync(resolve(root, 'dist/client.js'), clientJs)

console.log(`built dist/host.js (${hostJs.length} bytes) and dist/client.js (${clientJs.length} bytes)`)

