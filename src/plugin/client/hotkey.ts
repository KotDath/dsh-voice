/**
 * Voice hotkeys — a plugin-owned keyboard layer that starts a recording and
 * finishes it (send or insert) without the mouse.
 *
 * Why not `ctx.shortcuts`? The Harness command registry refuses Web bindings
 * outside its admitted set: on Web/Linux only `Ctrl+/`, `Ctrl+Shift+,` and
 * `Ctrl+Shift+.` pass `bindingIssue()`; `Ctrl+E` is `unsupported-browser` and
 * `register()` throws. This layer therefore listens on `window` in the bubble
 * phase and defers to the application: an already-prevented event means the
 * registry (or a local handler) owns the combination, so we stay out of it.
 *
 * Everything in this module is inert until {@link installHotkeyLayer} runs, and
 * nothing touches `window`/`document` at import time — the pure helpers are
 * imported directly by `test/hotkey.mjs` under Node.
 *
 * @module dsh-voice/client/hotkey
 */

import { getVoiceState, setVoiceState, subscribeVoice, type VoicePhase } from './state.ts'
import { apiCall, startRecording, stopWith } from './recorder.ts'
import { questionAnswerField, questionTarget } from './questionTarget.ts'
import { startQuestionOverlay, type QuestionOverlay } from './questionOverlay.ts'

/** One normalized combination: a physical key plus an exact modifier set. */
export interface HotkeySpec {
  /** Physical `KeyboardEvent.code` (layout independent, e.g. `KeyE`). */
  code: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
}

/** What the second press does: send the transcript or only insert it. */
export type HotkeyFinish = 'send' | 'insert'

/** Persisted hotkey settings, mirrored by the host half's `/api/voice/config`. */
export interface HotkeyConfig {
  combo: string
  /** Fallback combination, so a browser-reserved `combo` still leaves a way in. */
  altCombo: string
  action: HotkeyFinish
}

/** Outcome of one press, given the current recording phase. */
export type HotkeyAction = 'start' | 'pending' | 'finish-send' | 'finish-insert' | 'ignore'

/** The facts one keydown contributes to the decision (pure, testable). */
export interface HotkeyInput {
  repeat: boolean
  composing: boolean
  prevented: boolean
  terminal: boolean
  modal: boolean
  hasComposer: boolean
  /** An `ask_user_question` card offers its own insertion target. */
  hasTarget: boolean
  phase: VoicePhase
}

const DEFAULT_HOTKEY: HotkeyConfig = { combo: 'Ctrl+E', altCombo: 'Ctrl+Alt+E', action: 'send' }

/** Canonical modifier order for display and persistence. */
const MODIFIER_ORDER = ['ctrl', 'alt', 'shift', 'meta'] as const
const MODIFIER_LABELS: Record<(typeof MODIFIER_ORDER)[number], string> = {
  ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Meta',
}

/** Accepted physical keys: Latin letters, top-row digits, F1–F12. */
const KEY_CODE = /^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2]))$/

/** `KeyE` → `E`, `Digit1` → `1`, `F5` → `F5`. */
function displayCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  return code
}

/** One key token (`e`, `KeyE`, `1`, `F5`) → canonical code, or null. */
function codeFromToken(token: string): string | null {
  const lower = token.toLowerCase()
  const letter = /^(?:key)?([a-z])$/.exec(lower)
  if (letter !== null) return 'Key' + letter[1]!.toUpperCase()
  const digit = /^(?:digit)?([0-9])$/.exec(lower)
  if (digit !== null) return 'Digit' + digit[1]
  const fn = /^f([1-9]|1[0-2])$/.exec(lower)
  if (fn !== null) return 'F' + fn[1]
  return null
}

/**
 * Parse `Ctrl+E`, `ctrl+shift+e`, `Meta+F5` into a spec.
 * Requires at least one modifier — a bare key would hijack plain typing.
 * @param text - combination as typed in Settings.
 * @returns the normalized spec, or null when the text is not a combination.
 */
export function parseCombo(text: string): HotkeySpec | null {
  const raw = String(text ?? '').trim()
  if (raw === '') return null
  const parts = raw.split('+').map((part) => part.trim())
  if (parts.length < 2 || parts.some((part) => part === '')) return null
  const spec: HotkeySpec = { code: '', ctrl: false, alt: false, shift: false, meta: false }
  for (let i = 0; i < parts.length - 1; i++) {
    const modifier = parts[i]!.toLowerCase()
    if (!(MODIFIER_ORDER as readonly string[]).includes(modifier)) return null
    const slot = modifier as (typeof MODIFIER_ORDER)[number]
    if (spec[slot]) return null
    spec[slot] = true
  }
  const code = codeFromToken(parts[parts.length - 1]!)
  if (code === null) return null
  spec.code = code
  return spec
}

