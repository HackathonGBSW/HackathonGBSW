import type { IncomingMessage } from "node:http";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Several proxied API paths (/signup, /my, /profile, /portfolio, /battle) share
// a name with a client-side React Router route. A plain string proxy target
// would intercept a hard reload/direct URL at those paths and forward it to
// the (often absent, in dev) backend instead of serving the SPA. Only proxy
// actual API calls (fetch(), which sends Accept: */* by default) and let full
// page navigations (Accept: text/html) fall through to Vite's own handling.
function bypassPageNavigation(req: IncomingMessage) {
  if (req.headers.accept?.includes("text/html")) return req.url;
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/signup": { target: "http://localhost:5000", bypass: bypassPageNavigation },
      "/signin": { target: "http://localhost:5000", bypass: bypassPageNavigation },
      "/signout": { target: "http://localhost:5000", bypass: bypassPageNavigation },
      "/my": { target: "http://localhost:5000", bypass: bypassPageNavigation },
      "/profile": { target: "http://localhost:5000", bypass: bypassPageNavigation },
      "/portfolio": { target: "http://localhost:5000", bypass: bypassPageNavigation },
      "/battle": { target: "http://localhost:5000", bypass: bypassPageNavigation },
    },
  },
});
