import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const HOME = process.env.USERPROFILE || process.env.HOME;
const BLOCKY_DIR = join(HOME, ".blocky");
const SETTINGS_PATH = join(HOME, ".claude", "settings.json");
const BACKUP_PATH = SETTINGS_PATH + ".blocky-backup";
const MARKER = "BLOCKY_HOOK_v1";

// Deploy bridge script to ~/.blocky/hook-bridge.js so it's always reachable
const BRIDGE_PATH = join(BLOCKY_DIR, "hook-bridge.js").replace(/\\/g, "/");

const BRIDGE_SOURCE = `#!/usr/bin/env node
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

const HOOK_EVENTS = ["UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop"];

function readSettings() {
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeSettings(settings) {
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

function removeBlockyHooks(settings) {
  if (!settings.hooks) return settings;

  for (const event of HOOK_EVENTS) {
    const matchers = settings.hooks[event];
    if (!Array.isArray(matchers)) continue;

    for (const matcherGroup of matchers) {
      if (!Array.isArray(matcherGroup.hooks)) continue;
      matcherGroup.hooks = matcherGroup.hooks.filter(
        (h) => !h.command || !h.command.includes(MARKER),
      );
    }

    // Remove matcher groups that became empty
    settings.hooks[event] = matchers.filter(
      (mg) => mg.hooks && mg.hooks.length > 0,
    );

    if (settings.hooks[event].length === 0) {
      delete settings.hooks[event];
    }
  }

  return settings;
}

export function inject() {
  // Deploy bridge script
  if (!existsSync(BLOCKY_DIR)) {
    mkdirSync(BLOCKY_DIR, { recursive: true });
  }
  writeFileSync(BRIDGE_PATH.replace(/\//g, "\\"), BRIDGE_SOURCE);

  const settings = readSettings();

  // Backup original (only first time)
  if (!existsSync(BACKUP_PATH)) {
    writeFileSync(BACKUP_PATH, JSON.stringify(settings, null, 2));
  }

  // Always clean stale hooks first
  removeBlockyHooks(settings);

  if (!settings.hooks) settings.hooks = {};

  const blockyHook = {
    type: "command",
    command: `node "${BRIDGE_PATH}" # ${MARKER}`,
  };

  for (const event of HOOK_EVENTS) {
    if (!settings.hooks[event]) settings.hooks[event] = [];

    // Find existing catch-all matcher
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

  writeSettings(settings);
  console.log("[hook-injector] Blocky hooks injected");
}

export function remove() {
  const settings = readSettings();
  removeBlockyHooks(settings);
  writeSettings(settings);
  console.log("[hook-injector] Blocky hooks removed");
}
