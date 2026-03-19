# Blocky — Open Source Voice Interface for Claude Code

> A free, open-source desktop app that replaces the Claude Code terminal with a face-to-face voice interaction. Talk to an animated ASCII avatar named Blocky who codes, runs commands, and talks back — like pair programming on a Zoom call.

**License:** MIT
**Cost to run:** $0 (beyond your existing Claude Code subscription)
**Dependencies requiring accounts:** None. Everything runs locally.

---

## Project Philosophy

Blocky is a **free base layer** that any developer or company can fork and extend. The core is fully functional with zero API keys, zero cloud services, and zero cost. Every component uses a **provider pattern** so paid services can be swapped in as drop-in upgrades without touching core logic.

```
┌─────────────────────────────────────────────────────────┐
│                     EXTENSION LAYER                      │
│  (what companies/devs add on top — not our problem)      │
│                                                          │
│  ElevenLabs TTS │ Deepgram STT │ 3D Avatar │ GPT-4o    │
│  Azure Speech   │ AssemblyAI   │ ReadyPlayer│ Gemini    │
│  Play.ht        │ Rev AI       │ Live2D     │ etc.      │
├─────────────────────────────────────────────────────────┤
│                     BLOCKY CORE (FREE)                   │
│                                                          │
│  Piper TTS (local)  │  Web Speech API  │  ASCII Avatar  │
│  Whisper.cpp (local) │  Claude Code CLI │  Blocky Params │
│  Kokoro TTS (local)  │  Push-to-Talk    │  Command Parser│
│                                                          │
│  All MIT licensed. All run offline. All $0.              │
└─────────────────────────────────────────────────────────┘
```

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                      Electron App                         │
│                                                           │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Renderer      │  │  Main Process│  │ Claude Code  │  │
│  │  (React UI)    │◄─►│  (Node.js)  │◄─►│ CLI subprocess│ │
│  │                │  │              │  │              │  │
│  │  • Blocky face │  │  • TTS engine│  │  • --print   │  │
│  │  • Waveforms   │  │  • STT engine│  │  • stream-json│ │
│  │  • Transcript  │  │  • IPC hub   │  │  • file edits│  │
│  │  • Cmd parser  │  │  • Audio I/O │  │  • bash cmds │  │
│  └───────┬───────┘  └──────┬───────┘  └──────────────┘  │
│          │                 │                              │
│     ┌────▼─────┐     ┌────▼──────┐                       │
│     │ Web Speech│     │ Piper TTS │                       │
│     │ API (STT) │     │ (local)   │                       │
│     │ FREE      │     │ FREE      │                       │
│     └──────────┘     └───────────┘                       │
└──────────────────────────────────────────────────────────┘
```

**Core loop:**

1. User presses Push-to-Talk (or VAD detects speech)
2. Audio → Web Speech API or Whisper.cpp → transcribed text
3. **Message router** decides: is this a Blocky command or a Claude task?
4. Blocky commands → instant local parameter change (zero latency)
5. Claude tasks → Claude Code CLI subprocess via stdin (`claude --print`)
6. Response streams back → parsed → sentence chunks → Piper TTS (local)
7. Audio plays → Blocky mouth animates in sync
8. Activity events (tool_use, tool_result) → Blocky face/status updates in real-time
9. Return to idle

---

## The Free Stack

Every layer has a free default that ships with Blocky, plus a provider interface for paid upgrades.

### Speech-to-Text (STT)

| Provider           | Cost        | Latency             | Quality   | Offline                    | Ships with Blocky          |
| ------------------ | ----------- | ------------------- | --------- | -------------------------- | -------------------------- |
| **Web Speech API** | Free        | Real-time           | Good      | No (needs Chrome/internet) | **Yes — default**          |
| **Whisper.cpp**    | Free        | ~1-3s per utterance | Excellent | **Yes**                    | **Yes — offline fallback** |
| Deepgram           | ~$0.004/min | Real-time streaming | Excellent | No                         | Extension                  |
| AssemblyAI         | ~$0.006/min | Real-time streaming | Excellent | No                         | Extension                  |

**Default: Web Speech API** — zero setup, works in Electron's Chromium, real-time interim results. Falls back to Whisper.cpp when offline.

**Whisper.cpp integration:**

- Ships a `whisper-node` binding (MIT licensed)
- Downloads the `base.en` model on first run (~150MB, one-time)
- Runs inference on CPU — ~1-3 seconds for a typical utterance on modern hardware
- For push-to-talk this is fine: user finishes speaking → 1s pause → text ready
- Larger models (`small.en` ~500MB, `medium.en` ~1.5GB) available for better accuracy

```javascript
// Provider interface that all STT engines implement:
// {
//   start(): void                    // Begin listening
//   stop(): Promise<string>          // Stop and return final transcript
//   onInterim(callback: (text: string) => void): void  // Partial results
//   onFinal(callback: (text: string) => void): void    // Final result
//   isAvailable(): boolean           // Can this provider run right now?
//   name: string                     // Display name
// }
```

### Text-to-Speech (TTS)

| Provider           | Cost             | Latency          | Quality        | Offline | Ships with Blocky          |
| ------------------ | ---------------- | ---------------- | -------------- | ------- | -------------------------- |
| **Piper TTS**      | Free             | ~50-200ms        | Good (natural) | **Yes** | **Yes — default**          |
| **Kokoro TTS**     | Free             | ~100-300ms       | Very good      | **Yes** | **Yes — alternative**      |
| **Web Speech API** | Free             | Instant          | Robotic        | No      | **Yes — instant fallback** |
| ElevenLabs         | ~$0.003/char     | ~300ms streaming | Excellent      | No      | Extension                  |
| OpenAI TTS         | ~$0.015/1K chars | ~500ms           | Very good      | No      | Extension                  |
| Azure Neural TTS   | ~$0.016/1M chars | ~200ms           | Very good      | No      | Extension                  |

**Default: Piper TTS** — the key to making this free and good.

**Piper TTS details:**

- Open source (MIT), developed by Rhasspy project
- ONNX runtime — runs on CPU, no GPU needed
- ~20MB per voice model, dozens of voices/languages available
- Generates WAV audio at near-realtime speed
- Streams output — can start playing before full sentence is generated
- Install: download binary + voice model, no Python needed

**Kokoro TTS (alternative):**

- Open source (Apache 2.0), newer model with better prosody
- ONNX runtime, ~80MB model
- Slightly higher quality than Piper, slightly slower
- Good for users who want more natural-sounding speech

**Sentence chunking strategy (applies to all TTS providers):**

```
Claude response streams in token by token:
  "I found the bug. It's on line 42 in handler.ts. The import is wrong..."

