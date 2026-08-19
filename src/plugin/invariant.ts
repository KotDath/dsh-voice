/** Shared invariant helpers for dsh-voice. */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
