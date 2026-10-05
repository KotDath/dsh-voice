import { invariant } from "./invariant.js";
import { createRequire } from "node:module";
//#region src/plugin/generated-catalog.ts
const CATALOG = [
	{
		"id": "handy-computer/canary-180m-flash-gguf/canary-180m-flash-Q8_0.gguf",
		"name": "Canary 180M Flash",
		"repo": "handy-computer/canary-180m-flash-gguf",
		"file": "canary-180m-flash-Q8_0.gguf",
		"size": 218447552,
		"recommended": true,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/cohere-transcribe-03-2026-gguf/cohere-transcribe-03-2026-Q5_K_M.gguf",
		"name": "Cohere Transcribe",
		"repo": "handy-computer/cohere-transcribe-03-2026-gguf",
		"file": "cohere-transcribe-03-2026-Q5_K_M.gguf",
		"size": 1770270208,
		"recommended": true,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/nemotron-3.5-asr-streaming-0.6b-gguf/nemotron-3.5-asr-streaming-0.6b-Q8_0.gguf",
		"name": "Nemotron Streaming 3.5",
		"repo": "handy-computer/nemotron-3.5-asr-streaming-0.6b-gguf",
		"file": "nemotron-3.5-asr-streaming-0.6b-Q8_0.gguf",
		"size": 751094240,
		"recommended": true,
		"windowSec": 25,
		"streaming": true
	},
	{
		"id": "handy-computer/parakeet-unified-en-0.6b-gguf/parakeet-unified-en-0.6b-Q8_0.gguf",
		"name": "Parakeet Unified EN 0.6B",
		"repo": "handy-computer/parakeet-unified-en-0.6b-gguf",
		"file": "parakeet-unified-en-0.6b-Q8_0.gguf",
		"size": 731357568,
		"recommended": true,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/whisper-medium-gguf/whisper-medium-Q8_0.gguf",
		"name": "Whisper Medium",
		"repo": "handy-computer/whisper-medium-gguf",
		"file": "whisper-medium-Q8_0.gguf",
		"size": 831538144,
		"recommended": true,
		"windowSec": 30,
		"streaming": false
	},
	{
		"id": "handy-computer/Breeze-ASR-25-gguf/Breeze-ASR-25-Q5_K_M.gguf",
		"name": "Breeze-ASR-25",
		"repo": "handy-computer/Breeze-ASR-25-gguf",
		"file": "Breeze-ASR-25-Q5_K_M.gguf",
		"size": 1160366080,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/canary-1b-gguf/canary-1b-Q5_K_M.gguf",
		"name": "Canary 1B",
		"repo": "handy-computer/canary-1b-gguf",
		"file": "canary-1b-Q5_K_M.gguf",
		"size": 837694272,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/canary-1b-flash-gguf/canary-1b-flash-Q5_K_M.gguf",
		"name": "Canary 1B Flash",
		"repo": "handy-computer/canary-1b-flash-gguf",
		"file": "canary-1b-flash-Q5_K_M.gguf",
		"size": 769563424,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/canary-1b-v2-gguf/canary-1b-v2-Q5_K_M.gguf",
		"name": "Canary 1B v2",
		"repo": "handy-computer/canary-1b-v2-gguf",
		"file": "canary-1b-v2-Q5_K_M.gguf",
		"size": 836664032,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/canary-qwen-2.5b-gguf/canary-qwen-2.5b-Q5_K_M.gguf",
		"name": "Canary-Qwen 2.5B",
		"repo": "handy-computer/canary-qwen-2.5b-gguf",
		"file": "canary-qwen-2.5b-Q5_K_M.gguf",
		"size": 1983729024,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/cohere-transcribe-arabic-07-2026-gguf/cohere-transcribe-arabic-07-2026-Q5_K_M.gguf",
		"name": "Cohere Transcribe",
		"repo": "handy-computer/cohere-transcribe-arabic-07-2026-gguf",
		"file": "cohere-transcribe-arabic-07-2026-Q5_K_M.gguf",
		"size": 1770270112,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/Fun-ASR-Nano-2512-gguf/Fun-ASR-Nano-2512-Q8_0.gguf",
		"name": "Fun-ASR Nano",
		"repo": "handy-computer/Fun-ASR-Nano-2512-gguf",
		"file": "Fun-ASR-Nano-2512-Q8_0.gguf",
		"size": 891270912,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/Fun-ASR-MLT-Nano-2512-gguf/Fun-ASR-MLT-Nano-2512-Q8_0.gguf",
		"name": "Fun-ASR Nano Multilingual",
		"repo": "handy-computer/Fun-ASR-MLT-Nano-2512-gguf",
		"file": "Fun-ASR-MLT-Nano-2512-Q8_0.gguf",
		"size": 891271232,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/gigaam-v3-ctc-gguf/gigaam-v3-ctc-Q8_0.gguf",
		"name": "GigaAM v3 CTC",
		"repo": "handy-computer/gigaam-v3-ctc-gguf",
		"file": "gigaam-v3-ctc-Q8_0.gguf",
		"size": 271803328,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/gigaam-v3-e2e-ctc-gguf/gigaam-v3-e2e-ctc-Q8_0.gguf",
		"name": "GigaAM v3 E2E-CTC",
		"repo": "handy-computer/gigaam-v3-e2e-ctc-gguf",
		"file": "gigaam-v3-e2e-ctc-Q8_0.gguf",
		"size": 272151136,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/gigaam-v3-e2e-rnnt-gguf/gigaam-v3-e2e-rnnt-Q8_0.gguf",
		"name": "GigaAM v3 E2E-RNN-T",
		"repo": "handy-computer/gigaam-v3-e2e-rnnt-gguf",
		"file": "gigaam-v3-e2e-rnnt-Q8_0.gguf",
		"size": 273724832,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/gigaam-v3-rnnt-gguf/gigaam-v3-rnnt-Q8_0.gguf",
		"name": "GigaAM v3 RNN-T",
		"repo": "handy-computer/gigaam-v3-rnnt-gguf",
		"file": "gigaam-v3-rnnt-Q8_0.gguf",
		"size": 273022880,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/granite-4.0-1b-speech-gguf/granite-4.0-1b-speech-Q5_K_M.gguf",
		"name": "Granite Speech 4.0 1B",
		"repo": "handy-computer/granite-4.0-1b-speech-gguf",
		"file": "granite-4.0-1b-speech-Q5_K_M.gguf",
		"size": 1829704544,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/granite-speech-4.1-2b-gguf/granite-speech-4.1-2b-Q5_K_M.gguf",
		"name": "Granite Speech 4.1 2B",
		"repo": "handy-computer/granite-speech-4.1-2b-gguf",
		"file": "granite-speech-4.1-2b-Q5_K_M.gguf",
		"size": 1829704544,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/granite-speech-4.1-2b-nar-gguf/granite-speech-4.1-2b-nar-Q5_K_M.gguf",
		"name": "Granite Speech 4.1 2B NAR",
		"repo": "handy-computer/granite-speech-4.1-2b-nar-gguf",
		"file": "granite-speech-4.1-2b-nar-Q5_K_M.gguf",
		"size": 1782089344,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/granite-speech-4.1-2b-plus-gguf/granite-speech-4.1-2b-plus-Q5_K_M.gguf",
		"name": "Granite Speech 4.1 2B Plus",
		"repo": "handy-computer/granite-speech-4.1-2b-plus-gguf",
		"file": "granite-speech-4.1-2b-plus-Q5_K_M.gguf",
		"size": 1691297088,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/medasr-gguf/medasr-Q8_0.gguf",
		"name": "MedASR",
		"repo": "handy-computer/medasr-gguf",
		"file": "medasr-Q8_0.gguf",
		"size": 127712448,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/moonshine-base-gguf/moonshine-base-Q8_0.gguf",
		"name": "Moonshine Base",
		"repo": "handy-computer/moonshine-base-gguf",
		"file": "moonshine-base-Q8_0.gguf",
		"size": 77476480,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/moonshine-base-ar-gguf/moonshine-base-ar-Q8_0.gguf",
		"name": "Moonshine Base (Arabic)",
		"repo": "handy-computer/moonshine-base-ar-gguf",
		"file": "moonshine-base-ar-Q8_0.gguf",
		"size": 77476480,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/moonshine-base-zh-gguf/moonshine-base-zh-Q8_0.gguf",
		"name": "Moonshine Base (Chinese)",
		"repo": "handy-computer/moonshine-base-zh-gguf",
		"file": "moonshine-base-zh-Q8_0.gguf",
		"size": 77476480,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/moonshine-base-ja-gguf/moonshine-base-ja-Q8_0.gguf",
		"name": "Moonshine Base (Japanese)",
		"repo": "handy-computer/moonshine-base-ja-gguf",
		"file": "moonshine-base-ja-Q8_0.gguf",
		"size": 77476480,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/moonshine-base-ko-gguf/moonshine-base-ko-Q8_0.gguf",
		"name": "Moonshine Base (Korean)",
		"repo": "handy-computer/moonshine-base-ko-gguf",
		"file": "moonshine-base-ko-Q8_0.gguf",
		"size": 77476480,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/moonshine-base-uk-gguf/moonshine-base-uk-Q8_0.gguf",
		"name": "Moonshine Base (Ukrainian)",
		"repo": "handy-computer/moonshine-base-uk-gguf",
		"file": "moonshine-base-uk-Q8_0.gguf",
		"size": 77476512,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/moonshine-base-vi-gguf/moonshine-base-vi-Q8_0.gguf",
		"name": "Moonshine Base (Vietnamese)",
		"repo": "handy-computer/moonshine-base-vi-gguf",
		"file": "moonshine-base-vi-Q8_0.gguf",
		"size": 77476512,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/moonshine-streaming-medium-gguf/moonshine-streaming-medium-Q8_0.gguf",
		"name": "Moonshine Streaming Medium",
		"repo": "handy-computer/moonshine-streaming-medium-gguf",
		"file": "moonshine-streaming-medium-Q8_0.gguf",
		"size": 295793568,
		"recommended": false,
		"windowSec": 25,
		"streaming": true
	},
	{
		"id": "handy-computer/moonshine-streaming-small-gguf/moonshine-streaming-small-Q8_0.gguf",
		"name": "Moonshine Streaming Small",
		"repo": "handy-computer/moonshine-streaming-small-gguf",
		"file": "moonshine-streaming-small-Q8_0.gguf",
		"size": 198506848,
		"recommended": false,
		"windowSec": 25,
		"streaming": true
	},
	{
		"id": "handy-computer/moonshine-streaming-tiny-gguf/moonshine-streaming-tiny-Q8_0.gguf",
		"name": "Moonshine Streaming Tiny",
		"repo": "handy-computer/moonshine-streaming-tiny-gguf",
		"file": "moonshine-streaming-tiny-Q8_0.gguf",
		"size": 50462816,
		"recommended": false,
		"windowSec": 25,
		"streaming": true
	},
	{
		"id": "handy-computer/moonshine-tiny-gguf/moonshine-tiny-Q8_0.gguf",
		"name": "Moonshine Tiny",
		"repo": "handy-computer/moonshine-tiny-gguf",
		"file": "moonshine-tiny-Q8_0.gguf",
		"size": 35466912,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/moonshine-tiny-ar-gguf/moonshine-tiny-ar-Q8_0.gguf",
		"name": "Moonshine Tiny (Arabic)",
		"repo": "handy-computer/moonshine-tiny-ar-gguf",
		"file": "moonshine-tiny-ar-Q8_0.gguf",
		"size": 35466944,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/moonshine-tiny-zh-gguf/moonshine-tiny-zh-Q8_0.gguf",
		"name": "Moonshine Tiny (Chinese)",
		"repo": "handy-computer/moonshine-tiny-zh-gguf",
		"file": "moonshine-tiny-zh-Q8_0.gguf",
		"size": 35466944,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/moonshine-tiny-ja-gguf/moonshine-tiny-ja-Q8_0.gguf",
		"name": "Moonshine Tiny (Japanese)",
		"repo": "handy-computer/moonshine-tiny-ja-gguf",
		"file": "moonshine-tiny-ja-Q8_0.gguf",
		"size": 35466944,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/moonshine-tiny-ko-gguf/moonshine-tiny-ko-Q8_0.gguf",
		"name": "Moonshine Tiny (Korean)",
		"repo": "handy-computer/moonshine-tiny-ko-gguf",
		"file": "moonshine-tiny-ko-Q8_0.gguf",
		"size": 35466944,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/moonshine-tiny-uk-gguf/moonshine-tiny-uk-Q8_0.gguf",
		"name": "Moonshine Tiny (Ukrainian)",
		"repo": "handy-computer/moonshine-tiny-uk-gguf",
		"file": "moonshine-tiny-uk-Q8_0.gguf",
		"size": 35466944,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/moonshine-tiny-vi-gguf/moonshine-tiny-vi-Q8_0.gguf",
		"name": "Moonshine Tiny (Vietnamese)",
		"repo": "handy-computer/moonshine-tiny-vi-gguf",
		"file": "moonshine-tiny-vi-Q8_0.gguf",
		"size": 35466944,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/multitalker-parakeet-streaming-0.6b-v1-gguf/multitalker-parakeet-streaming-0.6b-v1-Q8_0.gguf",
		"name": "Multitalker Parakeet Streaming EN",
		"repo": "handy-computer/multitalker-parakeet-streaming-0.6b-v1-gguf",
		"file": "multitalker-parakeet-streaming-0.6b-v1-Q8_0.gguf",
		"size": 734123712,
		"recommended": false,
		"windowSec": 25,
		"streaming": true
	},
	{
		"id": "handy-computer/nemotron-speech-streaming-en-0.6b-gguf/nemotron-speech-streaming-en-0.6b-Q8_0.gguf",
		"name": "Nemotron Speech Streaming EN",
		"repo": "handy-computer/nemotron-speech-streaming-en-0.6b-gguf",
		"file": "nemotron-speech-streaming-en-0.6b-Q8_0.gguf",
		"size": 729650176,
		"recommended": false,
		"windowSec": 25,
		"streaming": true
	},
	{
		"id": "handy-computer/parakeet-ctc-0.6b-gguf/parakeet-ctc-0.6b-Q8_0.gguf",
		"name": "Parakeet CTC 0.6B",
		"repo": "handy-computer/parakeet-ctc-0.6b-gguf",
		"file": "parakeet-ctc-0.6b-Q8_0.gguf",
		"size": 722271424,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/parakeet-ctc-1.1b-gguf/parakeet-ctc-1.1b-Q5_K_M.gguf",
		"name": "Parakeet CTC 1.1B",
		"repo": "handy-computer/parakeet-ctc-1.1b-gguf",
		"file": "parakeet-ctc-1.1b-Q5_K_M.gguf",
		"size": 928584736,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/parakeet-rnnt-0.6b-gguf/parakeet-rnnt-0.6b-Q8_0.gguf",
		"name": "Parakeet RNN-T 0.6B",
		"repo": "handy-computer/parakeet-rnnt-0.6b-gguf",
		"file": "parakeet-rnnt-0.6b-Q8_0.gguf",
		"size": 729687456,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/parakeet-rnnt-1.1b-gguf/parakeet-rnnt-1.1b-Q5_K_M.gguf",
		"name": "Parakeet RNN-T 1.1B",
		"repo": "handy-computer/parakeet-rnnt-1.1b-gguf",
		"file": "parakeet-rnnt-1.1b-Q5_K_M.gguf",
		"size": 935755008,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/parakeet-tdt-0.6b-v2-gguf/parakeet-tdt-0.6b-v2-Q8_0.gguf",
		"name": "Parakeet TDT 0.6B v2",
		"repo": "handy-computer/parakeet-tdt-0.6b-v2-gguf",
		"file": "parakeet-tdt-0.6b-v2-Q8_0.gguf",
		"size": 729574912,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/parakeet-tdt-0.6b-v3-gguf/parakeet-tdt-0.6b-v3-Q8_0.gguf",
		"name": "Parakeet TDT 0.6B v3",
		"repo": "handy-computer/parakeet-tdt-0.6b-v3-gguf",
		"file": "parakeet-tdt-0.6b-v3-Q8_0.gguf",
		"size": 739508576,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/parakeet-tdt-1.1b-gguf/parakeet-tdt-1.1b-Q5_K_M.gguf",
		"name": "Parakeet TDT 1.1B",
		"repo": "handy-computer/parakeet-tdt-1.1b-gguf",
		"file": "parakeet-tdt-1.1b-Q5_K_M.gguf",
		"size": 935758496,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/parakeet-tdt_ctc-1.1b-gguf/parakeet-tdt_ctc-1.1b-Q5_K_M.gguf",
		"name": "Parakeet TDT-CTC 1.1B",
		"repo": "handy-computer/parakeet-tdt_ctc-1.1b-gguf",
		"file": "parakeet-tdt_ctc-1.1b-Q5_K_M.gguf",
		"size": 935758080,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/parakeet-tdt_ctc-110m-gguf/parakeet-tdt_ctc-110m-Q8_0.gguf",
		"name": "Parakeet TDT-CTC 110M",
		"repo": "handy-computer/parakeet-tdt_ctc-110m-gguf",
		"file": "parakeet-tdt_ctc-110m-Q8_0.gguf",
		"size": 135373280,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/Qwen3-ASR-0.6B-gguf/Qwen3-ASR-0.6B-Q8_0.gguf",
		"name": "Qwen3-ASR 0.6B",
		"repo": "handy-computer/Qwen3-ASR-0.6B-gguf",
		"file": "Qwen3-ASR-0.6B-Q8_0.gguf",
		"size": 850423456,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/Qwen3-ASR-1.7B-gguf/Qwen3-ASR-1.7B-Q5_K_M.gguf",
		"name": "Qwen3-ASR 1.7B",
		"repo": "handy-computer/Qwen3-ASR-1.7B-gguf",
		"file": "Qwen3-ASR-1.7B-Q5_K_M.gguf",
		"size": 1517290464,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/SenseVoiceSmall-gguf/SenseVoiceSmall-Q8_0.gguf",
		"name": "SenseVoice Small",
		"repo": "handy-computer/SenseVoiceSmall-gguf",
		"file": "SenseVoiceSmall-Q8_0.gguf",
		"size": 252684608,
		"recommended": false,
		"windowSec": 25,
		"streaming": false
	},
	{
		"id": "handy-computer/Voxtral-Mini-3B-2507-gguf/Voxtral-Mini-3B-2507-Q5_K_M.gguf",
		"name": "Voxtral Mini 3B",
		"repo": "handy-computer/Voxtral-Mini-3B-2507-gguf",
		"file": "Voxtral-Mini-3B-2507-Q5_K_M.gguf",
		"size": 3464182432,
		"recommended": false,
		"windowSec": 25,
		"streaming": true
	},
	{
		"id": "handy-computer/Voxtral-Mini-4B-Realtime-2602-gguf/Voxtral-Mini-4B-Realtime-2602-Q5_K_M.gguf",
		"name": "Voxtral Mini 4B Realtime",
		"repo": "handy-computer/Voxtral-Mini-4B-Realtime-2602-gguf",
		"file": "Voxtral-Mini-4B-Realtime-2602-Q5_K_M.gguf",
		"size": 3281439008,
		"recommended": false,
		"windowSec": 25,
		"streaming": true
	},
	{
		"id": "handy-computer/Voxtral-Small-24B-2507-gguf/Voxtral-Small-24B-2507-Q5_K_M.gguf",
		"name": "Voxtral Small 24B",
		"repo": "handy-computer/Voxtral-Small-24B-2507-gguf",
		"file": "Voxtral-Small-24B-2507-Q5_K_M.gguf",
		"size": 17138659808,
		"recommended": false,
		"windowSec": 25,
		"streaming": true
	},
	{
		"id": "handy-computer/whisper-base-gguf/whisper-base-Q8_0.gguf",
		"name": "Whisper Base",
		"repo": "handy-computer/whisper-base-gguf",
		"file": "whisper-base-Q8_0.gguf",
		"size": 84962880,
		"recommended": false,
		"windowSec": 30,
		"streaming": false
	},
	{
		"id": "handy-computer/whisper-base.en-gguf/whisper-base.en-Q8_0.gguf",
		"name": "Whisper Base (English)",
		"repo": "handy-computer/whisper-base.en-gguf",
		"file": "whisper-base.en-Q8_0.gguf",
		"size": 84886208,
		"recommended": false,
		"windowSec": 30,
		"streaming": false
	},
	{
		"id": "handy-computer/whisper-large-gguf/whisper-large-Q5_K_M.gguf",
		"name": "Whisper Large",
		"repo": "handy-computer/whisper-large-gguf",
		"file": "whisper-large-Q5_K_M.gguf",
		"size": 1160366048,
		"recommended": false,
		"windowSec": 30,
		"streaming": false
	},
	{
		"id": "handy-computer/whisper-large-v2-gguf/whisper-large-v2-Q5_K_M.gguf",
		"name": "Whisper Large v2",
		"repo": "handy-computer/whisper-large-v2-gguf",
		"file": "whisper-large-v2-Q5_K_M.gguf",
		"size": 1160366080,
		"recommended": false,
		"windowSec": 30,
		"streaming": false
	},
	{
		"id": "handy-computer/whisper-large-v3-gguf/whisper-large-v3-Q5_K_M.gguf",
		"name": "Whisper Large v3",
		"repo": "handy-computer/whisper-large-v3-gguf",
		"file": "whisper-large-v3-Q5_K_M.gguf",
		"size": 1161143008,
		"recommended": false,
		"windowSec": 30,
		"streaming": false
	},
	{
		"id": "handy-computer/whisper-large-v3-turbo-gguf/whisper-large-v3-turbo-Q8_0.gguf",
		"name": "Whisper Large v3 Turbo",
		"repo": "handy-computer/whisper-large-v3-turbo-gguf",
		"file": "whisper-large-v3-turbo-Q8_0.gguf",
		"size": 886381760,
		"recommended": false,
		"windowSec": 30,
		"streaming": false
	},
	{
		"id": "handy-computer/whisper-medium.en-gguf/whisper-medium.en-Q8_0.gguf",
		"name": "Whisper Medium (English)",
		"repo": "handy-computer/whisper-medium.en-gguf",
		"file": "whisper-medium.en-Q8_0.gguf",
		"size": 831460928,
		"recommended": false,
		"windowSec": 30,
		"streaming": false
	},
	{
		"id": "handy-computer/whisper-small-gguf/whisper-small-Q8_0.gguf",
		"name": "Whisper Small",
		"repo": "handy-computer/whisper-small-gguf",
		"file": "whisper-small-Q8_0.gguf",
		"size": 269751136,
		"recommended": false,
		"windowSec": 30,
		"streaming": false
	},
	{
		"id": "handy-computer/whisper-small.en-gguf/whisper-small.en-Q8_0.gguf",
		"name": "Whisper Small (English)",
		"repo": "handy-computer/whisper-small.en-gguf",
		"file": "whisper-small.en-Q8_0.gguf",
		"size": 269674144,
		"recommended": false,
		"windowSec": 30,
		"streaming": false
	},
	{
		"id": "handy-computer/whisper-tiny-gguf/whisper-tiny-Q8_0.gguf",
		"name": "Whisper Tiny",
		"repo": "handy-computer/whisper-tiny-gguf",
		"file": "whisper-tiny-Q8_0.gguf",
		"size": 45981088,
		"recommended": false,
		"windowSec": 30,
		"streaming": false
	},
	{
		"id": "handy-computer/whisper-tiny.en-gguf/whisper-tiny.en-Q8_0.gguf",
		"name": "Whisper Tiny (English)",
		"repo": "handy-computer/whisper-tiny.en-gguf",
		"file": "whisper-tiny.en-Q8_0.gguf",
		"size": 45904544,
		"recommended": false,
		"windowSec": 30,
		"streaming": false
	}
];
//#endregion
//#region src/plugin/index.ts
/** Plugin name (row id `voice` in cordis.patch.yml). */
const name = "dsh-voice";
/**
* The version of the module that is actually loaded right now, read from the
* package this file belongs to. It is the build marker for live reloads: when
* the profile installs this repo directly (a `file:` link), the Cordis HMR row
* watching `node_modules/dsh-voice/lib` re-mounts the row after
* `npm run build`, and `/api/voice/config` reports the new version without a
* restart. See AGENTS.md, "Restart vs live reload".
*/
function readOwnVersion() {
	try {
		const pkg = createRequire(import.meta.url)("../package.json");
		return typeof pkg.version === "string" ? pkg.version : "unknown";
	} catch {
		return "unknown";
	}
}
/** Version of the loaded module (see {@link readOwnVersion}). */
const version = readOwnVersion();
const LANGUAGE_CODES = {
	auto: 1,
	ru: 1,
	en: 1,
	uk: 1,
	de: 1
};
const PROVIDERS = {
	tcpp: 1,
	local: 1,
	api: 1,
	codex: 1
};
function publicConfigView(config) {
	return {
		version,
		provider: config.provider,
		language: config.language,
		tcpp: { ...config.tcpp },
		local: { ...config.local },
		api: {
			url: config.api.url,
			model: config.api.model,
			hasKey: config.api.key !== ""
		},
		codex: { ...config.codex }
	};
}
function applyConfigPatch(config, patch) {
	if (!patch || typeof patch !== "object") return;
	if (typeof patch.provider === "string" && PROVIDERS[patch.provider]) config.provider = patch.provider;
	if (typeof patch.language === "string" && LANGUAGE_CODES[patch.language]) config.language = patch.language;
	for (const g of [
		"tcpp",
		"local",
		"api",
		"codex"
	]) {
		const p = patch[g];
		if (p && typeof p === "object") {
			if (typeof p.binary === "string" && (g === "tcpp" || g === "local")) config[g].binary = p.binary.trim();
			if (g === "tcpp" && typeof p.modelsDir === "string") config.tcpp.modelsDir = p.modelsDir.trim();
			if (g === "tcpp" && typeof p.engineUrl === "string") config.tcpp.engineUrl = p.engineUrl.trim();
			if (g === "tcpp" && typeof p.modelId === "string") config.tcpp.modelId = p.modelId.trim();
			if (g === "local" && typeof p.model === "string") config.local.model = p.model.trim();
			if (g === "api" && typeof p.url === "string") config.api.url = p.url.trim();
			if (g === "api" && typeof p.model === "string") config.api.model = p.model.trim();
			if (g === "codex" && typeof p.authPath === "string") config.codex.authPath = p.authPath.trim();
			if (g === "codex" && typeof p.endpoint === "string") config.codex.endpoint = p.endpoint.trim();
			if (g === "codex" && typeof p.model === "string") config.codex.model = p.model.trim();
		}
	}
}
function q(s) {
	return "\"" + String(s).replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\$/g, "\\$").replace(/`/g, "\\`") + "\"";
}
async function runCmd(deps, command, opts = {}) {
	const spec = deps.shell.resolve({
		command,
		workdir: opts.workdir,
		stdin: opts.stdin,
		timeoutMs: opts.timeoutMs ?? 3e4,
		stdoutMaxBytes: 4194304,
		env: opts.env
	});
	const result = await deps.shell.run(spec);
	if (result.exitCode !== 0) {
		const stderrText = result.stderr?.text ?? "";
		const stdoutText = result.stdout?.text ?? "";
		throw new Error("command failed (exit " + result.exitCode + (result.timedOut ? ", timeout" : "") + "): " + (stderrText || stdoutText || "").slice(0, 400));
	}
	return result;
}
async function fileSize(deps, p) {
	const r = await runCmd(deps, "wc -c < " + q(p), { timeoutMs: 1e4 });
	return parseInt(String(r.stdout?.text ?? "").trim(), 10) || 0;
}
async function fileExists(deps, p) {
	try {
		await runCmd(deps, "test -f " + q(p), { timeoutMs: 1e4 });
		return true;
	} catch {
		return false;
	}
}
async function sha256(deps, path) {
	try {
		const r = await runCmd(deps, "(sha256sum " + q(path) + " 2>/dev/null || shasum -a 256 " + q(path) + " 2>/dev/null) || true", { timeoutMs: 6e4 });
		return String(r.stdout?.text ?? "").trim().split(/\s+/)[0] ?? "";
	} catch {
		return "";
	}
}
async function detectPlatform(deps) {
	const osR = await runCmd(deps, "uname -s", { timeoutMs: 1e4 });
	const archR = await runCmd(deps, "uname -m", { timeoutMs: 1e4 });
	const os = String(osR.stdout?.text ?? "").trim().toLowerCase();
	const arch = String(archR.stdout?.text ?? "").trim().toLowerCase();
	let platform = "linux";
	const archName = arch === "x86_64" || arch === "amd64" ? "x86_64" : arch === "aarch64" || arch === "arm64" ? "arm64" : arch;
	if (os.indexOf("darwin") >= 0) platform = "macos";
	else if (os.indexOf("mingw") >= 0 || os.indexOf("msys") >= 0 || os.indexOf("windows") >= 0) platform = "windows";
	return {
		os: platform,
		arch: archName
	};
}
async function engineUrl(config, deps) {
	const p = await detectPlatform(deps);
	let url = config.tcpp.engineUrl.replace("{platform}", p.os).replace("{arch}", p.arch);
	if (p.os === "windows" && !/\.exe$/i.test(url)) url += ".exe";
	return url;
}
let hfCache = null;
async function refreshHfCache(deps) {
	try {
		const r = await runCmd(deps, "ls -d \"$HOME\"/.cache/huggingface/hub/models--*/snapshots/*/*.gguf 2>/dev/null || true", { timeoutMs: 3e4 });
		const out = String(r.stdout?.text ?? "");
		const map = {};
		for (const line of out.split("\n")) {
			const p = line.trim();
			if (!p) continue;
			const fn = p.slice(p.lastIndexOf("/") + 1);
			if (fn) map[fn] = p;
		}
		hfCache = {
			at: Date.now(),
			map
		};
		return map;
	} catch {
		hfCache = {
			at: Date.now(),
			map: {}
		};
		return {};
	}
}
async function hfPathFor(deps, filename) {
	if (!hfCache || Date.now() - hfCache.at > 3e4) await refreshHfCache(deps);
	return hfCache?.map[filename] ?? null;
}
const downloads = {};
function activeDownloads() {
	for (const k of Object.keys(downloads)) if (downloads[k].status === "downloading") return true;
	return false;
}
async function runDownload(deps, fs, key, url, target, expectedSize, afterDone) {
	downloads[key] = {
		status: "downloading",
		bytes: 0,
		total: expectedSize || 0,
		error: ""
	};
	try {
		await runCmd(deps, "mkdir -p " + q(target.slice(0, target.lastIndexOf("/"))), { timeoutMs: 1e4 });
		await runCmd(deps, "curl -sS -L --fail --retry 2 -o " + q(target + ".part") + " " + q(url), { timeoutMs: 36e5 });
		await runCmd(deps, "mv " + q(target + ".part") + " " + q(target), { timeoutMs: 3e4 });
		if (key === "engine") try {
			await runCmd(deps, "chmod +x " + q(target), { timeoutMs: 1e4 });
		} catch {}
		if (afterDone) await afterDone(target);
		downloads[key].status = "done";
		downloads[key].bytes = expectedSize || await fileSize(deps, target);
	} catch (error) {
		downloads[key].status = "error";
		downloads[key].error = error instanceof Error ? error.message : String(error);
		try {
			await runCmd(deps, "rm -f " + q(target + ".part"), { timeoutMs: 1e4 });
		} catch {}
	}
}
function downloadStatusSnapshot() {
	return downloads;
}
async function ensureBinaryPath(config, deps) {
	if (config.tcpp.binary.slice(-4).toLowerCase() === ".exe") return config.tcpp.binary;
	if ((await detectPlatform(deps)).os === "windows") config.tcpp.binary += ".exe";
	return config.tcpp.binary;
}
async function engineExists(config, deps) {
	try {
		await ensureBinaryPath(config, deps);
		await runCmd(deps, "test -x " + q(config.tcpp.binary), { timeoutMs: 1e4 });
		return true;
	} catch {
		return false;
	}
}
async function adoptEngineFrom(config, deps, source) {
	if (!source || source === config.tcpp.binary) return null;
	if (!await fileExists(deps, source)) return null;
	await runCmd(deps, "mkdir -p " + q(config.tcpp.binary.slice(0, config.tcpp.binary.lastIndexOf("/"))), { timeoutMs: 1e4 });
	await runCmd(deps, "cp " + q(source) + " " + q(config.tcpp.binary), { timeoutMs: 3e4 });
	await runCmd(deps, "chmod +x " + q(config.tcpp.binary), { timeoutMs: 1e4 });
	return source;
}
async function discoverEngine(config, deps) {
	await ensureBinaryPath(config, deps);
	try {
		const r = await runCmd(deps, "command -v transcribe-cli 2>/dev/null || true", { timeoutMs: 1e4 });
		const found = String(r.stdout?.text ?? "").trim();
		if (found) return adoptEngineFrom(config, deps, found);
	} catch {}
	return adoptEngineFrom(config, deps, config.tcpp.binary.slice(0, config.tcpp.binary.lastIndexOf("/")) + "/../transcribe-cli");
}
async function ensureEngine(config, deps) {
	if (await engineExists(config, deps)) return { exists: true };
	const adopted = await discoverEngine(config, deps);
	if (adopted) return {
		exists: true,
		adoptedFrom: adopted
	};
	return { exists: false };
}
async function verifyEngineChecksum(config, deps, fs, binaryPath) {
	const expected = await sha256(deps, binaryPath);
	if (!expected) return true;
	const sidecarPath = binaryPath + ".sha256";
	await runCmd(deps, "curl -sS -L --fail --retry 1 -o " + q(sidecarPath) + " " + q(await engineUrl(config, deps) + ".sha256") + " 2>/dev/null || rm -f " + q(sidecarPath), { timeoutMs: 3e4 });
	if (!await fileExists(deps, sidecarPath)) return true;
	const content = await fs.readText(await fs.resolve(sidecarPath));
	const m = /^([0-9a-f]{64})/i.exec(content ?? "");
	await runCmd(deps, "rm -f " + q(sidecarPath), { timeoutMs: 1e4 });
	if (!m) return true;
	if (m[1].toLowerCase() !== expected.toLowerCase()) throw new Error("engine checksum mismatch: published " + m[1].slice(0, 12) + "…, got " + expected.slice(0, 12) + "…");
	return true;
}
async function modelPath(config, deps, entry) {
	const localPath = config.tcpp.modelsDir + "/" + entry.file;
	if (await fileExists(deps, localPath)) return {
		path: localPath,
		downloaded: true
	};
	const cached = await hfPathFor(deps, entry.file);
	if (cached) return {
		path: cached,
		downloaded: true
	};
	return {
		path: localPath,
		downloaded: false
	};
}
async function startModelDownload(config, deps, fs, modelId) {
	const entry = CATALOG.find((m) => m.id === modelId);
	if (!entry) return {
		ok: false,
		error: "model not found in catalog"
	};
	const target = config.tcpp.modelsDir + "/" + entry.file;
	if ((await modelPath(config, deps, entry)).downloaded) return {
		ok: true,
		status: "done"
	};
	if (activeDownloads()) return {
		ok: false,
		error: "another download is already running"
	};
	const url = "https://huggingface.co/" + entry.repo + "/resolve/main/" + entry.file;
	runDownload(deps, fs, "model:" + modelId, url, target, entry.size);
	return {
		ok: true,
		status: "downloading"
	};
}
function isWhisperFamily(entry) {
	return entry.name.toLowerCase().indexOf("whisper") >= 0;
}
const CHUNK_THRESHOLD_SECS = 22;
async function transcribeWithTcpp(config, deps, fs, tmp) {
	if (!config.tcpp.modelId) throw new Error("no model selected (Settings → Voice)");
	const entry = CATALOG.find((m) => m.id === config.tcpp.modelId);
	if (!entry) throw new Error("model not found in catalog");
	if (!(await ensureEngine(config, deps)).exists) throw new Error("engine is not installed — Settings → Voice → Download engine");
	const resolved = await modelPath(config, deps, entry);
	if (!resolved.downloaded) throw new Error("model is not downloaded — Settings → Voice → Download");
	const langArg = isWhisperFamily(entry) && config.language !== "auto" ? " -l " + config.language : "";
	if (await fileSize(deps, tmp + "/in.wav") / 32e3 > CHUNK_THRESHOLD_SECS) return await batchTranscribe(config, deps, fs, tmp, resolved.path, langArg);
	await runCmd(deps, q(config.tcpp.binary) + " -m " + q(resolved.path) + " -q" + langArg + " -o " + q(tmp + "/out.txt") + " " + q(tmp + "/in.wav"), {
		timeoutMs: 6e5,
		workdir: tmp
	});
	return await fs.readText(await fs.resolve(tmp + "/out.txt"));
}
async function batchTranscribe(config, deps, fs, tmp, modelPathArg, langArg) {
	await runCmd(deps, "mkdir -p " + q(tmp + "/chunks"), { timeoutMs: 1e4 });
	await runCmd(deps, "ffmpeg -y -hide_banner -loglevel error -i " + q(tmp + "/in.wav") + " -f segment -segment_time 20 -c copy " + q(tmp + "/chunks/chunk_%03d.wav"), { timeoutMs: 6e4 });
	await runCmd(deps, "ls " + q(tmp + "/chunks") + "/chunk_*.wav | sort > " + q(tmp + "/list.txt"), {
		timeoutMs: 1e4,
		workdir: tmp
	});
	const result = await runCmd(deps, q(config.tcpp.binary) + " --batch " + q(tmp + "/list.txt") + " -m " + q(modelPathArg) + " -q" + langArg + " --batch-jsonl", {
		timeoutMs: 9e5,
		workdir: tmp
	});
	const outText = String(result.stdout?.text ?? "");
	const parts = [];
	for (const line of outText.split("\n")) {
		const l = line.trim();
		if (!l) continue;
		let parsed = null;
		try {
			parsed = JSON.parse(l);
		} catch {
			parsed = null;
		}
		if (parsed && typeof parsed.text === "string" && parsed.text.trim()) parts.push(parsed.text.trim());
	}
	if (!parts.length) throw new Error("transcribe-cli: no batch output");
	return parts.join(" ");
}
async function transcribeWithWhisper(config, deps, fs, tmp) {
	if (!config.local.binary || !config.local.model) throw new Error("whisper paths not set (Settings → Voice → Advanced)");
	const langArg = config.language !== "auto" ? " -l " + config.language : "";
	await runCmd(deps, q(config.local.binary) + " -m " + q(config.local.model) + langArg + " -f " + q(tmp + "/in.wav") + " -oj -of " + q(tmp + "/out"), {
		timeoutMs: 3e5,
		workdir: tmp
	});
	const jsonText = await fs.readText(await fs.resolve(tmp + "/out.json"));
	const parsed = JSON.parse(jsonText);
	if (parsed && typeof parsed.text === "string") return parsed.text;
	else if (parsed && Array.isArray(parsed.transcription)) return parsed.transcription.map((seg) => seg && typeof seg.text === "string" ? seg.text : "").join("");
	throw new Error("whisper: could not parse out.json");
}
async function transcribeWithApi(config, deps, tmp) {
	if (!config.api.key) throw new Error("API key is required — set it in Settings → Voice → API key");
	if (!config.api.url) throw new Error("API endpoint is not set (Settings → Voice)");
	const langArg = config.language !== "auto" ? " -F " + q("language=" + config.language) : "";
	const result = await runCmd(deps, "curl -sS --max-time 120 -X POST " + q(config.api.url) + " -H \"Authorization: Bearer $DSHVOICE_API_KEY\" -F " + q("file=@" + tmp + "/in.wav;type=audio/wav") + " -F " + q("model=" + config.api.model) + langArg, {
		timeoutMs: 13e4,
		env: { DSHVOICE_API_KEY: config.api.key }
	});
	const outText = String(result.stdout?.text ?? "");
	let parsed = null;
	try {
		parsed = JSON.parse(outText);
	} catch {
		parsed = null;
	}
	if (parsed && typeof parsed.text === "string") return parsed.text;
	if (parsed && parsed.error && typeof parsed.error.message === "string") throw new Error("API: " + parsed.error.message);
	throw new Error("API: unexpected response: " + outText.slice(0, 300));
}
const CODEX_DEFAULT_ENDPOINT = "https://chatgpt.com/backend-api/transcribe";
const CODEX_TIMEOUT_MS = 3e5;
const CODEX_CLAIM_PATH = "https://api.openai.com/auth";
const CODEX_PROFILE_CLAIM_PATH = "https://api.openai.com/profile";
function homeDir() {
	return process.env.HOME?.trim() || process.env.USERPROFILE?.trim() || "";
}
function defaultCodexAuthPath() {
	const codexHome = process.env.CODEX_HOME?.trim();
	if (codexHome) return codexHome.replace(/[\\/]+$/, "") + "/auth.json";
	const home = homeDir().replace(/[\\/]+$/, "");
	return home ? home + "/.codex/auth.json" : "";
}
/** Configured path wins; empty means "$CODEX_HOME/auth.json or ~/.codex/auth.json". */
function codexAuthPath(config) {
	const configured = config.codex.authPath;
	if (!configured) return defaultCodexAuthPath();
	if (configured === "~") return homeDir();
	if (configured.indexOf("~/") === 0) return homeDir() + configured.slice(1);
	return configured;
}
function decodeJwtPayload(token) {
	const parts = token.split(".");
	if (parts.length !== 3 || !parts[1]) return null;
	try {
		const json = Buffer.from(parts[1], "base64url").toString("utf8");
		const parsed = JSON.parse(json);
		return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
}
function recordOf(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function nonEmptyString(value) {
	return typeof value === "string" && value.length > 0 ? value : null;
}
function classifyCodexAuth(raw, authPath) {
	if (!raw.trim()) return {
		state: "missing",
		authPath,
		credentials: null,
		message: "Codex auth file " + authPath + " not found — run `codex login` on this host"
	};
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {
			state: "invalid",
			authPath,
			credentials: null,
			message: "Codex auth file " + authPath + " is not valid JSON — run `codex login`"
		};
	}
	const file = recordOf(parsed);
	if (!file) return {
		state: "invalid",
		authPath,
		credentials: null,
		message: "Codex auth file " + authPath + " has an unexpected shape — run `codex login`"
	};
	const tokens = recordOf(file.tokens);
	const accessToken = nonEmptyString(tokens?.access_token);
	if (!accessToken) {
		const authMode = nonEmptyString(file.auth_mode);
		const apiKey = nonEmptyString(file.OPENAI_API_KEY);
		if (authMode === "apikey" || authMode === "apiKey" || apiKey !== null) return {
			state: "api_key",
			authPath,
			credentials: null,
			message: "Codex is signed in with an API key — the subscription endpoint needs a ChatGPT login (`codex login`, then remove the API key or log out of it)"
		};
		return {
			state: "invalid",
			authPath,
			credentials: null,
			message: "Codex auth file " + authPath + " has no access token — run `codex login`"
		};
	}
	const claims = recordOf(decodeJwtPayload(accessToken)?.[CODEX_CLAIM_PATH]);
	const idToken = nonEmptyString(tokens?.id_token);
	const idClaims = idToken === null ? null : recordOf(decodeJwtPayload(idToken)?.[CODEX_CLAIM_PATH]);
	const payload = decodeJwtPayload(accessToken);
	const profile = recordOf(payload?.[CODEX_PROFILE_CLAIM_PATH]);
	const accountId = nonEmptyString(tokens?.account_id) ?? nonEmptyString(claims?.chatgpt_account_id) ?? nonEmptyString(idClaims?.chatgpt_account_id) ?? null;
	const exp = payload?.exp;
	const expiresAt = typeof exp === "number" ? exp * 1e3 : null;
	const expired = expiresAt !== null && Date.now() >= expiresAt;
	const email = nonEmptyString(payload?.email) ?? nonEmptyString(profile?.email);
	const plan = nonEmptyString(claims?.chatgpt_plan_type) ?? nonEmptyString(idClaims?.chatgpt_plan_type);
	const credentials = {
		accessToken,
		accountId,
		email,
		plan,
		expiresAt
	};
	const who = email !== null ? email + (plan !== null ? " (" + plan + ")" : "") : plan ?? "this account";
	return expired ? {
		state: "expired",
		authPath,
		credentials,
		message: "Codex token for " + who + " expired " + new Date(expiresAt ?? Date.now()).toISOString().slice(0, 16).replace("T", " ") + " — run any codex command (or `codex login`) to refresh it"
	} : {
		state: "ok",
		authPath,
		credentials,
		message: "Signed in to Codex as " + who
	};
}
async function readCodexAuth(deps, fsDeps, authPath) {
	if (!authPath) return {
		state: "missing",
		authPath,
		credentials: null,
		message: "No Codex auth path: set HOME/CODEX_HOME or an explicit path in Settings → Voice"
	};
	let raw = null;
	try {
		raw = await fsDeps.readText(await fsDeps.resolve(authPath));
	} catch {
		try {
			const r = await runCmd(deps, "cat " + q(authPath) + " 2>/dev/null || true", { timeoutMs: 1e4 });
			const text = String(r.stdout?.text ?? "");
			if (text.trim()) raw = text;
		} catch {}
	}
	if (raw === null) return {
		state: "missing",
		authPath,
		credentials: null,
		message: "Codex auth file " + authPath + " not found — run `codex login` on this host"
	};
	return classifyCodexAuth(raw, authPath);
}
function codexAuthView(auth) {
	return {
		state: auth.state,
		authPath: auth.authPath,
		email: auth.credentials?.email ?? null,
		plan: auth.credentials?.plan ?? null,
		expiresAt: auth.credentials?.expiresAt ?? null,
		message: auth.message
	};
}
/** Pull a human-readable reason out of a ChatGPT backend error body. */
function codexErrorDetail(body) {
	const text = body.trim();
	if (!text) return "";
	if (text.charAt(0) === "{") try {
		const obj = recordOf(JSON.parse(text));
		const detail = nonEmptyString(obj?.detail);
		if (detail) return detail;
		const message = nonEmptyString(recordOf(obj?.error)?.message);
		if (message) return message;
	} catch {}
	if (/<html/i.test(text)) return "HTML challenge page (Cloudflare)";
	return text.replace(/\s+/g, " ").slice(0, 200);
}
function codexHttpError(status, body, language) {
	const detail = codexErrorDetail(body);
	const suffix = detail ? ": " + detail : "";
	if (status === 401) return /* @__PURE__ */ new Error("Codex login rejected (401)" + suffix + " — run any codex command (or `codex login`) to refresh the token");
	if (status === 403) return /* @__PURE__ */ new Error("ChatGPT refused the request (403)" + suffix + " — the endpoint sits behind Cloudflare; retry or check the network");
	if (status === 429) return /* @__PURE__ */ new Error("Codex subscription is rate limited (429)" + suffix + " — retry in a moment");
	if (status >= 500) {
		const hint = language !== "auto" ? " — if this repeats, set Language to Auto" : "";
		return /* @__PURE__ */ new Error("Codex transcription failed (" + status + ")" + suffix + hint);
	}
	return /* @__PURE__ */ new Error("Codex transcription failed (" + status + ")" + suffix);
}
async function transcribeWithCodex(config, deps, fsDeps, tmp) {
	if (!config.codex.endpoint) throw new Error("Codex endpoint is not set (Settings → Voice → Codex)");
	const auth = await readCodexAuth(deps, fsDeps, codexAuthPath(config));
	const cred = auth.credentials;
	if (cred === null) throw new Error(auth.message);
	const langArg = config.language !== "auto" ? " -F " + q("language=" + config.language) : "";
	const modelArg = config.codex.model ? " -F " + q("model=" + config.codex.model) : "";
	const accountHeader = cred.accountId !== null ? " -H \"chatgpt-account-id: $DSHVOICE_CODEX_ACCOUNT\"" : "";
	const result = await runCmd(deps, "curl -sS --max-time " + Math.round(CODEX_TIMEOUT_MS / 1e3) + " -o " + q(tmp + "/codex.json") + " -w " + q("%{http_code}") + " -X POST " + q(config.codex.endpoint) + " -H \"Authorization: Bearer $DSHVOICE_CODEX_TOKEN\"" + accountHeader + " -H " + q("originator: dsh-voice") + " -H " + q("User-Agent: dsh-voice") + " -F " + q("file=@" + tmp + "/in.wav;type=audio/wav") + langArg + modelArg, {
		timeoutMs: 31e4,
		env: {
			DSHVOICE_CODEX_TOKEN: cred.accessToken,
			DSHVOICE_CODEX_ACCOUNT: cred.accountId ?? ""
		}
	});
	const status = parseInt(String(result.stdout?.text ?? "").trim(), 10) || 0;
	let body = "";
	try {
		body = await fsDeps.readText(await fsDeps.resolve(tmp + "/codex.json"));
	} catch {
		body = "";
	}
	if (status !== 200) throw codexHttpError(status, body, config.language);
	let parsed;
	try {
		parsed = JSON.parse(body);
	} catch {
		throw new Error("Codex: unexpected response: " + body.slice(0, 300));
	}
	const text = recordOf(parsed)?.text;
	if (typeof text !== "string") throw new Error("Codex: response carries no transcript text: " + body.slice(0, 300));
	return text;
}
function json(res, value, status = 200) {
	const body = JSON.stringify(value);
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(body);
}
function readBody(req) {
	return new Promise((resolve, reject) => {
		let data = "";
		req.on("data", (chunk) => {
			data += String(chunk);
		});
		req.on("end", () => {
			try {
				const parsed = data ? JSON.parse(data) : {};
				resolve(typeof parsed === "object" && parsed !== null ? parsed : {});
			} catch (e) {
				reject(e instanceof Error ? e : new Error(String(e)));
			}
		});
		req.on("error", reject);
	});
}
/**
* Hard service dependencies: the Loader activates this plugin only after all
* of them are available (the same pattern dsh-track uses with
* `ctx.inject(['webServer'], …)` — an eager `ctx.get` at apply time would
* return undefined while sibling fibers are still activating, and the whole
* plugin would silently register nothing).
*/
const inject = [
	"webServer",
	"shell",
	"fs"
];
/**
* Host plugin body: register /api/voice/* endpoints on the webserver.
* @param ctx - host root context (services from `inject` are guaranteed).
*/
function apply(ctx) {
	const shell = ctx.get("shell");
	const fs = ctx.get("fs");
	const webServer = ctx.get("webServer");
	if (shell === void 0 || fs === void 0 || webServer === void 0) return;
	const sandboxPolicy = ctx.get("sandboxPolicy");
	const wsRoot = sandboxPolicy !== void 0 ? sandboxPolicy.workspaceRoot : void 0;
	const config = {
		provider: "tcpp",
		language: "auto",
		tcpp: {
			binary: (wsRoot ?? process.cwd()) + "/.engine/transcribe-cli",
			modelsDir: (wsRoot ?? process.cwd()) + "/.models",
			modelId: "handy-computer/gigaam-v3-e2e-rnnt-gguf/gigaam-v3-e2e-rnnt-Q8_0.gguf",
			engineUrl: "https://github.com/KotDath/dsh-voice/releases/latest/download/transcribe-cli-{platform}-{arch}"
		},
		local: {
			binary: "",
			model: ""
		},
		api: {
			url: "https://api.openai.com/v1/audio/transcriptions",
			model: "gpt-4o-transcribe",
			key: ""
		},
		codex: {
			authPath: "",
			endpoint: CODEX_DEFAULT_ENDPOINT,
			model: ""
		}
	};
	const deps = { shell };
	const fsDeps = fs;
	function tmpdir() {
		return (wsRoot ?? process.cwd()) + "/.tmp/voice-" + Date.now() + "-" + Math.floor(Math.random() * 1e6);
	}
	const registerRoute = (path, handler) => {
		ctx.effect(() => webServer.register({
			kind: "exact",
			path,
			handler: (req, res) => Promise.resolve(handler(req, res)).catch((e) => {
				json(res, {
					ok: false,
					error: e instanceof Error ? e.message : String(e)
				}, 500);
			})
		}), `dsh-voice: ${path}`);
	};
	registerRoute("/api/voice/config", async (req, res) => {
		if (req.method === "POST") {
			const body = await readBody(req);
			applyConfigPatch(config, body);
		}
		json(res, {
			ok: true,
			...publicConfigView(config)
		});
	});
	registerRoute("/api/voice/api-key", async (req, res) => {
		const body = await readBody(req);
		const key = typeof body.key === "string" ? body.key : "";
		config.api.key = key;
		json(res, {
			ok: true,
			hasKey: key !== ""
		});
	});
	registerRoute("/api/voice/codex-status", async (req, res) => {
		try {
			json(res, {
				ok: true,
				status: codexAuthView(await readCodexAuth(deps, fsDeps, codexAuthPath(config)))
			});
		} catch (error) {
			json(res, {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	});
	registerRoute("/api/voice/codex-check", async (req, res) => {
		let tmp = null;
		try {
			tmp = tmpdir();
			await runCmd(deps, "mkdir -p " + q(tmp), { timeoutMs: 1e4 });
			await runCmd(deps, "ffmpeg -y -hide_banner -loglevel error -f lavfi -i anullsrc=r=16000:cl=mono -t 1 -c:a pcm_s16le " + q(tmp + "/in.wav"), { timeoutMs: 3e4 });
			await transcribeWithCodex(config, deps, fsDeps, tmp);
			json(res, {
				ok: true,
				message: "Codex transcription works (login accepted, endpoint reachable)."
			});
		} catch (error) {
			json(res, {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			});
		} finally {
			if (tmp) try {
				await runCmd(deps, "rm -rf " + q(tmp), { timeoutMs: 1e4 });
			} catch {}
		}
	});
	registerRoute("/api/voice/models", async (req, res) => {
		try {
			const p = await detectPlatform(deps);
			const eng = await ensureEngine(config, deps);
			const map = await refreshHfCache(deps);
			const models = CATALOG.map((m) => ({
				id: m.id,
				name: m.name,
				repo: m.repo,
				file: m.file,
				size: m.size,
				recommended: m.recommended,
				windowSec: m.windowSec,
				streaming: m.streaming,
				downloaded: map[m.file] !== void 0
			}));
			try {
				const r = await runCmd(deps, "ls " + q(config.tcpp.modelsDir) + " 2>/dev/null || true", { timeoutMs: 1e4 });
				const localFiles = String(r.stdout?.text ?? "");
				for (const m of models) if (localFiles.indexOf(m.file) >= 0) m.downloaded = true;
			} catch {}
			models.sort((a, b) => Number(b.downloaded) - Number(a.downloaded) || Number(b.recommended) - Number(a.recommended) || a.name.localeCompare(b.name));
			json(res, {
				ok: true,
				models,
				platform: {
					os: p.os,
					arch: p.arch,
					exists: eng.exists,
					path: config.tcpp.binary,
					adoptedFrom: eng.adoptedFrom ?? null,
					modelsDir: config.tcpp.modelsDir
				}
			});
		} catch (error) {
			json(res, {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	});
	registerRoute("/api/voice/download", async (req, res) => {
		try {
			const body = await readBody(req);
			const modelId = typeof body.modelId === "string" ? body.modelId : "";
			json(res, await startModelDownload(config, deps, fsDeps, modelId));
		} catch (error) {
			json(res, {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	});
	registerRoute("/api/voice/engine-download", async (req, res) => {
		try {
			const eng = await ensureEngine(config, deps);
			if (eng.exists) {
				json(res, {
					ok: true,
					status: "done",
					adoptedFrom: eng.adoptedFrom ?? null
				});
				return;
			}
			if (activeDownloads()) {
				json(res, {
					ok: false,
					error: "another download is already running"
				});
				return;
			}
			runDownload(deps, fsDeps, "engine", await engineUrl(config, deps), config.tcpp.binary, 0, (target) => verifyEngineChecksum(config, deps, fsDeps, target).then(() => void 0));
			json(res, {
				ok: true,
				status: "downloading"
			});
		} catch (error) {
			json(res, {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	});
	registerRoute("/api/voice/download-status", async (req, res) => {
		try {
			json(res, {
				ok: true,
				downloads: downloadStatusSnapshot()
			});
		} catch (error) {
			json(res, {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	});
	registerRoute("/api/voice/transcribe", async (req, res) => {
		let tmp = null;
		try {
			const body = await readBody(req);
			if (typeof body.dataBase64 !== "string" || !body.dataBase64) throw new Error("no audio data");
			tmp = tmpdir();
			await runCmd(deps, "mkdir -p " + q(tmp), { timeoutMs: 1e4 });
			const mime = typeof body.mimeType === "string" ? body.mimeType : "";
			let ext = "webm";
			if (mime.indexOf("webm") >= 0) ext = "webm";
			else if (mime.indexOf("mp4") >= 0) ext = "m4a";
			else if (mime.indexOf("ogg") >= 0) ext = "ogg";
			else if (mime.indexOf("wav") >= 0) ext = "wav";
			await runCmd(deps, "base64 -d > " + q(tmp + "/src." + ext), {
				stdin: body.dataBase64,
				timeoutMs: 3e4
			});
			await runCmd(deps, "ffmpeg -y -hide_banner -loglevel error -i " + q(tmp + "/src." + ext) + " -ar 16000 -ac 1 -c:a pcm_s16le " + q(tmp + "/in.wav"), { timeoutMs: 3e4 });
			let text = "";
			if (config.provider === "tcpp") text = await transcribeWithTcpp(config, deps, fsDeps, tmp);
			else if (config.provider === "api") text = await transcribeWithApi(config, deps, tmp);
			else if (config.provider === "codex") text = await transcribeWithCodex(config, deps, fsDeps, tmp);
			else text = await transcribeWithWhisper(config, deps, fsDeps, tmp);
			const cleaned = String(text).trim();
			if (!cleaned) {
				json(res, {
					ok: true,
					text: "",
					empty: true
				});
				return;
			}
			json(res, {
				ok: true,
				text: cleaned
			});
		} catch (error) {
			json(res, {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			});
		} finally {
			if (tmp) try {
				await runCmd(deps, "rm -rf " + q(tmp), { timeoutMs: 1e4 });
			} catch {}
		}
	});
}
//#endregion
export { CATALOG, apply, inject, invariant, name, version };
