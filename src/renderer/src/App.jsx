import { useState, useEffect, useRef, useCallback } from "react";
import BlockyFace from "./components/BlockyFace";
import Waveform from "./components/Waveform";
import Terminal from "./components/Terminal";
import ProjectPicker from "./components/ProjectPicker";
import { DEFAULT_PARAMS, parseCommand } from "./blocky/command-parser";

export default function App() {
  const [p, setP] = useState({ ...DEFAULT_PARAMS });
  const [activity, setActivity] = useState("idle");
  const [detail, setDetail] = useState(null);
  const [phase, setPhase] = useState("picking"); // picking | running | exited
  const [input, setInput] = useState("");
  const [sec, setSec] = useState(0);
  const inRef = useRef();

  // Session timer
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Listen for hook activity events
  useEffect(() => {
    if (!window.blockyAPI) return;
    const unsub = window.blockyAPI.onHookActivity(
      ({ activity: act, detail: det }) => {
        setActivity(act);
        setDetail(det);
      },
    );
    return unsub;
  }, []);

  // Listen for PTY exit
  useEffect(() => {
    if (!window.blockyAPI) return;
    const unsub = window.blockyAPI.onPtyExit(() => {
      setPhase("exited");
      setActivity("idle");
      setDetail(null);
    });
    return unsub;
  }, []);

  const handleSelectProject = useCallback((dir) => {
    if (!window.blockyAPI) return;
    window.blockyAPI.startPty(dir);
    setPhase("running");
    setActivity("idle");
    setSec(0);
  }, []);

  const handleRestart = useCallback(() => {
    setPhase("picking");
    setActivity("idle");
    setDetail(null);
    setSec(0);
  }, []);

  // Blocky command bar — avatar commands only
  const exec = useCallback((text) => {
    const t = text.trim();
    if (!t) return;
    const { c, u } = parseCommand(t);
    if (Object.keys(c).length > 0) {
      setP((prev) => ({ ...prev, ...c }));
    }
  }, []);

  const submit = () => {
    exec(input);
    setInput("");
    setTimeout(() => inRef.current?.focus(), 30);
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
            CLAUDE CODE
          </span>
        </div>
        <span
          style={{
            color: "#2a4a3a",
            fontSize: 10,
            letterSpacing: 2,
            fontVariantNumeric: "tabular-nums",
            WebkitAppRegion: "no-drag",
          }}
        >
          {fmt(sec)}
        </span>
      </div>

      {/* ─── MAIN CONTENT ─── */}
      {phase === "picking" && (
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "20px 16px 10px",
              borderBottom: "1px solid #12251c",
              background: `radial-gradient(ellipse at 50% 40%, ${p.skinColor}08 0%, transparent 60%), radial-gradient(ellipse at center, #0c1612 0%, #080c0a 70%)`,
            }}
          >
            <BlockyFace params={p} activity={activity} detail={detail} />
            <div style={{ marginTop: 10 }}>
              <Waveform active={false} color={p.skinColor} />
            </div>
          </div>
          <ProjectPicker onSelect={handleSelectProject} />
        </>
      )}

      {phase === "running" && (
        <>
          {/* Compact avatar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "6px 16px",
              borderBottom: "1px solid #12251c",
              background: `radial-gradient(ellipse at 50% 50%, ${p.skinColor}06 0%, transparent 60%), #0a100e`,
              gap: 12,
            }}
          >
            <BlockyFace
              params={p}
              activity={activity}
              detail={detail}
              compact
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Waveform
                active={activity === "speaking" || activity === "thinking"}
                color={p.skinColor}
                n={16}
              />
            </div>
          </div>

          {/* Terminal */}
          <div
            style={{
              flex: 1,
              display: "flex",
              overflow: "hidden",
            }}
          >
            <Terminal />
          </div>

          {/* Command bar (avatar commands only) */}
          <div
            style={{
              borderTop: "1px solid #12251c",
              background: "#0a100e",
              padding: "8px 14px 6px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 6,
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
                }}
              >
                <span
                  style={{ color: "#1e3a2a", fontSize: 12, marginRight: 6 }}
                >
                  {"›"}
                </span>
                <input
                  ref={inRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="blocky command (dance, party, reset...)"
                  style={{
                    flex: 1,
                    background: "none",
                    border: "none",
                    outline: "none",
                    color: "#c0c8c4",
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 10,
                    padding: "7px 0",
                  }}
                />
              </div>
              <button
                onClick={submit}
                style={{
                  padding: "7px 12px",
                  borderRadius: 6,
                  border: `1px solid ${p.skinColor}33`,
                  background: `${p.skinColor}0d`,
                  color: p.skinColor,
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: 2,
                }}
              >
                CMD
              </button>
            </div>
            <div
              style={{
                display: "flex",
                gap: 4,
                flexWrap: "wrap",
                justifyContent: "center",
                paddingBottom: 4,
              }}
            >
              {quickCmds.map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => exec(cmd)}
                  style={{
                    padding: "2px 7px",
                    borderRadius: 3,
                    border: "1px solid #12251c",
                    background: "#0a100e",
                    color: "#2a5a3a",
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 8,
                    letterSpacing: 0.5,
                  }}
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {phase === "exited" && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <BlockyFace params={p} activity="idle" detail={null} />
          <div
            style={{
              fontSize: 11,
              letterSpacing: 3,
              color: "#2a4a3a",
              fontWeight: 600,
            }}
          >
            SESSION ENDED
          </div>
          <button
            onClick={handleRestart}
            style={{
              padding: "10px 24px",
              borderRadius: 6,
              border: "1px solid #00ff8833",
              background: "#00ff880d",
              color: "#00ff88",
              cursor: "pointer",
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 2,
            }}
          >
            NEW SESSION
          </button>
        </div>
      )}
    </div>
  );
}
