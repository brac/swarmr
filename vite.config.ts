import { defineConfig } from "vite";

// GitHub Pages serves this project repo under /swarmr/, so production assets need
// that base. Dev/preview stay at root for convenience.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/swarmr/" : "/",
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: "es2022",
  },
}));