Buffer until sentence boundary (. ! ? or \n):
  Chunk 1: "I found the bug." → send to TTS immediately
  Chunk 2: "It's on line 42 in handler.ts." → queue behind chunk 1
  Chunk 3: "The import is wrong." → queue behind chunk 2

Audio plays back sequentially with no gaps.
First audio starts playing within ~200ms of first sentence completing.
```

```javascript
// Provider interface that all TTS engines implement:
// {
//   speak(text: string): Promise<AudioBuffer>  // Convert text to audio
//   stream(text: string): ReadableStream        // Streaming variant
//   stop(): void                                 // Interrupt playback
//   voices(): Promise<Voice[]>                   // Available voices
//   setVoice(id: string): void                   // Select a voice
//   isAvailable(): boolean                       // Can this run right now?
//   name: string                                 // Display name
// }
```

### Claude Integration

| Provider                  | Cost                        | Ships with Blocky |
| ------------------------- | --------------------------- | ----------------- |
| **Claude Code CLI**       | Included in Claude Code sub | **Yes — default** |
| Claude API direct         | Per-token pricing           | Extension         |
| Any OpenAI-compatible API | Varies                      | Extension         |

**Default: Claude Code CLI as subprocess.** This is the only component that requires an existing subscription, but if someone is using this tool they already have Claude Code installed.

```javascript
// Provider interface for LLM backends:
// {
//   send(message: string): AsyncIterable<StreamEvent>  // Stream response
//   getActivityState(): ActivityState                     // Current tool use
//   interrupt(): void                                      // Cancel current response
//   setWorkingDirectory(path: string): void                // Change project dir
//   isAvailable(): boolean
//   name: string
// }
//
// StreamEvent types:
// { type: 'text', content: string }              // Claude speaking
// { type: 'tool_start', tool: string, input: any }  // Starting a tool
// { type: 'tool_end', tool: string, output: any }   // Tool finished
// { type: 'error', message: string }              // Something broke
// { type: 'done' }                                // Turn complete
```

---

## Blocky — The Interactive Avatar

Blocky is not just a display — it's an interactive character. Users can modify Blocky's appearance, behavior, and personality on the fly through natural language.

### Parameter System

Every visual and behavioral aspect of Blocky is a JSON parameter:

```javascript
const BlockyParams = {
  // Identity
  name: "BLOCKY", // Customizable name (max 16 chars)

  // Colors (any valid CSS color)
  skinColor: "#00ff88", // Border, frame color
  eyeColor: "#00ff88", // Eye character color
  mouthColor: "#00ff88", // Mouth color
  glowColor: "#00ff8844", // Text-shadow glow
  bgTint: "#0d1a14", // Radial gradient center

  // Face features
  eyeStyle: "dot", // dot, wide, squint, heart, star, dead, cool, wink, roll, dizzy
  mouthStyle: "neutral", // neutral, smile, open, grin, frown, o, teeth, blep, smirk, whistle
  accessory: "none", // none, hat, horns, halo, antenna, crown, headphones

  // Body
  bodyStyle: "normal", // normal, buff, tiny, wide, round

  // Animation
  animation: "none", // none, dance, bounce, wiggle, nod, spin, breathe, vibrate
  animSpeed: 1, // 0.25 (slow) to 4 (turbo)
  blinkRate: 3500, // ms between blinks

  // Mood presets (sets multiple params at once)
  mood: "neutral", // neutral, happy, sad, angry, excited, sleepy, confused, love, party
};
```

Parameters persist to disk (`~/.blocky/params.json`) so Blocky remembers its look between sessions.

### Message Router

Every user message goes through a two-stage router before reaching Claude:

```
User speaks: "make blocky dance"
                │
                ▼
   ┌────────────────────────┐
   │   BLOCKY COMMAND PARSER │  ← Local, instant, no API call
   │   (keyword matching)    │
   │                         │
   │   Match? ──yes──► Apply param changes
   │     │                   Blocky responds: "Got it! animation → dance"
   │     no                  (never hits Claude)
   │     │
   │     ▼
   │   CLAUDE CODE CLI       │  ← Normal coding task
   │   (subprocess)          │
   └────────────────────────┘

