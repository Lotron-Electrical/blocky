import { useState } from "react";

const STEPS = [
  {
    title: "WELCOME TO BLOCKY",
    body: "Your animated voice companion for Claude Code. Blocky watches what Claude does and keeps you in the loop — with speech, expressions, and a retro terminal vibe.",
  },
  {
    title: "VOICE OUTPUT",
    body: "Blocky uses Piper TTS to speak responses aloud. You can download the voice model (~35MB) from the main screen, or use your browser's built-in speech. Mute anytime with the MUTE button.",
  },
  {
    title: "VOICE INPUT",
    body: "Click MIC or hold Space to talk to Claude hands-free. Blocky supports browser speech recognition and offline Whisper STT (~150MB download).",
  },
  {
    title: "KEYBOARD SHORTCUTS",
    body: "Space — hold to talk (push-to-talk)\nEscape — stop Blocky speaking\nCtrl+Shift+E — export transcript\nCtrl+1/2 — switch Chat/Terminal view",
  },
  {
    title: "READY TO GO",
    body: "Pick a project folder and start coding with Claude. Blocky will show you what's happening in real time.",
  },
];

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = () => {
    if (isLast) {
      window.blockyAPI?.completeSetup();
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  const skip = () => {
    window.blockyAPI?.completeSetup();
    onComplete();
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 30px",
        gap: 24,
      }}
    >
      {/* Step dots */}
      <div style={{ display: "flex", gap: 6 }}>
        {STEPS.map((_, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: i === step ? "#00ff88" : "#12251c",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>

      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 4,
          color: "#00ff88",
          fontFamily: "'JetBrains Mono', monospace",
          textAlign: "center",
        }}
      >
        {current.title}
      </div>

      <div
        style={{
          fontSize: 11,
          lineHeight: 1.7,
          color: "#8aaa9a",
          fontFamily: "'JetBrains Mono', monospace",
          textAlign: "center",
          maxWidth: 380,
          whiteSpace: "pre-line",
        }}
      >
        {current.body}
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
        {!isLast && (
          <button
            onClick={skip}
            style={{
              padding: "8px 20px",
              borderRadius: 6,
              border: "1px solid #12251c",
              background: "#0a100e",
              color: "#2a4a3a",
              cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: 2,
            }}
          >
            SKIP
          </button>
        )}
        <button
          onClick={next}
          style={{
            padding: "8px 20px",
            borderRadius: 6,
            border: "1px solid #00ff8833",
            background: "#00ff880d",
            color: "#00ff88",
            cursor: "pointer",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: 2,
          }}
        >
          {isLast ? "GET STARTED" : "NEXT"}
        </button>
      </div>
    </div>
  );
}
