import { useState, useEffect } from "react";

export default function ProjectPicker({ onSelect }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!window.blockyAPI) return;
    window.blockyAPI.getRecentProjects().then((dirs) => {
      setProjects(dirs);
      setLoading(false);
    });
  }, []);

  const handleBrowse = async () => {
    const dir = await window.blockyAPI.selectDirectory();
    if (dir) onSelect(dir);
  };

  const handleHome = () => {
    onSelect(null); // null = home directory
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
        gap: 20,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: 3,
          color: "#2a4a3a",
          fontWeight: 600,
        }}
      >
        SELECT PROJECT
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 400,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center", color: "#2a4a3a", fontSize: 11 }}>
            Loading...
          </div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: "center", color: "#2a4a3a", fontSize: 11 }}>
            No recent projects found
          </div>
        ) : (
          projects.map((dir) => (
            <button
              key={dir}
              onClick={() => onSelect(dir)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 6,
                border: "1px solid #12251c",
                background: "#0a100e",
                color: "#90b8a4",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 11,
                textAlign: "left",
                transition: "all 0.15s",
                width: "100%",
              }}
            >
              <span style={{ color: "#2a4a3a" }}>{">"}</span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {dir.replace(/\\/g, "/").replace(/.*\//, "") || dir}
              </span>
              <span
                style={{
                  fontSize: 9,
                  color: "#1e3a2a",
                  marginLeft: "auto",
                  flexShrink: 0,
                }}
              >
                {dir.replace(/\\/g, "/")}
              </span>
            </button>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button
          onClick={handleBrowse}
          style={{
            padding: "10px 20px",
            borderRadius: 6,
            border: "1px solid #00ff8833",
            background: "#00ff880d",
            color: "#00ff88",
            cursor: "pointer",
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 2,
          }}
        >
          BROWSE...
        </button>
        <button
          onClick={handleHome}
          style={{
            padding: "10px 20px",
            borderRadius: 6,
            border: "1px solid #12251c",
            background: "#0a100e",
            color: "#2a4a3a",
            cursor: "pointer",
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 2,
          }}
        >
          HOME DIR
        </button>
      </div>
    </div>
  );
}
