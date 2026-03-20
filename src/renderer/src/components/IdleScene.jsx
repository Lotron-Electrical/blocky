import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// Mini Blocky face templates
const EYES = {
  dot: [" ·", "· "],
  blink: ["──", "──"],
  wide: [" ◉", "◉ "],
  squint: [" ▬", "▬ "],
  heart: [" ♥", "♥ "],
  star: [" ★", "★ "],
  dead: [" ×", "× "],
  cool: [" ■", "■ "],
  happy: [" ^", "^ "],
  dizzy: [" ◎", "◎ "],
};

const MOUTHS = {
  neutral: " ── ",
  smile: " ⌣⌣ ",
  open: " ○  ",
  speak1: " ── ",
  speak2: " ○  ",
  speak3: " ·  ",
  frown: " ▁▁ ",
};

function miniBlockyLines(eyeStyle, mouthStyle) {
  const eyes = EYES[eyeStyle] || EYES.dot;
  const mouth = MOUTHS[mouthStyle] || MOUTHS.neutral;
  return [" ┌────┐", ` │${eyes[0]}${eyes[1]}│`, ` │${mouth}│`, " └────┘"];
}

// Scenes
const SCENE_DEFS = [
  { name: "chat", duration: 4000, minPeers: 2 },
  { name: "chase", duration: 5000, minPeers: 2 },
  { name: "dance", duration: 3500, minPeers: 1 },
  { name: "nap", duration: 5000, minPeers: 1 },
  { name: "wave", duration: 2000, minPeers: 1 },
];

function pickScene(peerCount) {
  const valid = SCENE_DEFS.filter((s) => peerCount >= s.minPeers);
  return valid[Math.floor(Math.random() * valid.length)];
}