User speaks: "fix the bug in handler.ts"
                │
                ▼
   ┌────────────────────────┐
   │   BLOCKY COMMAND PARSER │
   │                         │
   │   Match? ──no──────────►│
   │                         │
   │   CLAUDE CODE CLI       │  ← Sent to Claude
   └────────────────────────┘
```

**Why local parsing instead of Claude?** Speed. Blocky commands should feel instant. When you say "make blocky red" the color should change in the same frame — not after a 2-second API round trip. The parser uses keyword matching for common patterns and can be extended with regex or a small local model later.

### Supported Blocky Commands (v1)

The command parser understands natural language patterns:

**Colors:** "make blocky {color}", "turn {color}", "{color} eyes", "{color} mouth"
Supported: red, green, blue, yellow, orange, purple, pink, cyan, white, brown, gold, lime, teal, magenta, coral, lavender, mint, salmon, crimson, amber

**Eyes:** "heart eyes", "star eyes", "dead eyes", "cool shades", "wink", "dizzy eyes"

**Mouth:** "smile", "frown", "grin", "open mouth", "teeth", "tongue out", "smirk", "whistle"

**Accessories:** "give blocky a {hat/crown/horns/halo/antenna/headphones}", "remove accessory"

**Animations:** "dance", "bounce", "wiggle", "spin", "breathe", "shake/vibrate", "stop moving"

**Speed:** "faster", "slower", "turbo/ludicrous speed"

**Body:** "make blocky {buff/tiny/wide/round}", "normal body"

**Moods (combo presets):**

- "angry" → red, squint eyes, teeth mouth, vibrate
- "excited" → yellow, star eyes, grin, bounce
- "sleepy" → squint eyes, o mouth, breathe animation
- "love" → pink, heart eyes, smile, breathe
- "confused" → rolling eyes, smirk, wiggle
- "party mode" → crown, star eyes, grin, dance

**Meta:** "reset" (restore defaults), "rename to {name}", "call yourself {name}"

### Activity-Driven Face States

Blocky's face automatically changes based on what Claude Code is doing. These override the user's cosmetic choices temporarily and revert when the activity ends:

| Activity State    | Eyes               | Mouth               | Extra             | Color          | Trigger (stream-json)                       |
| ----------------- | ------------------ | ------------------- | ----------------- | -------------- | ------------------------------------------- |
| `idle`            | User's choice      | User's choice       | —                 | User's color   | No subprocess activity                      |
| `listening`       | ◉ wide             | ░░ tense            | —                 | #ff4444 red    | Mic is active                               |
| `thinking`        | ◐ rolling (anim)   | ~~ squiggle         | ° thought bubbles | #ffaa00 amber  | Claude thinking, no tool_use yet            |
| `reading_file`    | ▸▾ scanning (anim) | neutral             | ↓ arrow           | #66bbff blue   | tool_use: Read, View, Cat                   |
| `writing_code`    | ● focused          | ▪▪ concentrating    | ⌨ keyboard        | #00ff88 green  | tool_use: Write, Edit, str_replace          |
| `running_bash`    | ⊙ alert            | ▓▓ grit (anim)      | >\_ cursor        | #ff8800 orange | tool_use: Bash, execute                     |
| `searching`       | ◎ target           | neutral             | ⌕ magnifier       | #bb88ff purple | tool_use: Grep, Search, Glob                |
| `speaking`        | ● normal           | 3-frame mouth cycle | —                 | #00ff88 green  | TTS is playing audio                        |
| `success`         | ^ happy squint     | ✓✓ grin             | —                 | #00ff88 green  | tool_result with no error, or task complete |
| `error`           | × dead             | ▁▁▁▁ flat frown     | —                 | #ff4444 red    | tool_result with error, or crash            |
| `waiting_confirm` | ● normal           | ·· pursed           | ? question        | #ffdd00 yellow | Claude asks a question / needs input        |

**Status text** is always displayed below Blocky's face:

- Line 1: State label (e.g., "WRITING CODE", "RUNNING COMMAND")
- Line 2: Detail (e.g., "src/api/handler.ts", "npm run test")

Both lines update in real-time as Claude works, driven by parsing the stream-json events.

### ASCII Face Renderer

Blocky's face is built from composable parts in a monospace `<pre>` block:

```
  [ACCESSORY LAYER - optional hat/horns/crown/etc]
  ╔══════════════════════╗    ← Frame (color = skinColor)
  ║                      ║
  ║    ┌──┐      ┌──┐    ║    ← Eye sockets
  ║    │ ●│      │● │    ║    ← Eye characters (from eyeStyle)
  ║    └──┘      └──┘    ║
  ║                      ║
  ║         ╭──╮         ║    ← Mouth (from mouthStyle)
  ║         │  │         ║       Multiple lines for different shapes
  ║         ╰──╯         ║
  ║          ⌨           ║    ← Extra line (activity-dependent)
  ╚══════════════════════╝

  BLOCKY                       ← Name (from params.name)
  ● WRITING CODE               ← Status dot + activity label
    src/api/handler.ts          ← Activity detail
