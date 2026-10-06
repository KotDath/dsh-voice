// Host-side unit tests for the dsh-voice bundle (Node half).
//
//   node test/run.mjs
//
// Exit code 0 = all pass.

import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const results = { pass: 0, fail: 0, failures: [] }
function ok(cond, label) {
  if (cond) results.pass++
  else { results.fail++; results.failures.push(label) }
}
function eq(a, b, label) {
  if (JSON.stringify(a) === JSON.stringify(b)) results.pass++
  else { results.fail++; results.failures.push(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`) }
}

async function main() {
  // ---------- built artifacts exist ----------
  for (const f of ['lib/index.js', 'lib/client.js', 'cordis.patch.yml', 'package.json']) {
    ok(existsSync(resolve(ROOT, f)), `artifact exists: ${f}`)
  }

  // ---------- host half loads and exposes the plugin contract ----------
  const host = await import(resolve(ROOT, 'lib/index.js'))
  eq(typeof host.apply, 'function', 'host half exports apply()')
  eq(host.name, 'dsh-voice', 'host half exports name "dsh-voice"')
  eq(host.version, JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version, 'host half exports the package version (live-reload build marker)')
  ok(Array.isArray(host.CATALOG) && host.CATALOG.length >= 60, `catalog has ${host.CATALOG.length} models (>= 60)`)

  // ---------- catalog integrity (models.json = single source of truth) ----------
  const models = JSON.parse(readFileSync(resolve(ROOT, 'models.json'), 'utf8'))
  ok(Array.isArray(models) && models.length >= 60, `models.json has ${models.length} models (>= 60)`)
  eq(models.length, host.CATALOG.length, 'generated catalog matches models.json count')
  const required = ['id', 'name', 'repo', 'file', 'size']
  let badEntry = null
  for (const m of models) {
    for (const k of required) {
      if (m[k] === undefined || m[k] === null || m[k] === '') { badEntry = { id: m.id, missing: k }; break }
    }
    if (badEntry) break
  }
  ok(!badEntry, `every catalog entry has required fields${badEntry ? ` (missing ${badEntry.missing} in ${badEntry.id})` : ''}`)
  ok(models.every((m) => /^handy-computer\//.test(m.repo || '')), 'all catalog repos are handy-computer org')

  // ---------- client bundle registers via __ModuleLoader__.load ----------
  const clientSrc = readFileSync(resolve(ROOT, 'lib/client.js'), 'utf8')
  ok(clientSrc.includes('window.__ModuleLoader__.load'), 'client bundle registers via __ModuleLoader__.load')
  ok(clientSrc.includes('dsh-voice'), 'client bundle carries plugin id')
  ok(clientSrc.includes('conversation.input.right'), 'client bundle registers input.right slot')
  ok(clientSrc.includes('conversation.input.dock'), 'client bundle registers input.dock slot')
  ok(clientSrc.includes('settings.section'), 'client bundle registers settings.section slot')
  ok(clientSrc.includes('/api/voice/codex-status'), 'client bundle talks to the codex-status endpoint')
  ok(clientSrc.includes('Codex — ChatGPT subscription'), 'client bundle offers the Codex provider')
  ok(clientSrc.includes('existing.textContent !== css'), 'client bundle replaces stale plugin CSS on re-evaluation')

  // ---------- theme safety ----------
  // Every color must come from a light/dark-aware theme token: a hardcoded one
  // (the Save button carried `color: #fff`) disappears in one of the themes —
  // `--dsw-alias-brand-primary` is near-black in light and near-white in dark.
  const cssSrc = readFileSync(resolve(ROOT, 'src/plugin/client/voice.module.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  const hardcoded = cssSrc.match(/#[0-9a-fA-F]{3,8}\b/g)
  ok(hardcoded === null, `plugin CSS uses theme tokens only (found ${JSON.stringify(hardcoded)})`)

  // ---------- design-system vocabulary ----------
  // The primitives themselves are not importable by a third-party bundle, so
  // the stylesheet mirrors their rules; these assertions pin the parts that are
  // easy to drift back out of the system.
  ok(/\.voiceSave\b[^}]*background:\s*var\(--dsw-alias-label-primary\)/.test(cssSrc), 'Save uses the system .save fill (label-primary)')
  ok(/\.voiceSave\b[^}]*color:\s*var\(--dsw-alias-bg-layer-3\)/.test(cssSrc), 'Save label uses the system .save foreground (bg-layer-3)')
  ok(cssSrc.includes('var(--dsw-radius-md)') && cssSrc.includes('var(--dsw-radius-sm)'), 'controls use the theme radius scale, not literals')
  ok(cssSrc.includes('var(--dsw-alias-state-business-primary)'), 'focus rings use the business accent token')
  ok(cssSrc.includes('var(--dsw-alias-interactive-bg-hover)'), 'hover states use the system interactive fill')

  // ---------- the bundle actually loads and renders in the loader contract ----------
  // Feed it the shell's window.__ModuleLoader__ and a require that resolves the
  // real React, so a bundle broken at factory time fails here, not in the GUI.
  const entries = []
  globalThis.window = { __ModuleLoader__: { load: (entry) => entries.push(entry) } }
  const clientRequire = createRequire(import.meta.url)
  await import(pathToFileURL(resolve(ROOT, 'lib/client.js')).href)
  eq(entries.length, 1, 'client bundle loads exactly one module entry')
  eq(entries[0]?.id, 'dsh-voice', 'module entry id is dsh-voice')
  let clientExports = null
  let factoryError = null
  try { clientExports = entries[0].factory(clientRequire) } catch (e) { factoryError = e }
  ok(factoryError === null, `client factory runs${factoryError ? `: ${factoryError.message}` : ''}`)
  for (const name of ['VoiceSettings', 'MicButton', 'RecordPill', 'apply']) {
    eq(typeof clientExports?.[name], 'function', `client bundle exports ${name}()`)
  }
  if (clientExports) {
    const React = clientRequire('react')
    const { renderToString } = clientRequire('react-dom/server')
    let html = ''
    let renderError = null
    try { html = renderToString(React.createElement(clientExports.VoiceSettings)) } catch (e) { renderError = e }
    ok(renderError === null, `VoiceSettings renders${renderError ? `: ${renderError.message}` : ''}`)
    ok(html.includes('Loading'), 'VoiceSettings renders its loading state before config arrives')
    delete globalThis.window
  }

  // ---------- cordis.patch.yml declares the plugin row ----------
  const patch = readFileSync(resolve(ROOT, 'cordis.patch.yml'), 'utf8')
  ok(patch.includes("name: 'dsh-voice'"), 'cordis.patch.yml inserts the dsh-voice row')
  ok(patch.includes('- insert:'), 'cordis.patch.yml uses the insert patch form')

  // ---------- package.json declares bundle + client ----------
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
  eq(pkg.dsh?.bundle?.patch, './cordis.patch.yml', 'package.json declares dsh.bundle.patch')
  eq(pkg.dsh?.client?.platform, 'web', 'package.json declares dsh.client.platform=web')
  ok(pkg.exports?.['./client'] !== undefined, 'package.json exports ./client')
  ok(pkg.exports?.['.'] !== undefined, 'package.json exports .')

  // ---------- summary ----------
  console.log(`\n${results.pass}/${results.pass + results.fail} assertions passed${results.fail ? `, ${results.fail} failed` : ''}`)
  if (results.fail) {
    for (const f of results.failures) console.log('  ✗ ' + f)
    process.exit(1)
  }
  console.log('All host tests passed.')
}

main().catch((e) => { console.error(e); process.exit(1) })
