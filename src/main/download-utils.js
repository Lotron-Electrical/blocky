import { createWriteStream } from "fs";
import { get } from "https";
import { exec } from "child_process";

/**
 * Downloads a file from a URL with redirect following and progress reporting.
 * @param {string} url - The URL to download from
 * @param {string} dest - Local file path to save to
 * @param {function} onProgress - Callback (label, progressFraction)
 * @param {string} label - Human-readable label for progress reporting
 * @returns {Promise<void>}
 */
export function downloadFile(url, dest, onProgress, label) {
  return new Promise((resolve, reject) => {
    const follow = (currentUrl) => {
      get(currentUrl, (res) => {
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

/**
 * Extracts a zip file using PowerShell Expand-Archive.
 * @param {string} zipPath - Path to the zip file
 * @param {string} destDir - Destination directory
 * @returns {Promise<void>}
 */
export function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    const safePath = zipPath.replace(/'/g, "''");
    const safeDest = destDir.replace(/'/g, "''");
    const cmd = `powershell -NoProfile -Command "Expand-Archive -Path '${safePath}' -DestinationPath '${safeDest}' -Force"`;
    exec(cmd, { timeout: 60000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