/**
 * Format a spec the way {@link parseCombo} accepts it (`Ctrl+Alt+E`).
 * @param spec - normalized combination.
 * @returns canonical display and persistence form.
 */
export function formatCombo(spec: HotkeySpec): string {
  const parts = MODIFIER_ORDER.filter((modifier) => spec[modifier]).map((modifier) => MODIFIER_LABELS[modifier])
  parts.push(displayCode(spec.code))
  return parts.join('+')
}

/**
 * Build a spec from a live event, ignoring bare modifier presses.
 * @param event - keydown event (structurally typed for the Node tests).
 * @returns the spec, or null while only modifiers are held.
 */
export function specFromEvent(event: {
  code?: string
  key?: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
}): HotkeySpec | null {
  const raw = event.code ?? ''
  let code: string | null = KEY_CODE.test(raw) ? raw : null
  if (code === null && typeof event.key === 'string' && event.key.length === 1) {
    code = codeFromToken(event.key)
  }
  if (code === null) return null
  return {
    code,
    ctrl: Boolean(event.ctrlKey),
    alt: Boolean(event.altKey),
    shift: Boolean(event.shiftKey),
    meta: Boolean(event.metaKey),
  }
}

/**
 * Compare an event with a spec: same physical key, exactly the same modifiers.
 * @param event - keydown-like event.
 * @param spec - normalized combination.
 * @returns whether this press is the bound combination.
 */
export function matches(event: {
  code?: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
}, spec: HotkeySpec): boolean {
  return (event.code ?? '') === spec.code
    && Boolean(event.ctrlKey) === spec.ctrl
    && Boolean(event.altKey) === spec.alt
    && Boolean(event.shiftKey) === spec.shift
    && Boolean(event.metaKey) === spec.meta
}

/**
 * Decide what one press means for the current phase.
 * @param phase - voice recording phase.
 * @param finish - configured second-press behavior.
 * @returns start / pending finish / finish now / ignore.
 */
export function hotkeyAction(phase: VoicePhase, finish: HotkeyFinish = 'send'): HotkeyAction {
  if (phase === 'idle' || phase === 'error') return 'start'
  if (phase === 'starting') return 'pending'
  if (phase === 'recording') return finish === 'insert' ? 'finish-insert' : 'finish-send'
  return 'ignore'
}

/**
 * First reason this press must not reach the voice state machine.
 * @param input - the pure facts gathered from the event and the app.
 * @returns a stable reason code, or null when the press belongs to voice input.
 */
export function ignoreReason(input: HotkeyInput): string | null {
  if (input.repeat) return 'repeat'
  if (input.composing) return 'composing'
  if (input.prevented) return 'prevented'
  if (input.terminal) return 'terminal'
  if (input.modal) return 'modal'
  if (!input.hasComposer && !input.hasTarget) return 'no-target'
  if (input.phase === 'processing') return 'processing'
  return null
}

// ── layer state (browser only; nothing here runs at import time) ────────────

let config: HotkeyConfig = { ...DEFAULT_HOTKEY }
let specs: HotkeySpec[] = []
let suspended = 0
let pendingFinish: HotkeyFinish | null = null
let installed = false
const configListeners = new Set<() => void>()

interface TestWaiter { resolve(ok: boolean): void }
let testWaiters: TestWaiter[] = []
let testTimer: number | null = null
let overlay: QuestionOverlay | null = null

/** Recompute the parsed specs from the current config. */
function rebuild(): void {
  specs = [config.combo, config.altCombo]
    .map((text) => (text === '' ? null : parseCombo(text)))
    .filter((spec): spec is HotkeySpec => spec !== null)
}

/**
 * Apply a partial config, ignoring combinations this module cannot parse.
 * @param next - fields to change.
 */
export function setHotkeyConfig(next: Partial<HotkeyConfig>): void {
  if (typeof next.combo === 'string') {
    const spec = parseCombo(next.combo)
    if (spec !== null) config.combo = formatCombo(spec)
  }
  if (typeof next.altCombo === 'string') {
    if (next.altCombo === '') config.altCombo = ''
    else {
      const spec = parseCombo(next.altCombo)
      if (spec !== null) config.altCombo = formatCombo(spec)
    }
  }
  if (next.action === 'send' || next.action === 'insert') config.action = next.action
  rebuild()
  for (const listener of configListeners) listener()
}

/** Read the live hotkey config (a copy). */
export function getHotkeyConfig(): HotkeyConfig {
  return { ...config }
}

/** Human-readable primary combination for tooltips (`Ctrl+E`). */
export function getHotkeyLabel(): string {
  const spec = config.combo === '' ? null : parseCombo(config.combo)
  return spec === null ? '' : formatCombo(spec)
}

/**
 * Subscribe to config changes (tooltip/settings).
 * @param listener - called after every applied change.
 * @returns disposer.
 */
export function subscribeHotkeyConfig(listener: () => void): () => void {
  configListeners.add(listener)
  return () => { configListeners.delete(listener) }
}

