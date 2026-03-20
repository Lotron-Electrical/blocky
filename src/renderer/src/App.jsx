import { useState, useEffect, useRef, useCallback } from "react";
import BlockyFace from "./components/BlockyFace";
import Waveform from "./components/Waveform";
import Terminal from "./components/Terminal";
import Transcript from "./components/Transcript";
import ProjectPicker from "./components/ProjectPicker";
import SetupWizard from "./components/SetupWizard";
import ErrorBanner from "./components/ErrorBanner";
import AudioDevicePicker from "./components/AudioDevicePicker";
import { DEFAULT_PARAMS, parseCommand } from "./blocky/command-parser";
import useSpeechRecognition from "./hooks/useSpeechRecognition";
import useSpeechSynthesis from "./hooks/useSpeechSynthesis";

const ACK_PHRASES = [
  "On it!",
  "Let me look into that.",
  "Sure, give me a sec.",
  "Working on it!",
  "Got it, one moment.",
  "Okay, let me check.",
];

const PROGRESS_PHRASES = {
  reading_file: (d) => `Reading ${d ? d.split("/").pop() : "a file"}.`,
  writing_code: (d) => `Writing to ${d ? d.split("/").pop() : "a file"}.`,
  running_bash: () => "Running a command.",
  searching: () => "Searching the codebase.",
  error: () => "Hmm, something went wrong.",
};

const PROGRESS_COOLDOWN = 4000; // ms

