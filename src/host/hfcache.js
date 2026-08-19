// Discover GGUF models already present in the Hugging Face cache (e.g. those
// downloaded by the Handy app), so the plugin reuses them instead of re-
// downloading. Maps filename -> absolute path. Reads only — never writes here.
let hfCache = null

async function refreshHfCache() {
  try {
    const cmd = 'ls -d "$HOME"/.cache/huggingface/hub/models--*/snapshots/*/*.gguf 2>/dev/null || true'
    const r = await runCmd(cmd, { timeoutMs: 30000 })
    const out = String((r.stdout && r.stdout.text) || '')
    const map = {}
    for (const line of out.split('\n')) {
      const p = line.trim()
      if (!p) continue
      const name = p.slice(p.lastIndexOf('/') + 1)
      if (name) map[name] = p
    }
    hfCache = { at: Date.now(), map: map }
    return map
  } catch (e) {
    hfCache = { at: Date.now(), map: {} }
    return {}
  }
}

async function hfPathFor(filename) {
  if (!hfCache || Date.now() - hfCache.at > 30000) await refreshHfCache()
  return hfCache.map[filename] || null
}
