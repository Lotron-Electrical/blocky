#!/usr/bin/env node

/**
 * Blocky CLI — Voice-enabled wrapper for Claude Code
 *
 * Usage:
 *   blocky [project-dir] [options]
 *
 * Options:
 *   --mute       Start with TTS muted
 *   --no-hooks   Don't inject Claude Code hooks (no activity tracking)
 *   --help       Show this help message
 *   --version    Show version number
 *
 * Examples:
 *   blocky                  # Launch in current directory
 *   blocky .                # Same as above
 *   blocky ~/projects/app   # Launch in specific directory
 *   blocky --mute           # Launch without voice
 */

const http = require("http");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ── Constants ──

const VERSION = require("../package.json").version;
const HOME = process.env.USERPROFILE || process.env.HOME;
const BLOCKY_DIR = path.join(HOME, ".blocky");
const PORT_FILE = path.join(BLOCKY_DIR, "hook-port");
const SETTINGS_PATH = path.join(HOME, ".claude", "settings.json");
const BRIDGE_PATH = path.join(BLOCKY_DIR, "hook-bridge.js");
const PIPER_EXE = path.join(BLOCKY_DIR, "piper", "piper.exe");
const PIPER_MODEL = path.join(BLOCKY_DIR, "piper", "en_US-lessac-medium.onnx");
const HOOK_MARKER = "BLOCKY_HOOK_v1";
const HOOK_EVENTS = ["UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop"];

// ── ANSI Helpers ──

const ESC = "\x1b";
const RESET = `${ESC}[0m`;
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const rgb = (r, g, b) => `${ESC}[38;2;${r};${g};${b}m`;
const GREEN = rgb(0, 255, 136);
const DARK_GREEN = rgb(42, 74, 58);
const YELLOW = rgb(255, 170, 0);
const RED = rgb(255, 68, 68);
const BLUE = rgb(85, 136, 255);
const PURPLE = rgb(187, 136, 255);
const CYAN = rgb(0, 221, 255);
const GRAY = rgb(74, 106, 90);

// ── Parse Args ──

const args = process.argv.slice(2);
let projectDir = null;
let muted = false;
let noHooks = false;

for (const arg of args) {
  if (arg === "--help" || arg === "-h") {
    printHelp();
    process.exit(0);
  }
  if (arg === "--version" || arg === "-v") {
    console.log(VERSION);
    process.exit(0);
  }
  if (arg === "--mute") {
    muted = true;
    continue;
  }
  if (arg === "--no-hooks") {
    noHooks = true;
    continue;
  }
  if (!arg.startsWith("-")) {
    projectDir = arg;
  }
}

// Resolve project dir
if (projectDir) {
  projectDir = path.resolve(projectDir);
  if (!fs.existsSync(projectDir)) {
    console.error(`${RED}Error: directory not found: ${projectDir}${RESET}`);
    process.exit(1);
  }
  if (!fs.statSync(projectDir).isDirectory()) {
    console.error(`${RED}Error: not a directory: ${projectDir}${RESET}`);
    process.exit(1);
  }
} else {
  projectDir = process.cwd();
}

// ── Face Rendering ──

const FACE_LINES = [
  "  ╔════════════════════════╗  ",
  "  ║                        ║  ",
  "  ║    ┌──┐      ┌──┐    ║  ",
  "  ║    │ ·│      │· │    ║  ",
  "  ║    └──┘      └──┘    ║  ",
  "  ║                        ║  ",
  "  ║       ╭──╮            ║  ",
  "  ║       │  │            ║  ",
  "  ║       ╰──╯            ║  ",
  "  ║                        ║  ",
  "  ╚════════════════════════╝  ",
];

