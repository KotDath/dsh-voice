# dsh-voice

Voice input for the DeepSeek Harness Web GUI (dynamic Cordis Plugin).

A microphone button (SVG icon) sits next to the send button in the composer.
Clicking it brings up a ChatGPT-style recording "pill" above the composer:

```
[ ✕ cancel ] [~~~~~~~~ waveform ~~~~~~~~] [ ⏹ stop ] [ ↑ send ]
```

- **✕** — cancel the recording;
- **⏹** — stop, transcribe and insert the text into the input (without sending);
- **↑** — stop, transcribe and send to the chat immediately.

The waveform is a row of vertical bars: fresh signal arrives on the right,
history fades left into a dim dotted baseline (like ChatGPT's voice mode).

## Installation

### Requirements

- A running DeepSeek Harness with the Web GUI (the plugin is a **dynamic Cordis
  Plugin**: it is loaded into a live session and lives for the process lifetime).
- On the host machine: `bash`, `curl` (engine/model downloads), `ffmpeg` (audio
  conversion). The transcribe.cpp engine is downloaded automatically per
  OS/architecture from this repository's Releases — or adopted from `PATH` / a
  sibling `.engine/` dir if a `transcribe-cli` binary already exists.
- A browser with mic access over HTTPS or localhost.

### Quick install (agent or human, in a DSH session)

The recommended way is to let an AI agent inside a DSH session do it — see
[AGENTS.md](AGENTS.md). In short, it reads `dist/host.js` and `dist/client.js`
from this repository and registers them through the dynamic-plugin tools:

```
cordis_define({
  plugin: { kind: 'new', idPrefix: 'voice' },
  name: 'dsh-voice',
  purpose: 'Voice input with local/API transcription for the DSH Web GUI.',
  code: {
    host:   <contents of dist/host.js>,
    client: <contents of dist/client.js>,
  },
})
// → pluginId, packageId
cordis_run({ pluginId, packageId, mode: 'run' })
// → approve the Run card in the UI (double-check to allow future updates)
```

After activation:

1. Open **Settings → Voice** — the engine is either `✓ installed` or
   downloadable with one click ("Download engine", releases built by CI).
2. Pick a model from the catalog and press **Download** if it is not marked ✓.
3. Use the mic button next to the send button in the composer.

### First-run flow (for the end user)

1. **Settings → Voice → Download engine** (5 MB, automatic per platform).
2. **Model → Download** (sizes shown, progress bar included).
3. Record → `✕` cancel / `⏹` insert / `↑` send.

### Notes on how DSH plugins attach

Dynamic Cordis plugins (this repository's format) are **session-scoped**:
`cordis_define` + `cordis_run` activates them in the running process, and they
do not survive a process restart or move to other sessions by themselves.
A permanent, always-mounted installation would require packaging the client as
a static web-plugin package (`dsh.client` scan path of the Harness) — not part
of this repository yet; contributions welcome.

## Architecture

```
[Client: browser]                                [Host: Node]
┌─────────────────────────────────┐  host.call   ┌────────────────────────────────┐
│ slot conversation.input.right   │ ───────────► │ harness.handle('voice/        │
│  • MediaRecorder (webm/opus)    │ base64+meta  │   transcribe')                │
│  • AnalyserNode → waveform      │              │  • base64 -d → file           │
│  • timers, states               │ ◄─────────── │  • ffmpeg → 16 kHz mono wav    │
│ inputActions.setDraft + submit  │   { text }   │  • provider:                  │
└─────────────────────────────────┘              │     tcpp:  transcribe-cli      │
                                                 │     local: whisper-cli -oj     │
                                                 │     api:   curl multipart     │
                                                 │  • temp file cleanup           │
                                                 └────────────────────────────────┘
```

## Transcription providers

Switchable in **Settings → Voice** (state is kept in memory, as expected from a
dynamic plugin).

| Provider | How it works | Requirements |
|---|---|---|
| `tcpp` (default) | the **transcribe.cpp** engine (the same one inside Handy) — a static `transcribe-cli` binary (~5 MB). A catalog of **67 models** (GigaAM v3 CTC/RNN-T/E2E, Voxtral Mini 3B/4B/24B, Whisper tiny…large-v3 (+turbo), Qwen3-ASR, Parakeet, Canary, Moonshine, Nemotron, Granite, SenseVoice, Fun-ASR, Cohere, MedASR…). Model picker dropdown, one-click Hugging Face download with progress | engine (self-downloads for Win/macOS/Linux) |
| `local` | whisper.cpp (`whisper-cli`) + one GGML model | paths to the binary and model; offline |
| `api` | OpenAI-compatible `POST /v1/audio/transcriptions` (multipart) | URL, API key, model name (`gpt-4o-transcribe`, `whisper-1`, Groq, a local faster-whisper server, etc.) |

### transcribe-cli engine: out of the box, no Handy app needed

- The plugin **does not depend on the Handy application**: the ASR engine is the
  open-source library [handy-computer/transcribe.cpp](https://github.com/handy-computer/transcribe.cpp).
- The binary is downloaded with the "Download engine" button from this
  repository's GitHub Releases for the current OS/architecture
  (`transcribe-cli-{platform}-{arch}`, `.exe` on Windows).
- If a `transcribe-cli` already exists on `PATH` or next to the configured
  engine path, the plugin **adopts it** (copies it into its own directory) — no
  download needed. Discovery is explicit; there is no filesystem sweep.
- Downloads are verified against a `.sha256` sidecar when one is published
  (best-effort integrity check).
- Plugin data (engine, models, temp files) lives in the DSH process launch
  directory (`.engine/`, `.models/`, `.tmp/`) — the sandbox only allows writes
  there. Paths are shown in the settings.
- Release binaries are built by CI (`.github/workflows/build-engine.yml`):
  Linux x86_64/arm64, macOS arm64/x86_64, Windows x86_64.
- Models are GGUF files from Hugging Face (`handy-computer`); the catalog is
  embedded in the plugin (sizes drive the progress bar). Models already
  downloaded by Handy into the HF cache are picked up automatically — no
  re-download required.
- Invocation: `transcribe-cli -m model.gguf -q -o out.txt in.wav` (16 kHz mono wav).
- **Long recordings**: many models have a ~25 s window (e.g. GigaAM) and silently
  lose the rest of a long recording. The plugin splits audio longer than 22 s
  into 20 s segments and transcribes them in one batch run (single model load,
  full text concatenated).

Verified on this machine: GigaAM v3 E2E-RNN-T — 30× realtime, Voxtral Mini 4B
Realtime — 1.7× realtime (20 s of Russian audio), excellent quality.

### API key handling

The OpenAI-compatible API key is **host-only**: it is set via a dedicated RPC
(`voice/api-key`), never echoed back to the page (the settings show only
whether a key is set), and is passed to the provider via the `DSHVOICE_API_KEY`
environment variable — never in argv.

## DSH contracts the plugin is built on

- Slot `conversation.input.right` — the mic button in the composer tool row
  (owner props `{session, input}`, standard props `useInput`, `inputActions`).
- Slot `conversation.input.dock` — the full-width row above the composer card
  that hosts the recording pill (same InputZone contract).
- Slot `settings.section` — the "Voice" settings page.
- RPC `harness.handle` / `host.call` — Client→Host, lossless JSON only
  (audio travels as base64).
- Host services: `shell` (bash + stdin + timeout), `fs` (reading out.json),
  `sandboxPolicy.workspaceRoot` (temp files inside the writable root, cleaned up).
- Client service `timer` (`ctx.interval`) — recording timer and waveform drawing.
- Theme tokens `--dsw-alias-*` for styling.

## Repository layout

```
src/host/      — host modules: shell, schema, catalog, platform, downloads,
                 engine, models, hfcache, RPC handlers, providers (tcpp/whisper/api)
src/client/    — client modules: style, state, icons, recorder, waveform,
                 components, settings, slot registrations
scripts/build-plugin.mjs — builds dist/host.js + dist/client.js from src/
                           (models.json is injected as the CATALOG table)
dist/          — generated flat function bodies: the installable artifacts
test/          — host unit tests + client recorder tests (plain Node, no browser)
models.json    — model catalog (source of truth for the CATALOG table)
.github/workflows/build-engine.yml — CI: plugin-tests job + engine builds for 5 platforms
AGENTS.md      — agent install/update instructions
README.md      — this document
```

`dist/host.js` / `dist/client.js` are the function bodies passed to
`cordis_define` (`code.host` / `code.client`) — see the Installation section
above. They are generated from `src/` by `node scripts/build-plugin.mjs` and
committed with every source change. Released versions are pinned by git tags
(`v0.2.0`, …). The `pkg-N` numbering belongs to the DSH runtime (immutable
package versions inside a live session) and intentionally does not leak into
this repository.

## Testing

```
node scripts/build-plugin.mjs     # regenerate dist/
node --check dist/host.js         # syntax
node --check dist/client.js
node test/run.mjs                 # host logic (config whitelist, platform/assets,
                                  #   RPC handlers, catalog integrity)
node test/client.test.mjs         # recorder flow with mocked MediaRecorder/mic
```

The CI `plugin-tests` job runs all of the above on every push to `main` and on
every `v*` tag.

## v1 limitations

- Recording uses the browser `MediaRecorder` (HTTPS or localhost required).
- Transcription is batch (after the recording ends); streaming partials are
  planned.
- Upstream whisper.cpp does not support Handy's Qwen3-ASR GGUF (needs the
  transcribe-cpp engine); standard ggml models (tiny…large-v3) work.