```

**Animations** are applied as CSS transforms on the `<pre>` container:

- `dance`: translateX(sin) + translateY(bounce) + rotate(sin)
- `bounce`: translateY(abs(sin)) + scale(pulse)
- `wiggle`: translateX(sin) + rotate(sin)
- `spin`: rotate(linear)
- `breathe`: scale(slow sin)
- `vibrate`: random translate + rotate (each frame)

**Blinking:** Every 3-5 seconds (randomized), eyes swap to `──` for 120ms, then revert.

---

## Project Structure

```
blocky/
├── package.json
├── LICENSE                        # MIT
├── README.md
├── CONTRIBUTING.md
├── electron-builder.yml
│
├── electron/                      # Main process (Node.js)
│   ├── main.js                    # Electron app lifecycle
│   ├── preload.js                 # Context bridge (IPC security)
│   ├── ipc-handlers.js            # All IPC channel handlers
│   │
│   ├── providers/                 # Provider system
│   │   ├── types.js               # Shared interfaces (STT, TTS, LLM)
│   │   │
│   │   ├── stt/
│   │   │   ├── web-speech.js      # Web Speech API (default)
│   │   │   ├── whisper-local.js   # Whisper.cpp via whisper-node
│   │   │   └── README.md          # How to add a custom STT provider
│   │   │
│   │   ├── tts/
│   │   │   ├── piper-local.js     # Piper TTS (default)
│   │   │   ├── kokoro-local.js    # Kokoro TTS (alternative)
│   │   │   ├── web-speech.js      # Web Speech API (instant fallback)
│   │   │   └── README.md          # How to add a custom TTS provider
│   │   │
│   │   └── llm/
│   │       ├── claude-code.js     # Claude Code CLI subprocess (default)
│   │       └── README.md          # How to add a custom LLM provider
│   │
│   ├── audio/
│   │   ├── playback-queue.js      # Gapless audio queue
│   │   ├── sentence-chunker.js    # Splits streaming text at sentence boundaries
│   │   └── audio-analyzer.js      # Amplitude analysis for mouth sync
│   │
│   └── services/
│       ├── model-downloader.js    # Downloads Piper/Whisper models on first run
│       └── config-store.js        # Persists settings + Blocky params to disk
│
├── src/                           # Renderer process (React)
│   ├── main.jsx
│   ├── App.jsx
│   │
│   ├── stores/
│   │   ├── session.js             # Zustand: session state, transcript, activity
│   │   └── blocky-params.js       # Zustand: Blocky's appearance/animation params
│   │
│   ├── components/
│   │   ├── Blocky.jsx             # The avatar: face renderer + animation engine
│   │   ├── Waveform.jsx           # Audio waveform visualizer
│   │   ├── Transcript.jsx         # Scrolling conversation log
│   │   ├── StatusBar.jsx          # Top bar: session time, provider indicators
│   │   ├── MicControls.jsx        # Push-to-talk button, mute, end session
│   │   ├── ActivityFeed.jsx       # Live tool-use events in transcript
│   │   └── SettingsPanel.jsx      # Provider selection, project dir, voice, etc.
│   │
│   ├── blocky/
│   │   ├── command-parser.js      # NL → param changes (local, instant)
│   │   ├── face-parts.js          # Eye, mouth, accessory ASCII definitions
│   │   ├── activity-mapper.js     # Maps stream-json events → face states
│   │   └── presets.js             # Mood presets, saved looks
│   │
│   ├── hooks/
│   │   ├── useSpeechRecognition.js
│   │   ├── useAudioPlayback.js
│   │   ├── useClaudeSession.js
│   │   ├── useBlockyAnimation.js
│   │   └── useMessageRouter.js    # Routes messages: Blocky cmd vs Claude
│   │
│   └── styles/
│       └── global.css
│
├── models/                        # Downloaded on first run (gitignored)
│   ├── piper/
│   │   └── en_US-lessac-medium.onnx   # ~20MB default voice
│   └── whisper/
│       └── ggml-base.en.bin           # ~150MB default model
│
├── scripts/
│   ├── download-models.js         # First-run model downloader
│   └── build-providers.js         # Validates provider implementations
│
└── docs/
    ├── PROVIDERS.md               # Full guide to writing custom providers
    ├── BLOCKY-COMMANDS.md          # Complete command reference
    └── ARCHITECTURE.md             # System design for contributors
```

---

## Detailed Component Specs

### 1. Electron Main Process (`electron/main.js`)

```javascript
// Window config:
// - width: 480, height: 800 (portrait, like a video call)
// - resizable: true, minWidth: 400, minHeight: 600
// - titleBarStyle: 'hidden' (custom title bar in React)
// - webPreferences: { preload: preload.js, contextIsolation: true }
// - icon: blocky icon

