/** Microphone capture + finishing (stop → transcribe → insert/send). */

import { getVoiceState, setVoiceState, type VoiceRec } from './state.ts'

export async function apiCall<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json() as T & { ok?: boolean; error?: string }
  if (!res.ok || data.ok === false) {
    throw new Error(data.error ?? `request failed (${res.status})`)
  }
  return data
}

export function teardown(rec: VoiceRec): void {
  try { rec.stream.getTracks().forEach((t) => t.stop()) } catch { /* noop */ }
  if (rec.audioCtx) { try { void rec.audioCtx.close() } catch { /* noop */ } }
}

function waitStop(rec: VoiceRec): Promise<void> {
  return new Promise((resolve) => {
    rec.recorder.addEventListener('stop', () => resolve(), { once: true })
  })
}

export function startRecording(): void {
  setVoiceState({ phase: 'starting', error: '' })
  getVoiceState().levels = []
  const run = (async () => {
    let stream: MediaStream | null = null
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser has no microphone access (HTTPS or localhost required)')
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder is not supported by this browser')

      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = ''
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data) }

      let audioCtx: AudioContext | null = null
      let analyser: AnalyserNode | null = null
      const win = window as Window & { webkitAudioContext?: typeof AudioContext }
      const AC = typeof AudioContext !== 'undefined' ? AudioContext : (win.webkitAudioContext ?? null)
      if (AC) {
        audioCtx = new AC()
        const src = audioCtx.createMediaStreamSource(stream)
        analyser = audioCtx.createAnalyser()
        analyser.fftSize = 128
        src.connect(analyser)
      }

      const rec: VoiceRec = { recorder, stream, chunks, audioCtx, analyser, stopping: false, startedAt: Date.now(), mime: mimeType || recorder.mimeType || 'audio/webm' }
      const st = getVoiceState()
      st.rec = rec
      recorder.start(250)
      setVoiceState({ phase: 'recording' })
    } catch (err) {
      if (stream) { try { stream.getTracks().forEach((t) => t.stop()) } catch { /* noop */ } }
      setVoiceState({ phase: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  })()
  run.catch((err) => setVoiceState({ phase: 'error', error: err instanceof Error ? err.message : String(err) }))
}

export function cancelRecording(): void {
  const rec = getVoiceState().rec
  if (!rec || rec.stopping) return
  rec.stopping = true
  const stopped = waitStop(rec)
  try { rec.recorder.stop() } catch { /* noop */ }
  stopped.then(() => {
    teardown(rec)
    const st = getVoiceState()
    st.rec = null
    setVoiceState({ phase: 'idle' })
  })
}

export function stopWith(mode: 'insert' | 'send'): void {
  const rec = getVoiceState().rec
  if (!rec || rec.stopping) return
  rec.stopping = true
  const stopped = waitStop(rec)
  try { rec.recorder.stop() } catch { /* noop */ }
  stopped.then(() => void finish(rec, mode))
}

export async function finish(rec: VoiceRec, mode: 'insert' | 'send'): Promise<void> {
  teardown(rec)
  const st = getVoiceState()
  st.rec = null
  setVoiceState({ phase: 'processing' })
  try {
    const blob = new Blob(rec.chunks, { type: rec.mime })
    const dataBase64 = await new Promise<string>((resolve, reject) => {
      if (typeof FileReader === 'undefined') { reject(new Error('FileReader is not supported')); return }
      const fr = new FileReader()
      fr.onload = () => { const s = String(fr.result ?? ''); resolve(s.indexOf(',') >= 0 ? s.slice(s.indexOf(',') + 1) : s) }
      fr.onerror = () => reject(new Error('failed to read audio'))
      fr.readAsDataURL(blob)
    })
    const result = await apiCall<{ ok: boolean; text?: string; error?: string }>('/api/voice/transcribe', { dataBase64, mimeType: rec.mime })
    const text = String(result.text ?? '').trim()
    if (!text) { setVoiceState({ phase: 'error', error: 'No speech recognized' }); return }

    const actions = getVoiceState().inputActions
    if (!actions || typeof actions.setDraft !== 'function') {
      setVoiceState({ phase: 'error', error: 'Composer is unavailable' })
      return
    }
    const input = getVoiceState().input
    const draft = input && typeof input.draft === 'string' ? input.draft : ''
    actions.setDraft(draft ? draft + ' ' + text : text)
    if (mode === 'send' && typeof actions.submit === 'function') actions.submit()
    setVoiceState({ phase: 'idle' })
  } catch (err) {
    setVoiceState({ phase: 'error', error: err instanceof Error ? err.message : String(err) })
  }
}
