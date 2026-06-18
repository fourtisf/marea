import { defineConfig } from "vite";

// The client talks to the Colyseus server at VITE_SERVER_URL (default ws://localhost:2567).
export default defineConfig({
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
