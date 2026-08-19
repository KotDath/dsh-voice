// Host-side unit tests for the dsh-voice bundle (Node half).
//
//   node test/run.mjs
//
// Exit code 0 = all pass.

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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

  // ---------- client bundle is a module-table closure ----------
  const clientSrc = readFileSync(resolve(ROOT, 'lib/client.js'), 'utf8')
  ok(clientSrc.includes('window.__ModuleLoader__.load'), 'client bundle registers via __ModuleLoader__.load')
  ok(clientSrc.includes('dsh-voice'), 'client bundle carries plugin id')
  ok(clientSrc.includes('conversation.input.right'), 'client bundle registers input.right slot')
  ok(clientSrc.includes('conversation.input.dock'), 'client bundle registers input.dock slot')
  ok(clientSrc.includes('settings.section'), 'client bundle registers settings.section slot')

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
