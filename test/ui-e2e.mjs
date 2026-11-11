// Browser end-to-end check of the dictation UI (Playwright + a real dsh web).
//
// Not part of `npm test`: it needs `playwright-core`, a running Harness and a
// Chrome build. It proves the things unit tests cannot — that the composer's own
// submit button really becomes clickable while recording, that a press sends
// when the draft is empty and splices at the caret when it is not, and that a
// cancel leaves the model seat alone. The transcription endpoint is stubbed, so
// no engine, model or network is involved.
//
//   npm i -D playwright-core            # once
//   DSH_VOICE_E2E_URL='http://127.0.0.1:3099/?token=…' node test/ui-e2e.mjs
//
// Optional: DSH_VOICE_E2E_CHROME (default /usr/bin/google-chrome),
//           DSH_VOICE_E2E_SHOTS (default <tmp>/dsh-voice-e2e-shots),
//           DSH_VOICE_E2E_PLAYWRIGHT (module specifier or path, default
//           `playwright-core` — a path lets a scratch install be used without
//           adding the dependency to this package).

import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const GUI = process.env.DSH_VOICE_E2E_URL ?? ''
const CHROME = process.env.DSH_VOICE_E2E_CHROME ?? '/usr/bin/google-chrome'
const SHOTS = process.env.DSH_VOICE_E2E_SHOTS ?? join(tmpdir(), 'dsh-voice-e2e-shots')
if (GUI === '') {
  console.error('DSH_VOICE_E2E_URL is required (e.g. "http://127.0.0.1:3099/?token=…")')
  process.exit(2)
}
mkdirSync(SHOTS, { recursive: true })
const ORIGIN = new URL(GUI).origin

const PLAYWRIGHT = process.env.DSH_VOICE_E2E_PLAYWRIGHT ?? 'playwright-core'
const playwright = await import(PLAYWRIGHT).catch((error) => {
  console.error(`cannot load ${PLAYWRIGHT}: ${error.message}\n  npm i -D playwright-core`)
  process.exit(2)
})
// A CJS entry exposes the API on `default`; the ESM entry exposes it directly.
const chromium = playwright.chromium ?? playwright.default?.chromium
const TRANSCRIPT = 'проверка диктовки'

const results = []
const ok = (cond, label, extra = '') => {
  results.push({ ok: Boolean(cond), label: label + (extra ? ' — ' + extra : '') })
  console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? ' — ' + extra : ''))
}

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-sandbox'],
})
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
await context.grantPermissions(['microphone'], { origin: ORIGIN })
const page = await context.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)))
page.on('console', (m) => { if (m.text().includes('dsh-voice')) console.log('[console]', m.text().slice(0, 300)) })

let transcribeCalls = 0
await page.route('**/api/voice/transcribe', async (route) => {
  transcribeCalls += 1
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, text: TRANSCRIPT }),
  })
})

await page.goto(GUI, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('[data-composer-card]', { timeout: 20000 })
// First-run chrome: the preview banner is modal and makes the composer inert.
await page.waitForSelector('[role="dialog"], [data-composer-card]', { timeout: 20000 })
await page.waitForTimeout(1500)
const cont = page.getByRole('button', { name: 'Continue' })
if (await cont.count()) {
  await cont.first().click()
  await page.waitForTimeout(1500)
}
const stillModal = await page.evaluate(() => document.querySelectorAll('[inert]').length)
ok(stillModal === 0, 'setup: the composer is interactive', `inert=${stillModal}`)

const card = page.locator('[data-composer-card]').last()
const editor = card.locator('[contenteditable="true"]').first()
const mic = card.locator('button[class*="voiceMic"]').first()
const primary = card.locator('button').last()
const submit = card.locator('[data-dsh-voice-submit]')
const model = card.locator('button[aria-label="Select model"]')

const shot = async (name) => {
  const box = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-composer-card]'))
    const visible = cards.filter((c) => c.getBoundingClientRect().width > 0)
    const card = visible[visible.length - 1]
    if (!card) return null
    const r = card.getBoundingClientRect()
    return { x: Math.max(0, r.x - 16), y: Math.max(0, r.y - 12), width: r.width + 32, height: r.height + 40 }
  })
  if (box) await page.screenshot({ path: `${SHOTS}/${name}.png`, clip: box })
}

const state = () => page.evaluate(() => {
  const card = document.querySelectorAll('[data-composer-card]')
  const last = card[card.length - 1]
  const buttons = Array.from(last.querySelectorAll('button'))
  const primary = buttons[buttons.length - 1]
  const editor = last.querySelector('[contenteditable="true"]')
  const modelSlot = last.querySelector('[data-slot="conversation.input.model"]')
  const model = modelSlot?.querySelector('button') ?? null
  return {
    recording: document.documentElement.hasAttribute('data-dsh-voice-recording'),
    marks: last.querySelectorAll('[data-dsh-voice-submit]').length,
    primaryDisabled: primary?.disabled ?? null,
    primaryIsSubmitMarked: primary?.hasAttribute('data-dsh-voice-submit') ?? null,
    modelDisabled: modelSlot?.querySelector('button')?.disabled ?? null,
    // The slot anchor is `display: contents`, so its own rect is always empty:
    // measure the seat's button instead.
    modelVisible: model ? model.getBoundingClientRect().width > 0 : null,
    modelClicked: modelSlot !== null,
    text: (editor?.textContent ?? '').trim(),
    strip: last.querySelectorAll('[class*="voiceStrip"]').length,
  }
})

// ── 1. idle ────────────────────────────────────────────────────────────────
let s = await state()
ok(s.primaryDisabled === true, 'idle: native send is disabled with an empty draft')
ok(s.recording === false && s.marks === 0, 'idle: no recording attribute, nothing borrowed')
await shot('10-idle')