// On ready:
// 1. Check if Piper model exists — if not, trigger model-downloader
// 2. Check if Whisper model exists — if not, offer to download (optional)
// 3. Check if `claude` CLI is in PATH — if not, show setup instructions
// 4. Initialize selected providers (STT, TTS, LLM)
// 5. Create window, load React app
// 6. Register global shortcuts (Space = push-to-talk when window focused)
```

### 2. Claude Code Bridge (`electron/providers/llm/claude-code.js`)

This is the most critical backend piece.

```javascript
// Spawn Claude Code in print mode:
// child_process.spawn('claude', ['--print', '--output-format', 'stream-json'], {
//   cwd: projectDirectory,
//   env: { ...process.env },
//   stdio: ['pipe', 'pipe', 'pipe']
// })

// The --output-format stream-json flag gives structured JSON events:
// Each line of stdout is a JSON object:
//
// { type: "assistant", content: "I'll fix that..." }     → Blocky speaks this
// { type: "tool_use", tool: "Write", input: {...} }      → Blocky shows writing_code
// { type: "tool_result", tool: "Write", output: {...} }  → Blocky shows success/error
// { type: "tool_use", tool: "Bash", input: {...} }       → Blocky shows running_bash
// { type: "result", content: "Done! I fixed..." }        → Blocky speaks summary

// Parse each line, emit typed StreamEvents to the renderer via IPC
// The activity-mapper in the renderer maps these to Blocky face states

// CRITICAL: Keep subprocess alive between turns
// Each write to stdin is a new user turn
// The subprocess maintains full conversation context
// Only restart on crash (auto-restart + notify user)
```

### 3. Piper TTS (`electron/providers/tts/piper-local.js`)

```javascript
// Piper runs as a spawned process:
// echo "text to speak" | piper --model en_US-lessac-medium.onnx --output_raw
//
// Returns raw PCM audio (16-bit, 22050Hz mono)
// Convert to AudioBuffer for Web Audio API playback
//
// For streaming:
// - Pipe text line-by-line
// - Piper outputs audio for each line sequentially
// - Feed each chunk to playback queue as it completes
//
// Model management:
// - Models stored in {app_data}/models/piper/
// - Default: en_US-lessac-medium (~20MB, good quality)
// - User can download additional voices from:
//   https://github.com/rhasspy/piper/blob/master/VOICES.md
//
// Voice list for settings panel:
// - Scan models/ directory for .onnx files
// - Each .onnx has a companion .json with metadata (name, language, quality)

// Performance targets:
// - First audio byte: <200ms after text arrives
// - Real-time factor: <0.5x on modern CPU (generates 2x faster than playback)
// - Memory: ~50MB resident
```

### 4. Sentence Chunker (`electron/audio/sentence-chunker.js`)

````javascript
// Buffers streaming text from Claude and emits complete sentences.
// This is critical for TTS quality — sending fragments sounds broken,
// but waiting for the full response adds seconds of latency.
//
// Rules:
// 1. Buffer incoming tokens
// 2. On sentence boundary (. ! ? followed by space/newline, or \n\n):
//    emit the buffered sentence
// 3. Don't split on abbreviations (Mr. Dr. e.g. i.e. etc.)
// 4. Don't split on decimals (3.14)
// 5. On stream end: flush remaining buffer even if no boundary
//
// Special handling:
// - Code blocks (``` ... ```): DON'T speak these. Add to transcript only.
//   Speak a summary like "I'm writing some code..." instead.
// - Bullet lists: Combine short bullets into one TTS chunk
// - Very long sentences (>200 chars): Split at comma or semicolon
````

### 5. Message Router (`src/hooks/useMessageRouter.js`)

```javascript
// Two-stage routing for every user message:
//
// Stage 1: Blocky command parser (local, instant)
//   - Parse input for appearance/animation/mood keywords
//   - If matches found:
//     → Apply param changes to Blocky store
//     → Add Blocky's response to transcript
//     → DONE (never reaches Claude)
//     → Latency: 0ms
//
// Stage 2: Claude Code (if not a Blocky command)
//   - Send to Claude Code subprocess via IPC
//   - Stream response events back
//   - Feed text to TTS, activity to face states
//   - Latency: depends on Claude + network
//
// Hybrid messages:
//   "fix the bug and make blocky happy when you're done"
//   → Send full message to Claude
//   → Claude's stream-json events trigger face states automatically
//   → On success, activity-mapper sets happy face
//   → (v2: Claude itself can emit Blocky commands in its response)
```

### 6. Audio Playback Queue (`electron/audio/playback-queue.js`)

```javascript
// Manages gapless sequential playback of TTS audio chunks.
//
// Queue structure:
// [AudioBuffer, AudioBuffer, AudioBuffer, ...]
//
// Behavior:
// 1. TTS generates audio for sentence 1 → push to queue → start playing
// 2. While playing, TTS generates sentence 2 → push to queue
// 3. Sentence 1 finishes → immediately start sentence 2 (no gap)
// 4. Continue until queue is empty
//
// State events emitted to renderer:
// - 'speaking_start': First chunk begins playing
// - 'speaking_end': Last chunk finished, queue empty
// - 'amplitude': Current audio amplitude (for mouth sync)
//
// Controls:
// - interrupt(): Stop playback immediately, clear queue
//   (called when user presses push-to-talk while Claude is speaking)
// - pause() / resume(): For mute button
//
// Amplitude analysis:
// - Use AnalyserNode from Web Audio API
// - Sample amplitude at 30fps
// - Map amplitude ranges to mouth shapes:
//   0.0-0.1 → closed, 0.1-0.3 → small, 0.3-0.6 → medium, 0.6+ → wide
// - Send to renderer via IPC for Blocky mouth animation
```

### 7. Provider System (`electron/providers/`)

The provider pattern is what makes Blocky extensible. Each provider type (STT, TTS, LLM) has a defined interface. The core ships free defaults. Anyone can add a new provider by:

1. Creating a file in the appropriate `providers/` subdirectory
2. Implementing the interface (see `types.js`)
3. Registering it in the provider registry

```javascript
// electron/providers/types.js

