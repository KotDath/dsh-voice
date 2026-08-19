//#region src/plugin/invariant.ts
/** Shared invariant helpers for dsh-voice. */
function invariant(condition, message) {
	if (!condition) throw new Error(message);
}
//#endregion
export { invariant };
