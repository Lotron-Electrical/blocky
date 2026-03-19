import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export default function Terminal({ onReady }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: "bar",
      theme: {
        background: "#080c0a",
        foreground: "#c0c8c4",
        cursor: "#00ff88",
        cursorAccent: "#080c0a",
        selectionBackground: "#2a4a3a88",
        black: "#080c0a",
        red: "#ff4444",
        green: "#00ff88",
        yellow: "#ffaa00",
        blue: "#5588ff",
        magenta: "#bb88ff",
        cyan: "#00ddff",
        white: "#c0c8c4",
        brightBlack: "#2a4a3a",
        brightRed: "#ff6666",
        brightGreen: "#44ffaa",
        brightYellow: "#ffcc44",
        brightBlue: "#77aaff",
        brightMagenta: "#dd99ff",
        brightCyan: "#44eeff",
        brightWhite: "#eeeeff",
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    // Connect PTY data → terminal
    const unsubData = window.blockyAPI.onPtyData((data) => {
      term.write(data);
    });

    // Connect terminal input → PTY
    const disposeInput = term.onData((data) => {
      window.blockyAPI.sendPtyInput(data);
    });

    // Resize handling
    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        const dims = fit.proposeDimensions();
        if (dims) {
          window.blockyAPI.resizePty(dims.cols, dims.rows);
        }
      } catch {
        // ignore fit errors during transitions
      }
    });
    ro.observe(containerRef.current);

    if (onReady) onReady();

    return () => {
      ro.disconnect();
      disposeInput.dispose();
      unsubData();
      term.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        padding: "4px 8px",
        background: "#080c0a",
        overflow: "hidden",
      }}
    />
  );
}
