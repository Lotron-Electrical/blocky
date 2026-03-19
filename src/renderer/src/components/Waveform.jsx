import { useState, useEffect, useRef } from "react";

const WV = ["▁", "▂", "▃", "▅", "▆", "▇", "█"];

export default function Waveform({ active, color, n = 22 }) {
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
