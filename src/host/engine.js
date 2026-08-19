// Engine (transcribe-cli) presence + installation.
// Discovery is explicit and predictable — no magic $HOME sweep:
//   1. the configured binary, if executable
//   2. a binary on PATH (`command -v transcribe-cli`)
//   3. a binary in a sibling `.engine/` dir relative to the configured path
// Installation: download the per-platform release asset, optionally verify a
// `.sha256` sidecar published alongside it, then chmod +x.

async function engineExists() {
  try {
    await runCmd('test -x ' + q(config.tcpp.binary), { timeoutMs: 10000 })
    return true
  } catch (e) {
    return false
  }
}

// Copy a discovered candidate into the configured binary path. Returns source
// path or null.
async function adoptEngineFrom(source) {
  if (!source || source === config.tcpp.binary) return null
  if (!(await fileExists(source))) return null
  const dir = config.tcpp.binary.slice(0, config.tcpp.binary.lastIndexOf('/'))
  await runCmd('mkdir -p ' + q(dir), { timeoutMs: 10000 })
  await runCmd('cp ' + q(source) + ' ' + q(config.tcpp.binary), { timeoutMs: 30000 })
  await runCmd('chmod +x ' + q(config.tcpp.binary), { timeoutMs: 10000 })
  return source
}

async function discoverEngine() {
  // PATH lookup (explicit, not a filesystem sweep).
  try {
    const r = await runCmd('command -v transcribe-cli 2>/dev/null || true', { timeoutMs: 10000 })
    const found = String((r.stdout && r.stdout.text) || '').trim()
    if (found) return adoptEngineFrom(found)
  } catch (e) {}
  // Sibling dir next to the configured binary (e.g. a manual build placed beside .engine).
  const dir = config.tcpp.binary.slice(0, config.tcpp.binary.lastIndexOf('/'))
  const sibling = dir + '/../transcribe-cli'
  return adoptEngineFrom(sibling)
}

async function ensureEngine() {
  if (await engineExists()) return { exists: true }
  const adopted = await discoverEngine()
  if (adopted) return { exists: true, adoptedFrom: adopted }
  return { exists: false }
}

// Optional integrity check: if a `<asset>.sha256` sidecar is published with the
// release, verify the downloaded binary against it before accepting it.
async function verifyEngineChecksum(binaryPath) {
  const expected = await sha256(binaryPath)
  if (!expected) return true // sidecar not published — skip
  const sidecarPath = binaryPath + '.sha256'
  await runCmd('curl -sS -L --fail --retry 1 -o ' + q(sidecarPath) + ' ' + q(await engineUrl() + '.sha256') + ' 2>/dev/null || rm -f ' + q(sidecarPath), { timeoutMs: 30000 })
  if (!(await fileExists(sidecarPath))) return true
  const content = await readTextFile(sidecarPath)
  const m = /^([0-9a-f]{64})/i.exec(content || '')
  await runCmd('rm -f ' + q(sidecarPath), { timeoutMs: 10000 })
  if (!m) return true
  if (m[1].toLowerCase() !== expected.toLowerCase()) {
    throw new Error('engine checksum mismatch: published ' + m[1].slice(0, 12) + '…, got ' + expected.slice(0, 12) + '…')
  }
  return true
}

async function readTextFile(path) {
  const target = await fs.resolve(path)
  return await fs.readText(target)
}