const FACE_EXIT = [
  "  ╔════════════════════════╗  ",
  "  ║                        ║  ",
  "  ║    ┌──┐      ┌──┐    ║  ",
  "  ║    │ ^│      │^ │    ║  ",
  "  ║    └──┘      └──┘    ║  ",
  "  ║                        ║  ",
  "  ║      ╭────────╮      ║  ",
  "  ║      │ ✓    ✓ │      ║  ",
  "  ║      ╰────────╯      ║  ",
  "  ║                        ║  ",
  "  ╚════════════════════════╝  ",
];

function printFace(lines, color, label, detail) {
  console.log();
  for (const line of lines) {
    console.log(`${color}${line}${RESET}`);
  }
  console.log(`${BOLD}${color}        BLOCKY${RESET}`);
  if (label) {
    console.log(`${DIM}${color}      ${label}${RESET}`);
  }
  if (detail) {
    console.log(`${DIM}${GRAY}      ${detail}${RESET}`);
  }
  console.log();
}

function printHelp() {
  console.log(`
${GREEN}${BOLD}BLOCKY${RESET} ${DIM}v${VERSION}${RESET}
${GRAY}Voice-enabled wrapper for Claude Code${RESET}

${BOLD}Usage:${RESET}
  blocky ${DIM}[project-dir] [options]${RESET}

${BOLD}Options:${RESET}
  ${GREEN}--mute${RESET}       Start with TTS muted
  ${GREEN}--no-hooks${RESET}   Don't inject Claude Code hooks
  ${GREEN}--help${RESET}       Show this help message
  ${GREEN}--version${RESET}    Show version number

${BOLD}Examples:${RESET}
  ${DIM}$${RESET} blocky                  ${GRAY}# Current directory${RESET}
  ${DIM}$${RESET} blocky ~/projects/app   ${GRAY}# Specific project${RESET}
  ${DIM}$${RESET} blocky --mute           ${GRAY}# No voice output${RESET}

${BOLD}Keyboard:${RESET}
  All input goes directly to Claude Code.
  Blocky speaks responses via TTS in the background.
`);
}

// ── Activity Colors ──

const ACTIVITY_COLORS = {
  idle: DARK_GREEN,
  thinking: YELLOW,
  reading_file: BLUE,
  writing_code: GREEN,
  running_bash: rgb(255, 136, 0),
  searching: PURPLE,
  speaking: GREEN,
  success: GREEN,
  error: RED,
};

const ACTIVITY_LABELS = {
  idle: "STANDING BY",
  thinking: "THINKING",
  reading_file: "READING FILE",
  writing_code: "WRITING CODE",
  running_bash: "RUNNING CMD",
  searching: "SEARCHING",
  speaking: "SPEAKING",
  success: "DONE ✓",
  error: "ERROR",
};

// ── TTS (Piper) ──

let piperAvailable = fs.existsSync(PIPER_EXE) && fs.existsSync(PIPER_MODEL);
let speakQueue = [];
let isSpeaking = false;

/**
 * Strips markdown/code from text for TTS.
 */
