# AGENTS.md — dsh-voice

Instructions for AI agents (and humans) working with this repository.

## What this is

`dsh-voice` is a **dynamic Cordis Plugin** for the DeepSeek Harness Web GUI:
a ChatGPT-style voice input button in the chat composer with transcription by

- the **transcribe.cpp** engine (same engine as the Handy app; 67-model catalog:
  GigaAM, Voxtral, Whisper, Qwen3-ASR, Parakeet, Canary, Moonshine, Nemotron…),
- whisper.cpp (single GGML model), or
- any OpenAI-compatible transcription API.

The plugin consists of two plain-JavaScript function bodies:
`packages/<latest-pkg>/host.js` (Node side) and `.../client.js` (browser side).

## Installing into a running DSH session

Dynamic plugins are installed with the DSH dynamic-plugin tools inside a live
session. An agent should do exactly this:

1. Determine the latest version: the numerically highest `packages/pkg-*/`
   directory (read the file list; do not guess).
2. Read `packages/<latest>/host.js` and `packages/<latest>/client.js`.
3. Call `cordis_define` with:
   - `plugin: { kind: 'new', idPrefix: 'voice' }`,
   - `name: 'dsh-voice'`,
   - `purpose`: one sentence, e.g. `Voice input with local/API transcription for the DSH Web GUI.`,
   - `code.host` = the **entire contents** of `host.js` (it is a function body
     that returns a Cordis Plugin object — do not wrap, trim, or transform it),
   - `code.client` = the **entire contents** of `client.js`.
4. The tool returns `pluginId` and `packageId`. Call `cordis_run` with
   `mode: 'run'`.
5. `awaiting-approval` means the user must approve the Run card in the Web GUI.
   Tell the user to tick it (double tick also authorizes future updates of the
   same plugin). **Never retry after a rejection.**
6. `starting` is asynchronous — wait for the system to report the final result;
   do not poll or claim success early.
7. On a technical failure: read the failed package's diagnostics with
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
- If a `transcribe-cli` binary exists anywhere under `$HOME`, the plugin adopts
  it (copies it to `<launch-dir>/.engine`) instead of downloading.
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
| Engine download → 404 | No release yet: push the repo and create tag `v0.1.0` (CI builds engines). Or point **Advanced → Engine path** at an existing `transcribe-cli`. |
| "engine is not installed" on transcription | Same as above; the plugin auto-searches `$HOME` first — check the engine path shown in settings. |
| Model download error | Verify the model id in `models.json`/catalog; HF `resolve/main/<file>` must return 200. Gated models may need a Hugging Face token. |
| Long dictation loses text | Fixed by 20 s chunking (pkg-9+). Models have ~25 s windows; do not remove the chunking branch in `voice/transcribe`. |
| Settings change lost after restart | Dynamic plugin state is in-memory by design; re-save after reinstall. |

## Repository conventions

- `packages/pkg-N/` holds immutable source snapshots; never edit an existing
  `pkg-N` — create `pkg-N+1` when the plugin changes, and point README at it.
- `models.json` is the human-readable model catalog; the inline `CATALOG` table
  in `host.js` must stay in sync when models are added.
- UI strings and comments in code are English.
