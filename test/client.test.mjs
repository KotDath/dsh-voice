// Client-side unit tests for dsh-voice (recorder flow).
//
// Compiles the same src/client/* modules that ship in dist/client.js into an
// in-memory bundle, appends a small driver that exposes the internal recorder
// API, runs apply(ctx) with mocked slots, and drives startRecording /
// cancelRecording / stopWith against mocked browser APIs (getUserMedia,
// MediaRecorder, Blob, FileReader, host.call).
//
//   node test/client.test.mjs
//
// Exit code 0 = all pass.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8')

const CLIENT_MODULES = [
  'src/client/style.js',
  'src/client/state.js',
  'src/client/icons.js',
  'src/client/recorder.js',
  'src/client/waveform.js',
  'src/client/components.js',
  'src/client/settings.js',
  'src/client/slots.js',
]

const results = { pass: 0, fail: 0, failures: [] }
function ok(cond, label) {
  if (cond) results.pass++
  else { results.fail++; results.failures.push(label) }
}
function eq(a, b, label) {
  if (JSON.stringify(a) === JSON.stringify(b)) results.pass++
  else { results.fail++; results.failures.push(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`) }
}
function stats() { return { ...results } }

// Fake MediaRecorder: fires dataavailable on start, stop event on stop().
function fakeMediaRecorderClass() {
  return class FakeMediaRecorder {
    constructor(stream, opts) {
      this.stream = stream
      this.mimeType = (opts && opts.mimeType) || 'audio/webm'
      this.state = 'inactive'
      this.listeners = {}
      this.ondataavailable = null
      this.onstop = null
    }
    start() { this.state = 'recording'; this.ondataavailable && this.ondataavailable({ data: { size: 100 } }) }
    stop() {
      this.state = 'inactive'
      if (this.onstop) this.onstop({})
      else if (this.listeners.stop) for (const l of this.listeners.stop) l({})
    }
    addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn) }
    static isTypeSupported() { return true }
  }
}

// Fake stream with stoppable tracks.
function fakeStream() {
  const tracks = [{ stop() { this._stopped = true }, _stopped: false }, { stop() { this._stopped = true }, _stopped: false }]
  return { getTracks: () => tracks, tracks }
}

function makeClientBundle({ transcribeResult, setDraftImpl, submitImpl }) {
  const body = CLIENT_MODULES.map(read).join('\n\n')
  const driver = `
;(function exposeInternals() {
  globalThis.__VOICE_TEST__ = { voice, startRecording, cancelRecording, stopWith }
})()
`
  let src = read('src/client/index.js').split('/* __BODY__ */').join(body + '\n' + driver)

  // --- mocks ---------------------------------------------------------------
  const slotRegistrations = []
  const slots = {
    inject(name, fn) { slotRegistrations.push({ name, fn }) },
    register() { return function RegisteredComponent() { return null } },
  }

  let draft = ''
  const inputActions = {
    setDraft: (t) => { draft = t; if (setDraftImpl) setDraftImpl(t) },
    submit: () => { if (submitImpl) submitImpl() },
  }
  const input = { draft: '' }

  const hostCalls = []
  const host = {
    async call(method, args) {
      hostCalls.push({ method, args })
      if (transcribeResult && typeof transcribeResult === 'function') return transcribeResult(method, args)
      return { ok: true, text: 'hello world' }
    },
  }

  // React stub sufficient for module eval + useVoice subscription.
  const ReactStub = {
    createElement: () => ({ __react: true }),
    useReducer: (reducer, init) => { const v = [0, () => {}]; return v },
    useState: (init) => [init, () => {}],
    useEffect: () => {},
    useRef: () => ({ current: null }),
  }

  // Browser globals.
  const MediaRecorderStub = fakeMediaRecorderClass()
  Object.defineProperty(globalThis, 'navigator', {
    value: { mediaDevices: { getUserMedia: async () => fakeStream() } },
    configurable: true, writable: true,
  })
  globalThis.MediaRecorder = MediaRecorderStub
  globalThis.Blob = class { constructor(parts, opts) { this.type = (opts && opts.type) || '' } }
  globalThis.FileReader = class {
    readAsDataURL() {
      this.result = 'data:audio/webm;base64,AAAA'
      this.onload && this.onload({ target: { result: this.result } })
    }
  }
  globalThis.AudioContext = class {
    constructor() { this.state = 'running' }
    createMediaStreamSource() { return { connect() {} } }
    createAnalyser() { return { fftSize: 128, frequencyBinCount: 64 } }
    close() { this.state = 'closed' }
  }
  globalThis.styles = { insert: () => {} }

  const factory = new Function('React', 'host', 'slots', src)
  const plugin = factory(ReactStub, host, slots)
  const applyCtx = { get(name) { if (name === 'slots') return slots; return undefined } }
  plugin.apply(applyCtx)

  return {
    test: globalThis.__VOICE_TEST__,
    hostCalls,
    getDraft: () => draft,
    slotRegistrations,
    // Mirror what the slot components do: bind composer state into voice.
    bindComposer() {
      globalThis.__VOICE_TEST__.voice.inputActions = inputActions
      globalThis.__VOICE_TEST__.voice.input = input
    },
  }
}

async function tick(ms = 20) { await new Promise((r) => setTimeout(r, ms)) }

async function main() {
  // ---------- recording starts and exposes a pill state ----------
  const b1 = makeClientBundle({})
  await b1.test.startRecording()
  await tick()
  eq(b1.test.voice.phase, 'recording', 'startRecording reaches recording phase')
  ok(!!b1.test.voice.rec, 'recorder object assigned')

  // ---------- cancel stops the mic and returns to idle ----------
  await b1.test.cancelRecording()
  await tick()
  eq(b1.test.voice.phase, 'idle', 'cancel returns to idle')
  const tracks = b1.test.voice.rec ? b1.test.voice.rec.stream.tracks : []
  // rec is nulled on cancel; verify the stream that WAS captured got stopped
  // (we can't reach it after nulling — assert via absence of lingering rec)
  ok(b1.test.voice.rec === null, 'rec cleared after cancel')

  // ---------- stop-with-insert appends to draft ----------
  const b2 = makeClientBundle({})
  b2.bindComposer()
  await b2.test.startRecording()
  await tick()
  await b2.test.stopWith('insert')
  await tick()
  eq(b2.test.voice.phase, 'idle', 'insert finishes to idle')
  eq(b2.getDraft(), 'hello world', 'transcribed text inserted into draft')
  eq(b2.hostCalls[0] && b2.hostCalls[0].method, 'voice/transcribe', 'transcribe RPC called')

  // ---------- stop-with-send submits ----------
  let submitted = false
  const b3 = makeClientBundle({ submitImpl: () => { submitted = true } })
  b3.bindComposer()
  await b3.test.startRecording()
  await tick()
  await b3.test.stopWith('send')
  await tick()
  ok(submitted, 'send mode calls submit()')

  // ---------- missing mic surfaces a friendly error ----------
  const b4 = makeClientBundle({})
  globalThis.navigator.mediaDevices.getUserMedia = async () => { throw new Error('NotAllowedError') }
  await b4.test.startRecording()
  await tick()
  eq(b4.test.voice.phase, 'error', 'mic denial surfaces error phase')
  ok(/NotAllowedError/.test(b4.test.voice.error || ''), 'error message preserved')

  // ---------- slot registration completeness ----------
  const b5 = makeClientBundle({})
  const names = b5.slotRegistrations.map((s) => s.name)
  for (const n of ['conversation.input.right', 'conversation.input.dock', 'settings.section']) {
    ok(names.includes(n), `slot registered: ${n}`)
  }

  // ---------- summary ----------
  const s = stats()
  console.log(`\n${s.pass}/${s.pass + s.fail} assertions passed${s.fail ? `, ${s.fail} failed` : ''}`)
  if (s.fail) {
    for (const f of s.failures) console.log('  ✗ ' + f)
    process.exit(1)
  }
  console.log('All client tests passed.')
}

main().catch((e) => { console.error(e); process.exit(1) })
