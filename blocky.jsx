import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════
//  BLOCKY PARAMETER SYSTEM
// ═══════════════════════════════════════════════════════
const DEFAULT_PARAMS = {
  name: "BLOCKY",
  skinColor: "#00ff88",
  eyeColor: "#00ff88",
  mouthColor: "#00ff88",
  glowColor: "#00ff8844",
  eyeStyle: "dot",
  mouthStyle: "neutral",
  accessory: "none",
  animation: "none",
  animSpeed: 1,
  blinkRate: 3200,
};

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

// ═══════════════════════════════════════════════════════
//  ANIMATION ENGINE
// ═══════════════════════════════════════════════════════
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
    const raf = requestAnimationFrame(tick);
    return () => {
      running = false;
    };
  }, [anim, speed]);
  return offset;
}

// ═══════════════════════════════════════════════════════
//  COMMAND PARSER
// ═══════════════════════════════════════════════════════
function parseCommand(input) {
  const l = input.toLowerCase().trim();
  const c = {};
  const u = [];
  const colors = {
    red: "#ff4444",
    green: "#00ff88",
    blue: "#5588ff",
    yellow: "#ffdd00",
    orange: "#ff8800",
    purple: "#bb44ff",
    pink: "#ff66aa",
    cyan: "#00ddff",
    white: "#eeeeff",
    brown: "#aa7744",
    gold: "#ffd700",
    lime: "#88ff00",
    teal: "#00aa88",
    magenta: "#ff00ff",
    coral: "#ff7766",
    lavender: "#bb99ff",
    mint: "#66ffcc",
    salmon: "#ff8877",
    crimson: "#cc2244",
    amber: "#ffbb00",
  };
  for (const [n, h] of Object.entries(colors)) {
    if (l.includes(n)) {
      if (l.includes("eye")) {
        c.eyeColor = h;
        u.push(`eyes → ${n}`);
      } else if (l.includes("mouth")) {
        c.mouthColor = h;
        u.push(`mouth → ${n}`);
      } else {
        c.skinColor = h;
        c.eyeColor = h;
        c.mouthColor = h;
        c.glowColor = h + "44";
        u.push(`color → ${n}`);
      }
    }
  }
  const eyeMap = {
    "heart eye": "heart",
    "star eye": "star",
    "dead eye": "dead",
    cool: "cool",
    wink: "wink",
    dizzy: "dizzy",
    "wide eye": "wide",
    squint: "squint",
    roll: "roll",
  };
  for (const [k, v] of Object.entries(eyeMap)) {
    if (l.includes(k)) {
      c.eyeStyle = v;
      u.push(`eyes → ${v}`);
    }
  }
  const mouthMap = {
    smile: "smile",
    frown: "frown",
    grin: "grin",
    "open mouth": "open",
    teeth: "teeth",
    blep: "blep",
    tongue: "blep",
    smirk: "smirk",
  };
  for (const [k, v] of Object.entries(mouthMap)) {
    if (l.includes(k)) {
      c.mouthStyle = v;
      u.push(`mouth → ${v}`);
    }
  }
  const accMap = {
    hat: "hat",
    cap: "hat",
    crown: "crown",
    king: "crown",
    queen: "crown",
    horn: "horns",
    halo: "halo",
    angel: "halo",
    antenna: "antenna",
    alien: "antenna",
    headphone: "headphones",
    music: "headphones",
  };
  for (const [k, v] of Object.entries(accMap)) {
    if (l.includes(k)) {
      c.accessory = v;
      u.push(`accessory → ${v}`);
    }
  }
  if (l.match(/no (hat|crown|horn|halo|antenna|headphone|accessor)/)) {
    c.accessory = "none";
    u.push("accessory removed");
  }

  const animMap = {
    dance: "dance",
    dancing: "dance",
    bounce: "bounce",
    jump: "bounce",
    wiggle: "wiggle",
    wobble: "wiggle",
    nod: "nod",
    spin: "spin",
    rotate: "spin",
    breathe: "breathe",
    chill: "breathe",
    vibrate: "vibrate",
    shake: "vibrate",
    shiver: "vibrate",
  };
  for (const [k, v] of Object.entries(animMap)) {
    if (l.includes(k)) {
      c.animation = v;
      u.push(`animation → ${v}`);
    }
  }
  if (l.match(/stop|still|freeze/)) {
    c.animation = "none";
    u.push("animation stopped");
  }
  if (l.includes("faster") || l.includes("speed up") || l.includes("turbo")) {
    c.animSpeed = (c.animSpeed || 1) * 2.5;
    u.push("speed ↑↑");
  }
  if (l.includes("slower") || l.includes("slow down")) {
    c.animSpeed = 0.4;
    u.push("speed ↓");
  }

  // Mood combos
  if (l.includes("angry") || l.includes("mad")) {
    return {
      c: {
        eyeStyle: "squint",
        mouthStyle: "teeth",
        skinColor: "#ff4444",
        eyeColor: "#ff4444",
        mouthColor: "#ff4444",
        glowColor: "#ff444444",
        animation: "vibrate",
        animSpeed: 1,
      },
      u: ["ANGRY MODE"],
    };
  }
  if (l.includes("excited") || l.includes("hyped")) {
    return {
      c: {
        eyeStyle: "star",
        mouthStyle: "grin",
        skinColor: "#ffdd00",
        eyeColor: "#ffdd00",
        mouthColor: "#ffdd00",
        glowColor: "#ffdd0044",
        animation: "bounce",
        animSpeed: 1.5,
      },
      u: ["EXCITED MODE"],
    };
  }
  if (l.includes("love") || l.includes("adorable")) {
    return {
      c: {
        eyeStyle: "heart",
        mouthStyle: "smile",
        skinColor: "#ff66aa",
        eyeColor: "#ff66aa",
        mouthColor: "#ff66aa",
        glowColor: "#ff66aa44",
        animation: "breathe",
        animSpeed: 0.8,
      },
      u: ["LOVE MODE"],
    };
  }
  if (l.includes("sleepy") || l.includes("tired")) {
    return {
      c: {
        eyeStyle: "squint",
        mouthStyle: "o",
        animation: "breathe",
        animSpeed: 0.5,
      },
      u: ["sleepy mode"],
    };
  }
  if (l.includes("confused") || l.includes("puzzled")) {
    return {
      c: {
        eyeStyle: "roll",
        mouthStyle: "smirk",
        animation: "wiggle",
        animSpeed: 0.7,
      },
      u: ["confused mode"],
    };
  }
  if (l.includes("party") || l.includes("rave")) {
    return {
      c: {
        eyeStyle: "star",
        mouthStyle: "grin",
        accessory: "crown",
        animation: "dance",
        animSpeed: 1.5,
        skinColor: "#ff66aa",
        eyeColor: "#ffdd00",
        mouthColor: "#00ddff",
        glowColor: "#ff66aa44",
      },
      u: ["🎉 PARTY MODE 🎉"],
    };
  }
  if (l.includes("hacker") || l.includes("matrix")) {
    return {
      c: {
        skinColor: "#00ff88",
        eyeColor: "#00ff88",
        mouthColor: "#00ff88",
        glowColor: "#00ff8844",
        eyeStyle: "cool",
        mouthStyle: "smirk",
        animation: "breathe",
        animSpeed: 0.6,
      },
      u: ["HACKER MODE"],
    };
  }
  if (l.includes("robot") || l.includes("mech")) {
    return {
      c: {
        skinColor: "#aabbcc",
        eyeColor: "#ff4444",
        mouthColor: "#aabbcc",
        glowColor: "#aabbcc44",
        eyeStyle: "wide",
        mouthStyle: "teeth",
        accessory: "antenna",
        animation: "nod",
        animSpeed: 0.5,
      },
      u: ["ROBOT MODE"],
    };
  }
  if (l.match(/reset|default|normal/)) {
    return { c: { ...DEFAULT_PARAMS }, u: ["reset to defaults"] };
  }
  const nameMatch = l.match(
    /(?:call (?:you|yourself|blocky|him|her|it)|rename|name is|you(?:'re| are)) (.+)/,
  );
  if (nameMatch) {
    c.name = nameMatch[1].toUpperCase().slice(0, 14);
    u.push(`name → ${c.name}`);
  }

  return { c, u };
}

// ═══════════════════════════════════════════════════════
//  WAVEFORM
// ═══════════════════════════════════════════════════════
const WV = ["▁", "▂", "▃", "▅", "▆", "▇", "█"];
function Waveform({ active, color, n = 22 }) {
  const [b, setB] = useState(Array(n).fill(0));
  const ref = useRef();
  useEffect(() => {
    if (!active) {
      setB(Array(n).fill(0));
      return;
    }
    let go = true;
    const tick = () => {
      if (!go) return;
      setB((p) =>
        p.map((_, i) =>
          Math.min(
            1,
            Math.max(
              0.05,
              Math.sin(Date.now() / 180 + i * 0.6) * 0.3 + Math.random() * 0.7,
            ),
          ),
        ),
      );
      ref.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      go = false;
      cancelAnimationFrame(ref.current);
    };
  }, [active, n]);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 1.5,
        height: 26,
        justifyContent: "center",
      }}
    >
      {b.map((h, i) => (
        <span
          key={i}
          style={{
            color: active ? color : "#162a1e",
            fontSize: 13,
            lineHeight: 1,
            fontFamily: "monospace",
          }}
        >
          {WV[Math.floor(h * (WV.length - 1))]}
        </span>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  BLOCKY FACE
// ═══════════════════════════════════════════════════════
function BlockyFace({ params, activity, detail }) {
  const offset = useAnimation(params.animation, params.animSpeed);
  const [blink, setBlink] = useState(false);
  const [speakF, setSpeakF] = useState(0);

  useEffect(() => {
    const iv = setInterval(
      () => {
        setBlink(true);
        setTimeout(() => setBlink(false), 110);
      },
      params.blinkRate + Math.random() * 1500,
    );
    return () => clearInterval(iv);
  }, [params.blinkRate]);

  useEffect(() => {
    if (activity !== "speaking") return;
    const iv = setInterval(() => setSpeakF((f) => (f + 1) % 3), 140);
    return () => clearInterval(iv);
  }, [activity]);

  // Resolve eyes and mouth based on activity overrides
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
    const ms = [MOUTH.speak1, MOUTH.speak2, MOUTH.speak3];
    mouth = ms[speakF];
  }

  const acc = ACCESSORY_ART[params.accessory] || [];

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

// ═══════════════════════════════════════════════════════
//  ACTIVITY DEMO
// ═══════════════════════════════════════════════════════
const SEQ = [
  { s: "idle", d: null, t: 2800 },
  { s: "listening", d: null, t: 2500 },
  { s: "thinking", d: null, t: 2200 },
  { s: "reading_file", d: "src/api/handler.ts", t: 2000 },
  { s: "thinking", d: null, t: 1200 },
  { s: "writing_code", d: "src/api/handler.ts", t: 3200 },
  { s: "writing_code", d: "src/utils/validate.ts", t: 2000 },
  { s: "running_bash", d: "npm run test", t: 2800 },
  { s: "error", d: "2 tests failed", t: 1800 },
  { s: "thinking", d: null, t: 1200 },
  { s: "writing_code", d: "src/utils/validate.ts", t: 2200 },
  { s: "running_bash", d: "npm run test", t: 2400 },
  { s: "success", d: "All 14 tests passed", t: 2200 },
  { s: "speaking", d: null, t: 3500 },
  { s: "waiting", d: "Push changes?", t: 2800 },
  { s: "listening", d: null, t: 1800 },
  { s: "running_bash", d: "git push origin main", t: 2200 },
  { s: "success", d: "Pushed to remote", t: 2000 },
  { s: "speaking", d: null, t: 2800 },
];

// ═══════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════
export default function App() {
  const [p, setP] = useState({ ...DEFAULT_PARAMS });
  const [si, setSi] = useState(0);
  const [log, setLog] = useState([
    {
      r: "sys",
      t: 'Talk to Blocky! Try: "dance", "party mode", "angry", "make me blue", "give me a crown", "heart eyes", "robot mode", "hacker", "reset"',
    },
  ]);
  const [input, setInput] = useState("");
  const [sec, setSec] = useState(0);
  const logRef = useRef();
  const inRef = useRef();
  const cur = SEQ[si];

  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setSi((i) => (i + 1) % SEQ.length), cur.t);
    return () => clearTimeout(t);
  }, [si, cur.t]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const exec = useCallback((text) => {
    const t = text.trim();
    if (!t) return;
    setLog((prev) => [...prev, { r: "you", t }]);
    const { c, u } = parseCommand(t);
    if (Object.keys(c).length > 0) {
      setP((prev) => ({ ...prev, ...c }));
      setLog((prev) => [...prev, { r: "blocky", t: u.join(", ") }]);
    } else {
      setLog((prev) => [
        ...prev,
        {
          r: "blocky",
          t: 'Hmm? Try: color names, "dance", "crown", "angry", "party mode", "reset"',
        },
      ]);
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
        minHeight: "100vh",
        background: "#080c0a",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'JetBrains Mono','Fira Code',monospace",
        color: "#c0c8c4",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;700&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glowPulse{0%,100%{box-shadow:0 0 8px #00ff8833}50%{box-shadow:0 0 20px #00ff8855}}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:#080c0a}
        ::-webkit-scrollbar-thumb{background:#1a3a2a;border-radius:2px}
        input::placeholder{color:#1e3a2a}
        button:hover{filter:brightness(1.3)!important}
        button:active{transform:scale(0.96)!important}
      `}</style>

      {/* CRT scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 20,
          background:
            "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,136,0.01) 2px,rgba(0,255,136,0.01) 4px)",
          mixBlendMode: "screen",
        }}
      />
      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 15,
          background:
            "radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,0.5) 100%)",
        }}
      />

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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 8,
              color: "#1e3a2a",
              letterSpacing: 1,
              padding: "2px 6px",
              border: "1px solid #12251c",
              borderRadius: 3,
            }}
          >
            FREE
          </span>
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
          <BlockyFace params={p} activity={cur.s} detail={cur.d} />
          <div style={{ marginTop: 10 }}>
            <Waveform active={cur.s === "speaking"} color={p.skinColor} />
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
          {log.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                animation: "fadeIn 0.2s ease",
              }}
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
          ))}
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
              placeholder={`talk to ${p.name.toLowerCase()}...`}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                color: "#c0c8c4",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 11.5,
                padding: "9px 0",
              }}
            />
          </div>
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
              onClick={() => exec(cmd)}
              style={{
                padding: "3px 8px",
                borderRadius: 3,
                border: "1px solid #12251c",
                background: "#0a100e",
                color: "#2a5a3a",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 8.5,
                letterSpacing: 0.5,
                transition: "all 0.15s",
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
