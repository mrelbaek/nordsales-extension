import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a manifest for development without content scripts
const originalManifest = JSON.parse(fs.readFileSync("manifest.json", "utf-8"));
const devManifest = { ...originalManifest };

// Remove content scripts for development mode
delete devManifest.content_scripts;

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest: devManifest }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    cors: true,
  },
});