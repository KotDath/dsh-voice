// whisper.cpp provider (single GGML model via whisper-cli).
async function transcribeWithWhisper(tmp) {
  if (!config.local.binary || !config.local.model) throw new Error('whisper paths not set (Settings → Voice → Advanced)')
  const langArg = config.language && config.language !== 'auto' ? ' -l ' + config.language : ''
  const cmd = q(config.local.binary) + ' -m ' + q(config.local.model) + langArg + ' -f ' + q(tmp + '/in.wav') + ' -oj -of ' + q(tmp + '/out')
  await runCmd(cmd, { timeoutMs: 300000, workdir: tmp })
  const target = await fs.resolve(tmp + '/out.json')
  const jsonText = await fs.readText(target)
  const parsed = JSON.parse(jsonText)
  if (parsed && typeof parsed.text === 'string') {
    return parsed.text
  } else if (parsed && Array.isArray(parsed.transcription)) {
    return parsed.transcription.map((seg) => (seg && typeof seg.text === 'string') ? seg.text : '').join('')
  }
  throw new Error('whisper: could not parse out.json')
}
