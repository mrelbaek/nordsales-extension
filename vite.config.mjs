import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a manifest for build without content scripts
// This will be created by the create-build-manifest.js script
const manifestPath = path.resolve(__dirname, "build-manifest.json");
let manifest;

try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
} catch (error) {
  console.error("Unable to read build-manifest.json. Run create-build-manifest.js first!");
  // Use the original manifest as a fallback, but this might cause build errors
  const originalManifestPath = path.resolve(__dirname, "manifest.json");
  manifest = JSON.parse(fs.readFileSync(originalManifestPath, "utf-8"));
}

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        // Just build the main React component
        popup: path.resolve(__dirname, "src/pages/popup/main.jsx"),
        contentScript: path.resolve(__dirname, "src/contentScript.js")
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  server: {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    cors: true,
  },
});