/**
 * dsh-voice — Node half.
 *
 * Registers the /api/voice/* HTTP endpoints on the host webserver (the
 * browser half calls them with plain fetch). All transcription, engine and
 * model management happens here:
 *
 *   GET  /api/voice/config            — current public config (no API key)
 *   POST /api/voice/config            — apply a sanitized config patch
 *   POST /api/voice/api-key           — set/clear the host-only API key
 *   GET  /api/voice/models            — model catalog + engine/platform state
 *   POST /api/voice/download          — start a model download
 *   POST /api/voice/engine-download   — download/verify the transcribe-cli engine
 *   GET  /api/voice/download-status   — poll active downloads
 *   POST /api/voice/transcribe        — audio base64 → text
 *
 * @module dsh-voice
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the ctx.webServer Context merge from dsh-host-webserver.
import type {} from '@deepseek-ai/dsh-host-webserver'
// Type-only: ctx.shell (ShellExecutor) and ctx.fs (FileSystem) Context merges.
import type {} from '@deepseek-ai/dsh-shell'
import type {} from '@deepseek-ai/dsh-fs'
import { CATALOG, type CatalogEntry } from './generated-catalog.ts'
import { invariant } from './invariant.ts'

export type {
  VoiceConfigView, VoiceModelView, VoiceModelsView, VoiceTranscribeView, VoiceDownloadView,
} from './types.ts'
export { CATALOG } from './generated-catalog.ts'
export { invariant } from './invariant.ts'

/** Plugin name (row id `voice` in cordis.patch.yml). */
export const name = 'dsh-voice'

// ── config schema (all user-controllable strings validated here) ────────────

const LANGUAGE_CODES = { auto: 1, ru: 1, en: 1, uk: 1, de: 1 } as const
const PROVIDERS = { tcpp: 1, local: 1, api: 1 } as const

interface VoiceConfig {
  provider: 'tcpp' | 'local' | 'api'
  language: keyof typeof LANGUAGE_CODES
  tcpp: { binary: string; modelsDir: string; modelId: string; engineUrl: string }
  local: { binary: string; model: string }
  api: { url: string; model: string; key: string }
}

interface VoiceConfigPatch {
  provider?: unknown
  language?: unknown
  tcpp?: Record<string, unknown>
  local?: Record<string, unknown>
  api?: Record<string, unknown>
}

function publicConfigView(config: VoiceConfig) {
  return {
    provider: config.provider,
    language: config.language,
    tcpp: { ...config.tcpp },
    local: { ...config.local },
    api: { url: config.api.url, model: config.api.model, hasKey: config.api.key !== '' },
  }
}

function applyConfigPatch(config: VoiceConfig, patch: VoiceConfigPatch | null | undefined): void {
  if (!patch || typeof patch !== 'object') return
  if (typeof patch.provider === 'string' && (PROVIDERS as Record<string, number>)[patch.provider]) {
    config.provider = patch.provider as VoiceConfig['provider']
  }
  if (typeof patch.language === 'string' && (LANGUAGE_CODES as Record<string, number>)[patch.language]) {
    config.language = patch.language as VoiceConfig['language']
  }
  const groups: Array<'tcpp' | 'local' | 'api'> = ['tcpp', 'local', 'api']
  for (const g of groups) {
    const p = patch[g]
    if (p && typeof p === 'object') {
      if (typeof p.binary === 'string' && g !== 'api') config[g].binary = p.binary.trim()
      if (g === 'tcpp' && typeof p.modelsDir === 'string') config.tcpp.modelsDir = p.modelsDir.trim()
      if (g === 'tcpp' && typeof p.engineUrl === 'string') config.tcpp.engineUrl = p.engineUrl.trim()
      if (g === 'tcpp' && typeof p.modelId === 'string') config.tcpp.modelId = p.modelId.trim()
      if (g === 'local' && typeof p.model === 'string') config.local.model = p.model.trim()
      if (g === 'api' && typeof p.url === 'string') config.api.url = p.url.trim()
      if (g === 'api' && typeof p.model === 'string') config.api.model = p.model.trim()
    }
  }
}

// ── shell helpers (safe quoting, execution, file probes) ────────────────────

