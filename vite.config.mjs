import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import fs from "fs";

const manifest = JSON.parse(fs.readFileSync(new URL("./manifest.json", import.meta.url), "utf-8"));

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest })
  ],
  build: {
    rollupOptions: {
      input: {
        popup: "src/pages/popup/main.jsx" // ✅ Do NOT include service-worker.js here!
      },
      output: {
        manualChunks(id) {
          if (id.includes("service-worker.js")) {
            return false; // ✅ Prevents bundling of the service worker
          }
        }
      }
    }
  }
});
