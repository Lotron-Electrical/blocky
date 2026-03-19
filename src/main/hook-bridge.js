#!/usr/bin/env node
// Standalone script called by Claude Code hooks.
// Reads JSON from stdin, POSTs it to Blocky's hook server.

const fs = require("fs");
const path = require("path");
const http = require("http");

const portFile = path.join(
  process.env.USERPROFILE || process.env.HOME,
  ".blocky",
  "hook-port",
);

let port;
try {
  port = parseInt(fs.readFileSync(portFile, "utf8").trim(), 10);
} catch {
  process.exit(0); // Blocky not running, silently exit
}

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const req = http.request(
    {
      hostname: "127.0.0.1",
      port,
      path: "/hook",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    () => {},
  );
  req.on("error", () => {}); // silently fail
  req.write(input);
  req.end();
});
