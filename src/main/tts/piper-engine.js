import { spawn } from "child_process";
import { getPiperPaths, checkReady } from "./piper-downloader";

let piperProc = null;

export async function synthesize(text) {
  if (!checkReady().ready) {
    throw new Error("Piper not downloaded yet");
  }

  const { PIPER_EXE, MODEL_FILE } = getPiperPaths();

  return new Promise((resolve, reject) => {
    const chunks = [];

    const proc = spawn(PIPER_EXE, ["--model", MODEL_FILE, "--output_raw"], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    piperProc = proc;

    proc.stdout.on("data", (chunk) => {
      chunks.push(chunk);
    });

    proc.on("error", (err) => {
      piperProc = null;
      reject(err);
    });

    proc.on("close", (code) => {
      piperProc = null;
      if (code !== 0 && chunks.length === 0) {
        reject(new Error(`Piper exited with code ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });

    // Write text to stdin then close it
    proc.stdin.write(text);
    proc.stdin.end();
  });
}

export function killPiper() {
  if (piperProc) {
    try {
      piperProc.kill();
    } catch {
      /* ignore */
    }
    piperProc = null;
  }
}