// Every provider must implement:
// {
//   name: string,                    // Display name ("Piper TTS", "ElevenLabs")
//   id: string,                      // Unique ID ("piper", "elevenlabs")
//   type: 'stt' | 'tts' | 'llm',    // Provider category
//   free: boolean,                   // Is this $0 to use?
//   offline: boolean,                // Works without internet?
//   isAvailable(): Promise<boolean>, // Can this run right now?
//   initialize(): Promise<void>,     // One-time setup
//   cleanup(): void,                 // Teardown
// }
//
// Plus the type-specific methods defined earlier (speak/listen/send)

// Provider selection stored in config. User can switch in settings panel.
// Hot-swappable — changing provider mid-session is supported.
```

**Each provider directory includes a README.md** with a complete guide for adding new providers. This is the main extension point for companies that want to add ElevenLabs, Deepgram, etc.

---

## UI Layout

Single vertical column, portrait orientation (like a video call window):

```
┌─────────────────────────────┐
│ BLOCKY  ○Piper ○WebSpeech   │  ← Status bar: name, active providers, session time
│                    04:07     │
├─────────────────────────────┤
│                              │
│     [ACCESSORY]              │
│     ╔══════════════════╗     │
│     ║    ┌──┐    ┌──┐  ║     │  ← Blocky (interactive, animated)
│     ║    │ ●│    │● │  ║     │
│     ║    └──┘    └──┘  ║     │
│     ║       ╭────╮     ║     │
│     ║       │    │     ║     │
│     ║       ╰────╯     ║     │
│     ╚══════════════════╝     │
│                              │
│     BLOCKY                   │  ← Name
│     ● WRITING CODE           │  ← Activity status
│       src/api/handler.ts     │  ← Activity detail
│                              │
│   ▁▂▃▅▆▇█▇▅▃▂▁▂▃▅▆▇▅▃▂▁    │  ← Blocky's voice waveform
│                              │
├─────────────────────────────┤
│  ── TRANSCRIPT ──            │
│                              │
│  YOU    Fix the API handler  │  ← Scrolling conversation log
│                              │
│  ● READING FILE              │  ← Inline activity events
│    src/api/handler.ts        │
│                              │
│  BLOCKY I found the issue... │
│                              │
├─────────────────────────────┤
│  › talk to blocky...         │  ← Text input (always available)
│                              │
│   ▁▂▃▅▆▇█▇▅▃▂▁▂▃▅▆▇▅▃▂▁    │  ← User's mic waveform
│                              │
│    [🔇]    [ 🎤 ]    [⚙]    │  ← Mute, Push-to-Talk, Settings
│                              │
│  [dance] [party] [reset] ... │  ← Quick Blocky command buttons
└─────────────────────────────┘
```

**Color scheme:**

- Background: `#0a0e0c` (near-black with green tint)
- Primary accent: `#00ff88` (terminal green) — Blocky's default color
- User accent: `#5588ff` (blue) — user's text, mic waveform
- Warning: `#ffaa00` (amber) — thinking state
- Error: `#ff4444` (red) — recording indicator, errors
- Scanline overlay: subtle horizontal lines for CRT effect
- Text glow: `text-shadow: 0 0 8px` on colored elements

**Font:** JetBrains Mono (bundled, OFL license). Fallback: Fira Code, Cascadia Code, monospace.

---

## State Management

### Session Store (`src/stores/session.js`)

```javascript
// Zustand store:
// {
//   // Voice loop state
//   state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error',
//   activityState: <activity states from table above>,
//   activityDetail: string | null,
//
//   // Conversation
//   transcript: Array<{
//     role: 'user' | 'blocky' | 'system',
//     text: string,
//     timestamp: Date,
//     type: 'speech' | 'activity' | 'command' | 'error'
//   }>,
//
//   // Session
//   sessionStartTime: Date,
//   projectDirectory: string,
//
//   // Provider state
//   activeSTT: string,    // provider id
//   activeTTS: string,    // provider id
//   activeLLM: string,    // provider id
//
//   // Settings
//   settings: {
//     pushToTalk: true,
//     showTranscript: true,
//     speakCodeBlocks: false,    // Usually false — just show in transcript
//     ttsVoice: string,
//     sttLanguage: 'en-US',
//   },
// }
```

