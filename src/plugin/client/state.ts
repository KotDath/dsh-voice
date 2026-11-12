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

/**
 * A place the transcript can go when the composer is not mounted — today the
 * free-text answer field of an `ask_user_question` card, which occupies the
 * composer seat while the agent waits for an answer.
 */
export interface VoiceTarget {
  insert(text: string): void
  /** Send the target's own answer (the card's Submit); absent = insert only. */
  submit?(): void
}

/**
 * The composer editor's insertion point, captured when a recording starts:
 * the Harness hands it out revision-guarded, so a transcript can be spliced in
 * later without overwriting edits made in the meantime.
 */
export interface InsertSpan {
  readonly start: number
  readonly end: number
  readonly draftRev: number
}

/** The composer action face this plugin uses (a subset of the Harness one). */
export interface ComposerActions {
  setDraft(text: string): void
  submit?(): void
  captureInsertion?(): InsertSpan
  insertText?(text: string, span: InsertSpan): boolean
}

export interface VoiceState {
  phase: VoicePhase
  error: string
  rec: VoiceRec | null
  levels: number[]
  inputActions: ComposerActions | null
  input: { draft?: string } | null
  /** Explicit insertion target captured when a recording starts; null = composer. */
  target: VoiceTarget | null
  /** Caret captured when a recording starts (composer drafts only). */
  span: InsertSpan | null
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
  target: null,
  span: null,
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