/** Read the persisted hotkey config once the host half answers. */
export async function loadHotkeyConfig(): Promise<void> {
  try {
    const view = await apiCall<{ ok?: boolean; hotkey?: Partial<HotkeyConfig> }>('/api/voice/config')
    if (view.hotkey !== undefined) setHotkeyConfig(view.hotkey)
  } catch {
    // The host half is unmounted (no /api/voice/*) — defaults still work.
  }
}

/**
 * Pause the layer while the settings page records a new combination.
 * @param active - whether the layer must stay out of the way.
 */
export function suspendHotkey(active: boolean): void {
  suspended = Math.max(0, suspended + (active ? 1 : -1))
}

/**
 * Watch for the configured combination for a short while (Settings → Test).
 * @param timeoutMs - how long to wait for a press.
 * @returns true when the page received a matching press, false on timeout.
 */
export function armHotkeyTest(timeoutMs = 5000): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  return new Promise<boolean>((resolve) => {
    testWaiters.push({ resolve })
    if (testTimer === null) {
      testTimer = window.setTimeout(() => {
        testTimer = null
        const waiters = testWaiters
        testWaiters = []
        for (const waiter of waiters) waiter.resolve(false)
      }, timeoutMs)
    }
  })
}

/** Resolve every armed test — a press reached the page. */
function settleTest(): void {
  if (testTimer !== null) { window.clearTimeout(testTimer); testTimer = null }
  const waiters = testWaiters
  testWaiters = []
  for (const waiter of waiters) waiter.resolve(true)
}

/** True while a visible modal/dialog owns the keyboard. */
function modalOpen(): boolean {
  const nodes = document.querySelectorAll('[aria-modal="true"], [role="dialog"], dialog[open]')
  for (const node of nodes) {
    const rect = node.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return true
  }
  return false
}

/** True when the event target lives inside an xterm terminal (Ctrl+E = EOL there). */
function inTerminal(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.xterm') !== null
}

/**
 * Show the floating indicator exactly while a question-card recording is alive
 * (the composer's own pill is not mounted in that presentation).
 */
function syncOverlay(): void {
  const state = getVoiceState()
  const wanted = state.target !== null && state.phase !== 'idle'
  if (wanted) {
    if (overlay === null) overlay = startQuestionOverlay()
    overlay.refresh()
    return
  }
  if (overlay !== null) {
    overlay.destroy()
    overlay = null
  }
}

/**
 * Attach the keyboard layer.
 * @returns disposer that removes the listener and pending state.
 */
export function installHotkeyLayer(): () => void {
  if (typeof window === 'undefined' || installed) return () => {}
  installed = true

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || event.isComposing || event.keyCode === 229) return
    if (suspended > 0) return
    if (!specs.some((spec) => matches(event, spec))) return

    // The Test button only measures delivery: the page saw the combination.
    if (testWaiters.length > 0) {
      event.preventDefault()
      settleTest()
      return
    }

    const state = getVoiceState()
    // A question card replaces the composer: its answer field becomes the target.
    // The configured second-press action applies there exactly as it does in the
    // composer — `send` inserts and submits the answer, `insert` only inserts.
    const field = questionAnswerField()
    const finish: HotkeyFinish = config.action
    const reason = ignoreReason({
      repeat: event.repeat,
      composing: event.isComposing,
      prevented: event.defaultPrevented,
      terminal: inTerminal(event.target),
      modal: modalOpen(),
      hasComposer: state.inputActions !== null,
      hasTarget: field !== null,
      phase: state.phase,
    })
    if (reason !== null) return

    const action = hotkeyAction(state.phase, finish)
    if (action === 'ignore') return
    event.preventDefault()

    if (action === 'start') {
      if (state.phase === 'error') setVoiceState({ phase: 'idle', error: '' })
      pendingFinish = null
      setVoiceState({ target: field === null ? null : questionTarget(field) })
      startRecording()
      return
    }
    if (action === 'pending') {
      pendingFinish = finish
      return
    }
    pendingFinish = null
    stopWith(action === 'finish-insert' ? 'insert' : 'send')
  }

  // A press during `starting` cannot stop a recorder that does not exist yet;
  // finish as soon as the phase flips to `recording`.
  const unsubscribePhase = subscribeVoice(() => {
    const phase = getVoiceState().phase
    if (phase === 'idle' || phase === 'error') pendingFinish = null
    else if (pendingFinish !== null && phase === 'recording') {
      const finish = pendingFinish
      pendingFinish = null
      stopWith(finish)
    }
    syncOverlay()
  })

  window.addEventListener('keydown', onKeyDown, { passive: false })
  rebuild()

  return () => {
    window.removeEventListener('keydown', onKeyDown)
    unsubscribePhase()
    overlay?.destroy()
    overlay = null
    installed = false
    pendingFinish = null
  }
}