# dsh-voice

Voice input for the DeepSeek Harness Web GUI — as an **official plugin bundle**.

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

- A running DeepSeek Harness with the Web GUI (Node.js quick start:
  `npx @deepseek-ai/dsh web`, default `http://127.0.0.1:3080`).
- On the host machine: `bash`, `curl` (engine/model downloads), `ffmpeg` (audio
  conversion). The transcribe.cpp engine is downloaded automatically per
  OS/architecture from this repository's Releases — or adopted from `PATH` / a
  sibling `.engine/` dir if a `transcribe-cli` binary already exists.
- A browser with mic access over HTTPS or localhost.

### Install into a profile (all sessions)

```sh
dsh plugin --profile web add github:KotDath/dsh-voice
```

For a local test build instead:

```sh
npm install && npm run build
dsh plugin --profile web add file:/path/to/dsh-voice
```

Then **restart the web process** (`dsh web`) — the new plugin row is picked up
at boot. After that the plugin is active in **every session** of the profile:
no per-session `cordis_define`, no source edits.

The package declares `dsh.bundle.patch` (→ `cordis.patch.yml`, one row
`id: voice, name: dsh-voice`) and `dsh.client` (→ the browser half
`lib/client.js`). `dsh plugin` installs it with pnpm into the profile and
reconciles `dsh.profile.bundles` automatically.

To remove:

```sh
dsh plugin --profile web remove dsh-voice
```

### First-run flow (for the end user)

1. Open **Settings → Voice** — the engine is either `✓ installed` or
   downloadable with one click ("Download engine", releases built by CI).
2. Pick a model from the catalog and press **Download** if it is not marked ✓.
3. Use the mic button next to the send button in the composer.
4. Record → `✕` cancel / `⏹` insert / `↑` send.

## Architecture

```
[Client: browser]                                [Host: Node]
┌─────────────────────────────────┐  fetch      ┌────────────────────────────────┐
│ slot conversation.input.right   │ ──────────► │ /api/voice/transcribe          │
│  • MediaRecorder (webm/opus)    │ base64+meta │  • base64 -d → file           │
│  • AnalyserNode → waveform      │              │  • ffmpeg → 16 kHz mono wav    │
│  • timers, states               │ ◄─────────── │  • provider:                  │
│ inputActions.setDraft + submit  │   { text }   │     tcpp:  transcribe-cli      │
└─────────────────────────────────┘              │     local: whisper-cli -oj     │
                                                 │     api:   curl multipart     │
                                                 │  • temp file cleanup           │
                                                 └────────────────────────────────┘
```

Unlike the earlier dynamic-plugin versions, the two halves do **not** use the
`harness.handle`/`host.call` bridge: the Node half registers plain HTTP
endpoints on the harness webserver (`/api/voice/*`), and the browser half
calls them with `fetch`. That is the pattern used by other static bundle
plugins (e.g. dsh-track).

## Transcription providers

Switchable in **Settings → Voice** (state is kept in memory, as expected from
a plugin bundle).

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
- **Long recordings**: many models have a ~25 s window (e.g. GigaAM) and silently
  lose the rest of a long recording. The plugin splits audio longer than 22 s
  into 20 s segments and transcribes them in one batch run (single model load,
  full text concatenated).

Verified on this machine: GigaAM v3 E2E-RNN-T — 30× realtime, Voxtral Mini 4B
Realtime — 1.7× realtime (20 s of Russian audio), excellent quality.

### API key handling

The OpenAI-compatible API key is **host-only**: it is set via its own endpoint
(`POST /api/voice/api-key`), never echoed back to the page (the settings show
only whether a key is set), and is passed to the provider via the
`DSHVOICE_API_KEY` environment variable — never in argv.

## Development

```
npm install          # dev deps (uses .npm-cache/ if ~/.npm is read-only)
npm run build        # gen-catalog → tsc → tsdown (lib/index.js + lib/client.js)
npm test             # host + client unit tests (plain Node, no browser)
```

The installable artifact is the npm package at the repository root. See
[AGENTS.md](AGENTS.md) for the full agent instructions (layout, endpoints,
security rules, troubleshooting).

## Repository layout

```
src/plugin/          — Node half (index.ts, HTTP /api/voice/*) + browser half
                       (client/: state, recorder, waveform, components,
                       settings, voice.module.css) + generated catalog
scripts/gen-catalog.mjs — injects models.json into generated-catalog.ts
tsdown.config.ts     — node ESM bundle + browser CJS-closure bundle
cordis.patch.yml     — the bundle's composition patch (one row: id voice)
package.json         — dsh.bundle.patch + dsh.client declarations
models.json          — model catalog (source of truth)
test/                — host + client unit tests
.github/workflows/build-engine.yml — CI: plugin tests + 5-platform engine builds
AGENTS.md            — agent install/update instructions
README.md            — this document
```

Released versions are pinned by git tags (`v0.3.0`, …).

## v1 limitations

- Recording uses the browser `MediaRecorder` (HTTPS or localhost required).
- Transcription is batch (after the recording ends); streaming partials are
  planned.
- Upstream whisper.cpp does not support Handy's Qwen3-ASR GGUF (needs the
  transcribe-cpp engine); standard ggml models (tiny…large-v3) work.
