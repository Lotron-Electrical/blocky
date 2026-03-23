import { useState, useEffect } from "react";

const EYE = {
  dot: [" ·", "· "],
  blink: ["──", "──"],
  wide: [" ◉", "◉ "],
  squint: [" ▬", "▬ "],
  heart: [" ♥", "♥ "],
  star: [" ★", "★ "],
  dead: [" ×", "× "],
  cool: [" ■", "■ "],
  wink: [" ·", "── "],
  roll: [" ◐", "◑ "],
  dizzy: [" ◎", "◎ "],
  happy: [" ^", "^ "],
};

const MOUTH = {
  neutral: [" ╭──╮ ", " │  │ ", " ╰──╯ "],
  smile: [" ╭──╮ ", " │⌣⌣│ ", " ╰──╯ "],
  open: ["╭────╮", "│    │", "╰────╯"],
  grin: ["╭────────╮", "│ ✓    ✓ │", "╰────────╯"],
  frown: ["╭──────╮", "│ ▁▁▁▁ │", "╰──────╯"],
  o: ["  ╭╮  ", "  ││  ", "  ╰╯  "],
  teeth: ["╭────╮", "│▀▀▀▀│", "╰────╯"],
  blep: [" ╭──╮ ", " │ ρ│ ", " ╰──╯ "],
  smirk: ["  ╭──╮", "  │~>│", "  ╰──╯"],
  speak1: [" ╭──╮ ", " │  │ ", " ╰──╯ "],
  speak2: ["╭────╮", "│    │", "╰────╯"],
  speak3: ["  ╭╮  ", "  ╰╯  ", "      "],
};

const ACCESSORY_ART = {
  none: [],
  hat: ["    ┌──────────┐    ", "  ┌─┘▓▓▓▓▓▓▓▓▓▓└─┐  "],
  crown: ["      ♛  ♛  ♛       ", "    ┌──────────┐    "],
  horns: ["  ╱              ╲  ", " ╱                ╲ "],
  halo: ["      · · · ·       ", "    ·         ·     "],
  antenna: ["          ◆         ", "          │         "],
  headphones: [" ╭──╮          ╭──╮ ", " │▓▓│          │▓▓│ "],
};

