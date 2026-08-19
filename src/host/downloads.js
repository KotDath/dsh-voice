// Background download state machine shared by engine and model installs.
// One download at a time; the client polls voice/download-status.
const downloads = {}

function activeDownloads() {
  for (const k of Object.keys(downloads)) {
    if (downloads[k].status === 'downloading') return true
  }
  return false
}

async function runDownload(key, url, target, expectedSize, afterDone) {
  downloads[key] = { status: 'downloading', bytes: 0, total: expectedSize || 0, error: '' }
  try {
    const dir = target.slice(0, target.lastIndexOf('/'))
    await runCmd('mkdir -p ' + q(dir), { timeoutMs: 10000 })
    await runCmd('curl -sS -L --fail --retry 2 -o ' + q(target + '.part') + ' ' + q(url), { timeoutMs: 3600000 })
    await runCmd('mv ' + q(target + '.part') + ' ' + q(target), { timeoutMs: 30000 })
    // The engine binary must be executable (curl/mv do not set the +x bit).
    // chmod is a no-op on Windows but required on Linux/macOS.
    if (key === 'engine') { try { await runCmd('chmod +x ' + q(target), { timeoutMs: 10000 }) } catch (e) {} }
    if (afterDone) await afterDone(target)
    downloads[key].status = 'done'
    downloads[key].bytes = expectedSize || await fileSize(target)
  } catch (error) {
    downloads[key].status = 'error'
    downloads[key].error = String(error && error.message ? error.message : error)
    try { await runCmd('rm -f ' + q(target + '.part'), { timeoutMs: 10000 }) } catch (e) {}
  }
}

async function downloadStatusSnapshot() {
  const out = {}
  for (const k of Object.keys(downloads)) {
    const d = downloads[k]
    const isEngine = k === 'engine'
    const entry = isEngine ? null : catalogEntry(k.slice(6))
    const target = isEngine ? config.tcpp.binary : (entry ? config.tcpp.modelsDir + '/' + entry[3] : null)
    if (d.status === 'downloading' && target) {
      try { d.bytes = await fileSize(target + '.part') } catch (e) {}
    }
    out[k] = { status: d.status, bytes: d.bytes, total: d.total, error: d.error }
  }
  return { ok: true, downloads: out }
}
