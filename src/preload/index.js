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

  // Dialog
  selectDirectory: () => ipcRenderer.invoke("dialog:selectDirectory"),

  // Projects
  getRecentProjects: () => ipcRenderer.invoke("getRecentProjects"),
});
