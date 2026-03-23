import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            width: "100%",
            height: "100vh",
            background: "#080c0a",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            fontFamily: "'JetBrains Mono', monospace",
            color: "#c0c8c4",
          }}
        >
          <pre
            style={{
              fontSize: 14,
              lineHeight: 1.28,
              color: "#ff4444",
              textShadow: "0 0 10px #ff444455",
              textAlign: "center",
              userSelect: "none",
            }}
          >
            {[
              "  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557  ",
              "  \u2551                        \u2551  ",
              "  \u2551    \u250c\u2500\u2500\u2510      \u250c\u2500\u2500\u2510    \u2551  ",
              "  \u2551    \u2502 \u00d7\u2502      \u2502\u00d7 \u2502    \u2551  ",
              "  \u2551    \u2514\u2500\u2500\u2518      \u2514\u2500\u2500\u2518    \u2551  ",
              "  \u2551                        \u2551  ",
              "  \u2551      \u256d\u2500\u2500\u2500\u2500\u2500\u2500\u256e      \u2551  ",
              "  \u2551      \u2502 \u2581\u2581\u2581\u2581 \u2502      \u2551  ",
              "  \u2551      \u2570\u2500\u2500\u2500\u2500\u2500\u2500\u256f      \u2551  ",
              "  \u2551                        \u2551  ",
              "  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d  ",
            ].join("\n")}
          </pre>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 4,
              color: "#ff4444",
            }}
          >
            SOMETHING BROKE
          </div>
          <div
            style={{
              fontSize: 10,
              color: "#4a6a5a",
              maxWidth: 400,
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            {this.state.error?.message || "Unknown error"}
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
            }}
            style={{
              padding: "10px 24px",
              borderRadius: 6,
              border: "1px solid #ff444433",
              background: "#ff44440d",
              color: "#ff4444",
              cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 2,
              marginTop: 8,
            }}
          >
            TRY AGAIN
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