function processTextForSpeech(text) {
  if (!text) return "";
  let cleaned = text;

  // Short responses — keep as-is
  if (cleaned.length < 100) return cleaned.trim();

  // Strip code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, "");
  // Strip inline code
  cleaned = cleaned.replace(/`[^`]+`/g, "");
  // Simplify file paths
  cleaned = cleaned.replace(/(?:[\w./\\-]+\/)+(\w[\w.-]*)/g, "$1");
  // Strip markdown
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");
  cleaned = cleaned.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  cleaned = cleaned.replace(/^[\s]*[-*]\s+/gm, "");
  cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, "");
  // Collapse whitespace
  cleaned = cleaned
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ");

  // Truncate
  if (cleaned.length > 300) {
    const sentences = cleaned.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length > 3) {
      cleaned =
        sentences.slice(0, 3).join("") + " Check the terminal for details.";
    } else {
      cleaned = cleaned.slice(0, 297) + "...";
    }
  }
  return cleaned.trim();
}

/**
 * Speaks text using Piper TTS. Non-blocking, queued.
 */
function speak(text) {
  if (muted || !piperAvailable || !text) return;
  const processed = processTextForSpeech(text);
  if (!processed) return;
  speakQueue.push(processed);
  drainSpeakQueue();
}

function drainSpeakQueue() {
  if (isSpeaking || speakQueue.length === 0) return;
  isSpeaking = true;
  const text = speakQueue.shift();

  const piper = spawn(PIPER_EXE, ["--model", PIPER_MODEL, "--output_raw"], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  const audioChunks = [];
  piper.stdout.on("data", (chunk) => audioChunks.push(chunk));

  piper.on("close", () => {
    if (audioChunks.length > 0) {
      // Play raw PCM via PowerShell SoundPlayer or ffplay
      // Simplest cross-platform: write to temp file and play
      playPcmAudio(Buffer.concat(audioChunks));
    } else {
      isSpeaking = false;
      drainSpeakQueue();
    }
  });

  piper.on("error", () => {
    isSpeaking = false;
    drainSpeakQueue();
  });

  piper.stdin.write(text);
  piper.stdin.end();
}

/**
 * Plays raw 16-bit 22050Hz PCM audio.
 * Uses PowerShell on Windows to play via SoundPlayer.
 */
function playPcmAudio(pcmBuffer) {
  // Convert raw PCM to WAV in memory, write to temp, play
  const sampleRate = 22050;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  const wavBuffer = Buffer.concat([header, pcmBuffer]);
  const tempWav = path.join(BLOCKY_DIR, `cli-tts-${Date.now()}.wav`);

  try {
    fs.writeFileSync(tempWav, wavBuffer);

    // Play using PowerShell SoundPlayer (non-blocking-ish)
    const player = spawn(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `(New-Object Media.SoundPlayer '${tempWav.replace(/'/g, "''")}').PlaySync()`,
      ],
      { stdio: "ignore", windowsHide: true },
    );

    player.on("close", () => {
      try {
        fs.unlinkSync(tempWav);
      } catch {}
      isSpeaking = false;
      drainSpeakQueue();
    });

    player.on("error", () => {
      try {
        fs.unlinkSync(tempWav);
      } catch {}
      isSpeaking = false;
      drainSpeakQueue();
    });
  } catch {
    isSpeaking = false;
    drainSpeakQueue();
  }
}

// ── Hook Server ──

let hookServer = null;

