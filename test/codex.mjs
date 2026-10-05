// Codex (ChatGPT subscription) provider tests for the dsh-voice bundle.
//
//   node test/codex.mjs              # offline: drives the built host half
//   DSH_VOICE_LIVE=1 node test/codex.mjs   # + real ChatGPT backend calls
//
// The offline suite mounts lib/index.js on a fake Cordis context (shell/fs/
// webServer doubles), so it exercises the real handlers, the real config
// validation and the real auth-file parsing — only the network is absent.
// The live suite needs a Codex CLI login on this host and calls the ChatGPT
// backend for real; it is skipped unless DSH_VOICE_LIVE=1.
//
// Exit code 0 = all pass.

import { exec as execCb } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LIVE = process.env.DSH_VOICE_LIVE === '1'
const results = { pass: 0, fail: 0, skipped: 0, failures: [] }

function ok(cond, label) {
  if (cond) results.pass++
  else { results.fail++; results.failures.push(label) }
}
function eq(a, b, label) {
  if (JSON.stringify(a) === JSON.stringify(b)) results.pass++
  else { results.fail++; results.failures.push(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`) }
}
function skip(label) { results.skipped++; console.log('  ~ skipped: ' + label) }

// ── fake Cordis context ─────────────────────────────────────────────────────

function makeShellShape() {
  // One command, executed the way a real executor does it: through /bin/bash.
  const spawn = (spec) => new Promise((res) => {
    const child = execCb(spec.command, {
      cwd: spec.workdir || process.cwd(),
      env: { ...process.env, ...(spec.env ?? {}) },
      maxBuffer: spec.stdoutMaxBytes ?? 8 * 1024 * 1024,
      timeout: spec.timeoutMs ?? 30000,
      shell: '/bin/bash',
    }, (err, stdout, stderr) => {
      if (err && err.killed) {
        res({ exitCode: 124, timedOut: true, stdout: { text: stdout ?? '' }, stderr: { text: stderr ?? '' } })
        return
      }
      res({
        exitCode: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
        stdout: { text: stdout ?? '' },
        stderr: { text: stderr ?? '' },
      })
    })
    child.stdin.on('error', () => {})
    child.stdin.end(spec.stdin ?? '')
  })
  // `resolve` fills the fields the executor owns, exactly like the real one.
  const resolve = (request) => ({
    ...request,
    workdir: request.workdir ?? process.cwd(),
    timeoutMs: request.timeoutMs ?? 30000,
    onExpiry: request.onExpiry ?? 'kill',
    stdoutMaxBytes: request.stdoutMaxBytes ?? 8 * 1024 * 1024,
  })
  return { resolve, spawn }
}

// The harness this bundle ships to runs `ctx.shell` in its 0.2 shape:
// `resolve(request)` + `execute(spec)` → a handle whose foreground projection
// is `result()`. `run` no longer exists there. The double therefore does NOT
// define it by default — the earlier double did, which is what hid
// `deps.shell.run is not a function` until it hit a live host.
function makeShell() {
  const { resolve, spawn } = makeShellShape()
  return {
    resolve,
    execute: async (spec) => ({ result: () => spawn(spec) }),
  }
}

// Harness 0.1 seam, kept as the legacy fallback the bundle still supports.
function makeLegacyShell() {
  const { resolve, spawn } = makeShellShape()
  return { resolve, run: (spec) => spawn(spec) }
}

function makeFs() {
  return {
    resolve: async (path) => path,
    readText: async (target) => readFileSync(String(target), 'utf8'),
  }
}

// Warnings the plugin logged through ctx.logger during a mount. Each mount
// appends, so a test reads its own tail.
const mountWarnings = []

async function mount(shell = makeShell(), { workspaceRoot, logger } = {}) {
  const routes = new Map()
  const fs = makeFs()
  const webServer = {
    register(row) {
      routes.set(row.path, row.handler)
      return () => routes.delete(row.path)
    },
  }
  // A mount owns its data root: the plugin persists its settings under
  // <workspaceRoot>/.dsh-voice, and tests must not write into the checkout.
  const root = workspaceRoot ?? mkdtempSync(resolve(tmpdir(), 'dsh-voice-ws-'))
  const ctx = {
    get: (name) => ({ shell, fs, webServer, sandboxPolicy: { workspaceRoot: root } })[name],
    effect: (fn) => { const d = fn(); return () => { if (typeof d === 'function') d() } },
    logger: logger ?? {
      warn: (m) => mountWarnings.push(String(m)),
      info: () => {},
      error: (m) => mountWarnings.push(String(m)),
    },
  }
  const host = await import(resolve(ROOT, 'lib/index.js'))
  host.apply(ctx)
  return routes
}

function call(routes, path, { method = 'GET', body = null } = {}) {
  const handler = routes.get(path)
  if (!handler) return Promise.reject(new Error('route not registered: ' + path))
  return new Promise((res, rej) => {
    const req = new EventEmitter()
    req.method = method
    const response = {
      status: 200,
      writeHead(code) { this.status = code },
      end(payload) {
        let parsed = payload
        try { parsed = JSON.parse(payload) } catch { /* keep raw */ }
        res({ status: this.status, body: parsed })
      },
    }
    Promise.resolve(handler(req, response)).catch(rej)
    // A real IncomingMessage buffers until the handler listens, and the plugin
    // reads the body only after awaiting its settings load — so deliver the
    // payload once the handler actually attaches its `end` listener instead of
    // racing it from the outside.
    let delivered = false
    req.on('newListener', (event) => {
      if (event !== 'end' || delivered) return
      delivered = true
      setImmediate(() => {
        if (body !== null) req.emit('data', JSON.stringify(body))
        req.emit('end')
      })
    })
  })
}

// ── synthetic Codex auth files ──────────────────────────────────────────────

function b64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function fakeJwt({ exp, email = 'user@example.com', plan = 'prolite', accountId = 'acct-123' }) {
  return [
    b64url({ alg: 'RS256', typ: 'JWT' }),
    b64url({
      exp,
      email,
      'https://api.openai.com/auth': { chatgpt_account_id: accountId, chatgpt_plan_type: plan },
    }),
    'signature',
  ].join('.')
}

function writeAuth(dir, name, contents) {
  const path = resolve(dir, name)
  writeFileSync(path, typeof contents === 'string' ? contents : JSON.stringify(contents))
  return path
}

function chatGptAuth({ exp, email, plan } = {}) {
  const token = fakeJwt({ exp: exp ?? Math.floor(Date.now() / 1000) + 3600, email, plan })
  return { auth_mode: 'chatgpt', tokens: { access_token: token, account_id: 'acct-123', refresh_token: 'rt.fake' } }
}

async function main() {
  const routes = await mount()
  const dir = mkdtempSync(resolve(tmpdir(), 'dsh-voice-codex-'))

  // CODEX_HOME drives the default auth path ($CODEX_HOME/auth.json).
  const codexHome = resolve(dir, 'codex-home')
  mkdirSync(codexHome, { recursive: true })
  const previousCodexHome = process.env.CODEX_HOME
  process.env.CODEX_HOME = codexHome

  // ---------- endpoint registration ----------
  for (const path of ['/api/voice/codex-status', '/api/voice/codex-check', '/api/voice/transcribe', '/api/voice/config']) {
    ok(routes.has(path), `route registered: ${path}`)
  }

  // ---------- provider enum accepts codex, rejects anything else ----------
  let r = await call(routes, '/api/voice/config', { method: 'POST', body: { provider: 'codex' } })
  eq(r.body.provider, 'codex', 'config accepts provider "codex"')
  eq(r.body.version, JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version, 'config reports the loaded module version')
  r = await call(routes, '/api/voice/config', { method: 'POST', body: { provider: 'codex; rm -rf /' } })
  eq(r.body.provider, 'codex', 'config rejects an unknown provider string')
  r = await call(routes, '/api/voice/config', {
    method: 'POST',
    body: { codex: { authPath: '', endpoint: 'https://example.invalid/transcribe', model: 'gpt-transcribe' } },
  })
  eq(r.body.codex.endpoint, 'https://example.invalid/transcribe', 'config stores the codex endpoint')
  eq(r.body.codex.model, 'gpt-transcribe', 'config stores the codex model')

  // ---------- status: no login ----------
  r = await call(routes, '/api/voice/codex-status')
  eq(r.body.ok, true, 'codex-status answers ok')
  eq(r.body.status.state, 'missing', 'missing auth.json reports state "missing"')
  eq(r.body.status.authPath, resolve(codexHome, 'auth.json'), 'default auth path follows $CODEX_HOME')
  ok(/codex login/.test(r.body.status.message), 'missing-login message names the fix')
  ok(!('access_token' in (r.body.status ?? {})), 'status never carries token material')

  // ---------- status: a healthy ChatGPT login ----------
  writeFileSync(resolve(codexHome, 'auth.json'), JSON.stringify(chatGptAuth({ email: 'me@example.com', plan: 'prolite' })))
  r = await call(routes, '/api/voice/codex-status')
  eq(r.body.status.state, 'ok', 'valid login reports state "ok"')
  eq(r.body.status.email, 'me@example.com', 'status surfaces the account email')
  eq(r.body.status.plan, 'prolite', 'status surfaces the plan')
  ok(typeof r.body.status.expiresAt === 'number' && r.body.status.expiresAt > Date.now(), 'status surfaces a future expiry')
  ok(!JSON.stringify(r.body).includes('signature'), 'status response carries no JWT material')

  // ---------- status: expired ----------
  writeFileSync(resolve(codexHome, 'auth.json'), JSON.stringify(chatGptAuth({ exp: Math.floor(Date.now() / 1000) - 60 })))
  r = await call(routes, '/api/voice/codex-status')
  eq(r.body.status.state, 'expired', 'expired token reports state "expired"')
  ok(/codex/.test(r.body.status.message), 'expired message names the fix')

  // ---------- status: api-key login, malformed file ----------
  writeFileSync(resolve(codexHome, 'auth.json'), JSON.stringify({ auth_mode: 'apikey', OPENAI_API_KEY: 'sk-fake' }))
  r = await call(routes, '/api/voice/codex-status')
  eq(r.body.status.state, 'api_key', 'API-key login reports state "api_key"')
  writeFileSync(resolve(codexHome, 'auth.json'), '{ not json')
  r = await call(routes, '/api/voice/codex-status')
  eq(r.body.status.state, 'invalid', 'malformed auth.json reports state "invalid"')

  // ---------- a login without an account id stays usable ----------
  // The endpoint falls back to the default account, so this must not block.
  writeFileSync(resolve(codexHome, 'auth.json'), JSON.stringify({
    auth_mode: 'chatgpt',
    tokens: { access_token: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, accountId: null }), refresh_token: 'rt.fake' },
  }))
  r = await call(routes, '/api/voice/codex-status')
  eq(r.body.status.state, 'ok', 'a login without an account id is still usable')

  // ---------- a configured path wins over CODEX_HOME ----------
  const explicit = writeAuth(dir, 'explicit.json', chatGptAuth({ email: 'explicit@example.com' }))
  await call(routes, '/api/voice/config', { method: 'POST', body: { codex: { authPath: explicit } } })
  r = await call(routes, '/api/voice/codex-status')
  eq(r.body.status.authPath, explicit, 'configured authPath wins over $CODEX_HOME')
  eq(r.body.status.email, 'explicit@example.com', 'configured authPath is the file that gets read')

  // ---------- the configured path is shell-quoted, never interpolated ----------
  const pwned = resolve(dir, 'pwned')
  await call(routes, '/api/voice/config', { method: 'POST', body: { codex: { authPath: '/nonexistent; touch ' + pwned } } })
  r = await call(routes, '/api/voice/codex-status')
  eq(r.body.status.state, 'missing', 'a hostile authPath degrades to "missing"')
  ok(!existsSync(pwned), 'a hostile authPath is quoted and cannot execute a command')
  await call(routes, '/api/voice/config', { method: 'POST', body: { codex: { authPath: '' } } })

  // ---------- transcribe fails loudly without a login ----------
  // Real silence, so the pipeline reaches the provider instead of failing in ffmpeg.
  writeFileSync(resolve(codexHome, 'auth.json'), JSON.stringify({ auth_mode: 'apikey', OPENAI_API_KEY: 'sk-fake' }))
  r = await call(routes, '/api/voice/transcribe', { method: 'POST', body: { dataBase64: silenceWavBase64(), mimeType: 'audio/wav' } })
  eq(r.body.ok, false, 'transcribe without a ChatGPT login fails')
  ok(/API key|codex login/i.test(r.body.error ?? ''), 'failure explains the API-key/chatgpt-login mix-up (got: ' + (r.body.error ?? '') + ')')

  // ---------- harness 0.1 seam: the legacy run() fallback still works ----------
  // The same bundle also has to serve a host still running the older shell
  // seam, where the executor is `resolve()` + `run()` and has no `execute()`.
  const legacyRoutes = await mount(makeLegacyShell())
  r = await call(legacyRoutes, '/api/voice/models')
  eq(r.body.ok, true, 'legacy shell seam: /api/voice/models answers ok (got: ' + (r.body.error ?? '') + ')')
  ok(typeof r.body.platform?.os === 'string', 'legacy shell seam: platform detection ran commands through run()')

  // ---------- settings survive a restart (and a plugin re-mount) ----------
  const stateRoot = mkdtempSync(resolve(tmpdir(), 'dsh-voice-state-'))
  const firstBoot = await mount(undefined, { workspaceRoot: stateRoot })
  await call(firstBoot, '/api/voice/config', {
    method: 'POST',
    body: {
      provider: 'api',
      language: 'ru',
      api: { url: 'https://example.invalid/v1/audio/transcriptions', model: 'gpt-4o-mini-transcribe' },
      codex: { endpoint: 'https://example.invalid/transcribe' },
    },
  })
  const keyPosted = await call(firstBoot, '/api/voice/api-key', { method: 'POST', body: { key: 'sk-secret-test' } })
  eq(keyPosted.body.hasKey, true, 'api-key endpoint reports hasKey')

  const stateFile = resolve(stateRoot, '.dsh-voice/state.json')
  ok(existsSync(stateFile), 'settings are written to <workspaceRoot>/.dsh-voice/state.json')
  eq(statSync(stateFile).mode & 0o777, 0o600, 'the settings file is 0600 (it holds the host-only API key)')

  // A fresh mount on the same root is exactly what a `dsh web` restart does.
  const secondBoot = await mount(undefined, { workspaceRoot: stateRoot })
  r = await call(secondBoot, '/api/voice/config')
  eq(r.body.provider, 'api', 'a restart keeps the provider')
  eq(r.body.language, 'ru', 'a restart keeps the language')
  eq(r.body.api.url, 'https://example.invalid/v1/audio/transcriptions', 'a restart keeps the API URL')
  eq(r.body.api.model, 'gpt-4o-mini-transcribe', 'a restart keeps the API model')
  eq(r.body.codex.endpoint, 'https://example.invalid/transcribe', 'a restart keeps the codex endpoint')
  eq(r.body.api.hasKey, true, 'a restart keeps the API key, reported as hasKey only')
  ok(!JSON.stringify(r.body).includes('sk-secret-test'), 'the API key never reaches the page')

  // A damaged file degrades to defaults instead of breaking every route.
  writeFileSync(stateFile, '{ not json')
  const thirdBoot = await mount(undefined, { workspaceRoot: stateRoot })
  r = await call(thirdBoot, '/api/voice/config')
  eq(r.body.ok, true, 'a damaged settings file still answers')
  eq(r.body.provider, 'tcpp', 'a damaged settings file falls back to defaults')
  ok(mountWarnings.some((w) => w.includes(stateFile)), 'the damaged settings file is reported through the logger')

  // ---------- the host half refuses Windows (ctx.shell there is PowerShell) ----------
  const realPlatform = process.platform
  const windowsWarnings = []
  let windowsRoutes = null
  try {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    windowsRoutes = await mount(undefined, {
      logger: { warn: (m) => windowsWarnings.push(String(m)), info: () => {}, error: () => {} },
    })
  } finally {
    Object.defineProperty(process, 'platform', { value: realPlatform })
  }
  eq(windowsRoutes.size, 0, 'no /api/voice/* route is registered on Windows')
  ok(windowsWarnings.join(' ').includes('Windows'), 'the Windows refusal names the platform')

  // ---------- live: real login, real endpoint ----------
  const realAuth = resolve(process.env.CODEX_HOME_REAL ?? resolve(homedir(), '.codex'), 'auth.json')
  if (!LIVE) {
    skip('live codex-check (set DSH_VOICE_LIVE=1 and log in with the Codex CLI)')
  } else if (!existsSync(realAuth)) {
    results.fail++
    results.failures.push('live: no Codex login at ' + realAuth)
  } else {
    process.env.CODEX_HOME = dirname(realAuth)
    await call(routes, '/api/voice/config', {
      method: 'POST',
      body: { provider: 'codex', codex: { authPath: realAuth, endpoint: 'https://chatgpt.com/backend-api/transcribe' } },
    })
    r = await call(routes, '/api/voice/codex-status')
    eq(r.body.status.state, 'ok', 'live: real Codex login is usable')
    console.log('  · live account: ' + (r.body.status.email ?? '?') + ' (' + (r.body.status.plan ?? '?') + ')')

    r = await call(routes, '/api/voice/codex-check')
    ok(r.body.ok === true, 'live: codex-check reaches the endpoint (got: ' + (r.body.error ?? r.body.message) + ')')

    // A real recording when one is available, otherwise 1 s of silence: both
    // must return ok, and a speech sample must yield non-empty text.
    const sample = findDictationSample()
    if (sample) {
      const dataBase64 = readFileSync(sample.path).toString('base64')
      r = await call(routes, '/api/voice/transcribe', { method: 'POST', body: { dataBase64, mimeType: 'audio/webm;codecs=opus' } })
      ok(r.body.ok === true, 'live: transcribe of a real recording succeeds (got: ' + (r.body.error ?? '') + ')')
      ok((r.body.text ?? '').length > 0, 'live: transcript is non-empty (' + JSON.stringify((r.body.text ?? '').slice(0, 60)) + ')')
      console.log('  · live transcript: ' + JSON.stringify(r.body.text ?? ''))
    } else {
      skip('live transcribe of speech (no dictation sample found)')
    }

    // Bogus credentials must fail with the refresh hint, not a hang.
    const bogus = writeAuth(dir, 'bogus.json', chatGptAuth({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    const bogusTokens = JSON.parse(readFileSync(bogus, 'utf8'))
    bogusTokens.tokens.access_token = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }).replace('signature', 'nope')
    writeFileSync(bogus, JSON.stringify(bogusTokens))
    await call(routes, '/api/voice/config', { method: 'POST', body: { codex: { authPath: bogus } } })
    r = await call(routes, '/api/voice/transcribe', { method: 'POST', body: { dataBase64: silenceWavBase64(), mimeType: 'audio/wav' } })
    eq(r.body.ok, false, 'live: a rejected token fails the request')
    ok(/401|codex login/i.test(r.body.error ?? ''), 'live: rejection message explains the fix (got: ' + (r.body.error ?? '') + ')')
  }

  if (previousCodexHome === undefined) delete process.env.CODEX_HOME
  else process.env.CODEX_HOME = previousCodexHome
  rmSync(dir, { recursive: true, force: true })

  // ---------- summary ----------
  const total = results.pass + results.fail
  console.log(`\n${results.pass}/${total} assertions passed${results.fail ? `, ${results.fail} failed` : ''}${results.skipped ? `, ${results.skipped} skipped` : ''}`)
  if (results.fail) {
    for (const f of results.failures) console.log('  ✗ ' + f)
    process.exit(1)
  }
  console.log(LIVE ? 'All codex tests passed (live).' : 'All codex tests passed (offline).')
}

/** Newest dictation recording with transcribed speech, if the host has one. */
function findDictationSample() {
  const root = resolve(process.env.CODEX_HOME_REAL ?? resolve(homedir(), '.codex'), 'dictation-history')
  if (!existsSync(root)) return null
  let best = null
  for (const entry of readdirSync(root)) {
    const meta = resolve(root, entry, 'metadata.json')
    const chunk = resolve(root, entry, '0000000000.chunk')
    if (!existsSync(meta) || !existsSync(chunk)) continue
    try {
      const parsed = JSON.parse(readFileSync(meta, 'utf8'))
      if (!parsed.text) continue
      if (best === null || (parsed.createdAtMs ?? 0) > best.at) best = { at: parsed.createdAtMs ?? 0, path: chunk, text: parsed.text }
    } catch { /* ignore unusable entries */ }
  }
  return best
}

function readdirSafe(path) {
  try { return readdirSync(path) } catch { return [] }
}

/** 1 s of 16 kHz mono silence as a WAV data URL payload (base64 only). */
function silenceWavBase64() {
  const rate = 16000
  const samples = rate
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples * 2, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(rate, 24)
  buffer.writeUInt32LE(rate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  return buffer.toString('base64')
}

main().catch((e) => { console.error(e); process.exit(1) })
