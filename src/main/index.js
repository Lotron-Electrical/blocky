import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { join } from "path";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  appendFileSync,
} from "fs";

// Log uncaught exceptions to file for debugging
const logFile = join(
  process.env.USERPROFILE || process.env.HOME,
  ".blocky",
  "crash.log",
);
process.on("uncaughtException", (err) => {
  const msg = `[${new Date().toISOString()}] ${err.stack || err.message}\n`;
  try {
    appendFileSync(logFile, msg);
  } catch {}
  console.error("[main] uncaughtException:", err);
});
import {
  spawnShell,
  write as ptyWrite,
  resize as ptyResize,
  kill as ptyKill,
} from "./pty-manager";
import { start as hookStart, stop as hookStop } from "./hook-server";
import { inject as hookInject, remove as hookRemove } from "./hook-injector";
import {
  checkReady as ttsCheckReady,
  download as ttsDownload,
} from "./tts/piper-downloader";
import { synthesize as ttsSynthesize, killPiper } from "./tts/piper-engine";
import {
  checkReady as sttCheckReady,
  download as sttDownload,
} from "./stt/whisper-downloader";
import { transcribe as sttTranscribe, killWhisper } from "./stt/whisper-engine";
import {
  register as peerRegister,
  updateState as peerUpdateState,
  unregister as peerUnregister,
} from "./peer-registry";

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 700,
    height: 900,
    minWidth: 500,
    minHeight: 600,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#080c0a",
      symbolColor: "#2a4a3a",
      height: 32,
    },
    backgroundColor: "#080c0a",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// ── IPC Handlers ──

ipcMain.on("pty:start", (_event, projectDir) => {
  spawnShell(projectDir, win);
});

ipcMain.on("pty:input", (_event, data) => {
  ptyWrite(data);
});

ipcMain.on("pty:resize", (_event, { cols, rows }) => {
  ptyResize(cols, rows);
});

ipcMain.on("pty:kill", () => {
  ptyKill();
});

// ── Peer IPC Handlers ──

ipcMain.on("peer:state", (_event, state) => {
  peerUpdateState(state);
});

ipcMain.handle("dialog:selectDirectory", async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ["openDirectory"],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// ── TTS IPC Handlers ──

ipcMain.handle("tts:check-ready", () => {
  return ttsCheckReady();
});

ipcMain.handle("tts:download", async () => {
  await ttsDownload(win);
});

ipcMain.handle("tts:synthesize", async (_event, text) => {
  const pcmBuffer = await ttsSynthesize(text);
  // Return as ArrayBuffer for renderer
  return pcmBuffer.buffer.slice(
    pcmBuffer.byteOffset,
    pcmBuffer.byteOffset + pcmBuffer.byteLength,
  );
});

// ── STT IPC Handlers ──

ipcMain.handle("stt:check-ready", () => {
  return sttCheckReady();
});

ipcMain.handle("stt:download", async () => {
  await sttDownload(win);
});

ipcMain.handle("stt:transcribe", async (_event, wavArrayBuffer) => {
  return await sttTranscribe(wavArrayBuffer);
});

ipcMain.handle("getRecentProjects", async () => {
  const claudeJson = join(
    process.env.USERPROFILE || process.env.HOME,
    ".claude.json",
  );
  try {
    const data = JSON.parse(readFileSync(claudeJson, "utf8"));
    const projects = new Set();
    if (data.projects) {
      for (const dir of Object.keys(data.projects)) {
        if (existsSync(dir)) projects.add(dir);
      }
    }
    return [...projects].slice(0, 10);
  } catch {
    return [];
  }
});

// ── First-run + Export ──

const blockyDir = join(process.env.USERPROFILE || process.env.HOME, ".blocky");

ipcMain.handle("app:isFirstRun", () => {
  const flag = join(blockyDir, ".setup-done");
  return !existsSync(flag);
});

ipcMain.handle("app:completeSetup", () => {
  mkdirSync(blockyDir, { recursive: true });
  writeFileSync(join(blockyDir, ".setup-done"), "1");
});

ipcMain.handle("app:exportTranscript", async (_event, markdown) => {
  const result = await dialog.showSaveDialog(win, {
    title: "Export Transcript",
    defaultPath: `blocky-session-${new Date().toISOString().slice(0, 10)}.md`,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (!result.canceled && result.filePath) {
    writeFileSync(result.filePath, markdown, "utf8");
    return result.filePath;
  }
  return null;
});

// ── App lifecycle ──

app.whenReady().then(() => {
  createWindow();
  hookStart(win);
  hookInject();
  peerRegister(win, {
    name: "BLOCKY",
    skinColor: "#00ff88",
    eyeStyle: "dot",
    mouthStyle: "neutral",
    accessory: "none",
    activity: "idle",
    detail: null,
    project: null,
    projectName: null,
  });
});

app.on("before-quit", () => {
  peerUnregister();
  ptyKill();
  killPiper();
  killWhisper();
  hookRemove();
  hookStop();
});

app.on("window-all-closed", () => {
  app.quit();
});
