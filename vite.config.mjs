import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifest = JSON.parse(fs.readFileSync(new URL("./manifest.json", import.meta.url), "utf-8"));

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src") // This will now work correctly
    }
  },
  build: {
    rollupOptions: {
      input: {
        popup: "src/pages/popup/main.jsx",
        "service-worker": "service-worker.js"
      },
      output: {
        dir: "dist",
        entryFileNames: "[name].js"
      }
    }
  },
  server: {
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    cors: true
  }
});
