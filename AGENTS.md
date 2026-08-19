# AGENTS.md — dsh-voice

Instructions for AI agents (and humans) working with this repository.

## What this is

`dsh-voice` is a **dynamic Cordis Plugin** for the DeepSeek Harness Web GUI:
a ChatGPT-style voice input button in the chat composer with transcription by

- the **transcribe.cpp** engine (same engine as the Handy app; 67-model catalog:
  GigaAM, Voxtral, Whisper, Qwen3-ASR, Parakeet, Canary, Moonshine, Nemotron…),
- whisper.cpp (single GGML model), or
- any OpenAI-compatible transcription API.

The distributable plugin is a pair of flat plain-JavaScript function bodies:
`dist/host.js` (Node side) and `dist/client.js` (browser side). They are
**generated** from the modular sources under `src/` by
`scripts/build-plugin.mjs` and must be committed whenever `src/` changes.

## Building

```
node scripts/build-plugin.mjs     # regenerates dist/host.js + dist/client.js
node --check dist/host.js         # syntax check
node --check dist/client.js
node test/run.mjs                 # host unit tests
node test/client.test.mjs         # client (recorder) unit tests
```

`models.json` is the single source of truth for the model catalog: the build
injects it into the `CATALOG` table used by the host.

## Installing into a running DSH session

Dynamic plugins are installed with the DSH dynamic-plugin tools inside a live
session. An agent should do exactly this:

1. Read `dist/host.js` and `dist/client.js` from the repository (they are
   always the current version; released versions are pinned by git tags).
2. Call `cordis_define` with:
   - `plugin: { kind: 'new', idPrefix: 'voice' }`,
   - `name: 'dsh-voice'`,
   - `purpose`: one sentence, e.g. `Voice input with local/API transcription for the DSH Web GUI.`,
   - `code.host` = the **entire contents** of `dist/host.js` (it is a function
     body that returns a Cordis Plugin object — do not wrap, trim, or
     transform it),
   - `code.client` = the **entire contents** of `dist/client.js`.
3. The tool returns `pluginId` and `packageId`. Call `cordis_run` with
   `mode: 'run'`.
4. `awaiting-approval` means the user must approve the Run card in the Web GUI.
   Tell the user to tick it (double tick also authorizes future updates of the
   same plugin). **Never retry after a rejection.**
5. `starting` is asynchronous — wait for the system to report the final result;
   do not poll or claim success early.
6. On a technical failure: read the failed package's diagnostics with
   `cordis_inspect_self(pluginId, packageId)`, fix the **same plugin** by
   appending a new package via `cordis_define` with
   `plugin: { kind: 'existing', pluginId }`, and run it with `mode: 'update'`
   (or `'run'` to roll back to `currentPackageId`). Do not create a replacement
   plugin.

Constraints that must be preserved when editing the code:

- Plain JavaScript only — no `import`/`require`, no TypeScript, no JSX.
- All code lives inside `apply(ctx)`; `ctx` is the apply parameter, not a global.
- Client React code uses `React.createElement(...)`.
- Every side effect (intervals, listeners, handlers) must be owned by the plugin
  fiber (`ctx.interval`, `ctx.timeout`, `harness.handle`, `slots.inject` —
  disposers are cleaned up automatically).
- Client→Host RPC arguments and results must be lossless JSON.
- User-facing strings are **English**.

## Security rules (do not regress)

- `provider` and `language` are strict enums (`src/host/schema.js`); free-form
  values must never reach a shell command unquoted. All shell arguments go
  through `q()`.
- The API key lives host-side only. It is set via the dedicated
  `voice/api-key` RPC and is never returned to the page — `publicConfig()`
  exposes `hasKey` only, and the key travels to the provider via the
  `DSHVOICE_API_KEY` environment variable, never argv.
- Engine downloads verify a `.sha256` sidecar when published (best-effort).
- Engine discovery is explicit: configured path → `command -v transcribe-cli`
  → sibling `.engine/` dir. No `$HOME` sweep.

## Post-install verification checklist

1. Composer tool row shows a mic button next to the send button.
2. Clicking it starts recording: a pill appears with `✕`, a live waveform,
   `⏹` (stop & insert) and `↑` (stop & send).
3. **Settings → Voice**:
   - engine shows `✓ installed` (or offers "Download engine" — releases are
     built by CI for Linux x86_64/arm64, macOS arm64/x86_64, Windows x86_64),
   - the model dropdown lists 67 models, downloaded ones marked `✓`,
   - `▸ Advanced` exposes engine path, models dir, download URL.
4. A short recording is transcribed and inserted/sent.

## Environment facts that matter

- The plugin stores data (engine binary, models, temp files) in the **DSH
  process launch directory** (`<launch-dir>/.engine`, `/.models`, `/.tmp`) —
  `sandboxPolicy.workspaceRoot` is the deployment default, not the session
  workspace. Do not assume it equals the repository directory.
- Models already in `~/.cache/huggingface/hub/models--handy-computer--*` (e.g.
  downloaded by the Handy app) are auto-detected — no re-download needed.
- Host requirements: `bash`, `curl`, `ffmpeg`.

## Releasing new engine binaries

- Engine binaries are built by `.github/workflows/build-engine.yml` from
  [handy-computer/transcribe.cpp](https://github.com/handy-computer/transcribe.cpp)
  (tag `v0.2.0`) for 5 platforms.
- Trigger: push a `v*` tag. Assets are named
  `transcribe-cli-{linux|macos|windows}-{x86_64|arm64}[.exe]` — keep this
  convention; the plugin's default `engineUrl` relies on it.
- After CI finishes, verify the GitHub Release contains all 5 assets.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Engine download → 404 | No release yet: push the repo and create a `v*` tag (CI builds engines). Or point **Advanced → Engine path** at an existing `transcribe-cli`. |
| "engine is not installed" on transcription | Same as above; check the engine path shown in settings. |
| Model download error | Verify the model id in `models.json`/catalog; HF `resolve/main/<file>` must return 200. Gated models may need a Hugging Face token. |
| Long dictation loses text | Fixed by 20 s chunking (since v0.1.0). Models have ~25 s windows; do not remove the chunking branch in `voice/transcribe`. |
| Settings change lost after restart | Dynamic plugin state is in-memory by design; re-save after reinstall. |
| `dist/*` looks stale | Rebuild with `node scripts/build-plugin.mjs`; committed bundles must match `src/`. |

## Repository conventions

- Edit `src/` (host and client are split into small modules per concern), then
  rebuild and commit `dist/host.js` / `dist/client.js` together with the change.
  Released versions are pinned by git tags (`v0.2.0`, …). Do not add per-version
  directories — the `pkg-N` numbering is DSH-runtime internal (immutable
  package versions inside a live session) and does not belong in this
  repository.
- `models.json` is the human-readable model catalog; the build injects it into
  the `CATALOG` table in `dist/host.js` — never hand-edit the table in a bundle.
- Tests live in `test/` and run on Node only (no browser needed). The CI job
  `plugin-tests` builds + syntax-checks the bundles and runs both suites.
- UI strings and comments in code are English.
