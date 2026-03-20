import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("blockyAPI", {
  // PTY
  startPty: (projectDir) => ipcRenderer.send("pty:start", projectDir),
  sendPtyInput: (data) => ipcRenderer.send("pty:input", data),
  resizePty: (cols, rows) => ipcRenderer.send("pty:resize", { cols, rows }),
  killPty: () => ipcRenderer.send("pty:kill"),
  onPtyData: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("pty:data", handler);
    return () => ipcRenderer.removeListener("pty:data", handler);
  },
  onPtyExit: (callback) => {
    const handler = (_event, code) => callback(code);
    ipcRenderer.on("pty:exit", handler);
    return () => ipcRenderer.removeListener("pty:exit", handler);
  },

  // Hook activity
  onHookActivity: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("hook:activity", handler);
    return () => ipcRenderer.removeListener("hook:activity", handler);
  },

  // TTS (Piper)
  checkTtsReady: () => ipcRenderer.invoke("tts:check-ready"),
  downloadTts: () => ipcRenderer.invoke("tts:download"),
  synthesize: (text) => ipcRenderer.invoke("tts:synthesize", text),
  onTtsDownloadProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("tts:download-progress", handler);
    return () => ipcRenderer.removeListener("tts:download-progress", handler);
  },

  // STT (Whisper)
  checkSttReady: () => ipcRenderer.invoke("stt:check-ready"),
  downloadStt: () => ipcRenderer.invoke("stt:download"),
  transcribe: (wavArrayBuffer) =>
    ipcRenderer.invoke("stt:transcribe", wavArrayBuffer),
  onSttDownloadProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("stt:download-progress", handler);
    return () => ipcRenderer.removeListener("stt:download-progress", handler);
  },

  // Peers
  updatePeerState: (state) => ipcRenderer.send("peer:state", state),
  onPeersUpdate: (callback) => {
    const handler = (_event, peers) => callback(peers);
    ipcRenderer.on("peers:update", handler);
    return () => ipcRenderer.removeListener("peers:update", handler);
  },

  // App
  isFirstRun: () => ipcRenderer.invoke("app:isFirstRun"),
  completeSetup: () => ipcRenderer.invoke("app:completeSetup"),
  exportTranscript: (markdown) =>
    ipcRenderer.invoke("app:exportTranscript", markdown),

  // Dialog
  selectDirectory: () => ipcRenderer.invoke("dialog:selectDirectory"),

  // Projects
  getRecentProjects: () => ipcRenderer.invoke("getRecentProjects"),
});
