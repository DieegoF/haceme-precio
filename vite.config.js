import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Versión = commit que armó Railway (se ve en /estado).
  define: { __APP_COMMIT__: JSON.stringify((process.env.RAILWAY_GIT_COMMIT_SHA || "local").slice(0, 7)) },
  server: { host: true, port: 5173 },
  build: { outDir: "dist", sourcemap: true },
});
