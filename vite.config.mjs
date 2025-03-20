import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import fs from "fs";

const manifest = JSON.parse(fs.readFileSync(new URL("./manifest.json", import.meta.url), "utf-8"));

export default defineConfig({
  plugins: [
    react(),
    crx({
      manifest,
      contentAssets: ["src/assets/**/*", "src/service-worker.js"]
    })
  ],
  server: {
    headers: {
      "Access-Control-Allow-Origin": "chrome-extension://neknkeieigbdolchlfadblpnilnjoghg"
    },
    cors: true
  }
});