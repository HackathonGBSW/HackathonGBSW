import type { IncomingMessage } from "node:http";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Several proxied API paths share a name with client-side React Router routes.
// Only proxy actual API calls (fetch Accept: */*) and let full page navigations
// (Accept: text/html) fall through to Vite's SPA handling.
function bypassPageNavigation(req: IncomingMessage) {
  if (req.headers.accept?.includes("text/html")) return req.url;
}

const backend = "http://localhost:5001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/signup": { target: backend, bypass: bypassPageNavigation },
      "/signin": { target: backend, bypass: bypassPageNavigation },
      "/signout": { target: backend, changeOrigin: true },
      "/my": { target: backend, changeOrigin: true },
      "/profile": { target: backend, bypass: bypassPageNavigation },
      "/portfolios": { target: backend, changeOrigin: true },
      "/battles": { target: backend, changeOrigin: true },
      "/leaderboard": { target: backend, changeOrigin: true },
    },
  },
});
