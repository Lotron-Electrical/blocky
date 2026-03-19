import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { join } from "path";
import { spawn } from "child_process";

let win = null;
let sessionId = null;
let currentProc = null;
let projectDir = null;

function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 800,
    minWidth: 400,
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

  // Load renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// ── NDJSON line-buffer parser ──
function parseNDJSON(stream, onLine) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete line
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        onLine(JSON.parse(trimmed));
      } catch {
        // skip non-JSON lines
      }
    }
  });
}

// ── Map stream-json events to renderer events ──
function mapEvent(evt) {
  if (!evt || !evt.type) return null;

  // init event
  if (evt.type === "system" && evt.subtype === "init") {
    sessionId = evt.session_id;
    return { type: "init", sessionId: evt.session_id };
  }

  // assistant message with content blocks
  if (evt.type === "assistant" && evt.message?.content) {
    const events = [];
    for (const block of evt.message.content) {
      if (block.type === "text") {
        events.push({ type: "text", content: block.text });
      } else if (block.type === "tool_use") {
        events.push({
          type: "tool_start",
          tool: block.name,
          toolUseId: block.id,
          input: block.input,
        });
      }
    }
    return events.length === 1 ? events[0] : events.length > 1 ? events : null;
  }

  // user message with tool_result
  if (evt.type === "user" && evt.message?.content) {
    const events = [];
    for (const block of evt.message.content) {
      if (block.type === "tool_result") {
        events.push({
          type: "tool_end",
          toolUseId: block.tool_use_id,
          output: block.content || "",
          isError: block.is_error || false,
        });
      }
    }
    return events.length === 1 ? events[0] : events.length > 1 ? events : null;
  }

  // result event
  if (evt.type === "result") {
    return {
      type: "done",
      result: evt.result,
      isError: evt.subtype === "error",
      cost: evt.cost_usd || null,
    };
  }

  return null;
}

function sendToRenderer(event) {
  if (!win || win.isDestroyed()) return;
  if (Array.isArray(event)) {
    for (const e of event) {
      win.webContents.send("claude:event", e);
    }
  } else {
    win.webContents.send("claude:event", event);
  }
}

// ── IPC Handlers ──

ipcMain.on("claude:send", (_event, message) => {
  if (currentProc) {
    currentProc.kill();
    currentProc = null;
  }

  const args = ["-p", "--output-format", "stream-json", "--verbose"];
  if (sessionId) {
    args.push("--resume", sessionId);
  }
  args.push(message);

  const proc = spawn("claude", args, {
    shell: true,
    cwd: projectDir || undefined,
    env: { ...process.env },
  });

  currentProc = proc;

  parseNDJSON(proc.stdout, (evt) => {
    const mapped = mapEvent(evt);
    if (mapped) sendToRenderer(mapped);
  });

  // Capture stderr for debugging
  let stderrBuf = "";
  proc.stderr.on("data", (chunk) => {
    stderrBuf += chunk.toString();
  });

  proc.on("close", (code) => {
    if (currentProc === proc) currentProc = null;
    if (code !== 0 && stderrBuf) {
      sendToRenderer({
        type: "done",
        result: stderrBuf.trim(),
        isError: true,
        cost: null,
      });
    }
  });

  proc.on("error", (err) => {
    if (currentProc === proc) currentProc = null;
    sendToRenderer({
      type: "done",
      result: `Failed to start Claude: ${err.message}`,
      isError: true,
      cost: null,
    });
  });
});

ipcMain.on("claude:interrupt", () => {
  if (currentProc) {
    currentProc.kill();
    currentProc = null;
  }
});

ipcMain.on("claude:setProjectDir", (_event, path) => {
  projectDir = path;
});

ipcMain.handle("dialog:selectDirectory", async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ["openDirectory"],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    projectDir = result.filePaths[0];
    return result.filePaths[0];
  }
  return null;
});

// ── App lifecycle ──

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (currentProc) currentProc.kill();
  app.quit();
});
