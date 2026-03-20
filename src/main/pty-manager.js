import pty from "@lydell/node-pty";
import { existsSync } from "fs";

let ptyProcess = null;
let win = null;

function getShell() {
  if (process.platform === "win32") {
    const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
    if (existsSync(gitBash)) return gitBash;
    return "cmd.exe";
  }
  return process.env.SHELL || "/bin/bash";
}

export function spawnShell(projectDir, browserWindow) {
  win = browserWindow;

  if (ptyProcess) {
    ptyProcess.kill();
    ptyProcess = null;
  }

  const shell = getShell();
  const isGitBash = shell.includes("bash");
  const shellArgs = isGitBash ? ["-l"] : [];

  ptyProcess = pty.spawn(shell, shellArgs, {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: projectDir || process.env.USERPROFILE || process.env.HOME,
    env: {
      ...process.env,
      TERM: "xterm-256color",
      BLOCKY_SESSION: "1",
    },
  });

  ptyProcess.onData((data) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("pty:data", data);
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("pty:exit", exitCode);
    }
    ptyProcess = null;
  });

  console.log(
    `[pty-manager] spawned shell in ${projectDir || "home"} (pid: ${ptyProcess.pid})`,
  );
}

export function write(data) {
  if (ptyProcess) ptyProcess.write(data);
}

export function resize(cols, rows) {
  if (ptyProcess) ptyProcess.resize(cols, rows);
}

export function kill() {
  if (ptyProcess) {
    ptyProcess.kill();
    ptyProcess = null;
  }
}
