import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: true, // Listen on all local IP addresses (0.0.0.0) for local network & port-forwarding tunnels
    port: 5173,
    allowedHosts: true, // Allow all tunnel hosts (localtunnel, ngrok, cloudflared, LAN IP)
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "http://127.0.0.1:5000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
