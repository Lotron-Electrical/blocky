import { useState, useEffect } from "react";

export default function ErrorBanner({ error, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (error) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [error, onDismiss]);

  if (!error) return null;

  return (
    <div
      style={{
        padding: "6px 14px",
        background: "#1a0a0a",
        borderBottom: "1px solid #3a1515",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 9,
        fontFamily: "'JetBrains Mono', monospace",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s",
      }}
    >
      <span style={{ color: "#ff4444" }}>{error}</span>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(onDismiss, 300);
        }}
        style={{
          background: "none",
          border: "none",
          color: "#ff444488",
          cursor: "pointer",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          padding: "0 4px",
        }}
      >
        x
      </button>
    </div>
  );
}