function startHookServer() {
  return new Promise((resolve) => {
    hookServer = http.createServer((req, res) => {
      if (req.method === "POST" && req.url === "/hook") {
        let body = "";
        let size = 0;
        const MAX = 1024 * 1024;

        req.on("data", (chunk) => {
          size += chunk.length;
          if (size > MAX) {
            res.writeHead(413);
            res.end();
            req.destroy();
            return;
          }
          body += chunk;
        });

        req.on("end", () => {
          res.writeHead(200);
          res.end("ok");
          try {
            handleHookEvent(JSON.parse(body));
          } catch {}
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    hookServer.listen(0, "127.0.0.1", () => {
      const port = hookServer.address().port;
      fs.mkdirSync(BLOCKY_DIR, { recursive: true });
      fs.writeFileSync(PORT_FILE, String(port));
      resolve(port);
    });
  });
}

function stopHookServer() {
  if (hookServer) {
    hookServer.close();
    hookServer = null;
  }
  try {
    fs.unlinkSync(PORT_FILE);
  } catch {}
}

// ── Hook Event Handler ──

let lastActivity = "idle";
let lastProgressTime = 0;
const PROGRESS_COOLDOWN = 5000;

const PROGRESS_PHRASES = {
  reading_file: (d) => `Reading ${d ? path.basename(d) : "a file"}.`,
  writing_code: (d) => `Writing to ${d ? path.basename(d) : "a file"}.`,
  running_bash: () => "Running a command.",
  searching: () => "Searching the codebase.",
};

function handleHookEvent(body) {
  const event = body.hook_event_name || body.hookEventName;
  const tool = body.tool_name || body.toolName;
  const error = body.tool_error || body.is_error;
  const input = body.tool_input || {};

  let detail = null;
  if (input.file_path) detail = input.file_path;
  else if (input.command) {
    detail =
      input.command.length > 50
        ? input.command.slice(0, 47) + "..."
        : input.command;
  } else if (input.pattern) detail = input.pattern;

  switch (event) {
    case "UserPromptSubmit":
      lastActivity = "thinking";
      break;

    case "PreToolUse": {
      const toolMap = {
        Read: "reading_file",
        View: "reading_file",
        Glob: "searching",
        Grep: "searching",
        Search: "searching",
        WebSearch: "searching",
        Edit: "writing_code",
        MultiEdit: "writing_code",
        Write: "writing_code",
        NotebookEdit: "writing_code",
        Bash: "running_bash",
        Agent: "thinking",
      };
      const activity = toolMap[tool] || "thinking";
      lastActivity = activity;

      // Speak progress updates with cooldown
      const phraser = PROGRESS_PHRASES[activity];
      if (phraser) {
        const now = Date.now();
        if (now - lastProgressTime >= PROGRESS_COOLDOWN) {
          lastProgressTime = now;
          speak(phraser(detail));
        }
      }
      break;
    }

    case "PostToolUse":
      if (error) {
        lastActivity = "error";
        speak("Something went wrong.");
        setTimeout(() => {
          lastActivity = "thinking";
        }, 1200);
      } else {
        lastActivity = "thinking";
      }
      break;

    case "Stop": {
      lastActivity = "success";
      const lastMessage = body.last_assistant_message;
      if (lastMessage) {
        speak(lastMessage);
      }
      setTimeout(() => {
        lastActivity = "idle";
      }, 2000);
      break;
    }
  }
}

// ── Hook Injection ──

const BRIDGE_SOURCE = `#!/usr/bin/env node
if (!process.env.BLOCKY_SESSION) process.exit(0);
const fs = require("fs");
const path = require("path");
const http = require("http");
const portFile = path.join(process.env.USERPROFILE || process.env.HOME, ".blocky", "hook-port");
let port;
try { port = parseInt(fs.readFileSync(portFile, "utf8").trim(), 10); } catch { process.exit(0); }
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const req = http.request({ hostname: "127.0.0.1", port, path: "/hook", method: "POST", headers: { "Content-Type": "application/json" } }, () => {});
  req.on("error", () => {});
  req.write(input);
  req.end();
});
`;

function injectHooks() {
  fs.mkdirSync(BLOCKY_DIR, { recursive: true });

  // Deploy bridge script
  fs.writeFileSync(BRIDGE_PATH, BRIDGE_SOURCE);

  // Read current settings
  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch {}

  // Clean any stale Blocky hooks first
  removeBlockyHooks(settings);

  if (!settings.hooks) settings.hooks = {};

  const bridgePath = BRIDGE_PATH.replace(/\\/g, "/");
  const blockyHook = {
    type: "command",
    command: `node "${bridgePath}" # ${HOOK_MARKER}`,
  };

  for (const event of HOOK_EVENTS) {
    if (!settings.hooks[event]) settings.hooks[event] = [];

    let catchAll = settings.hooks[event].find(
      (mg) => mg.matcher === "" || mg.matcher === undefined,
    );

    if (!catchAll) {
      catchAll = { matcher: "", hooks: [] };
      settings.hooks[event].push(catchAll);
    }

    if (!catchAll.hooks) catchAll.hooks = [];
    catchAll.hooks.push({ ...blockyHook });
  }

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

function removeHooks() {
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
    removeBlockyHooks(settings);
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  } catch {}
}

function removeBlockyHooks(settings) {
  if (!settings.hooks) return;

  for (const event of HOOK_EVENTS) {
    const matchers = settings.hooks[event];
    if (!Array.isArray(matchers)) continue;

    for (const mg of matchers) {
      if (!Array.isArray(mg.hooks)) continue;
      mg.hooks = mg.hooks.filter(
        (h) => !h.command || !h.command.includes(HOOK_MARKER),
      );
    }

    settings.hooks[event] = matchers.filter(
      (mg) => mg.hooks && mg.hooks.length > 0,
    );

    if (settings.hooks[event].length === 0) {
      delete settings.hooks[event];
    }
  }
}

// ── Find Claude CLI ──

function findClaude() {
  // Check if claude is in PATH
  try {
    const which =
      process.platform === "win32"
        ? execSync("where claude 2>NUL", { encoding: "utf8" }).trim()
        : execSync("which claude 2>/dev/null", { encoding: "utf8" }).trim();
    if (which) return which.split("\n")[0].trim();
  } catch {}

  // Check common locations
  const candidates = [
    path.join(HOME, ".claude", "local", "claude.exe"),
    path.join(HOME, "AppData", "Local", "Programs", "claude", "claude.exe"),
    "/usr/local/bin/claude",
    "/usr/bin/claude",
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  return null;
}

// ── Main ──

async function main() {
  // Print startup face
  printFace(FACE_LINES, GREEN, "STARTING UP", null);

  // Find claude
  const claudePath = findClaude();
  if (!claudePath) {
    console.error(
      `${RED}${BOLD}Error:${RESET}${RED} claude CLI not found in PATH.${RESET}`,
    );
    console.error(
      `${GRAY}Install Claude Code: https://docs.anthropic.com/en/docs/claude-code${RESET}`,
    );
    process.exit(1);
  }

  // TTS status
  if (piperAvailable && !muted) {
    console.log(`${GRAY}  TTS: Piper ready${RESET}`);
  } else if (muted) {
    console.log(`${GRAY}  TTS: muted${RESET}`);
  } else {
    console.log(
      `${GRAY}  TTS: not available (run Blocky Electron app to download)${RESET}`,
    );
  }

  // Project info
  const projectName = path.basename(projectDir);
  console.log(`${GRAY}  Project: ${projectName}${RESET}`);
  console.log(`${GRAY}  Dir: ${projectDir}${RESET}`);

  // Start hook server + inject hooks
  if (!noHooks) {
    const port = await startHookServer();
    console.log(`${GRAY}  Hooks: port ${port}${RESET}`);
    injectHooks();
  } else {
    console.log(`${GRAY}  Hooks: disabled${RESET}`);
  }

  console.log();
  console.log(`${GREEN}${BOLD}  Launching Claude Code...${RESET}`);
  console.log(`${DARK_GREEN}  ─────────────────────────────────────${RESET}`);
  console.log();

  // Spawn claude with full terminal control
  const isWin = process.platform === "win32";
  const shell = isWin ? true : false;
  const claude = spawn(claudePath, [], {
    cwd: projectDir,
    stdio: "inherit",
    shell,
    env: {
      ...process.env,
      BLOCKY_SESSION: "1",
    },
  });

  // Handle Claude exit
  claude.on("close", (code) => {
    console.log();
    console.log(`${DARK_GREEN}  ─────────────────────────────────────${RESET}`);
    printFace(FACE_EXIT, GREEN, "SESSION ENDED", `exit code: ${code || 0}`);

    cleanup();
    process.exit(code || 0);
  });

  claude.on("error", (err) => {
    console.error(
      `\n${RED}Failed to start Claude Code: ${err.message}${RESET}`,
    );
    cleanup();
    process.exit(1);
  });

  // Graceful shutdown
  const onSignal = () => {
    cleanup();
    // Let claude handle the signal naturally via stdio: inherit
  };

  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  process.on("exit", cleanup);
}

let cleanedUp = false;

function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;

  if (!noHooks) {
    removeHooks();
    stopHookServer();
  }

  // Kill any pending TTS
  speakQueue = [];
}

// ── Run ──

main().catch((err) => {
  console.error(`${RED}${err.message}${RESET}`);
  cleanup();
  process.exit(1);
});
