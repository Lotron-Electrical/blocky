import { useState, useEffect } from "react";

export default function AudioDevicePicker({ micDeviceId, onMicChange }) {
  const [devices, setDevices] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // Request mic permission first (needed to see device labels)
        await navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((s) => s.getTracks().forEach((t) => t.stop()));
        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices(all.filter((d) => d.kind === "audioinput"));
      } catch {
        setDevices([]);
      }
    }
    if (expanded) load();
  }, [expanded]);

  return (
    <div style={{ width: "100%", maxWidth: 400, marginTop: 4 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 0",
          background: "none",
          border: "none",
          color: "#2a4a3a",
          cursor: "pointer",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 8,
          letterSpacing: 1,
        }}
      >
        {expanded ? "v" : ">"} MICROPHONE
        {micDeviceId && (
          <span style={{ color: "#00ff8866", fontSize: 7 }}>(custom)</span>
        )}
      </button>

      {expanded && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            padding: "4px 0 4px 12px",
          }}
        >
          <button
            onClick={() => onMicChange(null)}
            style={{
              textAlign: "left",
              padding: "5px 10px",
              borderRadius: 4,
              border: `1px solid ${!micDeviceId ? "#00ff8833" : "#12251c"}`,
              background: !micDeviceId ? "#00ff880d" : "#0a100e",
              color: !micDeviceId ? "#00ff88" : "#4a6a5a",
              cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
            }}
          >
            System Default
          </button>
          {devices.map((d) => (
            <button
              key={d.deviceId}
              onClick={() => onMicChange(d.deviceId)}
              style={{
                textAlign: "left",
                padding: "5px 10px",
                borderRadius: 4,
                border: `1px solid ${micDeviceId === d.deviceId ? "#00ff8833" : "#12251c"}`,
                background:
                  micDeviceId === d.deviceId ? "#00ff880d" : "#0a100e",
                color: micDeviceId === d.deviceId ? "#00ff88" : "#4a6a5a",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
            </button>
          ))}
          {devices.length === 0 && (
            <span
              style={{
                color: "#2a4a3a",
                fontSize: 8,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              No microphones detected
            </span>
          )}
        </div>
      )}
    </div>
  );
}
