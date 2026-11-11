/**
 * Read the composer straight from the DOM.
 *
 * The voice store mirrors the composer through slot props, and that copy is a
 * beat behind an edit (and empty while no session-scoped face is mounted), so
 * every decision that needs to be exact — "does the draft hold anything?",
 * "which side of the caret needs a space?" — asks the elements themselves.
 *
 * @module dsh-voice/client/composerDom
 */

/** The composer's text editor (a Lexical contenteditable). */
export const EDITOR = '[contenteditable="true"]'

/** Marks the borrowed submit button. */
export const OWNED = 'data-dsh-voice-submit'

/**
 * The visible composer card (a session keeps the previous one mounted).
 * @returns the card, or null when the composer is not on screen.
 */
export function composerCard(): Element | null {
  if (typeof document === 'undefined') return null
  for (const card of Array.from(document.querySelectorAll('[data-composer-card]'))) {
    const rect = card.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return card
  }
  return null
}

/**
 * The draft text as the editor currently holds it.
 * @param card - the composer card (defaults to the visible one).
 * @returns the text, without the surrounding whitespace a Lexical doc keeps.
 */
export function composerText(card: Element | null = composerCard()): string {
  const editor = card === null ? null : card.querySelector(EDITOR)
  return editor === null ? '' : (editor.textContent ?? '')
}

/**
 * Whether the composer draft holds any text — reference chips included, since
 * they render as text inside the same editor.
 * @param card - the composer card.
 * @returns true when something would be sent.
 */
export function composerHasText(card: Element | null = composerCard()): boolean {
  return composerText(card).trim() !== ''
}

/**
 * The resident submit button: the last button of the composer row, and the only
 * one outside the dock below it. Matching on `aria-busy` is not enough — the
 * model select carries that attribute too and comes earlier in the row.
 * @param card - the composer card.
 * @returns the button, or null when the bar is not mounted.
 */
export function findNativeSubmit(card: Element | null): HTMLButtonElement | null {
  if (card === null) return null
  const buttons = Array.from(card.querySelectorAll<HTMLButtonElement>('button'))
    .filter((button) => button.closest('[data-composer-dock]') === null)
  return buttons.length === 0 ? null : buttons[buttons.length - 1]!
}
