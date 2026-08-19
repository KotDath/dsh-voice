// Host test runner for dsh-voice.
//
//   node test/run.mjs
//
// Exit code 0 = all pass.

import { makeBundle, ok, eq, stats } from './host.test.mjs'

async function main() {
  // ---------- config sanitization (schema.js) ----------
  const m1 = makeBundle()
  // provider/language whitelisted
  const c1 = await m1.handlers['voice/config']({ provider: 'api', language: 'ru' })
  eq(c1.provider, 'api', 'provider whitelist accepted')
  eq(c1.language, 'ru', 'language whitelist accepted')
  // hostile values are ignored (shell-injection guard, P0)
  const c2 = await m1.handlers['voice/config']({ provider: 'api; rm -rf /', language: 'ru$(touch /x)' })
  eq(c2.provider, 'api', 'hostile provider ignored, previous kept')
  eq(c2.language, 'ru', 'hostile language ignored, previous kept')
  // api key is host-only: never echoed back
  await m1.handlers['voice/api-key']({ key: 'sk-super-secret' })
  const c3 = await m1.handlers['voice/config']({})
  eq(c3.api.hasKey, true, 'hasKey=true after setting key')
  ok(!('key' in c3.api), 'api key is never present in public config')
  await m1.handlers['voice/api-key']({ key: '' })
  const c4 = await m1.handlers['voice/config']({})
  eq(c4.api.hasKey, false, 'hasKey=false after clearing key')

  // ---------- platform detection & Windows .exe asset (P0 fix) ----------
  const m2 = makeBundle({
    onCommand(spec) {
      const result = { exitCode: 0, timedOut: false, stdout: { text: '' }, stderr: { text: '' } }
      if (spec.command === 'uname -s') result.stdout.text = 'MINGW64_NT-10.0'
      if (spec.command === 'uname -m') result.stdout.text = 'x86_64'
      // Engine NOT installed and NOT discoverable anywhere → force download.
      if (/^test -x /.test(spec.command) && /transcribe-cli/.test(spec.command)) { result.exitCode = 1; return result }
      if (/^test -f /.test(spec.command) && /transcribe-cli/.test(spec.command)) { result.exitCode = 1; return result }
      return result
    },
  })
  await m2.handlers['voice/config']({ provider: 'tcpp', language: 'auto' })
  await m2.handlers['voice/engine-download']()
  // runDownload is fire-and-forget; give the mock shell a tick to log the curl.
  await new Promise((r) => setTimeout(r, 20))
  const winCurl = m2.shellCalls.find((c) => c.startsWith('curl'))
  ok(winCurl && /windows-x86_64\.exe/.test(winCurl || ''), 'Windows engine download URL carries .exe suffix')

  // ---------- catalog-driven models listing ----------
  const m3 = makeBundle({
    onCommand(spec) {
      const result = { exitCode: 0, timedOut: false, stdout: { text: '' }, stderr: { text: '' } }
      if (spec.command === 'uname -s') result.stdout.text = 'Linux'
      if (spec.command === 'uname -m') result.stdout.text = 'x86_64'
      return result
    },
  })
  const models = await m3.handlers['voice/models']()
  ok(models.ok === true, 'voice/models returns ok')
  ok(Array.isArray(models.models) && models.models.length > 0, 'voice/models lists models')
  eq(models.platform.os, 'linux', 'default mocked platform is linux')
  eq(models.platform.arch, 'x86_64', 'default mocked arch is x86_64')

  // ---------- transcribe validates input ----------
  const m4 = makeBundle()
  const bad = await m4.handlers['voice/transcribe']({})
  eq(bad.ok, false, 'transcribe with no audio returns ok:false')
  ok(/no audio/i.test(bad.error || ''), 'transcribe missing-audio error message')

  // ---------- handler registration completeness ----------
  const m5 = makeBundle()
  const expected = ['voice/config', 'voice/api-key', 'voice/models', 'voice/download',
    'voice/engine-download', 'voice/download-status', 'voice/transcribe']
  for (const name of expected) {
    ok(typeof m5.handlers[name] === 'function', `${name} handler registered`)
  }

  // ---------- catalog integrity (models.json = single source of truth) ----------
  const { readFileSync } = await import('node:fs')
  const { resolve, dirname } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const catalogModels = JSON.parse(readFileSync(resolve(root, 'models.json'), 'utf8'))
  ok(Array.isArray(catalogModels) && catalogModels.length >= 60, `catalog has ${catalogModels.length} models (>= 60)`)
  const required = ['id', 'name', 'repo', 'file', 'size']
  let badEntry = null
  for (const m of catalogModels) {
    for (const k of required) {
      if (m[k] === undefined || m[k] === null || m[k] === '') { badEntry = { id: m.id, missing: k }; break }
    }
    if (badEntry) break
  }
  ok(!badEntry, `every catalog entry has required fields${badEntry ? ` (missing ${badEntry.missing} in ${badEntry.id})` : ''}`)
  // repo must point at handy-computer org (engine download convention)
  ok(catalogModels.every((m) => /^handy-computer\//.test(m.repo || '')), 'all catalog repos are handy-computer org')

  // ---------- summary ----------
  const s = stats()
  console.log(`\n${s.pass}/${s.pass + s.fail} assertions passed${s.fail ? `, ${s.fail} failed` : ''}`)
  if (s.fail) {
    for (const f of s.failures) console.log('  ✗ ' + f)
    process.exit(1)
  }
  console.log('All host tests passed.')
}

main().catch((e) => { console.error(e); process.exit(1) })
