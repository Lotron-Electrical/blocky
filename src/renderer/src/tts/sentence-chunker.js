// Buffers streaming text and emits complete sentences.
// Handles abbreviations, decimals, code blocks, and markdown.

const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "ave",
  "blvd",
  "vs",
  "etc",
  "approx",
  "dept",
  "est",
  "vol",
  "e.g",
  "i.e",
  "fig",
  "no",
  "inc",
  "ltd",
  "corp",
]);

export default class SentenceChunker {
  constructor(onSentence) {
    this.onSentence = onSentence;
    this.buffer = "";
    this.inCodeBlock = false;
    this.codeBlockEmitted = false;
  }

  push(text) {
    for (const ch of text) {
      // Track code blocks (```)
      if (this._handleCodeFence(ch)) continue;

      if (this.inCodeBlock) continue; // skip code block content

      this.buffer += ch;
      this._tryEmit();
    }
  }

  flush() {
    // Emit whatever is left
    const cleaned = this._clean(this.buffer);
    if (cleaned) {
      this.onSentence(cleaned);
    }
    this.buffer = "";
    this.inCodeBlock = false;
    this.codeBlockEmitted = false;
  }

  _handleCodeFence(ch) {
    // Simple triple-backtick detector
    if (ch === "`") {
      this._tickCount = (this._tickCount || 0) + 1;
      if (this._tickCount === 3) {
        this._tickCount = 0;
        if (!this.inCodeBlock) {
          // Entering code block — flush buffer first
          const cleaned = this._clean(this.buffer);
          if (cleaned) this.onSentence(cleaned);
          this.buffer = "";
          this.inCodeBlock = true;
          this.codeBlockEmitted = false;
        } else {
          // Exiting code block
          this.inCodeBlock = false;
          if (!this.codeBlockEmitted) {
            this.onSentence("Here's some code.");
            this.codeBlockEmitted = true;
          }
        }
        return true;
      }
    } else {
      if (this._tickCount > 0) {
        // False alarm — backticks that weren't triple
        if (!this.inCodeBlock) {
          // Don't add inline code content
        }
        this._tickCount = 0;
      }
    }
    return false;
  }

  _tryEmit() {
    // Look for sentence boundaries: . ! ? followed by space or end
    const match = this.buffer.match(/([.!?])\s/);
    if (!match) {
      // Check for long sentences — split at comma/semicolon after 200 chars
      if (this.buffer.length > 200) {
        const splitMatch = this.buffer.match(/^(.{100,}?[,;])\s/);
        if (splitMatch) {
          const sentence = this._clean(splitMatch[1]);
          if (sentence) this.onSentence(sentence);
          this.buffer = this.buffer.slice(splitMatch[0].length);
        }
      }
      return;
    }

    const endPos = match.index + 1; // position after the punctuation
    const candidate = this.buffer.slice(0, endPos);

    // Check for abbreviation — word before the period
    if (match[1] === ".") {
      const wordBefore = candidate.match(/(\w+)\.$/);
      if (wordBefore && ABBREVIATIONS.has(wordBefore[1].toLowerCase())) {
        return; // don't split on abbreviation
      }
      // Check for decimal number (e.g. 3.14)
      if (
        /\d\.\d/.test(
          this.buffer.slice(Math.max(0, match.index - 1), match.index + 2),
        )
      ) {
        return;
      }
    }

    const sentence = this._clean(candidate);
    if (sentence) {
      this.onSentence(sentence);
    }
    this.buffer = this.buffer.slice(endPos + 1); // skip the trailing space too
  }

  _clean(text) {
    let s = text;
    // Strip inline code
    s = s.replace(/`[^`]+`/g, "");
    // Strip markdown bold/italic
    s = s.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
    // Strip markdown links
    s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    // Strip headers
    s = s.replace(/^#{1,6}\s+/gm, "");
    // Strip list markers
    s = s.replace(/^[\s]*[-*]\s+/gm, "");
    s = s.replace(/^[\s]*\d+\.\s+/gm, "");
    // Collapse whitespace
    s = s.replace(/\s+/g, " ").trim();
    return s;
  }
}
