import { describe, it, expect } from "vitest";
import {
  DEFAULT_PARAMS,
  parseCommand,
} from "../src/renderer/src/blocky/command-parser";

describe("parseCommand", () => {
  // ── Color commands ──

  it("sets skin color when color name is mentioned", () => {
    const { c } = parseCommand("make it red");
    expect(c.skinColor).toBe("#ff4444");
    expect(c.eyeColor).toBe("#ff4444");
    expect(c.mouthColor).toBe("#ff4444");
  });

  it("sets only eye color when specified", () => {
    const { c } = parseCommand("blue eyes");
    expect(c.eyeColor).toBe("#5588ff");
    expect(c.skinColor).toBeUndefined();
  });

  it("sets only mouth color when specified", () => {
    const { c } = parseCommand("green mouth");
    expect(c.mouthColor).toBe("#00ff88");
    expect(c.skinColor).toBeUndefined();
  });

  // ── Eye styles ──

  it("sets heart eyes", () => {
    const { c } = parseCommand("heart eyes");
    expect(c.eyeStyle).toBe("heart");
  });

  it("sets star eyes", () => {
    const { c } = parseCommand("star eyes");
    expect(c.eyeStyle).toBe("star");
  });

  it("sets wink", () => {
    const { c } = parseCommand("wink at me");
    expect(c.eyeStyle).toBe("wink");
  });

  // ── Mouth styles ──

  it("sets smile mouth", () => {
    const { c } = parseCommand("give me a smile");
    expect(c.mouthStyle).toBe("smile");
  });

  it("sets frown mouth", () => {
    const { c } = parseCommand("frown");
    expect(c.mouthStyle).toBe("frown");
  });

  it("sets blep/tongue mouth", () => {
    const { c } = parseCommand("stick out your tongue");
    expect(c.mouthStyle).toBe("blep");
  });

  // ── Accessories ──

  it("sets hat accessory", () => {
    const { c } = parseCommand("put on a hat");
    expect(c.accessory).toBe("hat");
  });

  it("sets crown accessory", () => {
    const { c } = parseCommand("give me a crown");
    expect(c.accessory).toBe("crown");
  });

  it("removes accessory", () => {
    const { c } = parseCommand("no hat");
    expect(c.accessory).toBe("none");
  });

  // ── Animations ──

  it("sets dance animation", () => {
    const { c } = parseCommand("dance");
    expect(c.animation).toBe("dance");
  });

  it("sets bounce animation", () => {
    const { c } = parseCommand("bounce around");
    expect(c.animation).toBe("bounce");
  });

  it("stops animation", () => {
    const { c } = parseCommand("stop");
    expect(c.animation).toBe("none");
  });

  it("increases speed", () => {
    const { c } = parseCommand("faster");
    expect(c.animSpeed).toBeGreaterThan(1);
  });

  it("decreases speed", () => {
    const { c } = parseCommand("slower");
    expect(c.animSpeed).toBe(0.4);
  });

  // ── Mood presets ──

  it("activates angry mode", () => {
    const { c, actions } = parseCommand("angry");
    expect(c.eyeStyle).toBe("squint");
    expect(c.mouthStyle).toBe("teeth");
    expect(c.skinColor).toBe("#ff4444");
    expect(c.animation).toBe("vibrate");
    expect(actions).toEqual([]);
  });

  it("activates party mode", () => {
    const { c, actions } = parseCommand("party mode");
    expect(c.eyeStyle).toBe("star");
    expect(c.mouthStyle).toBe("grin");
    expect(c.accessory).toBe("crown");
    expect(c.animation).toBe("dance");
    expect(actions).toEqual([]);
  });

  it("activates hacker mode", () => {
    const { c, actions } = parseCommand("hacker");
    expect(c.eyeStyle).toBe("cool");
    expect(c.mouthStyle).toBe("smirk");
    expect(actions).toEqual([]);
  });

  it("activates robot mode", () => {
    const { c, actions } = parseCommand("robot mode");
    expect(c.accessory).toBe("antenna");
    expect(c.eyeStyle).toBe("wide");
    expect(actions).toEqual([]);
  });

  it("resets to defaults", () => {
    const { c, actions } = parseCommand("reset");
    expect(c).toEqual(DEFAULT_PARAMS);
    expect(actions).toEqual([]);
  });

  // ── Mute/unmute actions ──

  it("returns mute action", () => {
    const { actions } = parseCommand("mute");
    expect(actions).toContain("mute");
  });

  it("returns mute action for 'shut up'", () => {
    const { actions } = parseCommand("shut up");
    expect(actions).toContain("mute");
  });

  it("returns unmute action", () => {
    const { actions } = parseCommand("unmute");
    expect(actions).toContain("unmute");
  });

  // ── Rename ──

  it("renames blocky", () => {
    const { c } = parseCommand("call yourself buddy");
    expect(c.name).toBe("BUDDY");
  });

  it("truncates name to 14 chars", () => {
    const { c } = parseCommand("rename superlongnamethatshouldbetruncated");
    expect(c.name.length).toBeLessThanOrEqual(14);
  });

  // ── No-op for unrecognized input ──

  it("returns empty changes for unrecognized input", () => {
    const { c, actions } = parseCommand("how's the weather today");
    expect(Object.keys(c).length).toBe(0);
    expect(actions.length).toBe(0);
  });

  // ── Case insensitivity ──

  it("handles uppercase input", () => {
    const { c } = parseCommand("DANCE");
    expect(c.animation).toBe("dance");
  });

  it("handles mixed case", () => {
    const { c } = parseCommand("Party Mode");
    expect(c.eyeStyle).toBe("star");
  });
});
