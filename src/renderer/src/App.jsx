import { useState, useEffect, useRef, useCallback } from "react";
import BlockyFace from "./components/BlockyFace";
import Waveform from "./components/Waveform";
import { DEFAULT_PARAMS, parseCommand } from "./blocky/command-parser";
import { mapToolToActivity, getActivityDetail } from "./blocky/activity-mapper";

export default function App() {
  const [p, setP] = useState({ ...DEFAULT_PARAMS });
  const [activity, setActivity] = useState("idle");
  const [detail, setDetail] = useState(null);
  const [log, setLog] = useState([
    {
      r: "sys",
      t: 'Talk to Blocky! Try "dance", "party mode", or ask Claude anything.',
    },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [projectDir, setProjectDir] = useState(null);
  const [sec, setSec] = useState(0);
  const logRef = useRef();
  const inRef = useRef();
  const streamTextRef = useRef("");

  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // Listen for Claude stream events
  useEffect(() => {
    if (!window.blockyAPI) return;
    const unsub = window.blockyAPI.onStreamEvent((evt) => {
      switch (evt.type) {
        case "init":
          setActivity("thinking");
          setDetail(null);
          break;

        case "text":
          setActivity("speaking");
          setDetail(null);
          streamTextRef.current += evt.content;
          setLog((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.r === "blocky" && last.streaming) {
              return [
                ...prev.slice(0, -1),
                { r: "blocky", t: streamTextRef.current, streaming: true },
              ];
            }
            return [
              ...prev,
              { r: "blocky", t: streamTextRef.current, streaming: true },
            ];
          });
          break;

        case "tool_start": {
          const act = mapToolToActivity(evt.tool);
          const det = getActivityDetail(evt.tool, evt.input);
          setActivity(act);
          setDetail(det);
          setLog((prev) => [
            ...prev,
            { r: "tool", t: `${evt.tool}${det ? ": " + det : ""}` },
          ]);
          break;
        }

        case "tool_end":
          if (evt.isError) {
            setActivity("error");
            setDetail("tool failed");
            setTimeout(() => setActivity("thinking"), 1200);
          } else {
            setActivity("thinking");
            setDetail(null);
          }
          break;

        case "done":
          // Finalize any streaming text
          if (streamTextRef.current) {
            const finalText = streamTextRef.current;
            setLog((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.r === "blocky" && last.streaming) {
                return [...prev.slice(0, -1), { r: "blocky", t: finalText }];
              }
              return prev;
            });
            streamTextRef.current = "";
          }

          if (evt.isError) {
            setActivity("error");
            setDetail(typeof evt.result === "string" ? evt.result : "error");
            setLog((prev) => [
              ...prev,
              {
                r: "sys",
                t: `Error: ${typeof evt.result === "string" ? evt.result : "Something went wrong"}`,
              },
            ]);
          } else {
            setActivity("success");
            setDetail(evt.cost ? `$${evt.cost.toFixed(4)}` : null);
          }
          setIsProcessing(false);
          setTimeout(() => {
            setActivity("idle");
            setDetail(null);
          }, 2000);
          break;
      }
    });
    return unsub;
  }, []);

  const exec = useCallback((text) => {
    const t = text.trim();
    if (!t) return;

    setLog((prev) => [...prev, { r: "you", t }]);

    // Try command parser first (instant, local)
    const { c, u } = parseCommand(t);
    if (Object.keys(c).length > 0) {
      setP((prev) => ({ ...prev, ...c }));
      setLog((prev) => [...prev, { r: "blocky", t: u.join(", ") }]);
      return;
    }

    // Otherwise send to Claude
    if (!window.blockyAPI) {
      setLog((prev) => [
        ...prev,
        {
          r: "sys",
          t: "Claude bridge not available (running outside Electron?)",
        },
      ]);
      return;
    }

    setIsProcessing(true);
    setActivity("thinking");
    setDetail(null);
    streamTextRef.current = "";
    window.blockyAPI.sendMessage(t);
  }, []);

  const submit = () => {
    if (isProcessing) return;
    exec(input);
    setInput("");
    setTimeout(() => inRef.current?.focus(), 30);
  };

  const handleSelectDir = async () => {
    if (!window.blockyAPI) return;
    const dir = await window.blockyAPI.selectDirectory();
    if (dir) {
      setProjectDir(dir);
      setLog((prev) => [...prev, { r: "sys", t: `Project: ${dir}` }]);
    }
  };

  const handleInterrupt = () => {
    if (!window.blockyAPI) return;
    window.blockyAPI.interrupt();
    setIsProcessing(false);
    setActivity("idle");
    setDetail(null);
    setLog((prev) => [...prev, { r: "sys", t: "Interrupted." }]);
  };

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const quickCmds = [
    "dance",
    "party mode",
    "angry",
    "love",
    "hacker",
    "robot mode",
    "crown",
    "heart eyes",
    "spin",
    "make me blue",
    "excited",
    "reset",
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "#080c0a",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'JetBrains Mono','Fira Code',monospace",
        color: "#c0c8c4",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div className="crt-scanlines" />
      <div className="vignette" />

      {/* ─── TOP BAR ─── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px",
          borderBottom: "1px solid #12251c",
          background: "#0a100e",
          zIndex: 10,
          WebkitAppRegion: "drag",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              color: p.skinColor,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: 3,
              transition: "color 0.3s",
            }}
          >
            BLOCKY
          </span>
          <span style={{ color: "#12251c" }}>│</span>
          <span style={{ color: "#2a4a3a", fontSize: 9, letterSpacing: 2 }}>
            OPEN SOURCE
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            WebkitAppRegion: "no-drag",
          }}
        >
          <button
            onClick={handleSelectDir}
            title="Select project directory"
            style={{
              padding: "2px 8px",
              borderRadius: 3,
              border: "1px solid #12251c",
              background: "none",
              color: "#2a4a3a",
              cursor: "pointer",
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 10,
              letterSpacing: 1,
            }}
          >
            {projectDir ? "📁 " + projectDir.split(/[\\/]/).pop() : "📁 Open"}
          </button>
          <span
            style={{
              color: "#2a4a3a",
              fontSize: 10,
              letterSpacing: 2,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmt(sec)}
          </span>
        </div>
      </div>

      {/* ─── MAIN ─── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* BLOCKY AREA */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 16px 10px",
            borderBottom: "1px solid #12251c",
            background: `radial-gradient(ellipse at 50% 40%, ${p.skinColor}08 0%, transparent 60%), radial-gradient(ellipse at center, #0c1612 0%, #080c0a 70%)`,
            transition: "background 0.5s",
          }}
        >
          <BlockyFace params={p} activity={activity} detail={detail} />
          <div style={{ marginTop: 10 }}>
            <Waveform active={activity === "speaking"} color={p.skinColor} />
          </div>
        </div>

        {/* TRANSCRIPT */}
        <div
          ref={logRef}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 7,
          }}
        >
          {log.map((m, i) =>
            m.r === "tool" ? (
              <div key={i} className="tool-line">
                ▸ {m.t}
              </div>
            ) : (
              <div
                key={i}
                className="transcript-msg"
                style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
              >
                <div
                  style={{
                    fontSize: 9,
                    minWidth: 44,
                    textAlign: "right",
                    paddingTop: 2,
                    letterSpacing: 1,
                    fontWeight: 600,
                    color:
                      m.r === "you"
                        ? "#5588ff"
                        : m.r === "blocky"
                          ? p.skinColor
                          : "#2a4a3a",
                  }}
                >
                  {m.r === "you" ? "YOU" : m.r === "blocky" ? p.name : "SYS"}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    color:
                      m.r === "you"
                        ? "#7799bb"
                        : m.r === "blocky"
                          ? "#90b8a4"
                          : "#2a4a3a",
                    borderLeft: `2px solid ${m.r === "you" ? "#15203a" : m.r === "blocky" ? "#15302a" : "#101a14"}`,
                    paddingLeft: 9,
                  }}
                >
                  {m.t}
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* ─── BOTTOM ─── */}
      <div
        style={{
          borderTop: "1px solid #12251c",
          background: "#0a100e",
          padding: "10px 14px 6px",
        }}
      >
        {/* Input */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              border: `1px solid ${p.skinColor}22`,
              borderRadius: 6,
              background: "#080c0a",
              padding: "0 10px",
              transition: "border-color 0.3s",
            }}
          >
            <span style={{ color: "#1e3a2a", fontSize: 12, marginRight: 6 }}>
              ›
            </span>
            <input
              ref={inRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={
                isProcessing
                  ? "thinking..."
                  : `talk to ${p.name.toLowerCase()}...`
              }
              disabled={isProcessing}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                color: "#c0c8c4",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 11.5,
                padding: "9px 0",
                opacity: isProcessing ? 0.4 : 1,
              }}
            />
          </div>
          {isProcessing ? (
            <button
              onClick={handleInterrupt}
              style={{
                padding: "9px 14px",
                borderRadius: 6,
                border: "1px solid #ff444433",
                background: "#ff44440d",
                color: "#ff4444",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 2,
                transition: "all 0.2s",
              }}
            >
              STOP
            </button>
          ) : (
            <button
              onClick={submit}
              style={{
                padding: "9px 14px",
                borderRadius: 6,
                border: `1px solid ${p.skinColor}33`,
                background: `${p.skinColor}0d`,
                color: p.skinColor,
                cursor: "pointer",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 2,
                transition: "all 0.2s",
              }}
            >
              SEND
            </button>
          )}
        </div>

        {/* Quick buttons */}
        <div
          style={{
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
            justifyContent: "center",
            paddingBottom: 6,
          }}
        >
          {quickCmds.map((cmd) => (
            <button
              key={cmd}
              onClick={() => !isProcessing && exec(cmd)}
              style={{
                padding: "3px 8px",
                borderRadius: 3,
                border: "1px solid #12251c",
                background: "#0a100e",
                color: "#2a5a3a",
                cursor: isProcessing ? "default" : "pointer",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 8.5,
                letterSpacing: 0.5,
                transition: "all 0.15s",
                opacity: isProcessing ? 0.4 : 1,
              }}
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
