/**
 * The free-text answer field of an `ask_user_question` card.
 *
 * While the agent waits for an answer, the question card occupies the composer
 * seat (`[data-composer-seat]` in `@deepseek-ai/dsh-client-ui-conversation`), so
 * the chat composer — and this plugin's mic button and recording pill with it —
 * is not mounted. The card is marked with `data-question-key` and its custom
 * answer ("your own variant") is a plain `<textarea>`, while the chat composer
 * itself is a Lexical `contenteditable` host. That difference is the whole
 * detector: a visible textarea inside a question card is the insertion target.
 *
 * Controlled React inputs ignore a plain `element.value = …`, so the update goes
 * through the prototype setter followed by a synthetic `input` event — the
 * change then flows through `onChange` like real typing.
 *
 * @module dsh-voice/client/questionTarget
 */

import type { VoiceTarget } from './state.ts'

/** A textarea's caret-insertion inputs, structurally typed for the Node tests. */
export interface CaretLike {
  value: string
  selectionStart: number | null
  selectionEnd: number | null
}

/**
 * Splice `text` over the selection and report the new caret.
 * @param value - current field content.
 * @param start - selection start.
 * @param end - selection end.
 * @param text - transcript to insert.
 * @returns the next value and the caret offset after the inserted text.
 */
export function spliceAtCaret(value: string, start: number, end: number, text: string): { next: string; caret: number } {
  const from = Math.max(0, Math.min(start, value.length))
  const to = Math.max(from, Math.min(end, value.length))
  // Keep the transcript from gluing onto the previous word, without doubling an
  // existing space or leading an empty field with one.
  const separator = text !== '' && from > 0 && !/\s$/u.test(value.slice(0, from)) ? ' ' : ''
  const next = value.slice(0, from) + separator + text + value.slice(to)
  return { next, caret: from + separator.length + text.length }
}

/**
 * Find the visible, editable answer field of the open question card.
 * @returns the textarea, or null when no question card occupies a composer seat.
 */
export function questionAnswerField(): HTMLTextAreaElement | null {
  const seats = document.querySelectorAll('[data-composer-seat]')
  for (const seat of seats) {
    const card = seat.querySelector('[data-question-key]')
    if (card === null) continue
    for (const candidate of card.querySelectorAll('textarea')) {
      if (!(candidate instanceof HTMLTextAreaElement)) continue
      if (candidate.disabled || candidate.readOnly) continue
      const rect = candidate.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) return candidate
    }
  }
  return null
}

/**
 * Insert the transcript at the field's caret (or append when it is not focused)
 * and hand the change to React.
 * @param field - the question card's answer textarea.
 * @param text - transcript to insert.
 * @returns whether the field changed.
 */
export function insertIntoField(field: HTMLTextAreaElement, text: string): boolean {
  const focused = document.activeElement === field
  const value = field.value
  const start = focused ? (field.selectionStart ?? value.length) : value.length
  const end = focused ? (field.selectionEnd ?? start) : value.length
  const { next, caret } = spliceAtCaret(value, start, end, text)
  if (next === value) return false
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  if (setter !== undefined) setter.call(field, next)
  else field.value = next
  field.dispatchEvent(new Event('input', { bubbles: true }))
  field.focus()
  field.setSelectionRange(caret, caret)
  return true
}

/**
 * The card's own primary action: Submit on the last question, Next before it.
 * It is the last button of the card, which is a rule we can state without
 * knowing the localized label.
 * @param field - the answer textarea of the same card.
 * @returns the button, or null when the card is gone.
 */
export function questionSubmitButton(field: HTMLTextAreaElement): HTMLButtonElement | null {
  const card = field.closest('[data-question-key]')
  if (card === null) return null
  const buttons = Array.from(card.querySelectorAll<HTMLButtonElement>('button'))
  return buttons.length === 0 ? null : buttons[buttons.length - 1]!
}

/**
 * Click the card's own submit, waiting for it to wake up.
 *
 * The transcript reaches React as an `input` event, so for one render the
 * button is still disabled (`!answered(draft)`); the click is retried on the
 * next animation frames instead of being lost.
 * @param field - the answer textarea whose answer should be sent.
 * @param frames - how many frames to wait for the button to enable.
 * @returns nothing; the click happens asynchronously.
 */
export function submitAnswer(field: HTMLTextAreaElement, frames = 20): void {
  if (typeof window === 'undefined') return
  const attempt = (left: number): void => {
    const live = questionAnswerField() ?? field
    const button = questionSubmitButton(live)
    if (button === null) return
    if (!button.disabled) { button.click(); return }
    if (left <= 0) return
    window.requestAnimationFrame(() => attempt(left - 1))
  }
  attempt(frames)
}

/**
 * Build a recording target for the question card, so `finish()` inserts there
 * and, on the send path, hands the answer to the card's own Submit.
 * @param field - the answer textarea found when the recording started.
 * @returns a target whose insertion re-resolves the field when the card re-rendered.
 */
export function questionTarget(field: HTMLTextAreaElement): VoiceTarget {
  return {
    insert(text: string): void {
      const live = questionAnswerField() ?? field
      insertIntoField(live, text)
    },
    submit(): void {
      submitAnswer(questionAnswerField() ?? field)
    },
  }
}