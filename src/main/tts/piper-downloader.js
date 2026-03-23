import { existsSync, mkdirSync, unlinkSync, readdirSync, renameSync } from "fs";
import { join } from "path";
import { downloadFile, extractZip } from "../download-utils";

const PIPER_DIR = join(
  process.env.USERPROFILE || process.env.HOME,
  ".blocky",
  "piper",
);
const PIPER_EXE = join(PIPER_DIR, "piper.exe");
const MODEL_FILE = join(PIPER_DIR, "en_US-lessac-medium.onnx");
const MODEL_JSON = join(PIPER_DIR, "en_US-lessac-medium.onnx.json");

const PIPER_ZIP_URL =
  "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip";
const MODEL_URL =
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx";
const MODEL_JSON_URL =
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json";

function ensureDir() {
  if (!existsSync(PIPER_DIR)) {
    mkdirSync(PIPER_DIR, { recursive: true });
  }
}

function isReady() {
  return (
    existsSync(PIPER_EXE) && existsSync(MODEL_FILE) && existsSync(MODEL_JSON)
  );
}

export function getPiperPaths() {
  return { PIPER_EXE, MODEL_FILE, PIPER_DIR };
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
    win?.webContents?.send("tts:download-progress", { label, pct });
  };

  try {
    // Step 1: Download Piper binary zip
    if (!existsSync(PIPER_EXE)) {
      const zipPath = join(PIPER_DIR, "piper.zip");
      sendProgress("Downloading Piper engine...", 0);
      await downloadFile(
        PIPER_ZIP_URL,
        zipPath,
        (l, p) => {
          sendProgress("Downloading Piper engine...", p * 0.4);
        },
        "piper",
      );

      // Extract
      sendProgress("Extracting Piper...", 0.4);
      await extractZip(zipPath, PIPER_DIR);

      // Piper extracts into a piper/ subfolder — move exe up if needed
      const nestedExe = join(PIPER_DIR, "piper", "piper.exe");
      if (existsSync(nestedExe) && !existsSync(PIPER_EXE)) {
        const nestedDir = join(PIPER_DIR, "piper");
        for (const f of readdirSync(nestedDir)) {
          const src = join(nestedDir, f);
          const dst = join(PIPER_DIR, f);
          if (!existsSync(dst)) {
            renameSync(src, dst);
          }
        }
      }

      // Clean up zip
      try {
        unlinkSync(zipPath);
      } catch {
        /* ignore */
      }
    }

    // Step 2: Download voice model (.onnx)
    if (!existsSync(MODEL_FILE)) {
      sendProgress("Downloading voice model...", 0.45);
      await downloadFile(
        MODEL_URL,
        MODEL_FILE,
        (l, p) => {
          sendProgress("Downloading voice model...", 0.45 + p * 0.5);
        },
        "model",
      );
    }

    // Step 3: Download model config (.json)
    if (!existsSync(MODEL_JSON)) {
      sendProgress("Downloading model config...", 0.95);
      await downloadFile(MODEL_JSON_URL, MODEL_JSON, () => {}, "config");
    }

    sendProgress("Ready!", 1);
  } catch (err) {
    sendProgress(`Error: ${err.message}`, -1);
    throw err;
  } finally {
    downloading = false;
  }
}
