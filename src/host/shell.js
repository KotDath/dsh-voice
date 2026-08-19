// Shell helpers: safe command construction, execution and file sizing.
// STYLE: never build user-controlled shell via string concatenation without
// quoting; arbitrary provider/model values are validated upstream (see schema.js).

const wsRoot = sandboxPolicy.workspaceRoot

const q = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`') + '"'

async function runCmd(command, opts) {
  opts = opts || {}
  const spec = shell.resolve({
    command: command,
    workdir: opts.workdir,
    stdin: opts.stdin,
    timeoutMs: opts.timeoutMs || 30000,
    stdoutMaxBytes: 4 * 1024 * 1024,
    env: opts.env,
  })
  const result = await shell.run(spec)
  if (result.exitCode !== 0) {
    const stderrText = result.stderr && result.stderr.text ? result.stderr.text : ''
    const stdoutText = result.stdout && result.stdout.text ? result.stdout.text : ''
    throw new Error('command failed (exit ' + result.exitCode + (result.timedOut ? ', timeout' : '') + '): ' + (stderrText || stdoutText || '').slice(0, 400))
  }
  return result
}

async function fileSize(p) {
  const r = await runCmd('wc -c < ' + q(p), { timeoutMs: 10000 })
  return parseInt(String((r.stdout && r.stdout.text) || '').trim(), 10) || 0
}

async function fileExists(p) {
  try {
    await runCmd('test -f ' + q(p), { timeoutMs: 10000 })
    return true
  } catch (e) {
    return false
  }
}

async function sha256(path) {
  // Best-effort; empty string means unavailable. macOS has no sha256sum, so
  // fall back to `shasum -a 256` (same first-token output format).
  try {
    const r = await runCmd('(sha256sum ' + q(path) + ' 2>/dev/null || shasum -a 256 ' + q(path) + ' 2>/dev/null) || true', { timeoutMs: 60000 })
    return String((r.stdout && r.stdout.text) || '').trim().split(/\s+/)[0] || ''
  } catch (e) {
    return ''
  }
}
