import { existsSync, mkdirSync, createWriteStream, unlinkSync } from "fs";
import { join } from "path";
import { get } from "https";
import { exec } from "child_process";

const WHISPER_DIR = join(
  process.env.USERPROFILE || process.env.HOME,
  ".blocky",
  "whisper",
);
const WHISPER_EXE = join(WHISPER_DIR, "main.exe");
const MODEL_FILE = join(WHISPER_DIR, "ggml-base.en.bin");

// whisper.cpp Windows release
const WHISPER_ZIP_URL =
  "https://github.com/ggerganov/whisper.cpp/releases/download/v1.7.3/whisper-bin-x64.zip";
// base.en model from HuggingFace (ggerganov's mirror)
const MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin";

function ensureDir() {
  if (!existsSync(WHISPER_DIR)) {
    mkdirSync(WHISPER_DIR, { recursive: true });
  }
}

function isReady() {
  return existsSync(WHISPER_EXE) && existsSync(MODEL_FILE);
}

function downloadFile(url, dest, onProgress, label) {
  return new Promise((resolve, reject) => {
    const follow = (url) => {
      get(url, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} downloading ${label}`));
          return;
        }

        const total = parseInt(res.headers["content-length"] || "0", 10);
        let downloaded = 0;
        const file = createWriteStream(dest);

        res.on("data", (chunk) => {
          downloaded += chunk.length;
          file.write(chunk);
          if (total > 0) {
            onProgress(label, downloaded / total);
          }
        });

        res.on("end", () => {
          file.end(() => resolve());
        });

        res.on("error", (err) => {
          file.close();
          reject(err);
        });
      }).on("error", reject);
    };
    follow(url);
  });
}

function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    const cmd = `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force"`;
    exec(cmd, { timeout: 60000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function getWhisperPaths() {
  return { WHISPER_EXE, MODEL_FILE, WHISPER_DIR };
}

export function checkReady() {
  return { ready: isReady() };
}

let downloading = false;

export async function download(win) {
  if (downloading) return;
  if (isReady()) return;

  downloading = true;
  ensureDir();

  const sendProgress = (label, pct) => {
    win?.webContents?.send("stt:download-progress", { label, pct });
  };

  try {
    // Step 1: Download whisper.cpp binary
    if (!existsSync(WHISPER_EXE)) {
      const zipPath = join(WHISPER_DIR, "whisper.zip");
      sendProgress("Downloading Whisper engine...", 0);
      await downloadFile(
        WHISPER_ZIP_URL,
        zipPath,
        (l, p) => {
          sendProgress("Downloading Whisper engine...", p * 0.15);
        },
        "whisper",
      );

      sendProgress("Extracting Whisper...", 0.15);
      await extractZip(zipPath, WHISPER_DIR);

      // whisper.cpp extracts to a subfolder — move main.exe up if needed
      const { readdirSync, renameSync, statSync } = await import("fs");
      const entries = readdirSync(WHISPER_DIR);
      for (const entry of entries) {
        const entryPath = join(WHISPER_DIR, entry);
        if (
          statSync(entryPath).isDirectory() &&
          entry !== "." &&
          entry !== ".."
        ) {
          // Check if main.exe is inside a subfolder
          const nestedExe = join(entryPath, "main.exe");
          if (existsSync(nestedExe) && !existsSync(WHISPER_EXE)) {
            for (const f of readdirSync(entryPath)) {
              const src = join(entryPath, f);
              const dst = join(WHISPER_DIR, f);
              if (!existsSync(dst)) {
                renameSync(src, dst);
              }
            }
          }
        }
      }

      try {
        unlinkSync(zipPath);
      } catch {
        /* ignore */
      }
    }

    // Step 2: Download base.en model (~150MB)
    if (!existsSync(MODEL_FILE)) {
      sendProgress("Downloading speech model (~150MB)...", 0.2);
      await downloadFile(
        MODEL_URL,
        MODEL_FILE,
        (l, p) => {
          sendProgress("Downloading speech model (~150MB)...", 0.2 + p * 0.8);
        },
        "model",
      );
    }

    sendProgress("Ready!", 1);
  } catch (err) {
    sendProgress(`Error: ${err.message}`, -1);
    throw err;
  } finally {
    downloading = false;
  }
}
