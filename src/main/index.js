import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { join } from "path";
import { readFileSync, existsSync } from "fs";
import {
  spawnClaude,
  write as ptyWrite,
  resize as ptyResize,
  kill as ptyKill,
} from "./pty-manager";
import { start as hookStart, stop as hookStop } from "./hook-server";
import { inject as hookInject, remove as hookRemove } from "./hook-injector";

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
  spawnClaude(projectDir, win);
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

ipcMain.handle("dialog:selectDirectory", async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ["openDirectory"],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
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

// ── App lifecycle ──

app.whenReady().then(() => {
  createWindow();
  hookStart(win);
  hookInject();
});

app.on("before-quit", () => {
  ptyKill();
  hookRemove();
  hookStop();
});

app.on("window-all-closed", () => {
  app.quit();
});
