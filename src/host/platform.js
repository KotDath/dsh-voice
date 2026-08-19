// OS/arch detection and the engine asset naming convention.
// Assets published by CI keep the name: transcribe-cli-{os}-{arch}[.exe].
let platformCache = null

async function detectPlatform() {
  if (platformCache) return platformCache
  const osR = await runCmd('uname -s', { timeoutMs: 10000 })
  const archR = await runCmd('uname -m', { timeoutMs: 10000 })
  const os = String((osR.stdout && osR.stdout.text) || '').trim().toLowerCase()
  const arch = String((archR.stdout && archR.stdout.text) || '').trim().toLowerCase()
  let platform = 'linux'
  const archName = arch === 'x86_64' || arch === 'amd64' ? 'x86_64' : (arch === 'aarch64' || arch === 'arm64' ? 'arm64' : arch)
  if (os.indexOf('darwin') >= 0) platform = 'macos'
  else if (os.indexOf('mingw') >= 0 || os.indexOf('msys') >= 0 || os.indexOf('windows') >= 0) platform = 'windows'
  platformCache = { os: platform, arch: archName }
  return platformCache
}

// Asset stem WITHOUT extension (matches the release file EXCEPT the .exe
// Windows suffix, which is appended separately by engineAssetName).
async function engineAssetStem() {
  const p = await detectPlatform()
  return 'transcribe-cli-' + p.os + '-' + p.arch
}

async function engineAssetName() {
  const p = await detectPlatform()
  const stem = 'transcribe-cli-' + p.os + '-' + p.arch
  return p.os === 'windows' ? stem + '.exe' : stem
}

// Resolves the download URL for the engine on this platform. The default
// template ends in `-{arch}`; on Windows the published asset carries a `.exe`
// suffix that must be appended (CI publishes transcribe-cli-windows-*-x86_64.exe).
async function engineUrl() {
  const p = await detectPlatform()
  let url = config.tcpp.engineUrl.replace('{platform}', p.os).replace('{arch}', p.arch)
  if (p.os === 'windows' && !/\.exe$/i.test(url)) url += '.exe'
  return url
}
