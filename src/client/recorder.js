// Microphone capture + finishing (stop → transcribe → insert/send).
// IMPORTANT: tear down the media stream even when MediaRecorder/AudioContext
// setup throws — wrap the whole init so no mic stream leaks.

function teardown(rec) {
  if (!rec) return
  try { rec.stream.getTracks().forEach((t) => t.stop()) } catch (e) {}
  if (rec.audioCtx) { try { rec.audioCtx.close() } catch (e) {} }
}

function waitStop(rec) {
  return new Promise((resolve) => {
    rec.recorder.addEventListener('stop', () => resolve(), { once: true })
  })
}

function startRecording() {
  voice.set({ phase: 'starting', error: '' })
  voice.levels = []
  const run = (async () => {
    let stream = null
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser has no microphone access (HTTPS or localhost required)')
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder is not supported by this browser')

      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = ''
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType: mimeType }) : new MediaRecorder(stream)
      const chunks = []
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data) }

      let audioCtx = null
      let analyser = null
      const AC = typeof AudioContext !== 'undefined' ? AudioContext : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null)
      if (AC) {
        audioCtx = new AC()
        const src = audioCtx.createMediaStreamSource(stream)
        analyser = audioCtx.createAnalyser()
        analyser.fftSize = 128
        src.connect(analyser)
      }

      voice.rec = { recorder, stream, chunks, audioCtx, analyser, stopping: false, startedAt: Date.now(), mime: mimeType || recorder.mimeType || 'audio/webm' }
      recorder.start(250)
      voice.set({ phase: 'recording' })
    } catch (err) {
      // If anything above threw, no voice.rec was assigned — stop the stream
      // explicitly so the mic indicator doesn't linger.
      if (stream) { try { stream.getTracks().forEach((t) => t.stop()) } catch (e) {} }
      voice.set({ phase: 'error', error: String(err && err.message ? err.message : err) })
    }
  })()
  run.catch((err) => voice.set({ phase: 'error', error: String(err && err.message ? err.message : err) }))
}

function cancelRecording() {
  const rec = voice.rec
  if (!rec || rec.stopping) return
  rec.stopping = true
  const stopped = waitStop(rec)
  try { rec.recorder.stop() } catch (e) {}
  stopped.then(() => {
    teardown(rec)
    voice.rec = null
    voice.set({ phase: 'idle' })
  })
}

function stopWith(mode) {
  const rec = voice.rec
  if (!rec || rec.stopping) return
  rec.stopping = true
  const stopped = waitStop(rec)
  try { rec.recorder.stop() } catch (e) {}
  stopped.then(() => finish(rec, mode))
}

async function finish(rec, mode) {
  teardown(rec)
  voice.rec = null
  voice.set({ phase: 'processing' })
  try {
    const blob = new Blob(rec.chunks, { type: rec.mime })
    const dataBase64 = await new Promise((resolve, reject) => {
      if (typeof FileReader === 'undefined') { reject(new Error('FileReader is not supported')); return }
      const fr = new FileReader()
      fr.onload = () => { const s = String(fr.result || ''); resolve(s.indexOf(',') >= 0 ? s.slice(s.indexOf(',') + 1) : s) }
      fr.onerror = () => reject(new Error('failed to read audio'))
      fr.readAsDataURL(blob)
    })
    const result = await host.call('voice/transcribe', { dataBase64, mimeType: rec.mime })
    if (!result || !result.ok) {
      voice.set({ phase: 'error', error: result && result.error ? result.error : 'Transcription failed' })
      return
    }
    const text = String(result.text || '').trim()
    if (!text) { voice.set({ phase: 'error', error: 'No speech recognized' }); return }

    const actions = voice.inputActions
    if (!actions || typeof actions.setDraft !== 'function') {
      voice.set({ phase: 'error', error: 'Composer is unavailable' })
      return
    }
    const draft = voice.input && typeof voice.input.draft === 'string' ? voice.input.draft : ''
    actions.setDraft(draft ? draft + ' ' + text : text)
    if (mode === 'send' && typeof actions.submit === 'function') actions.submit()
    voice.set({ phase: 'idle' })
  } catch (err) {
    voice.set({ phase: 'error', error: String(err && err.message ? err.message : err) })
  }
}
