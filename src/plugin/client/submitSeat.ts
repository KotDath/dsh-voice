/**
 * The composer's own submit button, borrowed for the duration of a recording.
 *
 * While a dictation is live the resident submit is disabled — an empty draft is
 * exactly the state in which someone dictates — so there is nothing to click.
 * Rather than adding a second button (rejected: two send affordances side by
 * side), or re-purposing the stop button (rejected: `⏹` means "insert"), this
 * module enables the resident button in place and takes the press: the
 * composer's own `onClick` never runs, so an empty draft is never submitted on
 * its behalf.
 *
 * `disabled` is a DOM property React writes only when its *prop* flips, so
 * clearing it here survives re-renders (and React re-applies it whenever the
 * draft really does change between empty and not). The attribute
 * `data-dsh-voice-submit` marks the borrowed node so the press handler can
 * recognise it without depending on hashed CSS-module class names.
 *
 * Whether the draft holds anything is read from the editor itself
 * ({@link composerHasText}): the voice store's copy arrives a beat later, and a
 * wrong guess here would leave the send button stuck in the wrong state.
 *
 * @module dsh-voice/client/submitSeat
 */

import { getVoiceState, subscribeVoice } from './state.ts'
import { requestFinish } from './recorder.ts'

/** Marks the borrowed submit button. */
const OWNED = 'data-dsh-voice-submit'

/** The resident submit is the only button the composer bar gives an `aria-busy`. */
const SUBMIT = 'button[aria-busy]'

/** The composer's text editor (a Lexical contenteditable). */
const EDITOR = '[contenteditable="true"]'

let owned: HTMLButtonElement | null = null

/** The visible composer card (a session keeps the previous one mounted). */
function liveComposerCard(): Element | null {
  for (const card of Array.from(document.querySelectorAll('[data-composer-card]'))) {
    const rect = card.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return card
  }
  return null
}

/**
 * Whether the composer draft holds any text — reference chips included, since
 * they render as text inside the same editor.
 * @param card - the composer card, or null when it is not on screen.
 * @returns true when something would be sent.
 */
export function composerHasText(card: Element | null): boolean {
  const editor = card === null ? null : card.querySelector(EDITOR)
  if (editor === null) return false
  return (editor.textContent ?? '').trim() !== ''
}

/**
 * Enable the composer's submit button and mark it as ours.
 * @param card - the visible composer card, or null when it is not on screen.
 */
export function grabNativeSubmit(card: Element | null): void {
  const button = card === null ? null : card.querySelector<HTMLButtonElement>(SUBMIT)
  if (button === null) { releaseNativeSubmit(); return }
  if (button !== owned) releaseNativeSubmit()
  owned = button
  if (button.disabled) button.disabled = false
  if (!button.hasAttribute(OWNED)) button.setAttribute(OWNED, '')
}

/** Hand the button back in the state the composer itself would give it. */
export function releaseNativeSubmit(): void {
  const button = owned
  owned = null
  if (button === null) return
  button.removeAttribute(OWNED)
  // React disabled it for an empty draft and has no update to apply, so that
  // state has to be restored by hand; a filled draft means React still owns an
  // enabled button (the transcript we just spliced in, usually).
  if (!button.isConnected) return
  button.disabled = !composerHasText(button.closest('[data-composer-card]'))
}

/** What a press on the borrowed submit means right now. */
export function submitPressMode(): 'insert' | 'send' {
  const card = owned?.closest('[data-composer-card]') ?? liveComposerCard()
  return composerHasText(card) ? 'insert' : 'send'
}

/**
 * Attach the click takeover and the recording-phase housekeeping.
 * @returns disposer that removes the listener and hands the button back.
 */
export function installSubmitLayer(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}

  let timer: number | null = null

  const onClick = (event: MouseEvent): void => {
    const node = event.target instanceof Element ? event.target.closest('[' + OWNED + ']') : null
    if (node === null) return
    const phase = getVoiceState().phase
    if (phase !== 'recording' && phase !== 'starting') return
    // Swallow the press: the composer would otherwise submit an empty draft
    // instead of waiting for the transcript.
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    requestFinish(submitPressMode())
  }

  const sync = (): void => {
    if (getVoiceState().phase === 'recording') {
      grabNativeSubmit(liveComposerCard())
      // The composer disables it again whenever the draft passes through empty;
      // keep it awake for as long as the recording lasts.
      if (timer === null) {
        timer = window.setInterval(() => grabNativeSubmit(liveComposerCard()), 250)
      }
      return
    }
    if (timer !== null) { window.clearInterval(timer); timer = null }
    releaseNativeSubmit()
  }

  const unsubscribe = subscribeVoice(sync)
  window.addEventListener('click', onClick, true)
  sync()

  return () => {
    unsubscribe()
    window.removeEventListener('click', onClick, true)
    if (timer !== null) window.clearInterval(timer)
    releaseNativeSubmit()
  }
}
