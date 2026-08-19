// Model resolution + download.
// Precedence: the models directory (explicitly downloaded) → the HF cache → not
// downloaded (client is offered a one-click download).

async function modelPath(entry) {
  const localPath = config.tcpp.modelsDir + '/' + entry[3]
  if (await fileExists(localPath)) return { path: localPath, downloaded: true }
  const cached = await hfPathFor(entry[3])
  if (cached) return { path: cached, downloaded: true }
  return { path: localPath, downloaded: false }
}

async function startModelDownload(modelId) {
  const entry = catalogEntry(modelId)
  if (!entry) return { ok: false, error: 'model not found in catalog' }
  const target = config.tcpp.modelsDir + '/' + entry[3]
  const existing = await modelPath(entry)
  if (existing.downloaded) return { ok: true, status: 'done' }
  if (activeDownloads()) return { ok: false, error: 'another download is already running' }
  const url = 'https://huggingface.co/' + entry[2] + '/resolve/main/' + entry[3]
  runDownload('model:' + modelId, url, target, entry[4])
  return { ok: true, status: 'downloading' }
}
