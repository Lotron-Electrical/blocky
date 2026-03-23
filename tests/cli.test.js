import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import path from "path";

const CLI = path.join(__dirname, "../bin/blocky.js");

function run(args = "") {
  return execSync(`node "${CLI}" ${args}`, {
    encoding: "utf8",
    timeout: 5000,
  }).trim();
}

function runWithError(args = "") {
  try {
    execSync(`node "${CLI}" ${args}`, {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { code: 0, stderr: "" };
  } catch (err) {
    return { code: err.status, stderr: err.stderr };
  }
}

describe("Blocky CLI", () => {
  it("shows version with --version", () => {
    const output = run("--version");
    expect(output).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("shows version with -v", () => {
    const output = run("-v");
    expect(output).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("shows help with --help", () => {
    const output = run("--help");
    expect(output).toContain("BLOCKY");
    expect(output).toContain("Usage:");
    expect(output).toContain("--mute");
    expect(output).toContain("--no-hooks");
    expect(output).toContain("--version");
    expect(output).toContain("Examples:");
  });

  it("shows help with -h", () => {
    const output = run("-h");
    expect(output).toContain("Usage:");
  });

  it("exits with error for nonexistent directory", () => {
    const { code, stderr } = runWithError("/definitely/not/a/real/path/xyz");
    expect(code).not.toBe(0);
    expect(stderr).toContain("not found");
  });

  it("exits with error when given a file instead of directory", () => {
    const { code, stderr } = runWithError(`"${CLI}"`);
    expect(code).not.toBe(0);
    expect(stderr).toContain("not a directory");
  });
});