// ── 2. recording starts from the mic ───────────────────────────────────────
await mic.click()
await page.waitForTimeout(1200)
s = await state()
ok(s.recording === true, 'recording: data-dsh-voice-recording is set')
ok(s.strip > 0, 'recording: the in-row strip (cancel + waveform) is mounted')
ok(s.marks === 1 && s.primaryIsSubmitMarked === true, 'recording: the resident submit is borrowed')
ok(s.primaryDisabled === false, 'recording: the native send button is ACTIVE')
ok(s.modelVisible === false, 'recording: the model select steps aside')
await shot('11-recording')


// ── 3. press the native send with an empty draft → send ────────────────────
await submit.click()
await page.waitForTimeout(2500)
const afterSend = await state()
ok(transcribeCalls === 1, 'send: exactly one transcription request', `calls=${transcribeCalls}`)
ok(afterSend.recording === false, 'send: recording state cleared')
ok(afterSend.text === '', 'send: the composer draft was consumed instead of keeping the text', JSON.stringify(afterSend.text))
const bodyText = await page.locator('body').innerText()
ok(bodyText.includes(TRANSCRIPT), 'send: the transcript went out as the message')
await shot('12-sent')

// a session exists now: re-grab the (possibly new) composer
await page.waitForTimeout(1500)
const card2 = page.locator('[data-composer-card]').last()
const editor2 = card2.locator('[contenteditable="true"]').first()
const mic2 = card2.locator('button[class*="voiceMic"]').first()
const primary2 = card2.locator('button').last()

// ── 4. dictation into a non-empty draft goes to the caret, not the end ─────
await editor2.click()
await page.keyboard.type('aaa bbb')
await page.keyboard.press('ArrowLeft')
await page.keyboard.press('ArrowLeft')
await page.keyboard.press('ArrowLeft')
await mic2.click()
await page.waitForTimeout(1200)
s = await state()
ok(s.primaryDisabled === false, 'draft+recording: the native send is active')
const dbg = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('[data-composer-card]'))
  const visible = cards.filter((c) => c.getBoundingClientRect().width > 0)
  const ed = visible[visible.length - 1]?.querySelector('[contenteditable="true"]')
  return { cards: cards.length, editors: visible[visible.length - 1]?.querySelectorAll('[contenteditable="true"]').length, text: ed?.textContent ?? null, html: (ed?.innerHTML ?? '').slice(0, 120) }
})
console.log('[debug] draft dom:', JSON.stringify(dbg))
const before = await card2.locator('[contenteditable="true"]').first().innerText()
ok(before.includes('aaa bbb'), 'draft+recording: the typed draft is untouched while recording', JSON.stringify(before))
await shot('13-recording-with-draft')


await card2.locator('[data-dsh-voice-submit]').click()
await page.waitForTimeout(2500)
const spliced = (await card2.locator('[contenteditable="true"]').first().innerText()).trim()
ok(spliced === `aaa ${TRANSCRIPT} bbb`, 'draft: the transcript was spliced at the caret', JSON.stringify(spliced))
ok(transcribeCalls === 2, 'draft: press did not send (insert-only path)', `calls=${transcribeCalls}`)
await shot('14-inserted')


// ── 5. cancel leaves the composer exactly as it was ───────────────────────
await mic2.click()
await page.waitForTimeout(1200)
s = await state()
ok(s.recording === true && s.marks === 1, 'cancel: recording started')
await card2.locator('button[title="Cancel recording"]').click()
await page.waitForTimeout(1200)
s = await state()
ok(s.recording === false, 'cancel: the recording attribute is gone')
ok(s.marks === 0, 'cancel: the submit button was handed back')
ok(s.modelVisible === true, 'cancel: the model select is visible again')
ok(s.modelDisabled === false, 'cancel: the model select is interactive again', `disabled=${s.modelDisabled}`)
ok(s.primaryDisabled === false, 'cancel: the draft still holds text, so the send stays enabled')
await shot('15-after-cancel')


// ── 6. ⏹ inserts without sending, even with an empty draft ────────────────
await card2.locator('[contenteditable="true"]').first().click()
await page.keyboard.press('Control+a')
await page.keyboard.press('Delete')
await page.waitForTimeout(400)
const cleared = (await card2.locator('[contenteditable="true"]').first().innerText()).trim()
ok(cleared === '', 'setup: the draft was cleared before the stop-button case', JSON.stringify(cleared))
await mic2.click()
await page.waitForTimeout(1200)
await card2.locator('button[title="Stop and insert text"]').click()
await page.waitForTimeout(2500)
const inserted = (await card2.locator('[contenteditable="true"]').first().innerText()).trim()
ok(inserted === TRANSCRIPT, 'stop button: inserted without sending', JSON.stringify(inserted))
ok(transcribeCalls === 3, 'stop button: one more transcription only')
await shot('16-stop-insert')


// ── 7. Ctrl+E twice sends, like a press on the submit button ──────────────
await card2.locator('[contenteditable="true"]').first().click()
await page.keyboard.press('Control+a')
await page.keyboard.press('Delete')
await page.waitForTimeout(400)
await page.keyboard.press('Control+e')
await page.waitForTimeout(1400)
s = await state()
ok(s.recording === true, 'hotkey: Ctrl+E starts a recording')
await page.keyboard.press('Control+e')
await page.waitForTimeout(2500)
const hotkeyBody = await page.locator('body').innerText()
ok(transcribeCalls === 4, 'hotkey: the second press transcribed', `calls=${transcribeCalls}`)
ok(hotkeyBody.includes(TRANSCRIPT), 'hotkey: the transcript was sent')
await shot('17-hotkey-sent')

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed (screenshots: ${SHOTS})`)
process.exit(failed.length === 0 ? 0 : 1)
