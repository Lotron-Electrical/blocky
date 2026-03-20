import { useEffect, useRef, useState } from "react";
import IdleScene from "./IdleScene";

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

export default function Transcript({
  entries,
  activity,
  detail,
  skinColor,
  peers,
  claudeReady,
}) {
  const bottomRef = useRef(null);
  const [showIdle, setShowIdle] = useState(false);
  const idleTimerRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length, activity, detail]);

  // Debounced idle activation: 3s after going idle, instant deactivation
  useEffect(() => {
    if (activity === "idle" && peers && peers.length > 0) {
      idleTimerRef.current = setTimeout(() => setShowIdle(true), 3000);
    } else {
      setShowIdle(false);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    }
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [activity, peers]);

  const hasPeers = peers && peers.length > 0;

  if (entries.length === 0) {
    if (hasPeers && showIdle) {
      return (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <IdleScene peers={peers} compact={false} />
        </div>
      );
    }
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
        {claudeReady ? "WAITING FOR INPUT..." : "STARTING CLAUDE CODE..."}
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
        if (entry.type === "blocky_verbal") {
          return (
            <div
              key={i}
              style={{
                fontSize: 9,
                fontStyle: "italic",
                color: "#3a8a5a",
                paddingLeft: 53,
                padding: "2px 0 2px 53px",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {entry.text}
            </div>
          );
        }

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
                {isUser ? "YOU" : "CLAUDE"}
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
      {/* Live status indicator — updates in place as Claude works */}
      {activity &&
        activity !== "idle" &&
        activity !== "speaking" &&
        activity !== "success" && (
          <div
            style={{
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              color: "#2a5a3a",
              letterSpacing: 1.5,
              padding: "4px 0 2px 0",
              opacity: 0.8,
            }}
          >
            {"› "}
            {TOOL_LABELS[activity] || activity.toUpperCase()}
            {detail ? ` · ${detail}` : ""}
          </div>
        )}
      {hasPeers && showIdle && (
        <div style={{ borderTop: "1px solid #12251c", marginTop: 4 }}>
          <IdleScene peers={peers} compact={true} />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
