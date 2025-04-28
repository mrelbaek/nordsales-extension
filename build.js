const fs = require('fs');
const path = require('path');

const target = process.argv[2]; // 'chrome' or 'edge'

// Validate input
if (!["chrome", "edge"].includes(target)) {
  console.error("❌ Error: Please specify 'chrome' or 'edge' as the build target.");
  process.exit(1);
}

const distDir = path.join(__dirname, 'dist');
const srcDir = path.join(__dirname, 'src');
const manifestSource = path.join(__dirname, 'manifest', `manifest.${target}.json`);
const manifestDestination = path.join(distDir, 'manifest.json');

// Clean and recreate dist/ folder
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Copy all source files
fs.cpSync(srcDir, distDir, { recursive: true });

// Copy the correct manifest
fs.copyFileSync(manifestSource, manifestDestination);

console.log(`✅ Build complete for ${target}. Output in /dist`);
