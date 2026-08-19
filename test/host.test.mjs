// Host-side unit-test harness for dsh-voice.
//
// Compiles the same src/host/* modules that ship in dist/host.js into an
// in-memory bundle, runs it inside a fake apply(ctx) with a scripted shell, and
// exposes a tiny assertion API plus the compiled plugin's RPC handlers and
// shell command log for assertions.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8')

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

// ---- shared assertion counters ---------------------------------------------
const results = { pass: 0, fail: 0, failures: [] }
export function ok(cond, label) {
  if (cond) results.pass++
  else { results.fail++; results.failures.push(label) }
}
export function eq(a, b, label) {
  if (JSON.stringify(a) === JSON.stringify(b)) results.pass++
  else { results.fail++; results.failures.push(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`) }
}
export function stats() { return { ...results } }

// Build the catalog array exactly as scripts/build-plugin.mjs does.
function buildCatalog() {
  const models = JSON.parse(read('models.json'))
  const rows = models.map((m) => {
    const name = m.name || ''
    const windowSec = /whisper/i.test(name) ? 30 : 25
    const streaming = /stream|realtime|voxtral/i.test(name) ? 1 : 0
    return `[${JSON.stringify(m.id)}, ${JSON.stringify(m.name)}, ${JSON.stringify(m.repo)}, ${JSON.stringify(m.file)}, ${Number(m.size) || 0}, ${m.recommended ? 1 : 0}, ${windowSec}, ${streaming}]`
  })
  return '[\n' + rows.join(',\n') + '\n]'
}

// Compile a fresh plugin instance with a scripted shell.
// overrides: { onCommand(spec)->result|undefined, failCommands: RegExp,
//             platform: {os,arch} to force uname output }
function makeBundle(overrides = {}) {
  const body = HOST_MODULES.map(read).join('\n\n')
  let src = read('src/host/index.js').split('/* __BODY__ */').join(body)
  src = src.split('/* __CATALOG__ */').join(buildCatalog())

  const shellCalls = []
  const shell = {
    resolve: (spec) => spec,
    async run(spec) {
      shellCalls.push(spec.command)
      const h = overrides.onCommand ? overrides.onCommand(spec, shellCalls) : null
      if (h) return h
      if (overrides.failCommands && overrides.failCommands.test(spec.command)) {
        return { exitCode: 1, timedOut: false, stdout: { text: '' }, stderr: { text: 'mocked failure' } }
      }
      return { exitCode: 0, timedOut: false, stdout: { text: '' }, stderr: { text: '' } }
    },
  }
  const sandboxPolicy = { workspaceRoot: '/fake/root' }
  const harness = { __handlers: {}, handle(name, fn) { harness.__handlers[name] = fn } }
  const fakeFs = {}

  const factory = new Function('sandboxPolicy', 'shell', 'fs', 'harness', src)
  const plugin = factory(sandboxPolicy, shell, fakeFs, harness)

  const applyCtx = {
    get(name) {
      if (name === 'shell') return shell
      if (name === 'fs') return fakeFs
      if (name === 'sandboxPolicy') return sandboxPolicy
      return undefined
    },
  }
  plugin.apply(applyCtx)

  return { handlers: harness.__handlers, shellCalls, wsRoot: '/fake/root' }
}

export { makeBundle }
