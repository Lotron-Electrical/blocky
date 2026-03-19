import { useEffect, useRef } from "react";

function renderContent(text) {
  // Split on code blocks, render them in <pre> blocks
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const code = part.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
      return (
        <pre
          key={i}
          style={{
            background: "#060a08",
            border: "1px solid #12251c",
            borderRadius: 4,
            padding: "6px 8px",
            margin: "4px 0",
            fontSize: 9,
            lineHeight: 1.4,
            overflowX: "auto",
            color: "#8aaa9a",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {code}
        </pre>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const TOOL_LABELS = {
  reading_file: "READING FILE",
  searching: "SEARCHING",
  writing_code: "WRITING CODE",
  running_bash: "RUNNING COMMAND",
  thinking: "THINKING",
};

export default function Transcript({ entries }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#1e3a2a",
          fontSize: 10,
          letterSpacing: 2,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        WAITING FOR INPUT...
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {entries.map((entry, i) => {
        if (entry.type === "tool") {
          const label = TOOL_LABELS[entry.activity] || "WORKING";
          return (
            <div key={i} className="tool-line">
              {label}
              {entry.detail ? ` · ${entry.detail}` : ""}
            </div>
          );
        }

        const isUser = entry.type === "user";
        return (
          <div
            key={i}
            className="transcript-msg"
            style={{
              padding: "6px 0",
              borderBottom: "1px solid #0c1612",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 3,
              }}
            >
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: isUser ? "#5588ff" : "#00ff88",
                  minWidth: 45,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {isUser ? "YOU" : "BLOCKY"}
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                lineHeight: 1.5,
                color: isUser ? "#8899bb" : "#b0c8b4",
                paddingLeft: 53,
                fontFamily: "'JetBrains Mono', monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {isUser ? entry.text : renderContent(entry.text)}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
