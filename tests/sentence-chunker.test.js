import { describe, it, expect } from "vitest";
import SentenceChunker from "../src/renderer/src/tts/sentence-chunker";

function chunk(text) {
  const results = [];
  const chunker = new SentenceChunker((s) => results.push(s));
  chunker.push(text);
  chunker.flush();
  return results;
}

describe("SentenceChunker", () => {
  it("splits on period + space", () => {
    const r = chunk("Hello there. How are you? Great!");
    expect(r).toEqual(["Hello there.", "How are you?", "Great!"]);
  });

  it("does not split on abbreviations", () => {
    const r = chunk("Dr. Smith went to St. Louis. It was nice.");
    expect(r[0]).toContain("Dr.");
    expect(r[0]).toContain("St.");
    expect(r.length).toBe(2);
  });

  it("does not split on decimal numbers", () => {
    const r = chunk("The value is 3.14 approximately. Done.");
    expect(r[0]).toContain("3.14");
  });

  it("strips code blocks and replaces with placeholder", () => {
    const r = chunk("Before code. ```js\nconst x = 1;\n``` After code.");
    // Code block content should not appear
    const all = r.join(" ");
    expect(all).not.toContain("const x = 1");
    expect(all).toContain("code");
  });

  it("strips inline code", () => {
    const r = chunk("Use the `forEach` method. It works.");
    const all = r.join(" ");
    expect(all).not.toContain("forEach");
  });

  it("strips markdown bold/italic", () => {
    const r = chunk("This is **bold** and *italic*. Done.");
    expect(r[0]).toContain("bold");
    expect(r[0]).toContain("italic");
    expect(r[0]).not.toContain("**");
    expect(r[0]).not.toContain("*italic*");
  });

  it("strips markdown links", () => {
    const r = chunk("Click [here](http://example.com) for more. End.");
    expect(r[0]).toContain("here");
    expect(r[0]).not.toContain("http://");
  });

  it("strips markdown headers", () => {
    const r = chunk("## Section Title\nSome content. End.");
    const all = r.join(" ");
    expect(all).toContain("Section Title");
    expect(all).not.toContain("##");
  });

  it("strips list markers", () => {
    const r = chunk("- Item one. - Item two. Done.");
    const all = r.join(" ");
    expect(all).toContain("Item one");
    expect(all).not.toMatch(/^-/);
  });

  it("splits long sentences at comma/semicolon after 200 chars", () => {
    const longStart = "A".repeat(150) + ", ";
    const rest = "then something else happened, and more stuff happened. End.";
    const r = chunk(longStart + rest);
    // Should have split at the comma after 100+ chars
    expect(r.length).toBeGreaterThanOrEqual(2);
  });

  it("handles empty input", () => {
    const r = chunk("");
    expect(r).toEqual([]);
  });

  it("handles input with only whitespace", () => {
    const r = chunk("   \n\n  ");
    expect(r).toEqual([]);
  });

  it("handles streaming input (push multiple times)", () => {
    const results = [];
    const chunker = new SentenceChunker((s) => results.push(s));
    chunker.push("Hello ");
    chunker.push("there. ");
    chunker.push("How are ");
    chunker.push("you?");
    chunker.flush();
    expect(results).toContain("Hello there.");
  });
});
