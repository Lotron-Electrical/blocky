import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: {
      outDir: "dist-electron/main",
      rollupOptions: {
        external: ["electron", "@lydell/node-pty"],
      },
    },
  },
  preload: {
    build: {
      outDir: "dist-electron/preload",
    },
  },
  renderer: {
    root: "src/renderer",
    build: {
      outDir: "dist-electron/renderer",
    },
    plugins: [react()],
  },
});
