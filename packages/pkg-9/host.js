// dsh-voice — Host half (pkg-9)
// Body for cordis_define code.host. Runtime: Node side of DSH.
// Providers: tcpp (transcribe.cpp engine, default) | local (whisper.cpp) | api.
// RPC: voice/config, voice/models, voice/download, voice/engine-download,
//      voice/download-status, voice/transcribe.
return {
  apply(ctx) {
    const fs = ctx.get('fs')
    const shell = ctx.get('shell')
    const sandboxPolicy = ctx.get('sandboxPolicy')
    if (!fs || !shell || !sandboxPolicy) return

    const wsRoot = sandboxPolicy.workspaceRoot

    const config = {
      provider: 'tcpp',
      language: 'auto',
      tcpp: {
        binary: wsRoot + '/.engine/transcribe-cli',
        modelsDir: wsRoot + '/.models',
        modelId: 'handy-computer/gigaam-v3-e2e-rnnt-gguf/gigaam-v3-e2e-rnnt-Q8_0.gguf',
        engineUrl: 'https://github.com/KotDath/dsh-voice/releases/latest/download/transcribe-cli-{platform}-{arch}',
      },
      local: {
        binary: '/home/kotdath/Documents/whisper.cpp/build/bin/whisper-cli',
        model: '/home/kotdath/Documents/whisper.cpp/models/ggml-large-v3.bin',
      },
      api: {
        url: 'https://api.openai.com/v1/audio/transcriptions',
        key: '',
        model: 'gpt-4o-transcribe',
      },
    }

    // [id, name, repo, file, size_bytes, recommended] — generated from
    // Handy's bundled catalog (handy-computer HF org), see models.json.
    const CATALOG = [
    ["handy-computer/canary-180m-flash-gguf/canary-180m-flash-Q8_0.gguf", "Canary 180M Flash", "handy-computer/canary-180m-flash-gguf", "canary-180m-flash-Q8_0.gguf", 218447552, 1],
    ["handy-computer/cohere-transcribe-03-2026-gguf/cohere-transcribe-03-2026-Q5_K_M.gguf", "Cohere Transcribe", "handy-computer/cohere-transcribe-03-2026-gguf", "cohere-transcribe-03-2026-Q5_K_M.gguf", 1770270208, 1],
    ["handy-computer/nemotron-3.5-asr-streaming-0.6b-gguf/nemotron-3.5-asr-streaming-0.6b-Q8_0.gguf", "Nemotron Streaming 3.5", "handy-computer/nemotron-3.5-asr-streaming-0.6b-gguf", "nemotron-3.5-asr-streaming-0.6b-Q8_0.gguf", 751094240, 1],
    ["handy-computer/parakeet-unified-en-0.6b-gguf/parakeet-unified-en-0.6b-Q8_0.gguf", "Parakeet Unified EN 0.6B", "handy-computer/parakeet-unified-en-0.6b-gguf", "parakeet-unified-en-0.6b-Q8_0.gguf", 731357568, 1],
    ["handy-computer/whisper-medium-gguf/whisper-medium-Q8_0.gguf", "Whisper Medium", "handy-computer/whisper-medium-gguf", "whisper-medium-Q8_0.gguf", 831538144, 1],
    ["handy-computer/Breeze-ASR-25-gguf/Breeze-ASR-25-Q5_K_M.gguf", "Breeze-ASR-25", "handy-computer/Breeze-ASR-25-gguf", "Breeze-ASR-25-Q5_K_M.gguf", 1160366080, 0],
    ["handy-computer/canary-1b-gguf/canary-1b-Q5_K_M.gguf", "Canary 1B", "handy-computer/canary-1b-gguf", "canary-1b-Q5_K_M.gguf", 837694272, 0],
    ["handy-computer/canary-1b-flash-gguf/canary-1b-flash-Q5_K_M.gguf", "Canary 1B Flash", "handy-computer/canary-1b-flash-gguf", "canary-1b-flash-Q5_K_M.gguf", 769563424, 0],
    ["handy-computer/canary-1b-v2-gguf/canary-1b-v2-Q5_K_M.gguf", "Canary 1B v2", "handy-computer/canary-1b-v2-gguf", "canary-1b-v2-Q5_K_M.gguf", 836664032, 0],
    ["handy-computer/canary-qwen-2.5b-gguf/canary-qwen-2.5b-Q5_K_M.gguf", "Canary-Qwen 2.5B", "handy-computer/canary-qwen-2.5b-gguf", "canary-qwen-2.5b-Q5_K_M.gguf", 1983729024, 0],
    ["handy-computer/cohere-transcribe-arabic-07-2026-gguf/cohere-transcribe-arabic-07-2026-Q5_K_M.gguf", "Cohere Transcribe", "handy-computer/cohere-transcribe-arabic-07-2026-gguf", "cohere-transcribe-arabic-07-2026-Q5_K_M.gguf", 1770270112, 0],
    ["handy-computer/Fun-ASR-Nano-2512-gguf/Fun-ASR-Nano-2512-Q8_0.gguf", "Fun-ASR Nano", "handy-computer/Fun-ASR-Nano-2512-gguf", "Fun-ASR-Nano-2512-Q8_0.gguf", 891270912, 0],
    ["handy-computer/Fun-ASR-MLT-Nano-2512-gguf/Fun-ASR-MLT-Nano-2512-Q8_0.gguf", "Fun-ASR Nano Multilingual", "handy-computer/Fun-ASR-MLT-Nano-2512-gguf", "Fun-ASR-MLT-Nano-2512-Q8_0.gguf", 891271232, 0],
    ["handy-computer/gigaam-v3-ctc-gguf/gigaam-v3-ctc-Q8_0.gguf", "GigaAM v3 CTC", "handy-computer/gigaam-v3-ctc-gguf", "gigaam-v3-ctc-Q8_0.gguf", 271803328, 0],
    ["handy-computer/gigaam-v3-e2e-ctc-gguf/gigaam-v3-e2e-ctc-Q8_0.gguf", "GigaAM v3 E2E-CTC", "handy-computer/gigaam-v3-e2e-ctc-gguf", "gigaam-v3-e2e-ctc-Q8_0.gguf", 272151136, 0],
    ["handy-computer/gigaam-v3-e2e-rnnt-gguf/gigaam-v3-e2e-rnnt-Q8_0.gguf", "GigaAM v3 E2E-RNN-T", "handy-computer/gigaam-v3-e2e-rnnt-gguf", "gigaam-v3-e2e-rnnt-Q8_0.gguf", 273724832, 0],
    ["handy-computer/gigaam-v3-rnnt-gguf/gigaam-v3-rnnt-Q8_0.gguf", "GigaAM v3 RNN-T", "handy-computer/gigaam-v3-rnnt-gguf", "gigaam-v3-rnnt-Q8_0.gguf", 273022880, 0],
    ["handy-computer/granite-4.0-1b-speech-gguf/granite-4.0-1b-speech-Q5_K_M.gguf", "Granite Speech 4.0 1B", "handy-computer/granite-4.0-1b-speech-gguf", "granite-4.0-1b-speech-Q5_K_M.gguf", 1829704544, 0],
    ["handy-computer/granite-speech-4.1-2b-gguf/granite-speech-4.1-2b-Q5_K_M.gguf", "Granite Speech 4.1 2B", "handy-computer/granite-speech-4.1-2b-gguf", "granite-speech-4.1-2b-Q5_K_M.gguf", 1829704544, 0],
    ["handy-computer/granite-speech-4.1-2b-nar-gguf/granite-speech-4.1-2b-nar-Q5_K_M.gguf", "Granite Speech 4.1 2B NAR", "handy-computer/granite-speech-4.1-2b-nar-gguf", "granite-speech-4.1-2b-nar-Q5_K_M.gguf", 1782089344, 0],
    ["handy-computer/granite-speech-4.1-2b-plus-gguf/granite-speech-4.1-2b-plus-Q5_K_M.gguf", "Granite Speech 4.1 2B Plus", "handy-computer/granite-speech-4.1-2b-plus-gguf", "granite-speech-4.1-2b-plus-Q5_K_M.gguf", 1691297088, 0],
    ["handy-computer/medasr-gguf/medasr-Q8_0.gguf", "MedASR", "handy-computer/medasr-gguf", "medasr-Q8_0.gguf", 127712448, 0],
    ["handy-computer/moonshine-base-gguf/moonshine-base-Q8_0.gguf", "Moonshine Base", "handy-computer/moonshine-base-gguf", "moonshine-base-Q8_0.gguf", 77476480, 0],
    ["handy-computer/moonshine-base-ar-gguf/moonshine-base-ar-Q8_0.gguf", "Moonshine Base (Arabic)", "handy-computer/moonshine-base-ar-gguf", "moonshine-base-ar-Q8_0.gguf", 77476480, 0],
    ["handy-computer/moonshine-base-zh-gguf/moonshine-base-zh-Q8_0.gguf", "Moonshine Base (Chinese)", "handy-computer/moonshine-base-zh-gguf", "moonshine-base-zh-Q8_0.gguf", 77476480, 0],
    ["handy-computer/moonshine-base-ja-gguf/moonshine-base-ja-Q8_0.gguf", "Moonshine Base (Japanese)", "handy-computer/moonshine-base-ja-gguf", "moonshine-base-ja-Q8_0.gguf", 77476480, 0],
    ["handy-computer/moonshine-base-ko-gguf/moonshine-base-ko-Q8_0.gguf", "Moonshine Base (Korean)", "handy-computer/moonshine-base-ko-gguf", "moonshine-base-ko-Q8_0.gguf", 77476480, 0],
    ["handy-computer/moonshine-base-uk-gguf/moonshine-base-uk-Q8_0.gguf", "Moonshine Base (Ukrainian)", "handy-computer/moonshine-base-uk-gguf", "moonshine-base-uk-Q8_0.gguf", 77476512, 0],
    ["handy-computer/moonshine-base-vi-gguf/moonshine-base-vi-Q8_0.gguf", "Moonshine Base (Vietnamese)", "handy-computer/moonshine-base-vi-gguf", "moonshine-base-vi-Q8_0.gguf", 77476512, 0],
    ["handy-computer/moonshine-streaming-medium-gguf/moonshine-streaming-medium-Q8_0.gguf", "Moonshine Streaming Medium", "handy-computer/moonshine-streaming-medium-gguf", "moonshine-streaming-medium-Q8_0.gguf", 295793568, 0],
    ["handy-computer/moonshine-streaming-small-gguf/moonshine-streaming-small-Q8_0.gguf", "Moonshine Streaming Small", "handy-computer/moonshine-streaming-small-gguf", "moonshine-streaming-small-Q8_0.gguf", 198506848, 0],
    ["handy-computer/moonshine-streaming-tiny-gguf/moonshine-streaming-tiny-Q8_0.gguf", "Moonshine Streaming Tiny", "handy-computer/moonshine-streaming-tiny-gguf", "moonshine-streaming-tiny-Q8_0.gguf", 50462816, 0],
    ["handy-computer/moonshine-tiny-gguf/moonshine-tiny-Q8_0.gguf", "Moonshine Tiny", "handy-computer/moonshine-tiny-gguf", "moonshine-tiny-Q8_0.gguf", 35466912, 0],
    ["handy-computer/moonshine-tiny-ar-gguf/moonshine-tiny-ar-Q8_0.gguf", "Moonshine Tiny (Arabic)", "handy-computer/moonshine-tiny-ar-gguf", "moonshine-tiny-ar-Q8_0.gguf", 35466944, 0],
    ["handy-computer/moonshine-tiny-zh-gguf/moonshine-tiny-zh-Q8_0.gguf", "Moonshine Tiny (Chinese)", "handy-computer/moonshine-tiny-zh-gguf", "moonshine-tiny-zh-Q8_0.gguf", 35466944, 0],
    ["handy-computer/moonshine-tiny-ja-gguf/moonshine-tiny-ja-Q8_0.gguf", "Moonshine Tiny (Japanese)", "handy-computer/moonshine-tiny-ja-gguf", "moonshine-tiny-ja-Q8_0.gguf", 35466944, 0],
    ["handy-computer/moonshine-tiny-ko-gguf/moonshine-tiny-ko-Q8_0.gguf", "Moonshine Tiny (Korean)", "handy-computer/moonshine-tiny-ko-gguf", "moonshine-tiny-ko-Q8_0.gguf", 35466944, 0],
    ["handy-computer/moonshine-tiny-uk-gguf/moonshine-tiny-uk-Q8_0.gguf", "Moonshine Tiny (Ukrainian)", "handy-computer/moonshine-tiny-uk-gguf", "moonshine-tiny-uk-Q8_0.gguf", 35466944, 0],
    ["handy-computer/moonshine-tiny-vi-gguf/moonshine-tiny-vi-Q8_0.gguf", "Moonshine Tiny (Vietnamese)", "handy-computer/moonshine-tiny-vi-gguf", "moonshine-tiny-vi-Q8_0.gguf", 35466944, 0],
    ["handy-computer/multitalker-parakeet-streaming-0.6b-v1-gguf/multitalker-parakeet-streaming-0.6b-v1-Q8_0.gguf", "Multitalker Parakeet Streaming EN", "handy-computer/multitalker-parakeet-streaming-0.6b-v1-gguf", "multitalker-parakeet-streaming-0.6b-v1-Q8_0.gguf", 734123712, 0],
    ["handy-computer/nemotron-speech-streaming-en-0.6b-gguf/nemotron-speech-streaming-en-0.6b-Q8_0.gguf", "Nemotron Speech Streaming EN", "handy-computer/nemotron-speech-streaming-en-0.6b-gguf", "nemotron-speech-streaming-en-0.6b-Q8_0.gguf", 729650176, 0],
    ["handy-computer/parakeet-ctc-0.6b-gguf/parakeet-ctc-0.6b-Q8_0.gguf", "Parakeet CTC 0.6B", "handy-computer/parakeet-ctc-0.6b-gguf", "parakeet-ctc-0.6b-Q8_0.gguf", 722271424, 0],
    ["handy-computer/parakeet-ctc-1.1b-gguf/parakeet-ctc-1.1b-Q5_K_M.gguf", "Parakeet CTC 1.1B", "handy-computer/parakeet-ctc-1.1b-gguf", "parakeet-ctc-1.1b-Q5_K_M.gguf", 928584736, 0],
    ["handy-computer/parakeet-rnnt-0.6b-gguf/parakeet-rnnt-0.6b-Q8_0.gguf", "Parakeet RNN-T 0.6B", "handy-computer/parakeet-rnnt-0.6b-gguf", "parakeet-rnnt-0.6b-Q8_0.gguf", 729687456, 0],
    ["handy-computer/parakeet-rnnt-1.1b-gguf/parakeet-rnnt-1.1b-Q5_K_M.gguf", "Parakeet RNN-T 1.1B", "handy-computer/parakeet-rnnt-1.1b-gguf", "parakeet-rnnt-1.1b-Q5_K_M.gguf", 935755008, 0],
    ["handy-computer/parakeet-tdt-0.6b-v2-gguf/parakeet-tdt-0.6b-v2-Q8_0.gguf", "Parakeet TDT 0.6B v2", "handy-computer/parakeet-tdt-0.6b-v2-gguf", "parakeet-tdt-0.6b-v2-Q8_0.gguf", 729574912, 0],
    ["handy-computer/parakeet-tdt-0.6b-v3-gguf/parakeet-tdt-0.6b-v3-Q8_0.gguf", "Parakeet TDT 0.6B v3", "handy-computer/parakeet-tdt-0.6b-v3-gguf", "parakeet-tdt-0.6b-v3-Q8_0.gguf", 739508576, 0],
    ["handy-computer/parakeet-tdt-1.1b-gguf/parakeet-tdt-1.1b-Q5_K_M.gguf", "Parakeet TDT 1.1B", "handy-computer/parakeet-tdt-1.1b-gguf", "parakeet-tdt-1.1b-Q5_K_M.gguf", 935758496, 0],
    ["handy-computer/parakeet-tdt_ctc-1.1b-gguf/parakeet-tdt_ctc-1.1b-Q5_K_M.gguf", "Parakeet TDT-CTC 1.1B", "handy-computer/parakeet-tdt_ctc-1.1b-gguf", "parakeet-tdt_ctc-1.1b-Q5_K_M.gguf", 935758080, 0],
    ["handy-computer/parakeet-tdt_ctc-110m-gguf/parakeet-tdt_ctc-110m-Q8_0.gguf", "Parakeet TDT-CTC 110M", "handy-computer/parakeet-tdt_ctc-110m-gguf", "parakeet-tdt_ctc-110m-Q8_0.gguf", 135373280, 0],
    ["handy-computer/Qwen3-ASR-0.6B-gguf/Qwen3-ASR-0.6B-Q8_0.gguf", "Qwen3-ASR 0.6B", "handy-computer/Qwen3-ASR-0.6B-gguf", "Qwen3-ASR-0.6B-Q8_0.gguf", 850423456, 0],
    ["handy-computer/Qwen3-ASR-1.7B-gguf/Qwen3-ASR-1.7B-Q5_K_M.gguf", "Qwen3-ASR 1.7B", "handy-computer/Qwen3-ASR-1.7B-gguf", "Qwen3-ASR-1.7B-Q5_K_M.gguf", 1517290464, 0],
    ["handy-computer/SenseVoiceSmall-gguf/SenseVoiceSmall-Q8_0.gguf", "SenseVoice Small", "handy-computer/SenseVoiceSmall-gguf", "SenseVoiceSmall-Q8_0.gguf", 252684608, 0],
    ["handy-computer/Voxtral-Mini-3B-2507-gguf/Voxtral-Mini-3B-2507-Q5_K_M.gguf", "Voxtral Mini 3B", "handy-computer/Voxtral-Mini-3B-2507-gguf", "Voxtral-Mini-3B-2507-Q5_K_M.gguf", 3464182432, 0],
    ["handy-computer/Voxtral-Mini-4B-Realtime-2602-gguf/Voxtral-Mini-4B-Realtime-2602-Q5_K_M.gguf", "Voxtral Mini 4B Realtime", "handy-computer/Voxtral-Mini-4B-Realtime-2602-gguf", "Voxtral-Mini-4B-Realtime-2602-Q5_K_M.gguf", 3281439008, 0],
    ["handy-computer/Voxtral-Small-24B-2507-gguf/Voxtral-Small-24B-2507-Q5_K_M.gguf", "Voxtral Small 24B", "handy-computer/Voxtral-Small-24B-2507-gguf", "Voxtral-Small-24B-2507-Q5_K_M.gguf", 17138659808, 0],
    ["handy-computer/whisper-base-gguf/whisper-base-Q8_0.gguf", "Whisper Base", "handy-computer/whisper-base-gguf", "whisper-base-Q8_0.gguf", 84962880, 0],
    ["handy-computer/whisper-base.en-gguf/whisper-base.en-Q8_0.gguf", "Whisper Base (English)", "handy-computer/whisper-base.en-gguf", "whisper-base.en-Q8_0.gguf", 84886208, 0],
    ["handy-computer/whisper-large-gguf/whisper-large-Q5_K_M.gguf", "Whisper Large", "handy-computer/whisper-large-gguf", "whisper-large-Q5_K_M.gguf", 1160366048, 0],
    ["handy-computer/whisper-large-v2-gguf/whisper-large-v2-Q5_K_M.gguf", "Whisper Large v2", "handy-computer/whisper-large-v2-gguf", "whisper-large-v2-Q5_K_M.gguf", 1160366080, 0],
    ["handy-computer/whisper-large-v3-gguf/whisper-large-v3-Q5_K_M.gguf", "Whisper Large v3", "handy-computer/whisper-large-v3-gguf", "whisper-large-v3-Q5_K_M.gguf", 1161143008, 0],
    ["handy-computer/whisper-large-v3-turbo-gguf/whisper-large-v3-turbo-Q8_0.gguf", "Whisper Large v3 Turbo", "handy-computer/whisper-large-v3-turbo-gguf", "whisper-large-v3-turbo-Q8_0.gguf", 886381760, 0],
    ["handy-computer/whisper-medium.en-gguf/whisper-medium.en-Q8_0.gguf", "Whisper Medium (English)", "handy-computer/whisper-medium.en-gguf", "whisper-medium.en-Q8_0.gguf", 831460928, 0],
    ["handy-computer/whisper-small-gguf/whisper-small-Q8_0.gguf", "Whisper Small", "handy-computer/whisper-small-gguf", "whisper-small-Q8_0.gguf", 269751136, 0],
    ["handy-computer/whisper-small.en-gguf/whisper-small.en-Q8_0.gguf", "Whisper Small (English)", "handy-computer/whisper-small.en-gguf", "whisper-small.en-Q8_0.gguf", 269674144, 0],
    ["handy-computer/whisper-tiny-gguf/whisper-tiny-Q8_0.gguf", "Whisper Tiny", "handy-computer/whisper-tiny-gguf", "whisper-tiny-Q8_0.gguf", 45981088, 0],
    ["handy-computer/whisper-tiny.en-gguf/whisper-tiny.en-Q8_0.gguf", "Whisper Tiny (English)", "handy-computer/whisper-tiny.en-gguf", "whisper-tiny.en-Q8_0.gguf", 45904544, 0]
    ]

    const downloads = {}
    let platformCache = null
    let hfCache = null

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

    async function engineUrl() {
      const p = await detectPlatform()
      return config.tcpp.engineUrl.replace('{platform}', p.os).replace('{arch}', p.arch)
    }

    async function engineExists() {
      try {
        await runCmd('test -x ' + q(config.tcpp.binary), { timeoutMs: 10000 })
        return true
      } catch (e) {
        return false
      }
    }

    async function adoptLocalEngine() {
      try {
        const cmd = 'find "$HOME" -maxdepth 8 -name transcribe-cli -type f -perm -u+x 2>/dev/null | head -n 3 || true'
        const r = await runCmd(cmd, { timeoutMs: 60000 })
        const out = String((r.stdout && r.stdout.text) || '')
        for (const line of out.split('\n')) {
          const p = line.trim()
          if (!p || p === config.tcpp.binary) continue
          const dir = config.tcpp.binary.slice(0, config.tcpp.binary.lastIndexOf('/'))
          await runCmd('mkdir -p ' + q(dir), { timeoutMs: 10000 })
          await runCmd('cp ' + q(p) + ' ' + q(config.tcpp.binary), { timeoutMs: 30000 })
          await runCmd('chmod +x ' + q(config.tcpp.binary), { timeoutMs: 10000 })
          return p
        }
        return null
      } catch (e) {
        return null
      }
    }

    async function refreshHfCache() {
      try {
        const cmd = 'ls -d "$HOME"/.cache/huggingface/hub/models--*/snapshots/*/*.gguf 2>/dev/null || true'
        const r = await runCmd(cmd, { timeoutMs: 30000 })
        const out = String((r.stdout && r.stdout.text) || '')
        const map = {}
        for (const line of out.split('\n')) {
          const p = line.trim()
          if (!p) continue
          const name = p.slice(p.lastIndexOf('/') + 1)
          if (name) map[name] = p
        }
        hfCache = { at: Date.now(), map: map }
      } catch (e) {
        hfCache = { at: Date.now(), map: {} }
      }
    }

    function catalogEntry(modelId) {
      for (let i = 0; i < CATALOG.length; i++) {
        if (CATALOG[i][0] === modelId) return CATALOG[i]
      }
      return null
    }

    async function modelPath(entry) {
      const localPath = config.tcpp.modelsDir + '/' + entry[3]
      try {
        await runCmd('test -f ' + q(localPath), { timeoutMs: 10000 })
        return { path: localPath, downloaded: true }
      } catch (e) {}
      if (!hfCache || Date.now() - hfCache.at > 30000) await refreshHfCache()
      const cached = hfCache.map[entry[3]]
      if (cached) return { path: cached, downloaded: true }
      return { path: localPath, downloaded: false }
    }

    function activeDownloads() {
      for (const k of Object.keys(downloads)) {
        if (downloads[k].status === 'downloading') return true
      }
      return false
    }

    async function runDownload(key, url, target, expectedSize) {
      downloads[key] = { status: 'downloading', bytes: 0, total: expectedSize || 0, error: '' }
      try {
        const dir = target.slice(0, target.lastIndexOf('/'))
        await runCmd('mkdir -p ' + q(dir), { timeoutMs: 10000 })
        await runCmd('curl -sS -L --fail --retry 2 -o ' + q(target + '.part') + ' ' + q(url), { timeoutMs: 3600000 })
        await runCmd('mv ' + q(target + '.part') + ' ' + q(target), { timeoutMs: 30000 })
        downloads[key].status = 'done'
        downloads[key].bytes = expectedSize || await fileSize(target)
      } catch (error) {
        downloads[key].status = 'error'
        const msg = String(error && error.message ? error.message : error)
        downloads[key].error = key === 'engine' && msg.indexOf('404') >= 0
          ? 'No engine release yet (404): push the repository and create tag v0.1.0 — CI will build the binaries. Or point "Engine path" to an existing transcribe-cli.'
          : msg
        try { await runCmd('rm -f ' + q(target + '.part'), { timeoutMs: 10000 }) } catch (e) {}
      }
      if (key === 'engine') { try { await runCmd('chmod +x ' + q(target), { timeoutMs: 10000 }) } catch (e) {} }
    }

    harness.handle('voice/config', async (args) => {
      if (args && typeof args === 'object') {
        if (args.provider === 'api' || args.provider === 'local' || args.provider === 'tcpp') config.provider = args.provider
        if (typeof args.language === 'string' && args.language) config.language = args.language
        const groups = ['tcpp', 'local', 'api']
        for (let gi = 0; gi < groups.length; gi++) {
          const g = groups[gi]
          if (args[g] && typeof args[g] === 'object') {
            for (const k of Object.keys(config[g])) {
              if (typeof args[g][k] === 'string') config[g][k] = args[g][k]
            }
          }
        }
      }
      return JSON.parse(JSON.stringify(config))
    })

    harness.handle('voice/models', async () => {
      try {
        const p = await detectPlatform()
        let exists = await engineExists()
        let adoptedFrom = null
        if (!exists) {
          adoptedFrom = await adoptLocalEngine()
          exists = !!adoptedFrom
        }
        await refreshHfCache()
        const models = CATALOG.map((m) => ({
          id: m[0], name: m[1], repo: m[2], file: m[3], size: m[4], recommended: m[5] === 1,
          downloaded: !!(hfCache.map[m[3]]),
        }))
        try {
          const r = await runCmd('ls ' + q(config.tcpp.modelsDir) + ' 2>/dev/null || true', { timeoutMs: 10000 })
          const localFiles = String((r.stdout && r.stdout.text) || '')
          for (const m of models) {
            if (localFiles.indexOf(m.file) >= 0) m.downloaded = true
          }
        } catch (e) {}
        const sorted = models.slice().sort((a, b) => (b.downloaded - a.downloaded) || (b.recommended - a.recommended) || a.name.localeCompare(b.name))
        return { ok: true, models: sorted, platform: { os: p.os, arch: p.arch, exists: exists, path: config.tcpp.binary, adoptedFrom: adoptedFrom, modelsDir: config.tcpp.modelsDir } }
      } catch (error) {
        return { ok: false, error: String(error && error.message ? error.message : error) }
      }
    })

    harness.handle('voice/download', async (args) => {
      try {
        const modelId = args && args.modelId ? String(args.modelId) : ''
        const entry = catalogEntry(modelId)
        if (!entry) return { ok: false, error: 'model not found in catalog' }
        const target = config.tcpp.modelsDir + '/' + entry[3]
        const existing = await modelPath(entry)
        if (existing.downloaded) return { ok: true, status: 'done' }
        if (activeDownloads()) return { ok: false, error: 'another download is already running' }
        const url = 'https://huggingface.co/' + entry[2] + '/resolve/main/' + entry[3]
        runDownload('model:' + modelId, url, target, entry[4])
        return { ok: true, status: 'downloading' }
      } catch (error) {
        return { ok: false, error: String(error && error.message ? error.message : error) }
      }
    })

    harness.handle('voice/engine-download', async () => {
      try {
        if (await engineExists()) return { ok: true, status: 'done' }
        const adopted = await adoptLocalEngine()
        if (adopted) return { ok: true, status: 'done', adoptedFrom: adopted }
        if (activeDownloads()) return { ok: false, error: 'another download is already running' }
        runDownload('engine', await engineUrl(), config.tcpp.binary, 0)
        return { ok: true, status: 'downloading' }
      } catch (error) {
        return { ok: false, error: String(error && error.message ? error.message : error) }
      }
    })

    harness.handle('voice/download-status', async () => {
      const out = {}
      for (const k of Object.keys(downloads)) {
        const d = downloads[k]
        if (d.status === 'downloading') {
          const isEngine = k === 'engine'
          const entry = isEngine ? null : catalogEntry(k.slice(6))
          const target = isEngine ? config.tcpp.binary : (entry ? config.tcpp.modelsDir + '/' + entry[3] : null)
          if (target) {
            try { d.bytes = await fileSize(target + '.part') } catch (e) {}
          }
        }
        out[k] = { status: d.status, bytes: d.bytes, total: d.total, error: d.error }
      }
      return { ok: true, downloads: out }
    })

    harness.handle('voice/transcribe', async (args) => {
      let tmp = null
      try {
        if (!args || typeof args.dataBase64 !== 'string' || !args.dataBase64) throw new Error('no audio data')
        tmp = wsRoot + '/.tmp/voice-' + Date.now() + '-' + Math.floor(Math.random() * 1000000)
        await runCmd('mkdir -p ' + q(tmp), { timeoutMs: 10000 })
        const mime = String(args.mimeType || '')
        let ext = 'webm'
        if (mime.indexOf('webm') >= 0) ext = 'webm'
        else if (mime.indexOf('mp4') >= 0) ext = 'm4a'
        else if (mime.indexOf('ogg') >= 0) ext = 'ogg'
        else if (mime.indexOf('wav') >= 0) ext = 'wav'
        await runCmd('base64 -d > ' + q(tmp + '/in.' + ext), { stdin: args.dataBase64, timeoutMs: 30000 })
        await runCmd('ffmpeg -y -hide_banner -loglevel error -i ' + q(tmp + '/in.' + ext) + ' -ar 16000 -ac 1 -c:a pcm_s16le ' + q(tmp + '/in.wav'), { timeoutMs: 30000 })
        let text = ''
        if (config.provider === 'tcpp') {
          if (!config.tcpp.modelId) throw new Error('no model selected (Settings → Voice)')
          const entry = catalogEntry(config.tcpp.modelId)
          if (!entry) throw new Error('model not found in catalog')
          let exists = await engineExists()
          if (!exists) await adoptLocalEngine()
          if (!(await engineExists())) throw new Error('engine is not installed — Settings → Voice → Download engine')
          const resolved = await modelPath(entry)
          if (!resolved.downloaded) throw new Error('model is not downloaded — Settings → Voice → Download')
          const isWhisper = entry[1].toLowerCase().indexOf('whisper') >= 0
          const langArg = isWhisper && config.language && config.language !== 'auto' ? ' -l ' + config.language : ''
          const wavBytes = await fileSize(tmp + '/in.wav')
          const durationSec = wavBytes / 32000
          if (durationSec > 22) {
            // Long audio: split into 20 s chunks and run the engine in batch
            // mode (one model load for all chunks, full text).
            await runCmd('mkdir -p ' + q(tmp + '/chunks'), { timeoutMs: 10000 })
            await runCmd('ffmpeg -y -hide_banner -loglevel error -i ' + q(tmp + '/in.wav') + ' -f segment -segment_time 20 -c copy ' + q(tmp + '/chunks/chunk_%03d.wav'), { timeoutMs: 60000 })
            await runCmd('ls ' + q(tmp + '/chunks') + '/chunk_*.wav | sort > ' + q(tmp + '/list.txt'), { timeoutMs: 10000, workdir: tmp })
            const cmd = q(config.tcpp.binary) + ' --batch ' + q(tmp + '/list.txt') + ' -m ' + q(resolved.path) + ' -q' + langArg + ' --batch-jsonl'
            const result = await runCmd(cmd, { timeoutMs: 900000, workdir: tmp })
            const outText = (result.stdout && result.stdout.text) || ''
            const parts = []
            for (const line of outText.split('\n')) {
              const l = line.trim()
              if (!l) continue
              let parsed = null
              try { parsed = JSON.parse(l) } catch (e) { parsed = null }
              if (parsed && typeof parsed.text === 'string' && parsed.text.trim()) parts.push(parsed.text.trim())
            }
            if (!parts.length) throw new Error('transcribe-cli: no batch output')
            text = parts.join(' ')
          } else {
            const cmd = q(config.tcpp.binary) + ' -m ' + q(resolved.path) + ' -q' + langArg + ' -o ' + q(tmp + '/out.txt') + ' ' + q(tmp + '/in.wav')
            await runCmd(cmd, { timeoutMs: 600000, workdir: tmp })
            const target = await fs.resolve(tmp + '/out.txt')
            text = await fs.readText(target)
          }
        } else if (config.provider === 'api') {
          if (!config.api.key) throw new Error('API key is not set (Settings → Voice)')
          const langArg = config.language && config.language !== 'auto' ? ' -F ' + q('language=' + config.language) : ''
          const cmd = 'curl -sS --max-time 120 -X POST ' + q(config.api.url) + ' -H ' + q('Authorization: Bearer ' + config.api.key) + ' -F ' + q('file=@' + tmp + '/in.wav;type=audio/wav') + ' -F ' + q('model=' + config.api.model) + langArg
          const result = await runCmd(cmd, { timeoutMs: 130000 })
          const outText = (result.stdout && result.stdout.text) || ''
          let parsed = null
          try { parsed = JSON.parse(outText) } catch (e) { parsed = null }
          if (parsed && typeof parsed.text === 'string') text = parsed.text
          else if (parsed && parsed.error && parsed.error.message) throw new Error('API: ' + parsed.error.message)
          else throw new Error('API: unexpected response: ' + outText.slice(0, 300))
        } else {
          const langArg = config.language && config.language !== 'auto' ? ' -l ' + config.language : ''
          const cmd = q(config.local.binary) + ' -m ' + q(config.local.model) + langArg + ' -f ' + q(tmp + '/in.wav') + ' -oj -of ' + q(tmp + '/out')
          await runCmd(cmd, { timeoutMs: 300000, workdir: tmp })
          const target = await fs.resolve(tmp + '/out.json')
          const jsonText = await fs.readText(target)
          const parsed = JSON.parse(jsonText)
          if (parsed && typeof parsed.text === 'string') {
            text = parsed.text
          } else if (parsed && Array.isArray(parsed.transcription)) {
            text = parsed.transcription.map((seg) => (seg && typeof seg.text === 'string') ? seg.text : '').join('')
          } else {
            throw new Error('whisper: could not parse out.json')
          }
        }
        const cleaned = String(text).trim()
        if (!cleaned) return { ok: true, text: '', empty: true }
        return { ok: true, text: cleaned }
      } catch (error) {
        return { ok: false, error: String(error && error.message ? error.message : error) }
      } finally {
        if (tmp) {
          try { await runCmd('rm -rf ' + q(tmp), { timeoutMs: 10000 }) } catch (e) {}
        }
      }
    })
  },
}
