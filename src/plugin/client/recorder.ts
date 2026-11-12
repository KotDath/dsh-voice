/** Microphone capture + finishing (stop → transcribe → insert/send). */

import { getVoiceState, setVoiceState, subscribeVoice, type InsertSpan, type VoiceRec } from './state.ts'
import { composerCard, composerText } from './composerDom.ts'

export async function apiCall<T>(path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (e) {
    throw new Error('voice API unreachable: ' + (e instanceof Error ? e.message : String(e)))
  }
  const text = await res.text()
  let data: T & { ok?: boolean; error?: string }
  try {
    data = JSON.parse(text) as T & { ok?: boolean; error?: string }
  } catch {
    // The endpoint answered non-JSON (e.g. a 404 HTML page when the host half
    // is not mounted) — surface that instead of a cryptic JSON.parse error.
    throw new Error(`voice API ${path} returned ${res.status}: ${text.slice(0, 120) || '(empty)'}`)
  }
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
  // Remember where the cursor sits: the transcript goes exactly there, even if
  // transcription takes a while (the span is revision-guarded by the editor).
  const actions = getVoiceState().inputActions
  const span = actions !== null && typeof actions.captureInsertion === 'function'
    ? actions.captureInsertion()
    : null
  setVoiceState({ span })
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
    setVoiceState({ phase: 'idle', target: null, span: null })
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

/**
 * Finish a recording that may still be opening the microphone. A press during
 * `starting` cannot stop a recorder that does not exist yet; it is carried out
 * as soon as the phase flips to `recording`.
 * @param mode - send the transcript or only insert it.
 */
export function requestFinish(mode: 'insert' | 'send'): void {
  const phase = getVoiceState().phase
  if (phase === 'recording') { stopWith(mode); return }
  if (phase !== 'starting') return
  const off = subscribeVoice(() => {
    const next = getVoiceState().phase
    if (next === 'recording') { off(); stopWith(mode) }
    else if (next !== 'starting') off()
  })
}

/**
 * Wrap the transcript with the spaces the surrounding draft needs, so a
 * dictation lands as its own word instead of gluing itself to the text around
 * the caret.
 * @param draft - the draft before insertion.
 * @param span - insertion range in the same coordinates.
 * @param text - recognized speech.
 * @returns the text to splice in, spaces included.
 */
export function padTranscript(draft: string, span: InsertSpan, text: string): string {
  const before = draft.slice(0, span.start)
  const after = draft.slice(span.end)
  const lead = before !== '' && !/\s$/.test(before) && !/^\s/.test(text) ? ' ' : ''
  const tail = after !== '' && !/^\s/.test(after) && !/\s$/.test(text) ? ' ' : ''
  return lead + text + tail
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

    // A question card occupies the composer seat: its answer field is the
    // target, and the transcript is inserted there instead of into a draft.
    const target = getVoiceState().target
    if (target !== null) {
      target.insert(text)
      setVoiceState({ phase: 'idle', target: null, span: null })
      // Same contract as the composer: `⏹` (insert) leaves the answer for the
      // user, the send path hands it to the card's own Submit.
      if (mode === 'send') target.submit?.()
      return
    }

    const actions = getVoiceState().inputActions
    if (!actions || typeof actions.insertText !== 'function' || typeof actions.captureInsertion !== 'function') {
      setVoiceState({ phase: 'error', error: 'Composer is unavailable' })
      return
    }
    let span = getVoiceState().span
    let spliced = span !== null && actions.insertText(padTranscript(composerText(composerCard()), span, text), span)
    if (!spliced) {
      // The draft moved on while the audio was in flight (the user kept typing):
      // take the live caret instead of dumping the text at the end.
      span = actions.captureInsertion()
      spliced = actions.insertText(padTranscript(composerText(composerCard()), span, text), span)
    }
    if (!spliced) {
      setVoiceState({ phase: 'error', error: 'Could not insert the transcript' })
      return
    }
    setVoiceState({ phase: 'idle', span: null })
    // Sending is the caller's decision (the composer's own submit button or the
    // configured second press), never an automatic side effect of dictating.
    if (mode === 'send' && typeof actions.submit === 'function') actions.submit()
  } catch (err) {
    setVoiceState({ phase: 'error', error: err instanceof Error ? err.message : String(err) })
  }
}

