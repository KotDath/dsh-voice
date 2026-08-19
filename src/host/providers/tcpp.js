// transcribe.cpp provider (default). Handles the model's ~25 s window by
// chunking long audio into 20 s segments and running one batch invocation
// (single model load for all chunks). Short audio uses a single file run.
async function transcribeWithTcpp(tmp) {
  if (!config.tcpp.modelId) throw new Error('no model selected (Settings → Voice)')
  const entry = catalogEntry(config.tcpp.modelId)
  if (!entry) throw new Error('model not found in catalog')
  const eng = await ensureEngine()
  if (!eng.exists) throw new Error('engine is not installed — Settings → Voice → Download engine')

  const resolved = await modelPath(entry)
  if (!resolved.downloaded) throw new Error('model is not downloaded — Settings → Voice → Download')

  const whisper = isWhisperFamily(entry)
  // config.language is validated against the enum in schema.js — safe to quote.
  const langArg = whisper && config.language && config.language !== 'auto' ? ' -l ' + config.language : ''
  const wavBytes = await fileSize(tmp + '/in.wav')
  const durationSec = wavBytes / 32000

  if (durationSec > CHUNK_THRESHOLD_SECS) {
    return await batchTranscribe(tmp, resolved.path, langArg)
  }
  const cmd = q(config.tcpp.binary) + ' -m ' + q(resolved.path) + ' -q' + langArg + ' -o ' + q(tmp + '/out.txt') + ' ' + q(tmp + '/in.wav')
  await runCmd(cmd, { timeoutMs: 600000, workdir: tmp })
  const target = await fs.resolve(tmp + '/out.txt')
  return await fs.readText(target)
}

async function batchTranscribe(tmp, modelPath, langArg) {
  await runCmd('mkdir -p ' + q(tmp + '/chunks'), { timeoutMs: 10000 })
  await runCmd('ffmpeg -y -hide_banner -loglevel error -i ' + q(tmp + '/in.wav') + ' -f segment -segment_time ' + CHUNK_SECS + ' -c copy ' + q(tmp + '/chunks/chunk_%03d.wav'), { timeoutMs: 60000 })
  await runCmd('ls ' + q(tmp + '/chunks') + '/chunk_*.wav | sort > ' + q(tmp + '/list.txt'), { timeoutMs: 10000, workdir: tmp })
  const cmd = q(config.tcpp.binary) + ' --batch ' + q(tmp + '/list.txt') + ' -m ' + q(modelPath) + ' -q' + langArg + ' --batch-jsonl'
  const result = await runCmd(cmd, { timeoutMs: 900000, workdir: tmp })
  const outText = (result.stdout && result.stdout.text) || ''
  const parts = []
  for (const line of outText.split('\n')) {
    const l = line.trim()
    if (!l) continue
    let parsed = null
    try { parsed = JSON.parse(l) } catch (e) { parsed = null }
    if (parsed && typeof parsed.text === 'string' && parsed.text.trim()) parts.push(parsed.text.trim())
  }
  if (!parts.length) throw new Error('transcribe-cli: no batch output')
  return parts.join(' ')
}
