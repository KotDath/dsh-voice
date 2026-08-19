/** Shared voice recording state between the mic button and the recording pill. */

export type VoicePhase = 'idle' | 'starting' | 'recording' | 'processing' | 'error'

export interface VoiceRec {
  recorder: MediaRecorder
  stream: MediaStream
  chunks: Blob[]
  audioCtx: AudioContext | null
  analyser: AnalyserNode | null
  stopping: boolean
  startedAt: number
  mime: string
}

export interface VoiceState {
  phase: VoicePhase
  error: string
  rec: VoiceRec | null
  levels: number[]
  inputActions: { setDraft(text: string): void; submit?(): void } | null
  input: { draft?: string } | null
  waveColor?: string
}

export const MAX_RECORDING_SECS = 300

const state: VoiceState = {
  phase: 'idle',
  error: '',
  rec: null,
  levels: [],
  inputActions: null,
  input: null,
}

const listeners = new Set<() => void>()

export function getVoiceState(): VoiceState {
  return state
}

export function setVoiceState(patch: Partial<VoiceState>): void {
  Object.assign(state, patch)
  for (const l of listeners) l()
}

export function subscribeVoice(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function fmtSize(b: number): string {
  if (!b || b <= 0) return ''
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB'
  return Math.max(1, Math.round(b / 1e6)) + ' MB'
}

export function fmtTime(sec: number): string {
  const s = Math.floor(sec)
  const m = Math.floor(s / 60)
  return m + ':' + String(s % 60).padStart(2, '0')
}
