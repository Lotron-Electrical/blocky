import { spawn } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { getWhisperPaths, checkReady } from "./whisper-downloader";

let whisperProc = null;

export async function transcribe(wavBuffer) {
  if (!checkReady().ready) {
    throw new Error("Whisper not downloaded yet");
  }

  const { WHISPER_EXE, MODEL_FILE, WHISPER_DIR } = getWhisperPaths();

  // Write WAV buffer to a temp file (whisper.cpp needs a file path)
  const tempWav = join(WHISPER_DIR, `temp_${Date.now()}.wav`);

  try {
    writeFileSync(tempWav, Buffer.from(wavBuffer));

    return await new Promise((resolve, reject) => {
      const chunks = [];

      const proc = spawn(
        WHISPER_EXE,
        [
          "--model",
          MODEL_FILE,
          "--file",
          tempWav,
          "--no-timestamps",
          "--language",
          "en",
          "--threads",
          "4",
          "--output-txt",
        ],
        {
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        },
      );

      whisperProc = proc;

      proc.stdout.on("data", (chunk) => {
        chunks.push(chunk.toString());
      });

      let stderr = "";
      proc.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      proc.on("error", (err) => {
        whisperProc = null;
        reject(err);
      });

      proc.on("close", (code) => {
        whisperProc = null;
        if (code !== 0 && chunks.length === 0) {
          reject(new Error(`Whisper exited with code ${code}: ${stderr}`));
          return;
        }
        // Parse output — whisper outputs text with possible [BLANK_AUDIO] markers
        const text = chunks
          .join("")
          .replace(/\[BLANK_AUDIO\]/g, "")
          .replace(/^\s+|\s+$/g, "")
          .replace(/\s+/g, " ")
          .trim();
        resolve(text);
      });
    });
  } finally {
    // Clean up temp file
    try {
      unlinkSync(tempWav);
    } catch {
      /* ignore */
    }
  }
}

export function killWhisper() {
  if (whisperProc) {
    try {
      whisperProc.kill();
    } catch {
      /* ignore */
    }
    whisperProc = null;
  }
}
