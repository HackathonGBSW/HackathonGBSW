import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/signup": "http://localhost:5000",
      "/signin": "http://localhost:5000",
      "/signout": "http://localhost:5000",
      "/my": "http://localhost:5000",
      "/profile": "http://localhost:5000",
      "/portfolio": "http://localhost:5000",
      "/battle": "http://localhost:5000",
    },
  },
});
