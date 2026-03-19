import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("blockyAPI", {
  sendMessage: (text) => ipcRenderer.send("claude:send", text),
  interrupt: () => ipcRenderer.send("claude:interrupt"),
  setProjectDir: (path) => ipcRenderer.send("claude:setProjectDir", path),
  selectDirectory: () => ipcRenderer.invoke("dialog:selectDirectory"),
  onStreamEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("claude:event", handler);
    return () => ipcRenderer.removeListener("claude:event", handler);
  },
});