### Blocky Params Store (`src/stores/blocky-params.js`)

```javascript
// Zustand store with persistence:
// {
//   ...BlockyParams,              // All params from the parameter system
//
//   // Param history (for undo)
//   history: BlockyParams[],
//
//   // Saved presets
//   presets: { [name: string]: BlockyParams },
//
//   // Actions
//   updateParams(partial: Partial<BlockyParams>): void,
//   applyMood(mood: string): void,
//   savePreset(name: string): void,
//   loadPreset(name: string): void,
//   reset(): void,
//   undo(): void,
// }
//
// Persists to ~/.blocky/params.json via electron-store
// Synced between renderer and main process via IPC
```

---

## Build & Run

```bash
# Prerequisites:
# - Node.js 18+
# - Claude Code CLI installed and authenticated
#   (run `claude` in terminal to verify)

# Clone and install
git clone https://github.com/<org>/blocky.git
cd blocky
npm install

# Download TTS/STT models (first time only, ~170MB total)
npm run download-models

# Run in development
npm run dev

# Build for your platform
npm run build          # Auto-detects OS
npm run build:mac      # macOS .dmg
npm run build:win      # Windows .exe
npm run build:linux    # Linux .AppImage
```

**First-run experience:**

1. App opens with a setup wizard
2. Checks for `claude` CLI in PATH → shows install instructions if missing
3. Downloads Piper voice model (~20MB) → progress bar
4. Optionally downloads Whisper model (~150MB) for offline STT
5. Opens main interface with Blocky waving and saying "Hey! I'm Blocky."

---

## Implementation Order

Build in this exact order. Each phase must be fully working before moving on.

### Phase 1: Electron Shell + Claude Bridge

**Goal: Text in, text out, working through Claude Code CLI.**

1. Scaffold Electron + Vite + React project with `electron-vite`
2. Set up contextBridge + preload for secure IPC
3. Build `claude-code.js` provider — spawn `claude --print --output-format stream-json`
4. Parse streaming JSON events, emit StreamEvents via IPC
5. Build minimal UI: text input → send to Claude → show response in transcript
6. Verify conversation context persists between turns
7. Handle subprocess lifecycle (start, restart on crash, clean shutdown)
8. Add project directory selector

**Exit criteria:** You can type messages, Claude responds, it can edit files and run commands, and you see the stream-json events parsed correctly.

### Phase 2: Blocky Avatar + Activity States

**Goal: Blocky's face reacts to what Claude is doing.**

1. Build the ASCII face renderer from composable parts
2. Implement all face states from the activity table
3. Build the `activity-mapper` that converts stream-json events to face states
4. Wire activity states to the face in real-time
5. Add blinking animation
6. Add status label + detail text below face
7. Implement the CSS transform animation engine (dance, bounce, etc.)
8. Build the waveform visualizer component
9. Apply the full retro terminal UI theme (colors, scanlines, glow)

**Exit criteria:** Blocky's face changes in real-time as Claude reads files, writes code, runs commands. Text input still works for both Blocky commands and Claude tasks.

### Phase 3: Blocky Interaction System

**Goal: Users can customize Blocky through natural language.**

1. Build the command parser (keyword matching for all param types)
2. Build the message router (Blocky command vs Claude task)
3. Implement the Blocky params store with persistence
4. Wire command parser → param store → face renderer
5. Add mood presets
6. Add quick-action buttons below mic controls
7. Param persistence to disk between sessions
8. Undo support

**Exit criteria:** "Make blocky red", "dance", "party mode", "reset" all work instantly. Commands don't go to Claude. Coding tasks still route to Claude normally.

### Phase 4: Local TTS (make it speak)

**Goal: Blocky speaks Claude's responses aloud with a natural voice.**

1. Integrate Piper TTS — download binary + default voice model
2. Build the sentence chunker for streaming text
3. Build the audio playback queue for gapless playback
4. Wire Claude response stream → chunker → Piper → queue → playback
5. Add amplitude analysis for mouth-sync animation
6. Build model downloader for first-run setup
7. Add Kokoro TTS as alternative provider
8. Add Web Speech API as instant fallback
9. Voice selection in settings panel
10. Provider hot-swap support

**Exit criteria:** Claude's text responses play as spoken audio through Piper. Blocky's mouth animates in rough sync with the audio. User can switch between Piper, Kokoro, and Web Speech API.

### Phase 5: STT (make it listen)

**Goal: Users speak instead of type.**

1. Implement Web Speech API provider in renderer
2. Build push-to-talk button with visual feedback
3. Wire STT → message router → (Blocky or Claude)
4. Show interim transcription in real-time
5. Implement Whisper.cpp provider for offline fallback
6. Auto-detect which STT providers are available
7. **Critical: Disable STT while TTS is playing (echo prevention)**
8. Full voice loop working: speak → transcribe → route → Claude → TTS → playback