export default function App() {
  const [p, setP] = useState({ ...DEFAULT_PARAMS });
  const [activity, setActivity] = useState("idle");
  const [detail, setDetail] = useState(null);
  const [phase, setPhase] = useState("picking"); // picking | running | exited
  const [input, setInput] = useState("");
  const [sec, setSec] = useState(0);
  const [view, setView] = useState("chat"); // chat | term
  const [claudeReady, setClaudeReady] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [ttsReady, setTtsReady] = useState(null); // null=checking, true/false
  const [ttsDownloading, setTtsDownloading] = useState(false);
  const [ttsProgress, setTtsProgress] = useState({ label: "", pct: 0 });
  const [sttReady, setSttReady] = useState(null); // null=checking, true/false
  const [sttDownloading, setSttDownloading] = useState(false);
  const [sttProgress, setSttProgress] = useState({ label: "", pct: 0 });
  const [amplitude, setAmplitude] = useState(0);
  const [peers, setPeers] = useState([]);
  const [error, setError] = useState(null);
  const [showSetup, setShowSetup] = useState(null); // null=checking, true/false
  const [micDeviceId, setMicDeviceId] = useState(null);
  const inRef = useRef();
  const queuedInputRef = useRef(null);
  const lastProgressRef = useRef(0);
  const ampTimerRef = useRef(null);
  const pttRef = useRef(false); // push-to-talk state
  const inputSourceRef = useRef("typed"); // "typed" | "voice"

  // TTS — controls Blocky speaking
  const tts = useSpeechSynthesis({
    onStart: () => {
      setActivity("speaking");
      // Start polling amplitude from the ref
      if (ampTimerRef.current) clearInterval(ampTimerRef.current);
      ampTimerRef.current = setInterval(() => {
        setAmplitude(tts.amplitude.current);
      }, 33); // ~30fps
    },
    onEnd: () => {
      setActivity("idle");
      if (ampTimerRef.current) {
        clearInterval(ampTimerRef.current);
        ampTimerRef.current = null;
      }
      setAmplitude(0);
    },
  });

  // Check TTS readiness on mount + listen for download progress
  useEffect(() => {
    if (!window.blockyAPI?.checkTtsReady) {
      setTtsReady(false);
      return;
    }
    window.blockyAPI.checkTtsReady().then((r) => {
      setTtsReady(r?.ready || false);
    });
    const unsub = window.blockyAPI.onTtsDownloadProgress?.((data) => {
      setTtsProgress(data);
      if (data.pct === 1) {
        setTtsReady(true);
        setTtsDownloading(false);
        tts.refreshPiperStatus();
      } else if (data.pct === -1) {
        setTtsDownloading(false);
      }
    });
    return unsub;
  }, []);

  const handleTtsDownload = useCallback(() => {
    setTtsDownloading(true);
    window.blockyAPI?.downloadTts();
  }, []);

  // Check STT (Whisper) readiness on mount + listen for download progress
  useEffect(() => {
    if (!window.blockyAPI?.checkSttReady) {
      setSttReady(false);
      return;
    }
    window.blockyAPI.checkSttReady().then((r) => {
      setSttReady(r?.ready || false);
    });
    const unsub = window.blockyAPI.onSttDownloadProgress?.((data) => {
      setSttProgress(data);
      if (data.pct === 1) {
        setSttReady(true);
        setSttDownloading(false);
        stt.refreshWhisperStatus?.();
      } else if (data.pct === -1) {
        setSttDownloading(false);
      }
    });
    return unsub;
  }, []);

  const handleSttDownload = useCallback(() => {
    setSttDownloading(true);
    window.blockyAPI?.downloadStt();
  }, []);

  // Helper — handle actions from command parser (mute/unmute)
  const handleActions = useCallback(
    (actions) => {
      for (const action of actions) {
        if (action === "mute" && !tts.isMuted) tts.toggleMute();
        if (action === "unmute" && tts.isMuted) tts.toggleMute();
      }
    },
    [tts.isMuted, tts.toggleMute],
  );

  // Helper — speak ack and log to transcript
  const doAck = useCallback(() => {
    const phrase = ACK_PHRASES[Math.floor(Math.random() * ACK_PHRASES.length)];
    tts.speakAck(phrase);
    setTranscript((prev) => [...prev, { type: "blocky_verbal", text: phrase }]);
  }, [tts.speakAck]);

  // STT — voice input (with echo prevention)
  const stt = useSpeechRecognition({
    onResult: useCallback(
      (text) => {
        const t = text.trim();
        if (!t) return;

        // Try Blocky command first
        const { c, u, actions } = parseCommand(t);
        if (Object.keys(c).length > 0 || (actions && actions.length > 0)) {
          if (Object.keys(c).length > 0) setP((prev) => ({ ...prev, ...c }));
          if (actions?.length > 0) handleActions(actions);
          return;
        }

        // Otherwise send to Claude Code via PTY
        inputSourceRef.current = "voice";
        setTranscript((prev) => [...prev, { type: "user", text: t }]);
        window.blockyAPI?.sendPtyInput(t + "\r");
        doAck();
      },
      [doAck, handleActions],
    ),
    isTtsSpeaking: tts.isSpeaking,
    micDeviceId,
  });

  // Peer discovery — listen for updates from other Blocky instances
  useEffect(() => {
    if (!window.blockyAPI?.onPeersUpdate) return;
    const unsub = window.blockyAPI.onPeersUpdate((peerList) => {
      setPeers(peerList);
    });
    return unsub;
  }, []);

  // Push own state to peer registry when it changes
  useEffect(() => {
    window.blockyAPI?.updatePeerState?.({
      name: p.name,
      skinColor: p.skinColor,
      eyeStyle: p.eyeStyle,
      mouthStyle: p.mouthStyle,
      accessory: p.accessory,
      activity,
      detail,
    });
  }, [
    p.name,
    p.skinColor,
    p.eyeStyle,
    p.mouthStyle,
    p.accessory,
    activity,
    detail,
  ]);

  // First-run check
  useEffect(() => {
    window.blockyAPI
      ?.isFirstRun?.()
      .then((first) => {
        setShowSetup(first);
      })
      .catch(() => setShowSetup(false));
  }, []);

  // Transcript export helper
  const exportTranscript = useCallback(() => {
    if (transcript.length === 0) return;
    const lines = [`# Blocky Session — ${new Date().toLocaleString()}`, ""];
    for (const entry of transcript) {
      if (entry.type === "user") lines.push(`**You:** ${entry.text}`, "");
      else if (entry.type === "response")
        lines.push(`**Blocky:** ${entry.text}`, "");
      else if (entry.type === "blocky_verbal")
        lines.push(`*${entry.text}*`, "");
      else if (entry.type === "tool") {
        const label = entry.activity?.toUpperCase() || "WORKING";
        lines.push(`> ${label}${entry.detail ? ` · ${entry.detail}` : ""}`, "");
      }
    }
    window.blockyAPI
      ?.exportTranscript?.(lines.join("\n"))
      .then((path) => {
        if (path) setError(null); // clear any prior error
      })
      .catch(() => setError("Failed to export transcript"));
  }, [transcript]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept when typing in input
      const inInput =
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA";

      // Space = push-to-talk (only when not typing)
      if (
        e.code === "Space" &&
        !inInput &&
        phase === "running" &&
        !pttRef.current
      ) {
        e.preventDefault();
        pttRef.current = true;
        if (!stt.isListening && !stt.isTranscribing && stt.isSupported) {
          tts.stop();
          stt.start();
        }
      }

      // Escape = stop TTS/STT
      if (e.key === "Escape") {
        tts.stop();
        if (stt.isListening) stt.stop();
      }

      // Ctrl+Shift+E = export transcript
      if (e.ctrlKey && e.shiftKey && e.key === "E") {
        e.preventDefault();
        exportTranscript();
      }

      // Ctrl+1/2 = switch views
      if (e.ctrlKey && e.key === "1") {
        e.preventDefault();
        setView("chat");
      }
      if (e.ctrlKey && e.key === "2") {
        e.preventDefault();
        setView("term");
      }
    };

    const handleKeyUp = (e) => {
      // Space release = stop push-to-talk
      if (e.code === "Space" && pttRef.current) {
        pttRef.current = false;
        if (stt.isListening) stt.stop();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    phase,
    stt.isListening,
    stt.isTranscribing,
    stt.isSupported,
    tts,
    exportTranscript,
  ]);

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
        const isVoice = inputSourceRef.current === "voice";

        // Only log tool entries to transcript for voice input
        if (isVoice) {
          setTranscript((prev) => [
            ...prev,
            { type: "tool", activity: data.activity, detail: data.detail },
          ]);
        }

        // Verbal progress update with cooldown (voice only)
        if (isVoice) {
          const phraser = PROGRESS_PHRASES[data.activity];
          if (phraser) {
            const now = Date.now();
            if (now - lastProgressRef.current >= PROGRESS_COOLDOWN) {
              lastProgressRef.current = now;
              const phrase = phraser(data.detail);
              tts.speakProgress(phrase);
              setTranscript((prev) => [
                ...prev,
                { type: "blocky_verbal", text: phrase },
              ]);
            }
          }
        }
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
  }, [tts.speak, tts.speakProgress]);

  // Detect when Claude Code is ready by watching PTY output for the prompt
  useEffect(() => {
    if (!window.blockyAPI || phase !== "running") return;
    const unsub = window.blockyAPI.onPtyData((data) => {
      // Claude Code shows its prompt character when ready
      if (!claudeReady && /[❯>]\s*$/.test(data)) {
        setClaudeReady(true);
        // Send queued input if any
        if (queuedInputRef.current) {
          window.blockyAPI.sendPtyInput(queuedInputRef.current);
          queuedInputRef.current = null;
        }
      }
    });
    return unsub;
  }, [phase, claudeReady]);

  // Listen for PTY exit
  useEffect(() => {
    if (!window.blockyAPI) return;
    const unsub = window.blockyAPI.onPtyExit((code) => {
      setPhase("exited");
      setActivity("idle");
      setDetail(null);
      if (code && code !== 0) {
        setError(`Claude Code exited with code ${code}`);
      }
    });
    return unsub;
  }, []);

  const handleSelectProject = useCallback((dir) => {
    if (!window.blockyAPI) return;
    window.blockyAPI.startPty(dir);
    setPhase("running");
    setClaudeReady(false);
    setActivity("idle");
    setSec(0);
    setTranscript([]);
    // Push project info to peer registry
    const projectName = dir ? dir.split(/[/\\]/).filter(Boolean).pop() : "Home";
    window.blockyAPI.updatePeerState?.({ project: dir, projectName });
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
    const { c, actions } = parseCommand(t);
    if (Object.keys(c).length > 0 || (actions && actions.length > 0)) {
      if (Object.keys(c).length > 0) setP((prev) => ({ ...prev, ...c }));
      if (actions?.length > 0) handleActions(actions);
    } else {
      // Send to Claude Code via PTY
      inputSourceRef.current = "typed";
      setTranscript((prev) => [...prev, { type: "user", text: t }]);
      if (claudeReady) {
        window.blockyAPI?.sendPtyInput(t + "\r");
      } else {
        // Queue input until Claude Code is ready
        queuedInputRef.current = t + "\r";
      }
    }

    setInput("");
    setTimeout(() => inRef.current?.focus(), 30);
  };

  // Mic button handler
  const handleMic = async () => {
    if (stt.isListening) {
      await stt.stop();
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

      {/* ─── ERROR BANNER ─── */}
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {/* ─── SETUP WIZARD ─── */}
      {showSetup && <SetupWizard onComplete={() => setShowSetup(false)} />}

      {/* ─── MAIN CONTENT ─── */}
      {!showSetup && phase === "picking" && (
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
            <BlockyFace
              params={p}
              activity={activity}
              detail={detail}
              amplitude={activity === "speaking" ? amplitude : undefined}
            />
            <div style={{ marginTop: 10 }}>
              <Waveform active={false} color={p.skinColor} />
            </div>
          </div>
          {/* TTS download banner */}
          {ttsReady === false && !ttsDownloading && (
            <div
              style={{
                padding: "8px 16px",
                background: "#0c1612",
                borderBottom: "1px solid #12251c",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 9,
                fontFamily: "'JetBrains Mono',monospace",
              }}
            >
              <span style={{ color: "#4a6a5a" }}>
                Download voice model (~35MB, one-time) for natural speech
              </span>
              <button
                onClick={handleTtsDownload}
                style={{
                  padding: "4px 12px",
                  borderRadius: 4,
                  border: "1px solid #00ff8833",
                  background: "#00ff880d",
                  color: "#00ff88",
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 8,
                  fontWeight: 600,
                  letterSpacing: 1,
                }}
              >
                DOWNLOAD
              </button>
            </div>
          )}
          {ttsDownloading && (
            <div
              style={{
                padding: "8px 16px",
                background: "#0c1612",
                borderBottom: "1px solid #12251c",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 9,
              }}
            >
              <div style={{ color: "#4a6a5a", marginBottom: 4 }}>
                {ttsProgress.label || "Preparing..."}
              </div>
              <div
                style={{
                  height: 3,
                  background: "#12251c",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, ttsProgress.pct * 100))}%`,
                    height: "100%",
                    background: "#00ff88",
                    borderRadius: 2,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          )}
          {/* STT download banner */}
          {sttReady === false && !sttDownloading && (
            <div
              style={{
                padding: "8px 16px",
                background: "#0c1612",
                borderBottom: "1px solid #12251c",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 9,
                fontFamily: "'JetBrains Mono',monospace",
              }}
            >
              <span style={{ color: "#4a6a5a" }}>
                Download offline speech model (~150MB) for Whisper STT
              </span>
              <button
                onClick={handleSttDownload}
                style={{
                  padding: "4px 12px",
                  borderRadius: 4,
                  border: "1px solid #5588ff33",
                  background: "#5588ff0d",
                  color: "#5588ff",
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 8,
                  fontWeight: 600,
                  letterSpacing: 1,
                }}
              >
                DOWNLOAD
              </button>
            </div>
          )}
          {sttDownloading && (
            <div
              style={{
                padding: "8px 16px",
                background: "#0c1612",
                borderBottom: "1px solid #12251c",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 9,
              }}
            >
              <div style={{ color: "#4a6a5a", marginBottom: 4 }}>
                {sttProgress.label || "Preparing..."}
              </div>
              <div
                style={{
                  height: 3,
                  background: "#12251c",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, sttProgress.pct * 100))}%`,
                    height: "100%",
                    background: "#5588ff",
                    borderRadius: 2,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "0 30px",
            }}
          >
            <AudioDevicePicker
              micDeviceId={micDeviceId}
              onMicChange={setMicDeviceId}
            />
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
              amplitude={activity === "speaking" ? amplitude : undefined}
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
            <Transcript
              entries={transcript}
              activity={activity}
              detail={detail}
              skinColor={p.skinColor}
              peers={peers}
              claudeReady={claudeReady}
            />
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
                    stt.isTranscribing
                      ? "transcribing..."
                      : stt.isListening
                        ? "listening..."
                        : "ask claude or blocky command..."
                  }
                  readOnly={stt.isListening || stt.isTranscribing}
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
                  disabled={stt.isTranscribing || tts.isSpeaking}
                  className={stt.isListening ? "mic-active" : ""}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 6,
                    border: `1px solid ${stt.isListening ? "#ff4444" : stt.isTranscribing ? "#ffaa00" : "#2a4a3a"}33`,
                    background: stt.isListening
                      ? "#ff44440d"
                      : stt.isTranscribing
                        ? "#ffaa000d"
                        : "#0a100e",
                    color: stt.isListening
                      ? "#ff4444"
                      : stt.isTranscribing
                        ? "#ffaa00"
                        : tts.isSpeaking
                          ? "#1a2a1a"
                          : "#2a4a3a",
                    cursor:
                      stt.isTranscribing || tts.isSpeaking
                        ? "not-allowed"
                        : "pointer",
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: 1,
                  }}
                >
                  {stt.isTranscribing ? "..." : "MIC"}
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
              {transcript.length > 0 && (
                <button
                  onClick={exportTranscript}
                  title="Export transcript (Ctrl+Shift+E)"
                  style={{
                    padding: "7px 10px",
                    borderRadius: 6,
                    border: "1px solid #2a4a3a33",
                    background: "#0a100e",
                    color: "#2a4a3a",
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 8,
                    fontWeight: 600,
                    letterSpacing: 1,
                  }}
                >
                  SAVE
                </button>
              )}
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
                    const { c, actions } = parseCommand(cmd);
                    if (Object.keys(c).length > 0) {
                      setP((prev) => ({ ...prev, ...c }));
                    }
                    if (actions?.length > 0) handleActions(actions);
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
          <BlockyFace
            params={p}
            activity="idle"
            detail={null}
            amplitude={undefined}
          />
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