export default function IdleScene({ peers, compact }) {
  const containerRef = useRef(null);
  const positionsRef = useRef({}); // { pid: { x, y, targetX, targetY } }
  const sceneRef = useRef(null);
  const sceneTimerRef = useRef(null);
  const rafRef = useRef(null);
  const [, forceRender] = useState(0);
  const tickRef = useRef(0);

  // Track which peers have entered (for staggered animation)
  const enteredRef = useRef(new Set());

  // Init / update positions for peers
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.offsetWidth;
    const h = container.offsetHeight;

    for (const peer of peers) {
      if (!positionsRef.current[peer.pid]) {
        const spacing = w / (peers.length + 1);
        const idx = peers.indexOf(peer);
        positionsRef.current[peer.pid] = {
          x: spacing * (idx + 1),
          y: h - 20,
          targetX: spacing * (idx + 1),
          targetY: h * 0.3 + Math.random() * h * 0.4,
          entered: false,
          enterStart: Date.now() + idx * 300,
          blinkUntil: 0,
          overrideEyes: null,
          overrideMouth: null,
          bubble: null,
          sceneRole: null,
        };
      }
    }
    // Clean up positions for peers that left
    const pids = new Set(peers.map((p) => p.pid));
    for (const pid of Object.keys(positionsRef.current)) {
      if (!pids.has(Number(pid))) delete positionsRef.current[pid];
    }
  }, [peers]);

  // Scene picker
  useEffect(() => {
    function scheduleScene() {
      const delay = 5000 + Math.random() * 3000;
      sceneTimerRef.current = setTimeout(() => {
        if (peers.length > 0 && !sceneRef.current) {
          const scene = pickScene(peers.length);
          if (scene) {
            startScene(scene);
          }
        }
        scheduleScene();
      }, delay);
    }
    scheduleScene();
    return () => {
      if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current);
    };
  }, [peers.length]);

  function startScene(sceneDef) {
    const idlePeers = peers.filter((p) => p.activity === "idle" || !p.activity);
    if (idlePeers.length < sceneDef.minPeers) return;

    sceneRef.current = {
      name: sceneDef.name,
      start: Date.now(),
      duration: sceneDef.duration,
      actors: idlePeers.slice(0, 2).map((p) => p.pid),
    };

    const pos = positionsRef.current;
    const [a, b] = sceneRef.current.actors;

    switch (sceneDef.name) {
      case "chat":
        if (pos[a] && pos[b]) {
          const midX = (pos[a].x + pos[b].x) / 2;
          pos[a].targetX = midX - 40;
          pos[b].targetX = midX + 40;
          pos[a].sceneRole = "chatA";
          pos[b].sceneRole = "chatB";
        }
        break;
      case "chase":
        if (pos[a] && pos[b]) {
          pos[a].sceneRole = "chaser";
          pos[b].sceneRole = "runner";
        }
        break;
      case "dance":
        for (const p of idlePeers) {
          if (pos[p.pid]) pos[p.pid].sceneRole = "dancer";
        }
        break;
      case "nap":
        if (pos[a]) {
          pos[a].sceneRole = "napper";
          if (pos[b]) pos[b].sceneRole = "bumper";
        }
        break;
      case "wave":
        if (pos[a]) {
          pos[a].sceneRole = "waver";
          pos[a].bubble = "hi!";
        }
        break;
    }
  }

  // Animation loop
  useEffect(() => {
    let running = true;

    function tick() {
      if (!running) return;
      tickRef.current++;
      const now = Date.now();
      const container = containerRef.current;
      if (!container) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const w = container.offsetWidth;
      const h = container.offsetHeight;

      // Check scene expiry
      if (
        sceneRef.current &&
        now - sceneRef.current.start > sceneRef.current.duration
      ) {
        // Reset scene roles
        for (const pid of Object.keys(positionsRef.current)) {
          const p = positionsRef.current[pid];
          p.sceneRole = null;
          p.overrideEyes = null;
          p.overrideMouth = null;
          p.bubble = null;
          // New random target
          p.targetX = 30 + Math.random() * (w - 60);
          p.targetY = 10 + Math.random() * (h - 40);
        }
        sceneRef.current = null;
      }

      // Update each peer position
      for (const pid of Object.keys(positionsRef.current)) {
        const p = positionsRef.current[pid];

        // Entry animation
        if (!p.entered) {
          if (now >= p.enterStart) {
            p.entered = true;
            p.y = h - 10;
            p.targetY = h * 0.3 + Math.random() * h * 0.4;
          } else {
            continue;
          }
        }

        // Random blink
        if (now > p.blinkUntil && Math.random() < 0.003) {
          p.blinkUntil = now + 200;
        }

        // Scene-specific behaviors
        const scene = sceneRef.current;
        if (scene && p.sceneRole) {
          const t = (now - scene.start) / scene.duration;

          switch (p.sceneRole) {
            case "chatA":
              p.overrideMouth = Math.sin(now / 200) > 0 ? "speak1" : "speak3";
              if (t > 0.7) {
                p.overrideMouth = "smile";
                p.overrideEyes = null;
              }
              break;
            case "chatB":
              p.overrideMouth = Math.sin(now / 200) < 0 ? "speak2" : "speak3";
              if (t > 0.7) {
                p.overrideMouth = "smile";
                p.overrideEyes = null;
              }
              break;
            case "chaser":
              {
                const runner = positionsRef.current[scene.actors[1]];
                if (runner) {
                  p.targetX = runner.x;
                  p.targetY = runner.y;
                }
                if (t > 0.8) p.overrideEyes = "dizzy";
              }
              break;
            case "runner":
              if (t < 0.3) p.targetX = w - 40;
              else if (t < 0.6) p.targetX = 40;
              else p.targetX = w / 2;
              break;
            case "dancer":
              p.targetY = h * 0.4 + Math.sin(now / 300 + Number(pid)) * 15;
              p.overrideMouth = "smile";
              break;
            case "napper":
              p.overrideEyes = t < 0.3 ? "squint" : "blink";
              p.overrideMouth = "neutral";
              p.bubble = t > 0.3 && t < 0.85 ? "z z z" : null;
              if (t > 0.85) {
                p.overrideEyes = "wide";
                p.bubble = "!";
              }
              break;
            case "bumper":
              if (t > 0.7 && t < 0.85) {
                const napper = positionsRef.current[scene.actors[0]];
                if (napper) p.targetX = napper.x + 15;
              }
              break;
            case "waver":
              p.overrideMouth = "smile";
              p.bubble = t < 0.8 ? "hi!" : null;
              break;
          }
        }

        // Lerp toward target
        p.x += (p.targetX - p.x) * 0.03;
        p.y += (p.targetY - p.y) * 0.03;

        // If close to target (and no scene), pick new target
        if (!p.sceneRole) {
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
            if (Math.random() < 0.005) {
              p.targetX = 30 + Math.random() * (w - 60);
              p.targetY = 10 + Math.random() * (h - 40);
            }
          }
        }

        // Clamp
        p.x = Math.max(10, Math.min(w - 70, p.x));
        p.y = Math.max(5, Math.min(h - 60, p.y));
      }

      // Re-render at ~15fps for DOM updates
      if (tickRef.current % 4 === 0) {
        forceRender((n) => n + 1);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [peers]);

  const containerStyle = compact
    ? { position: "relative", width: "100%", height: 80, overflow: "hidden" }
    : { position: "relative", width: "100%", flex: 1, overflow: "hidden" };

  return (
    <div ref={containerRef} style={containerStyle}>
      {peers.map((peer) => {
        const pos = positionsRef.current[peer.pid];
        if (!pos || !pos.entered) return null;

        const now = Date.now();
        const isBlinking = now < pos.blinkUntil;
        const eyeStyle =
          pos.overrideEyes || (isBlinking ? "blink" : peer.eyeStyle || "dot");
        const mouthStyle = pos.overrideMouth || peer.mouthStyle || "neutral";
        const lines = miniBlockyLines(eyeStyle, mouthStyle);
        const color = peer.skinColor || "#00ff88";

        // Activity label for busy peers
        const isBusy = peer.activity && peer.activity !== "idle";
        const activityLabel = isBusy ? peer.activity.toUpperCase() : null;

        // Project label
        const projectLabel = peer.projectName
          ? peer.projectName.length > 12
            ? peer.projectName.slice(0, 11) + "~"
            : peer.projectName
          : null;

        // Entry animation (fade + slide)
        const age = now - pos.enterStart;
        const enterProgress = Math.min(1, age / 1000);
        const opacity = enterProgress;
        const slideY = (1 - enterProgress) * 20;

        // Subtle float
        const floatY = Math.sin(now / 2000 + (peer.pid % 100)) * 3;

        return (
          <div
            key={peer.pid}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y + slideY + floatY,
              opacity,
              transition: "none",
              pointerEvents: "none",
            }}
          >
            {/* Bubble */}
            {pos.bubble && (
              <div
                style={{
                  position: "absolute",
                  top: -16,
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: 8,
                  color,
                  fontFamily: "'JetBrains Mono', monospace",
                  whiteSpace: "nowrap",
                  textShadow: `0 0 6px ${color}66`,
                }}
              >
                {pos.bubble}
              </div>
            )}
            {/* Face */}
            <pre
              style={{
                margin: 0,
                padding: 0,
                fontSize: 8,
                lineHeight: 1.2,
                color,
                fontFamily: "'JetBrains Mono', monospace",
                textShadow: `0 0 8px ${color}44`,
                userSelect: "none",
              }}
            >
              {lines.join("\n")}
            </pre>
            {/* Activity label */}
            {activityLabel && (
              <div
                style={{
                  textAlign: "center",
                  fontSize: 6,
                  letterSpacing: 1,
                  color: "#ffaa00",
                  fontFamily: "'JetBrains Mono', monospace",
                  marginTop: 1,
                }}
              >
                {activityLabel}
              </div>
            )}
            {/* Project label */}
            {projectLabel && !activityLabel && (
              <div
                style={{
                  textAlign: "center",
                  fontSize: 6,
                  letterSpacing: 0.5,
                  color: `${color}88`,
                  fontFamily: "'JetBrains Mono', monospace",
                  marginTop: 1,
                }}
              >
                {projectLabel}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
