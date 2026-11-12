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
 * A press on it always means "send": the transcript is spliced in at the caret
 * and the resulting draft goes out, whether it was empty or not. Inserting
 * without sending is the stop button's job (`⏹`) — two buttons that do the same
 * thing would make the word "send" a lie.
 *
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
import { composerCard, composerHasText, findNativeSubmit, OWNED } from './composerDom.ts'

let owned: HTMLButtonElement | null = null

/**
 * Enable the composer's submit button and mark it as ours.
 * @param card - the visible composer card, or null when it is not on screen.
 */
export function grabNativeSubmit(card: Element | null = composerCard()): void {
  const button = findNativeSubmit(card)
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
    requestFinish('send')
  }

  const sync = (): void => {
    if (getVoiceState().phase === 'recording') {
      grabNativeSubmit()
      // The composer disables it again whenever the draft passes through empty;
      // keep it awake for as long as the recording lasts.
      if (timer === null) {
        timer = window.setInterval(() => grabNativeSubmit(), 250)
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
