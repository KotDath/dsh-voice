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
 * Build a recording target for the question card, so `finish()` inserts there.
 * @param field - the answer textarea found when the recording started.
 * @returns a target whose insertion re-resolves the field when the card re-rendered.
 */
export function questionTarget(field: HTMLTextAreaElement): { insert(text: string): void } {
  return {
    insert(text: string): void {
      const live = questionAnswerField() ?? field
      insertIntoField(live, text)
    },
  }
}