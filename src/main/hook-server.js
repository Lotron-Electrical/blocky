import http from "http";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";

const BLOCKY_DIR = join(process.env.USERPROFILE || process.env.HOME, ".blocky");
const PORT_FILE = join(BLOCKY_DIR, "hook-port");

function mapHookToActivity(body) {
  const event = body.hook_event_name || body.hookEventName;
  const tool = body.tool_name || body.toolName;
  const error = body.tool_error || body.is_error;

  switch (event) {
    case "UserPromptSubmit":
      return {
        activity: "thinking",
        detail: null,
        userPrompt: body.prompt || null,
      };

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
      const act = toolMap[tool] || "thinking";
      const input = body.tool_input || {};
      let detail = null;
      if (input.file_path) detail = input.file_path;
      else if (input.command)
        detail =
          input.command.length > 50
            ? input.command.slice(0, 47) + "..."
            : input.command;
      else if (input.pattern) detail = input.pattern;
      return { activity: act, detail, toolName: tool };
    }

    case "PostToolUse":
      if (error) return { activity: "error", detail: "tool failed" };
      return { activity: "thinking", detail: null };

    case "Stop":
      return {
        activity: "success",
        detail: null,
        lastMessage: body.last_assistant_message || null,
      };

    default:
      return null;
  }
}

let server = null;
let winRef = null;

export function start(browserWindow) {
  winRef = browserWindow;

  if (!existsSync(BLOCKY_DIR)) {
    mkdirSync(BLOCKY_DIR, { recursive: true });
  }

  const MAX_BODY = 1024 * 1024; // 1MB limit

  server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/hook") {
      let body = "";
      let truncated = false;
      req.on("data", (chunk) => {
        if (truncated) return;
        body += chunk;
        if (body.length > MAX_BODY) {
          truncated = true;
          res.writeHead(413);
          res.end("body too large");
          req.destroy();
        }
      });
      req.on("end", () => {
        if (truncated) return;
        res.writeHead(200);
        res.end("ok");
        try {
          const parsed = JSON.parse(body);
          const mapped = mapHookToActivity(parsed);
          if (mapped && winRef && !winRef.isDestroyed()) {
            winRef.webContents.send("hook:activity", mapped);

            if (mapped.activity === "error") {
              setTimeout(() => {
                if (winRef && !winRef.isDestroyed()) {
                  winRef.webContents.send("hook:activity", {
                    activity: "thinking",
                    detail: null,
                  });
                }
              }, 1200);
            }
            if (mapped.activity === "success") {
              setTimeout(() => {
                if (winRef && !winRef.isDestroyed()) {
                  winRef.webContents.send("hook:activity", {
                    activity: "idle",
                    detail: null,
                  });
                }
              }, 2000);
            }
          }
        } catch {
          // ignore parse errors
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    writeFileSync(PORT_FILE, String(port));
    console.log(`[hook-server] listening on port ${port}`);
  });
}

export function stop() {
  if (server) {
    server.close();
    server = null;
  }
  try {
    unlinkSync(PORT_FILE);
  } catch {
    // ignore
  }
}