function q(s: string): string {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`') + '"'
}

interface ShellDeps {
  shell: { resolve(request: unknown): unknown; run(spec: unknown): Promise<{ exitCode: number; timedOut?: boolean; stdout?: { text?: string }; stderr?: { text?: string } }> }
}

interface CmdResult { stdout?: { text?: string }; stderr?: { text?: string } }

async function runCmd(deps: ShellDeps, command: string, opts: { workdir?: string; stdin?: string; timeoutMs?: number; env?: Record<string, string> } = {}): Promise<CmdResult> {
  const spec = deps.shell.resolve({
    command,
    workdir: opts.workdir,
    stdin: opts.stdin,
    timeoutMs: opts.timeoutMs ?? 30000,
    stdoutMaxBytes: 4 * 1024 * 1024,
    env: opts.env,
  })
  const result = await deps.shell.run(spec)
  if (result.exitCode !== 0) {
    const stderrText = result.stderr?.text ?? ''
    const stdoutText = result.stdout?.text ?? ''
    throw new Error('command failed (exit ' + result.exitCode + (result.timedOut ? ', timeout' : '') + '): ' + (stderrText || stdoutText || '').slice(0, 400))
  }
  return result
}

async function fileSize(deps: ShellDeps, p: string): Promise<number> {
  const r = await runCmd(deps, 'wc -c < ' + q(p), { timeoutMs: 10000 })
  return parseInt(String(r.stdout?.text ?? '').trim(), 10) || 0
}

async function fileExists(deps: ShellDeps, p: string): Promise<boolean> {
  try {
    await runCmd(deps, 'test -f ' + q(p), { timeoutMs: 10000 })
    return true
  } catch {
    return false
  }
}

async function sha256(deps: ShellDeps, path: string): Promise<string> {
  // Best-effort; empty string means unavailable. macOS has no sha256sum, so
  // fall back to `shasum -a 256` (same first-token output format).
  try {
    const r = await runCmd(deps, '(sha256sum ' + q(path) + ' 2>/dev/null || shasum -a 256 ' + q(path) + ' 2>/dev/null) || true', { timeoutMs: 60000 })
    return String(r.stdout?.text ?? '').trim().split(/\s+/)[0] ?? ''
  } catch {
    return ''
  }
}

// ── platform detection & engine asset naming ────────────────────────────────

interface PlatformInfo { os: 'linux' | 'macos' | 'windows'; arch: string }

async function detectPlatform(deps: ShellDeps): Promise<PlatformInfo> {
  const osR = await runCmd(deps, 'uname -s', { timeoutMs: 10000 })
  const archR = await runCmd(deps, 'uname -m', { timeoutMs: 10000 })
  const os = String(osR.stdout?.text ?? '').trim().toLowerCase()
  const arch = String(archR.stdout?.text ?? '').trim().toLowerCase()
  let platform: PlatformInfo['os'] = 'linux'
  const archName = arch === 'x86_64' || arch === 'amd64' ? 'x86_64' : (arch === 'aarch64' || arch === 'arm64' ? 'arm64' : arch)
  if (os.indexOf('darwin') >= 0) platform = 'macos'
  else if (os.indexOf('mingw') >= 0 || os.indexOf('msys') >= 0 || os.indexOf('windows') >= 0) platform = 'windows'
  return { os: platform, arch: archName }
}

async function engineUrl(config: VoiceConfig, deps: ShellDeps): Promise<string> {
  const p = await detectPlatform(deps)
  let url = config.tcpp.engineUrl.replace('{platform}', p.os).replace('{arch}', p.arch)
  if (p.os === 'windows' && !/\.exe$/i.test(url)) url += '.exe'
  return url
}

// ── Hugging Face cache discovery ────────────────────────────────────────────

let hfCache: { at: number; map: Record<string, string> } | null = null

async function refreshHfCache(deps: ShellDeps): Promise<Record<string, string>> {
  try {
    const cmd = 'ls -d "$HOME"/.cache/huggingface/hub/models--*/snapshots/*/*.gguf 2>/dev/null || true'
    const r = await runCmd(deps, cmd, { timeoutMs: 30000 })
    const out = String(r.stdout?.text ?? '')
    const map: Record<string, string> = {}
    for (const line of out.split('\n')) {
      const p = line.trim()
      if (!p) continue
      const fn = p.slice(p.lastIndexOf('/') + 1)
      if (fn) map[fn] = p
    }
    hfCache = { at: Date.now(), map }
    return map
  } catch {
    hfCache = { at: Date.now(), map: {} }
    return {}
  }
}

async function hfPathFor(deps: ShellDeps, filename: string): Promise<string | null> {
  if (!hfCache || Date.now() - hfCache.at > 30000) await refreshHfCache(deps)
  return hfCache?.map[filename] ?? null
}

// ── background downloads ────────────────────────────────────────────────────

interface DownloadState { status: 'downloading' | 'done' | 'error'; bytes: number; total: number; error: string }

const downloads: Record<string, DownloadState> = {}

function activeDownloads(): boolean {
  for (const k of Object.keys(downloads)) {
    if (downloads[k].status === 'downloading') return true
  }
  return false
}

async function runDownload(
  deps: ShellDeps,
  fs: { readText(target: unknown): Promise<string> },
  key: string,
  url: string,
  target: string,
  expectedSize: number,
  afterDone?: (target: string) => Promise<void>,
): Promise<void> {
  downloads[key] = { status: 'downloading', bytes: 0, total: expectedSize || 0, error: '' }
  try {
    const dir = target.slice(0, target.lastIndexOf('/'))
    await runCmd(deps, 'mkdir -p ' + q(dir), { timeoutMs: 10000 })
    await runCmd(deps, 'curl -sS -L --fail --retry 2 -o ' + q(target + '.part') + ' ' + q(url), { timeoutMs: 3600000 })
    await runCmd(deps, 'mv ' + q(target + '.part') + ' ' + q(target), { timeoutMs: 30000 })
    // The engine binary must be executable (curl/mv do not set the +x bit).
    // chmod is a no-op on Windows but required on Linux/macOS.
    if (key === 'engine') {
      try { await runCmd(deps, 'chmod +x ' + q(target), { timeoutMs: 10000 }) } catch { /* noop */ }
    }
    if (afterDone) await afterDone(target)
    downloads[key].status = 'done'
    downloads[key].bytes = expectedSize || await fileSize(deps, target)
  } catch (error) {
    downloads[key].status = 'error'
    downloads[key].error = error instanceof Error ? error.message : String(error)
    try { await runCmd(deps, 'rm -f ' + q(target + '.part'), { timeoutMs: 10000 }) } catch { /* noop */ }
  }
}

function downloadStatusSnapshot(): Record<string, DownloadState> {
  return downloads
}

// ── engine (transcribe-cli) presence + installation ────────────────────────

// On Windows the engine file must carry a .exe extension (CreateProcess /
// git-bash `test -x` refuse extensionless PE files). The default config path
// has no extension, so append it once the platform is known.
async function ensureBinaryPath(config: VoiceConfig, deps: ShellDeps): Promise<string> {
  if (config.tcpp.binary.slice(-4).toLowerCase() === '.exe') return config.tcpp.binary
  const p = await detectPlatform(deps)
  if (p.os === 'windows') config.tcpp.binary += '.exe'
  return config.tcpp.binary
}

async function engineExists(config: VoiceConfig, deps: ShellDeps): Promise<boolean> {
  try {
    await ensureBinaryPath(config, deps)
    await runCmd(deps, 'test -x ' + q(config.tcpp.binary), { timeoutMs: 10000 })
    return true
  } catch {
    return false
  }
}

async function adoptEngineFrom(config: VoiceConfig, deps: ShellDeps, source: string | null): Promise<string | null> {
  if (!source || source === config.tcpp.binary) return null
  if (!(await fileExists(deps, source))) return null
  const dir = config.tcpp.binary.slice(0, config.tcpp.binary.lastIndexOf('/'))
  await runCmd(deps, 'mkdir -p ' + q(dir), { timeoutMs: 10000 })
  await runCmd(deps, 'cp ' + q(source) + ' ' + q(config.tcpp.binary), { timeoutMs: 30000 })
  await runCmd(deps, 'chmod +x ' + q(config.tcpp.binary), { timeoutMs: 10000 })
  return source
}

async function discoverEngine(config: VoiceConfig, deps: ShellDeps): Promise<string | null> {
  await ensureBinaryPath(config, deps)
  // PATH lookup (explicit, not a filesystem sweep).
  try {
    const r = await runCmd(deps, 'command -v transcribe-cli 2>/dev/null || true', { timeoutMs: 10000 })
    const found = String(r.stdout?.text ?? '').trim()
    if (found) return adoptEngineFrom(config, deps, found)
  } catch { /* noop */ }
  const dir = config.tcpp.binary.slice(0, config.tcpp.binary.lastIndexOf('/'))
  return adoptEngineFrom(config, deps, dir + '/../transcribe-cli')
}

async function ensureEngine(config: VoiceConfig, deps: ShellDeps): Promise<{ exists: boolean; adoptedFrom?: string }> {
  if (await engineExists(config, deps)) return { exists: true }
  const adopted = await discoverEngine(config, deps)
  if (adopted) return { exists: true, adoptedFrom: adopted }
  return { exists: false }
}

// Optional integrity check: if a `<asset>.sha256` sidecar is published with the
// release, verify the downloaded binary against it before accepting it.
async function verifyEngineChecksum(
  config: VoiceConfig,
  deps: ShellDeps,
  fs: { resolve(path: string): Promise<unknown>; readText(target: unknown): Promise<string> },
  binaryPath: string,
): Promise<boolean> {
  const expected = await sha256(deps, binaryPath)
  if (!expected) return true // sidecar not published — skip
  const sidecarPath = binaryPath + '.sha256'
  await runCmd(deps, 'curl -sS -L --fail --retry 1 -o ' + q(sidecarPath) + ' ' + q(await engineUrl(config, deps) + '.sha256') + ' 2>/dev/null || rm -f ' + q(sidecarPath), { timeoutMs: 30000 })
  if (!(await fileExists(deps, sidecarPath))) return true
  const content = await fs.readText(await fs.resolve(sidecarPath))
  const m = /^([0-9a-f]{64})/i.exec(content ?? '')
  await runCmd(deps, 'rm -f ' + q(sidecarPath), { timeoutMs: 10000 })
  if (!m) return true
  if (m[1]!.toLowerCase() !== expected.toLowerCase()) {
    throw new Error('engine checksum mismatch: published ' + m[1]!.slice(0, 12) + '…, got ' + expected.slice(0, 12) + '…')
  }
  return true
}

// ── model resolution + download ─────────────────────────────────────────────

async function modelPath(config: VoiceConfig, deps: ShellDeps, entry: CatalogEntry): Promise<{ path: string; downloaded: boolean }> {
  const localPath = config.tcpp.modelsDir + '/' + entry.file
  if (await fileExists(deps, localPath)) return { path: localPath, downloaded: true }
  const cached = await hfPathFor(deps, entry.file)
  if (cached) return { path: cached, downloaded: true }
  return { path: localPath, downloaded: false }
}

async function startModelDownload(
  config: VoiceConfig,
  deps: ShellDeps,
  fs: { readText(target: unknown): Promise<string> },
  modelId: string,
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const entry = CATALOG.find((m) => m.id === modelId)
  if (!entry) return { ok: false, error: 'model not found in catalog' }
  const target = config.tcpp.modelsDir + '/' + entry.file
  const existing = await modelPath(config, deps, entry)
  if (existing.downloaded) return { ok: true, status: 'done' }
  if (activeDownloads()) return { ok: false, error: 'another download is already running' }
  const url = 'https://huggingface.co/' + entry.repo + '/resolve/main/' + entry.file
  void runDownload(deps, fs, 'model:' + modelId, url, target, entry.size)
  return { ok: true, status: 'downloading' }
}

// ── transcription providers ─────────────────────────────────────────────────

function isWhisperFamily(entry: CatalogEntry): boolean {
  return entry.name.toLowerCase().indexOf('whisper') >= 0
}

const CHUNK_SECS = 20
const CHUNK_THRESHOLD_SECS = 22

async function transcribeWithTcpp(
  config: VoiceConfig,
  deps: ShellDeps,
  fs: { resolve(path: string): Promise<unknown>; readText(target: unknown): Promise<string> },
  tmp: string,
): Promise<string> {
  if (!config.tcpp.modelId) throw new Error('no model selected (Settings → Voice)')
  const entry = CATALOG.find((m) => m.id === config.tcpp.modelId)
  if (!entry) throw new Error('model not found in catalog')
  const eng = await ensureEngine(config, deps)
  if (!eng.exists) throw new Error('engine is not installed — Settings → Voice → Download engine')

  const resolved = await modelPath(config, deps, entry)
  if (!resolved.downloaded) throw new Error('model is not downloaded — Settings → Voice → Download')

  const whisper = isWhisperFamily(entry)
  const langArg = whisper && config.language !== 'auto' ? ' -l ' + config.language : ''
  const wavBytes = await fileSize(deps, tmp + '/in.wav')
  const durationSec = wavBytes / 32000

  if (durationSec > CHUNK_THRESHOLD_SECS) {
    return await batchTranscribe(config, deps, fs, tmp, resolved.path, langArg)
  }
  const cmd = q(config.tcpp.binary) + ' -m ' + q(resolved.path) + ' -q' + langArg + ' -o ' + q(tmp + '/out.txt') + ' ' + q(tmp + '/in.wav')
  await runCmd(deps, cmd, { timeoutMs: 600000, workdir: tmp })
  return await fs.readText(await fs.resolve(tmp + '/out.txt'))
}

async function batchTranscribe(
  config: VoiceConfig,
  deps: ShellDeps,
  fs: { readText(target: unknown): Promise<string> },
  tmp: string,
  modelPathArg: string,
  langArg: string,
): Promise<string> {
  await runCmd(deps, 'mkdir -p ' + q(tmp + '/chunks'), { timeoutMs: 10000 })
  await runCmd(deps, 'ffmpeg -y -hide_banner -loglevel error -i ' + q(tmp + '/in.wav') + ' -f segment -segment_time ' + CHUNK_SECS + ' -c copy ' + q(tmp + '/chunks/chunk_%03d.wav'), { timeoutMs: 60000 })
  await runCmd(deps, 'ls ' + q(tmp + '/chunks') + '/chunk_*.wav | sort > ' + q(tmp + '/list.txt'), { timeoutMs: 10000, workdir: tmp })
  const cmd = q(config.tcpp.binary) + ' --batch ' + q(tmp + '/list.txt') + ' -m ' + q(modelPathArg) + ' -q' + langArg + ' --batch-jsonl'
  const result = await runCmd(deps, cmd, { timeoutMs: 900000, workdir: tmp })
  const outText = String(result.stdout?.text ?? '')
  const parts: string[] = []
  for (const line of outText.split('\n')) {
    const l = line.trim()
    if (!l) continue
    let parsed: { text?: unknown } | null = null
    try { parsed = JSON.parse(l) } catch { parsed = null }
    if (parsed && typeof parsed.text === 'string' && parsed.text.trim()) parts.push(parsed.text.trim())
  }
  if (!parts.length) throw new Error('transcribe-cli: no batch output')
  return parts.join(' ')
}

async function transcribeWithWhisper(
  config: VoiceConfig,
  deps: ShellDeps,
  fs: { resolve(path: string): Promise<unknown>; readText(target: unknown): Promise<string> },
  tmp: string,
): Promise<string> {
  if (!config.local.binary || !config.local.model) throw new Error('whisper paths not set (Settings → Voice → Advanced)')
  const langArg = config.language !== 'auto' ? ' -l ' + config.language : ''
  const cmd = q(config.local.binary) + ' -m ' + q(config.local.model) + langArg + ' -f ' + q(tmp + '/in.wav') + ' -oj -of ' + q(tmp + '/out')
  await runCmd(deps, cmd, { timeoutMs: 300000, workdir: tmp })
  const jsonText = await fs.readText(await fs.resolve(tmp + '/out.json'))
  const parsed: { text?: unknown; transcription?: Array<{ text?: unknown }> } = JSON.parse(jsonText)
  if (parsed && typeof parsed.text === 'string') {
    return parsed.text
  } else if (parsed && Array.isArray(parsed.transcription)) {
    return parsed.transcription.map((seg) => (seg && typeof seg.text === 'string') ? seg.text : '').join('')
  }
  throw new Error('whisper: could not parse out.json')
}

async function transcribeWithApi(config: VoiceConfig, deps: ShellDeps, tmp: string): Promise<string> {
  if (!config.api.key) throw new Error('API key is required — set it in Settings → Voice → API key')
  if (!config.api.url) throw new Error('API endpoint is not set (Settings → Voice)')
  const langArg = config.language !== 'auto' ? ' -F ' + q('language=' + config.language) : ''
  const cmd = 'curl -sS --max-time 120 -X POST ' + q(config.api.url) + ' -H ' + '"Authorization: Bearer $DSHVOICE_API_KEY"' + ' -F ' + q('file=@' + tmp + '/in.wav;type=audio/wav') + ' -F ' + q('model=' + config.api.model) + langArg
  const env = { DSHVOICE_API_KEY: config.api.key }
  const result = await runCmd(deps, cmd, { timeoutMs: 130000, env })
  const outText = String(result.stdout?.text ?? '')
  let parsed: { text?: unknown; error?: { message?: unknown } } | null = null
  try { parsed = JSON.parse(outText) } catch { parsed = null }
  if (parsed && typeof parsed.text === 'string') return parsed.text
  if (parsed && parsed.error && typeof parsed.error.message === 'string') throw new Error('API: ' + parsed.error.message)
  throw new Error('API: unexpected response: ' + outText.slice(0, 300))
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

function json(res: ServerResponse, value: unknown, status = 200): void {
  const body = JSON.stringify(value)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(body)
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += String(chunk) })
    req.on('end', () => {
      try {
        const parsed = data ? JSON.parse(data) : {}
        resolve(typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {})
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    })
    req.on('error', reject)
  })
}

// ── plugin entry ────────────────────────────────────────────────────────────

/** Plugin configuration (no config today; kept for future options). */
export interface Config {}

/**
 * Host plugin body: register /api/voice/* endpoints on the webserver.
 * @param ctx - host root context.
 */
export function apply(ctx: Context): void {
  const shell = ctx.get('shell')
  const fs = ctx.get('fs')
  const webServer = ctx.get('webServer')
  if (shell === undefined || fs === undefined || webServer === undefined) return

  const sandboxPolicy = ctx.get('sandboxPolicy')
  const wsRoot = sandboxPolicy !== undefined
    ? (sandboxPolicy as { workspaceRoot?: string }).workspaceRoot
    : undefined

  const config: VoiceConfig = {
    provider: 'tcpp',
    language: 'auto',
    tcpp: {
      binary: (wsRoot ?? process.cwd()) + '/.engine/transcribe-cli',
      modelsDir: (wsRoot ?? process.cwd()) + '/.models',
      modelId: 'handy-computer/gigaam-v3-e2e-rnnt-gguf/gigaam-v3-e2e-rnnt-Q8_0.gguf',
      engineUrl: 'https://github.com/KotDath/dsh-voice/releases/latest/download/transcribe-cli-{platform}-{arch}',
    },
    local: { binary: '', model: '' },
    api: { url: 'https://api.openai.com/v1/audio/transcriptions', model: 'gpt-4o-transcribe', key: '' },
  }

  const deps: ShellDeps = { shell: shell as ShellDeps['shell'] }
  const fsDeps = fs as { resolve(path: string): Promise<unknown>; readText(target: unknown): Promise<string> }

  function tmpdir(): string {
    return (wsRoot ?? process.cwd()) + '/.tmp/voice-' + Date.now() + '-' + Math.floor(Math.random() * 1000000)
  }

  const registerRoute = (path: string, handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void): void => {
    ctx.effect(
      () => webServer.register({
        kind: 'exact',
        path,
        handler: (req, res) => Promise.resolve(handler(req, res)).catch((e) => {
          json(res, { ok: false, error: e instanceof Error ? e.message : String(e) }, 500)
        }),
      }),
      `dsh-voice: ${path}`,
    )
  }

  // GET/POST /api/voice/config
  registerRoute('/api/voice/config', async (req, res) => {
    if (req.method === 'POST') {
      const body = await readBody(req)
      applyConfigPatch(config, body as VoiceConfigPatch)
    }
    json(res, { ok: true, ...publicConfigView(config) })
  })

  // POST /api/voice/api-key — set/clear host-only key; never echoed back.
  registerRoute('/api/voice/api-key', async (req, res) => {
    const body = await readBody(req)
    const key = typeof body.key === 'string' ? body.key : ''
    config.api.key = key
    json(res, { ok: true, hasKey: key !== '' })
  })

  // GET /api/voice/models
  registerRoute('/api/voice/models', async (req, res) => {
    try {
      const p = await detectPlatform(deps)
      const eng = await ensureEngine(config, deps)
      const map = await refreshHfCache(deps)
      const models = CATALOG.map((m) => ({
        id: m.id,
        name: m.name,
        repo: m.repo,
        file: m.file,
        size: m.size,
        recommended: m.recommended,
        windowSec: m.windowSec,
        streaming: m.streaming,
        downloaded: map[m.file] !== undefined,
      }))
      try {
        const r = await runCmd(deps, 'ls ' + q(config.tcpp.modelsDir) + ' 2>/dev/null || true', { timeoutMs: 10000 })
        const localFiles = String(r.stdout?.text ?? '')
        for (const m of models) {
          if (localFiles.indexOf(m.file) >= 0) m.downloaded = true
        }
      } catch { /* noop */ }
      models.sort((a, b) => (Number(b.downloaded) - Number(a.downloaded)) || (Number(b.recommended) - Number(a.recommended)) || a.name.localeCompare(b.name))
      json(res, {
        ok: true,
        models,
        platform: {
          os: p.os,
          arch: p.arch,
          exists: eng.exists,
          path: config.tcpp.binary,
          adoptedFrom: eng.adoptedFrom ?? null,
          modelsDir: config.tcpp.modelsDir,
        },
      })
    } catch (error) {
      json(res, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  })

  // POST /api/voice/download
  registerRoute('/api/voice/download', async (req, res) => {
    try {
      const body = await readBody(req)
      const modelId = typeof body.modelId === 'string' ? body.modelId : ''
      json(res, await startModelDownload(config, deps, fsDeps, modelId))
    } catch (error) {
      json(res, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  })

  // POST /api/voice/engine-download
  registerRoute('/api/voice/engine-download', async (req, res) => {
    try {
      const eng = await ensureEngine(config, deps)
      if (eng.exists) { json(res, { ok: true, status: 'done', adoptedFrom: eng.adoptedFrom ?? null }); return }
      if (activeDownloads()) { json(res, { ok: false, error: 'another download is already running' }); return }
      void runDownload(deps, fsDeps, 'engine', await engineUrl(config, deps), config.tcpp.binary, 0, (target) => verifyEngineChecksum(config, deps, fsDeps, target).then(() => undefined))
      json(res, { ok: true, status: 'downloading' })
    } catch (error) {
      json(res, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  })

  // GET /api/voice/download-status
  registerRoute('/api/voice/download-status', async (req, res) => {
    try {
      json(res, { ok: true, downloads: downloadStatusSnapshot() })
    } catch (error) {
      json(res, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  })

  // POST /api/voice/transcribe
  registerRoute('/api/voice/transcribe', async (req, res) => {
    let tmp: string | null = null
    try {
      const body = await readBody(req)
      if (typeof body.dataBase64 !== 'string' || !body.dataBase64) throw new Error('no audio data')
      tmp = tmpdir()
      await runCmd(deps, 'mkdir -p ' + q(tmp), { timeoutMs: 10000 })
      const mime = typeof body.mimeType === 'string' ? body.mimeType : ''
      let ext = 'webm'
      if (mime.indexOf('webm') >= 0) ext = 'webm'
      else if (mime.indexOf('mp4') >= 0) ext = 'm4a'
      else if (mime.indexOf('ogg') >= 0) ext = 'ogg'
      else if (mime.indexOf('wav') >= 0) ext = 'wav'
      await runCmd(deps, 'base64 -d > ' + q(tmp + '/in.' + ext), { stdin: body.dataBase64, timeoutMs: 30000 })
      await runCmd(deps, 'ffmpeg -y -hide_banner -loglevel error -i ' + q(tmp + '/in.' + ext) + ' -ar 16000 -ac 1 -c:a pcm_s16le ' + q(tmp + '/in.wav'), { timeoutMs: 30000 })

      let text = ''
      if (config.provider === 'tcpp') {
        text = await transcribeWithTcpp(config, deps, fsDeps, tmp)
      } else if (config.provider === 'api') {
        text = await transcribeWithApi(config, deps, tmp)
      } else {
        text = await transcribeWithWhisper(config, deps, fsDeps, tmp)
      }

      const cleaned = String(text).trim()
      if (!cleaned) { json(res, { ok: true, text: '', empty: true }); return }
      json(res, { ok: true, text: cleaned })
    } catch (error) {
      json(res, { ok: false, error: error instanceof Error ? error.message : String(error) })
    } finally {
      if (tmp) {
        try { await runCmd(deps, 'rm -rf ' + q(tmp), { timeoutMs: 10000 }) } catch { /* noop */ }
      }
    }
  })
}