function useAnimation(anim, speed) {
  const [offset, setOffset] = useState({ x: 0, y: 0, r: 0, s: 1 });
  useEffect(() => {
    if (anim === "none") {
      setOffset({ x: 0, y: 0, r: 0, s: 1 });
      return;
    }
    let f = 0,
      running = true;
    const tick = () => {
      if (!running) return;
      f++;
      const t = f * speed;
      switch (anim) {
        case "dance":
          setOffset({
            x: Math.sin(t * 0.12) * 10,
            y: Math.abs(Math.sin(t * 0.08)) * -10,
            r: Math.sin(t * 0.12) * 6,
            s: 1,
          });
          break;
        case "bounce":
          setOffset({
            x: 0,
            y: Math.abs(Math.sin(t * 0.09)) * -16,
            r: 0,
            s: 1 + Math.abs(Math.sin(t * 0.09)) * 0.04,
          });
          break;
        case "wiggle":
          setOffset({
            x: Math.sin(t * 0.18) * 5,
            y: 0,
            r: Math.sin(t * 0.18) * 10,
            s: 1,
          });
          break;
        case "nod":
          setOffset({ x: 0, y: Math.sin(t * 0.07) * 4, r: 0, s: 1 });
          break;
        case "spin":
          setOffset({ x: 0, y: 0, r: t * 3, s: 1 });
          break;
        case "breathe":
          setOffset({ x: 0, y: 0, r: 0, s: 1 + Math.sin(t * 0.04) * 0.035 });
          break;
        case "vibrate":
          setOffset({
            x: (Math.random() - 0.5) * 5,
            y: (Math.random() - 0.5) * 5,
            r: (Math.random() - 0.5) * 4,
            s: 1,
          });
          break;
        default:
          setOffset({ x: 0, y: 0, r: 0, s: 1 });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      running = false;
    };
  }, [anim, speed]);
  return offset;
}

const ACOL = {
  idle: "#445a50",
  listening: "#ff4444",
  thinking: "#ffaa00",
  reading_file: "#66bbff",
  writing_code: "#00ff88",
  running_bash: "#ff8800",
  speaking: "#00ff88",
  success: "#00ff88",
  error: "#ff4444",
  waiting: "#ffdd00",
  searching: "#bb88ff",
};

const ALAB = {
  idle: "STANDING BY",
  listening: "● REC",
  thinking: "THINKING",
  reading_file: "READING FILE",
  writing_code: "WRITING CODE",
  running_bash: "RUNNING CMD",
  speaking: "SPEAKING",
  success: "DONE ✓",
  error: "ERROR",
  waiting: "AWAITING INPUT",
  searching: "SEARCHING",
};

export default function BlockyFace({
  params,
  activity,
  detail,
  compact,
  amplitude,
}) {
  const offset = useAnimation(params.animation, params.animSpeed);
  const [blink, setBlink] = useState(false);
  const [speakF, setSpeakF] = useState(0);

  useEffect(() => {
    let timer;
    const scheduleBlink = () => {
      const delay = params.blinkRate + Math.random() * 1500;
      timer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 110);
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(timer);
  }, [params.blinkRate]);

  useEffect(() => {
    if (activity !== "speaking") return;
    const iv = setInterval(() => setSpeakF((f) => (f + 1) % 3), 140);
    return () => clearInterval(iv);
  }, [activity]);

  let eyes = blink ? EYE.blink : EYE[params.eyeStyle] || EYE.dot;
  let mouth = MOUTH[params.mouthStyle] || MOUTH.neutral;
  let extra = "";

  if (activity === "writing_code") {
    eyes = blink ? EYE.blink : EYE.dot;
    extra = " ⌨";
  }
  if (activity === "running_bash") {
    eyes = blink ? EYE.blink : EYE.wide;
    extra = " >_";
  }
  if (activity === "reading_file") {
    eyes = blink ? EYE.blink : EYE.roll;
  }
  if (activity === "thinking") {
    eyes = blink ? EYE.blink : EYE.roll;
  }
  if (activity === "error") {
    eyes = EYE.dead;
    mouth = MOUTH.frown;
  }
  if (activity === "success") {
    eyes = blink ? EYE.blink : EYE.happy;
    mouth = MOUTH.grin;
  }
  if (activity === "searching") {
    eyes = blink ? EYE.blink : EYE.dizzy;
  }
  if (activity === "waiting") {
    eyes = blink ? EYE.blink : EYE.wide;
    mouth = MOUTH.o;
    extra = " ?";
  }
  if (activity === "speaking") {
    if (amplitude !== undefined && amplitude !== null) {
      // Amplitude-driven mouth (Piper TTS)
      if (amplitude < 0.1)
        mouth = MOUTH.speak3; // small mouth
      else if (amplitude < 0.4)
        mouth = MOUTH.speak1; // medium
      else mouth = MOUTH.speak2; // wide open
    } else {
      // Fixed cycle fallback (Web Speech API)
      const ms = [MOUTH.speak1, MOUTH.speak2, MOUTH.speak3];
      mouth = ms[speakF];
    }
  }

  const acc = ACCESSORY_ART[params.accessory] || [];
  const ac = ACOL[activity] || params.skinColor;
  const faceColor = activity !== "idle" ? ac : params.skinColor;
  const W = 24;
  const pad = (s, w) => {
    const d = w - s.length;
    const l = Math.floor(d / 2);
    return " ".repeat(Math.max(0, l)) + s + " ".repeat(Math.max(0, d - l));
  };

  const lines = [
    ...acc.map((l) => pad(l, W + 4)),
    `  ╔${"═".repeat(W)}╗  `,
    `  ║${" ".repeat(W)}║  `,
    `  ║    ┌──┐      ┌──┐    ║  `,
    `  ║    │${eyes[0]}│      │${eyes[1]}│    ║  `,
    `  ║    └──┘      └──┘    ║  `,
    `  ║${" ".repeat(W)}║  `,
    ...mouth.map((ml) => `  ║${pad(ml, W)}║  `),
    extra ? `  ║${pad(extra, W)}║  ` : `  ║${" ".repeat(W)}║  `,
    `  ╚${"═".repeat(W)}╝  `,
  ];

  if (compact) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          transform: `translate(${offset.x * 0.3}px,${offset.y * 0.3}px) rotate(${offset.r * 0.3}deg) scale(${offset.s})`,
          transition:
            params.animation === "vibrate"
              ? "none"
              : "transform 0.06s ease-out",
        }}
      >
        <pre
          style={{
            fontFamily: "'JetBrains Mono','Fira Code',monospace",
            fontSize: 8,
            lineHeight: 1.2,
            margin: 0,
            textAlign: "center",
            userSelect: "none",
            color: faceColor,
            textShadow: `0 0 6px ${faceColor}44`,
            transition: "color 0.35s",
          }}
        >
          {lines.join("\n")}
        </pre>
        <div style={{ fontFamily: "'JetBrains Mono',monospace" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: 2,
              color: ac,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: ac,
                display: "inline-block",
                boxShadow: `0 0 4px ${ac}`,
                animation:
                  activity !== "idle" ? "pulse 1s ease infinite" : "none",
              }}
            />
            {ALAB[activity] || "STANDING BY"}
          </div>
          {detail && (
            <div
              style={{
                fontSize: 8,
                color: "#4a6a5a",
                letterSpacing: 0.5,
                marginTop: 2,
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {detail}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: `translate(${offset.x}px,${offset.y}px) rotate(${offset.r}deg) scale(${offset.s})`,
        transition:
          params.animation === "vibrate" ? "none" : "transform 0.06s ease-out",
      }}
    >
      <pre
        style={{
          fontFamily: "'JetBrains Mono','Fira Code',monospace",
          fontSize: 14,
          lineHeight: 1.28,
          margin: 0,
          textAlign: "center",
          userSelect: "none",
          color: faceColor,
          textShadow: `0 0 10px ${faceColor}55, 0 0 25px ${faceColor}22`,
          transition: "color 0.35s, text-shadow 0.35s",
        }}
      >
        {lines.join("\n")}
      </pre>
      <div
        style={{
          marginTop: 8,
          textAlign: "center",
          fontFamily: "'JetBrains Mono',monospace",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 5,
            color: params.skinColor,
            marginBottom: 4,
          }}
        >
          {params.name}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 2,
            color: ac,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: ac,
              display: "inline-block",
              boxShadow: `0 0 6px ${ac}`,
              animation:
                activity !== "idle" ? "pulse 1s ease infinite" : "none",
            }}
          />
          {ALAB[activity] || "STANDING BY"}
        </div>
        {detail && (
          <div
            style={{
              fontSize: 9,
              color: "#4a6a5a",
              letterSpacing: 1,
              marginTop: 3,
            }}
          >
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}
