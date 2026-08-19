// OpenAI-compatible HTTP API provider.
// The API key is kept host-only (never returned to the client) and is passed to
// curl via the process environment rather than argv, so it does not appear in
// `ps` output. The header uses double quotes so bash expands $DSHVOICE_API_KEY.
async function transcribeWithApi(tmp) {
  if (!config.api.key) throw new Error('API key is required — set it in Settings → Voice → API key')
  if (!config.api.url) throw new Error('API endpoint is not set (Settings → Voice)')
  const langArg = config.language && config.language !== 'auto' ? ' -F ' + q('language=' + config.language) : ''
  const cmd = 'curl -sS --max-time 120 -X POST ' + q(config.api.url) + ' -H ' + '"Authorization: Bearer $DSHVOICE_API_KEY"' + ' -F ' + q('file=@' + tmp + '/in.wav;type=audio/wav') + ' -F ' + q('model=' + config.api.model) + langArg
  const env = { DSHVOICE_API_KEY: config.api.key }
  const result = await runCmd(cmd, { timeoutMs: 130000, env: env })
  const outText = (result.stdout && result.stdout.text) || ''
  let parsed = null
  try { parsed = JSON.parse(outText) } catch (e) { parsed = null }
  if (parsed && typeof parsed.text === 'string') return parsed.text
  if (parsed && parsed.error && parsed.error.message) throw new Error('API: ' + parsed.error.message)
  throw new Error('API: unexpected response: ' + outText.slice(0, 300))
}