**Exit criteria:** Complete hands-free voice loop works. User can talk to both Blocky ("make me blue") and Claude ("fix the bug") by voice. No echo feedback loop.

### Phase 6: Polish + Open Source Prep

**Goal: Production-ready, well-documented, ready for contributors.**

1. Keyboard shortcuts (Space = push-to-talk, Esc = cancel, Ctrl+Z = undo Blocky)
2. Audio device selection (mic, speakers)
3. Conversation export (transcript to markdown)
4. Error states and graceful degradation throughout
5. First-run setup wizard
6. Write PROVIDERS.md — complete guide for adding custom providers
7. Write BLOCKY-COMMANDS.md — full command reference
8. Write ARCHITECTURE.md — system design for contributors
9. Write CONTRIBUTING.md — PR process, code style, testing
10. CI/CD pipeline for multi-platform builds
11. GitHub release workflow with auto-built binaries

---

## Key Technical Gotchas

1. **Echo cancellation:** When Blocky speaks, the mic picks it up. Push-to-talk sidesteps this (user isn't talking while Blocky speaks). For VAD mode (future), you must disable STT during TTS playback, or implement acoustic echo cancellation via Web Audio API.

2. **Claude Code subprocess persistence:** `claude --print` in stream-json mode — each write to stdin is a new user turn. The subprocess maintains full conversation history. Never restart between turns. Only restart on crash.

3. **Piper binary distribution:** Piper is a native binary (C++). Ship platform-specific binaries in the Electron app, or download on first run. Use `piper-phonemize` for the text processing pipeline. The ONNX runtime handles inference.

4. **Whisper model size:** The `base.en` model is 150MB. Don't bundle it — download on first run with a progress bar. Store in the app data directory, not the app bundle.

5. **Electron security:** Use contextBridge + preload. Never expose Node.js APIs to the renderer. All subprocess management, TTS, and file I/O happen in the main process via IPC.

6. **Long responses + code blocks:** Claude Code often outputs large code blocks. Don't speak these — detect ``` fences and skip them for TTS. Show in transcript only. Optionally speak a summary ("I'm writing a new function...").

7. **Tool use feedback timing:** Stream-json events for tool_use arrive before the tool runs. tool_result arrives after. Use tool_use to show "RUNNING COMMAND: npm test" and tool_result to show success/error. The face state should update on tool_use (optimistic) and potentially change on tool_result if there's an error.

8. **Cross-platform audio:** Piper outputs raw PCM (16-bit, 22050Hz). On macOS/Linux this plays fine through Web Audio API. On Windows, you may need to handle sample rate conversion if the audio device doesn't support 22050Hz natively.

9. **Provider hot-swap:** When switching providers mid-session, cleanly shut down the old provider (stop any audio, close any connections) before initializing the new one. Don't lose the conversation — only the I/O layer changes.

10. **Blocky param persistence:** Save params on every change (debounced 500ms). Load on startup. If the params file is corrupted, fall back to defaults silently. Never crash on bad params.

---

## Extension Guide (for downstream developers)

Blocky is designed to be forked and enhanced. Here are the main extension points:

### Adding a Premium TTS Provider (e.g., ElevenLabs)

```javascript
// Create: electron/providers/tts/elevenlabs.js

module.exports = {
  name: "ElevenLabs",
  id: "elevenlabs",
  type: "tts",
  free: false,
  offline: false,

  async isAvailable() {
    return !!getConfig("elevenlabs_api_key");
  },

  async speak(text) {
    // POST to ElevenLabs streaming API
    // Return AudioBuffer
  },

  stream(text) {
    // Return ReadableStream of audio chunks
  },

  // ... rest of interface
};
```

Register in provider registry → it appears in Settings → user selects it → done.

### Adding a New Avatar System (e.g., 3D)

The avatar receives two inputs: `params` (BlockyParams JSON) and `activityState` (string). Any renderer that consumes these can replace the ASCII face:

```jsx
// Replace <Blocky params={...} activityState={...} />
// with   <ThreeDAvatar params={...} activityState={...} />
```

The param system, command parser, activity mapper, and message router all remain the same. Only the visual renderer changes.

### Adding a New LLM Backend

Implement the LLM provider interface. Could wrap any CLI tool, API, or local model. The message router and Blocky interaction system work with any backend that emits StreamEvents.

---

## Future Roadmap (Community-Driven)

These are NOT in scope for v1 but are natural extensions:

- **2D SVG Avatar:** Smooth vector face with CSS transitions
- **3D Avatar:** Three.js or Ready Player Me with lip sync (viseme mapping)
- **VAD (Voice Activity Detection):** Always-on listening with silence detection
- **Wake word:** "Hey Blocky" activation via Porcupine (free tier)
- **Multi-monitor:** Floating Blocky window over your code editor
- **Screen sharing:** Blocky can see your screen (periodic screenshots → Claude vision)
- **Themes:** Community-created UI themes beyond the default terminal look
- **Blocky skins:** Alternative ASCII art styles, emoji face, pixel art
- **Plugin system:** NPM-based plugins for custom commands, integrations
- **Mobile companion:** React Native app that connects to desktop Blocky remotely
