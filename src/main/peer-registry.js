import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  renameSync,
  existsSync,
} from "fs";
import { join } from "path";

const PEER_DIR = join(
  process.env.USERPROFILE || process.env.HOME,
  ".blocky",
  "peers",
);
const POLL_INTERVAL = 2500;
const HEARTBEAT_INTERVAL = 4000;
const STALE_THRESHOLD = 10000;
const DEBOUNCE_MS = 500;

let ownPid = process.pid;
let ownFile = join(PEER_DIR, `${ownPid}.json`);
let ownState = {};
let pollTimer = null;
let heartbeatTimer = null;
let debounceTimer = null;
let lastPeersJson = "";
let win = null;

function ensureDir() {
  mkdirSync(PEER_DIR, { recursive: true });
}

function atomicWrite(path, data) {
  const tmp = path + ".tmp";
  try {
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, path);
  } catch {
    // If rename fails, try direct write as fallback
    try {
      writeFileSync(path, JSON.stringify(data));
    } catch {}
  }
}

function writePeerFile() {
  ownState.timestamp = Date.now();
  ownState.pid = ownPid;
  atomicWrite(ownFile, ownState);
}

function readPeers() {
  const peers = [];
  try {
    const files = readdirSync(PEER_DIR);
    const now = Date.now();
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const filePath = join(PEER_DIR, f);
      try {
        const raw = readFileSync(filePath, "utf8");
        const data = JSON.parse(raw);
        // Skip own process
        if (data.pid === ownPid) continue;
        // Clean stale files
        if (now - data.timestamp > STALE_THRESHOLD) {
          try {
            unlinkSync(filePath);
          } catch {}
          continue;
        }
        peers.push(data);
      } catch {
        // File mid-write or corrupt, skip
      }
    }
  } catch {
    // Dir doesn't exist yet
  }
  return peers;
}

function poll() {
  const peers = readPeers();
  const json = JSON.stringify(peers);
  if (json !== lastPeersJson) {
    lastPeersJson = json;
    if (win && !win.isDestroyed()) {
      win.webContents.send("peers:update", peers);
    }
  }
}

function heartbeat() {
  writePeerFile();
}

export function register(mainWindow, initialState) {
  win = mainWindow;
  ensureDir();
  ownState = { ...initialState, pid: ownPid, timestamp: Date.now() };
  writePeerFile();
  pollTimer = setInterval(poll, POLL_INTERVAL);
  heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL);
}

export function updateState(partial) {
  Object.assign(ownState, partial);
  // Debounced write
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    writePeerFile();
  }, DEBOUNCE_MS);
}

export function unregister() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  try {
    unlinkSync(ownFile);
  } catch {}
}

export function getPeers() {
  return readPeers();
}
