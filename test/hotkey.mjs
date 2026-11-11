// Browser-half unit tests for the voice hotkey layer (pure helpers only).
//
//   node test/hotkey.mjs
//
// The module is imported straight from `src/`: Node 24 strips the TypeScript
// types, so the same code that ships in `lib/client.js` is exercised here.
// Exit code 0 = all pass.

import {
  formatCombo, getHotkeyConfig, getHotkeyLabel, hotkeyAction, ignoreReason,
  installHotkeyLayer, matches, parseCombo, setHotkeyConfig, specFromEvent,
} from '../src/plugin/client/hotkey.ts'

const results = { pass: 0, fail: 0, failures: [] }
function ok(cond, label) {
  if (cond) results.pass++
  else { results.fail++; results.failures.push(label) }
}
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) results.pass++
  else { results.fail++; results.failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`) }
}

const spec = (code, { ctrl = false, alt = false, shift = false, meta = false } = {}) =>
  ({ code, ctrl, alt, shift, meta })

// ---------- parseCombo ----------
eq(parseCombo('Ctrl+E'), spec('KeyE', { ctrl: true }), 'parses Ctrl+E')
eq(parseCombo('ctrl+shift+e'), spec('KeyE', { ctrl: true, shift: true }), 'parses case-insensitively')
eq(parseCombo('Ctrl+Alt+E'), spec('KeyE', { ctrl: true, alt: true }), 'parses two modifiers')
eq(parseCombo('Meta+F5'), spec('F5', { meta: true }), 'parses a function key')
eq(parseCombo('Ctrl+Digit1'), spec('Digit1', { ctrl: true }), 'parses a digit')
eq(parseCombo('Ctrl+KeyE'), spec('KeyE', { ctrl: true }), 'accepts the physical code form')
for (const bad of ['', '   ', 'E', 'Ctrl+', 'Ctrl++', '+E', 'Ctrl+E+', 'Ctrl+Foo', 'Ctrl+Ctrl+E', 'Ctrl+E+X', 'Ctl+E']) {
  eq(parseCombo(bad), null, `rejects ${JSON.stringify(bad)}`)
}

// ---------- formatCombo ----------
eq(formatCombo(parseCombo('ctrl+e')), 'Ctrl+E', 'formats Ctrl+E')
eq(formatCombo(parseCombo('meta+shift+ctrl+e')), 'Ctrl+Shift+Meta+E', 'formats in canonical modifier order')
eq(formatCombo(parseCombo('alt+digit3')), 'Alt+3', 'formats a digit without the code prefix')

// ---------- specFromEvent ----------
eq(specFromEvent({ code: 'KeyE', ctrlKey: true }), spec('KeyE', { ctrl: true }), 'builds a spec from an event')
eq(specFromEvent({ code: '', key: 'e', ctrlKey: true }), spec('KeyE', { ctrl: true }), 'falls back to event.key')
eq(specFromEvent({ code: 'ShiftLeft', key: 'Shift', shiftKey: true }), null, 'ignores a bare modifier press')
eq(specFromEvent({ code: 'KeyE' }), spec('KeyE'), 'allows a modifier-less spec when the caller asks for one')

// ---------- matches ----------
const ctrlE = spec('KeyE', { ctrl: true })
ok(matches({ code: 'KeyE', ctrlKey: true }, ctrlE), 'matches the bound combination')
ok(!matches({ code: 'KeyE', ctrlKey: true, shiftKey: true }, ctrlE), 'rejects an extra modifier')
ok(!matches({ code: 'KeyE', ctrlKey: true, altKey: true }, ctrlE), 'rejects a missing/extra modifier the other way')
ok(!matches({ code: 'KeyR', ctrlKey: true }, ctrlE), 'rejects another key on the same modifiers')
ok(!matches({ code: 'KeyE' }, ctrlE), 'rejects the same key without the modifier')

// ---------- hotkeyAction ----------
eq(hotkeyAction('idle'), 'start', 'idle starts a recording')
eq(hotkeyAction('error'), 'start', 'an error state restarts')
eq(hotkeyAction('starting'), 'pending', 'starting defers the finish')
eq(hotkeyAction('recording', 'send'), 'finish-send', 'recording finishes by sending')
eq(hotkeyAction('recording', 'insert'), 'finish-insert', 'recording finishes by inserting')
eq(hotkeyAction('processing'), 'ignore', 'processing ignores the press')

// ---------- ignoreReason ----------
const clean = { repeat: false, composing: false, prevented: false, terminal: false, modal: false, hasComposer: true, phase: 'recording' }
eq(ignoreReason(clean), null, 'a clean press belongs to voice input')
for (const [field, value, reason] of [
  ['repeat', true, 'repeat'],
  ['composing', true, 'composing'],
  ['prevented', true, 'prevented'],
  ['terminal', true, 'terminal'],
  ['modal', true, 'modal'],
  ['hasComposer', false, 'no-composer'],
  ['phase', 'processing', 'processing'],
]) {
  eq(ignoreReason({ ...clean, [field]: value }), reason, `ignores ${reason}`)
}

// ---------- config plumbing (no DOM in Node) ----------
eq(getHotkeyLabel(), 'Ctrl+E', 'defaults to Ctrl+E')
eq(installHotkeyLayer()() , undefined, 'installHotkeyLayer() is inert without a window')
setHotkeyConfig({ combo: 'Ctrl+Alt+E', action: 'insert' })
eq(getHotkeyLabel(), 'Ctrl+Alt+E', 'applies a valid combination')
eq(getHotkeyConfig().action, 'insert', 'applies the finish action')
setHotkeyConfig({ combo: 'nonsense', altCombo: '' })
eq(getHotkeyConfig().combo, 'Ctrl+Alt+E', 'keeps the previous combination when the new one is invalid')
eq(getHotkeyConfig().altCombo, '', 'allows clearing the fallback')

// ---------- report ----------
const total = results.pass + results.fail
console.log(`hotkey: ${results.pass}/${total} passed`)
if (results.fail > 0) {
  for (const failure of results.failures) console.error('  FAIL ' + failure)
  process.exit(1)
}