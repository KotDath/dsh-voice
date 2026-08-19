// RPC handlers exposed to the client via harness.handle. Every value returned
// must be lossless JSON. The API secret is never returned; only `hasKey`.

function tmpdir() {
  return wsRoot + '/.tmp/voice-' + Date.now() + '-' + Math.floor(Math.random() * 1000000)
}

harness.handle('voice/config', async (args) => {
  applyConfigPatch(args)
  return publicConfig()
})

// Set the API key separately from the rest of config so it is never echoed
// back to the client. Empty string clears it.
harness.handle('voice/api-key', async (args) => {
  const key = args && typeof args.key === 'string' ? args.key : ''
  config.api.key = key
  return { ok: true, hasKey: !!key }
})

harness.handle('voice/models', async () => {
  try {
    const p = await detectPlatform()
    const eng = await ensureEngine()
    const map = await refreshHfCache()
    const models = CATALOG.map((m) => ({
      id: m[0],
      name: m[1],
      repo: m[2],
      file: m[3],
      size: m[4],
      recommended: m[5] === 1,
      windowSec: m[6],
      streaming: m[7] === 1,
      downloaded: !!(map[m[3]]),
    }))
    try {
      const r = await runCmd('ls ' + q(config.tcpp.modelsDir) + ' 2>/dev/null || true', { timeoutMs: 10000 })
      const localFiles = String((r.stdout && r.stdout.text) || '')
      for (const m of models) {
        if (localFiles.indexOf(m.file) >= 0) m.downloaded = true
      }
    } catch (e) {}
    const sorted = models.slice().sort((a, b) => (b.downloaded - a.downloaded) || (b.recommended - a.recommended) || a.name.localeCompare(b.name))
    return { ok: true, models: sorted, platform: { os: p.os, arch: p.arch, exists: eng.exists, path: config.tcpp.binary, adoptedFrom: eng.adoptedFrom || null, modelsDir: config.tcpp.modelsDir } }
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) }
  }
})

harness.handle('voice/download', async (args) => {
  try {
    const modelId = args && args.modelId ? String(args.modelId) : ''
    return await startModelDownload(modelId)
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) }
  }
})

harness.handle('voice/engine-download', async () => {
  try {
    const eng = await ensureEngine()
    if (eng.exists) return { ok: true, status: 'done', adoptedFrom: eng.adoptedFrom || null }
    if (activeDownloads()) return { ok: false, error: 'another download is already running' }
    // Verify the engine against its published .sha256 sidecar (best-effort —
    // verifyEngineChecksum skips when no sidecar is published).
    runDownload('engine', await engineUrl(), config.tcpp.binary, 0, () => verifyEngineChecksum(config.tcpp.binary))
    return { ok: true, status: 'downloading' }
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) }
  }
})

harness.handle('voice/download-status', async () => {
  try {
    return await downloadStatusSnapshot()
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) }
  }
})

harness.handle('voice/transcribe', async (args) => {
  let tmp = null
  try {
    if (!args || typeof args.dataBase64 !== 'string' || !args.dataBase64) throw new Error('no audio data')
    tmp = tmpdir()
    await runCmd('mkdir -p ' + q(tmp), { timeoutMs: 10000 })
    const mime = String(args.mimeType || '')
    let ext = 'webm'
    if (mime.indexOf('webm') >= 0) ext = 'webm'
    else if (mime.indexOf('mp4') >= 0) ext = 'm4a'
    else if (mime.indexOf('ogg') >= 0) ext = 'ogg'
    else if (mime.indexOf('wav') >= 0) ext = 'wav'
    await runCmd('base64 -d > ' + q(tmp + '/in.' + ext), { stdin: args.dataBase64, timeoutMs: 30000 })
    await runCmd('ffmpeg -y -hide_banner -loglevel error -i ' + q(tmp + '/in.' + ext) + ' -ar 16000 -ac 1 -c:a pcm_s16le ' + q(tmp + '/in.wav'), { timeoutMs: 30000 })

    let text = ''
    if (config.provider === 'tcpp') {
      text = await transcribeWithTcpp(tmp)
    } else if (config.provider === 'api') {
      text = await transcribeWithApi(tmp)
    } else {
      text = await transcribeWithWhisper(tmp)
    }

    const cleaned = String(text).trim()
    if (!cleaned) return { ok: true, text: '', empty: true }
    return { ok: true, text: cleaned }
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) }
  } finally {
    if (tmp) {
      try { await runCmd('rm -rf ' + q(tmp), { timeoutMs: 10000 }) } catch (e) {}
    }
  }
})
