import { useState, useEffect, useRef, useCallback } from "react";
import BlockyFace from "./components/BlockyFace";
import Waveform from "./components/Waveform";
import Terminal from "./components/Terminal";
import Transcript from "./components/Transcript";
import ProjectPicker from "./components/ProjectPicker";
import { DEFAULT_PARAMS, parseCommand } from "./blocky/command-parser";
import useSpeechRecognition from "./hooks/useSpeechRecognition";
import useSpeechSynthesis from "./hooks/useSpeechSynthesis";

export default function App() {
  const [p, setP] = useState({ ...DEFAULT_PARAMS });
  const [activity, setActivity] = useState("idle");
  const [detail, setDetail] = useState(null);
  const [phase, setPhase] = useState("picking"); // picking | running | exited
  const [input, setInput] = useState("");
  const [sec, setSec] = useState(0);
  const [view, setView] = useState("chat"); // chat | term
  const [transcript, setTranscript] = useState([]);
  const inRef = useRef();

  // TTS — controls Blocky speaking
  const tts = useSpeechSynthesis({
    onStart: () => setActivity("speaking"),
    onEnd: () => setActivity("idle"),
  });

  // STT — voice input
  const stt = useSpeechRecognition({
    onResult: useCallback(
      (text) => {
        const t = text.trim();
        if (!t) return;

        // Try Blocky command first
        const { c, u } = parseCommand(t);
        if (Object.keys(c).length > 0) {
          setP((prev) => ({ ...prev, ...c }));
          return;
        }

        // Otherwise send to Claude Code via PTY
        setTranscript((prev) => [...prev, { type: "user", text: t }]);
        window.blockyAPI?.sendPtyInput(t + "\r");
      },
      [],
    ),
  });

  // Session timer
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Listen for hook activity events → drive transcript + TTS
  useEffect(() => {
    if (!window.blockyAPI) return;
    const unsub = window.blockyAPI.onHookActivity((data) => {
      setActivity(data.activity);
      setDetail(data.detail);

      // User prompt submitted
      if (data.userPrompt) {
        setTranscript((prev) => {
          // Avoid duplicate if we already added it from the input bar
          const last = prev[prev.length - 1];
          if (last && last.type === "user" && last.text === data.userPrompt) {
            return prev;
          }
          return [...prev, { type: "user", text: data.userPrompt }];
        });
      }

      // Tool use
      if (
        data.toolName &&
        data.activity !== "thinking" &&
        data.activity !== "success"
      ) {
        setTranscript((prev) => [
          ...prev,
          { type: "tool", activity: data.activity, detail: data.detail },
        ]);
      }

      // Claude's response (Stop hook)
      if (data.lastMessage) {
        setTranscript((prev) => [
          ...prev,
          { type: "response", text: data.lastMessage },
        ]);
        // Speak it
        tts.speak(data.lastMessage);
      }
    });
    return unsub;
  }, [tts.speak]);

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
    setTranscript([]);
  }, []);

  const handleRestart = useCallback(() => {
    setPhase("picking");
    setActivity("idle");
    setDetail(null);
    setSec(0);
    setTranscript([]);
  }, []);

  // Input submission — routes to Blocky commands or PTY
  const submit = () => {
    const t = input.trim();
    if (!t) return;

    // Try Blocky command first
    const { c } = parseCommand(t);
    if (Object.keys(c).length > 0) {
      setP((prev) => ({ ...prev, ...c }));
    } else {
      // Send to Claude Code via PTY
      setTranscript((prev) => [...prev, { type: "user", text: t }]);
      window.blockyAPI?.sendPtyInput(t + "\r");
    }

    setInput("");
    setTimeout(() => inRef.current?.focus(), 30);
  };

  // Mic button handler
  const handleMic = () => {
    if (stt.isListening) {
      stt.stop();
    } else {
      // Cancel TTS if Blocky is speaking
      tts.stop();
      stt.start();
    }
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            WebkitAppRegion: "no-drag",
          }}
        >
          {phase === "running" && (
            <div style={{ display: "flex", gap: 2 }}>
              <button
                onClick={() => setView("chat")}
                className="view-toggle-btn"
                style={{
                  padding: "3px 8px",
                  borderRadius: "4px 0 0 4px",
                  border: "1px solid #12251c",
                  background: view === "chat" ? "#1a3a2a" : "#0a100e",
                  color: view === "chat" ? "#00ff88" : "#2a4a3a",
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 8,
                  fontWeight: 600,
                  letterSpacing: 1,
                }}
              >
                CHAT
              </button>
              <button
                onClick={() => setView("term")}
                className="view-toggle-btn"
                style={{
                  padding: "3px 8px",
                  borderRadius: "0 4px 4px 0",
                  border: "1px solid #12251c",
                  borderLeft: "none",
                  background: view === "term" ? "#1a3a2a" : "#0a100e",
                  color: view === "term" ? "#00ff88" : "#2a4a3a",
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 8,
                  fontWeight: 600,
                  letterSpacing: 1,
                }}
              >
                TERM
              </button>
            </div>
          )}
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
              flexDirection: "column",
              alignItems: "center",
              padding: "6px 16px",
              borderBottom: "1px solid #12251c",
              background: `radial-gradient(ellipse at 50% 50%, ${p.skinColor}06 0%, transparent 60%), #0a100e`,
              gap: 6,
            }}
          >
            <BlockyFace
              params={p}
              activity={activity}
              detail={detail}
              compact
            />
            <div style={{ width: "100%" }}>
              <Waveform
                active={activity === "speaking" || activity === "thinking"}
                color={p.skinColor}
                n={16}
              />
            </div>
          </div>

          {/* Transcript (chat view) */}
          <div
            style={{
              flex: 1,
              display: view === "chat" ? "flex" : "none",
              overflow: "hidden",
            }}
          >
            <Transcript entries={transcript} />
          </div>

          {/* Terminal (term view) — stays mounted */}
          <div
            style={{
              flex: 1,
              display: view === "term" ? "flex" : "none",
              overflow: "hidden",
            }}
          >
            <Terminal />
          </div>

          {/* Input bar */}
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
                gap: 6,
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
                  value={stt.isListening && stt.interim ? stt.interim : input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder={
                    stt.isListening
                      ? "listening..."
                      : "ask claude or blocky command..."
                  }
                  readOnly={stt.isListening}
                  style={{
                    flex: 1,
                    background: "none",
                    border: "none",
                    outline: "none",
                    color: stt.isListening ? "#3a5a4a" : "#c0c8c4",
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 10,
                    padding: "7px 0",
                    fontStyle: stt.isListening ? "italic" : "normal",
                  }}
                />
              </div>
              <button
                onClick={submit}
                style={{
                  padding: "7px 10px",
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
                SEND
              </button>
              {stt.isSupported && (
                <button
                  onClick={handleMic}
                  className={stt.isListening ? "mic-active" : ""}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 6,
                    border: `1px solid ${stt.isListening ? "#ff4444" : "#2a4a3a"}33`,
                    background: stt.isListening ? "#ff44440d" : "#0a100e",
                    color: stt.isListening ? "#ff4444" : "#2a4a3a",
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: 1,
                  }}
                >
                  MIC
                </button>
              )}
              <button
                onClick={tts.toggleMute}
                style={{
                  padding: "7px 10px",
                  borderRadius: 6,
                  border: `1px solid ${tts.isMuted ? "#ff880033" : "#2a4a3a33"}`,
                  background: tts.isMuted ? "#ff88000d" : "#0a100e",
                  color: tts.isMuted ? "#ff8800" : "#2a4a3a",
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 8,
                  fontWeight: 600,
                  letterSpacing: 1,
                }}
              >
                {tts.isMuted ? "UNMUTE" : "MUTE"}
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
                  onClick={() => {
                    const { c } = parseCommand(cmd);
                    if (Object.keys(c).length > 0) {
                      setP((prev) => ({ ...prev, ...c }));
                    }
                  }}
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
            justifyContent: "flex-start",
            paddingTop: 40,
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
