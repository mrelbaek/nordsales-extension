import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Running post-build script...");

// Ensure dist directory exists
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
  fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
}

// Copy the content script
try {
  const srcContentScriptPath = path.join(__dirname, 'src', 'contentScript.js');
  const distContentScriptPath = path.join(__dirname, 'dist', 'contentScript.js');
  fs.copyFileSync(srcContentScriptPath, distContentScriptPath);
  console.log('Content script copied to dist folder');
} catch (error) {
  console.error('Error copying content script:', error);
}

// Copy service-worker.js
try {
  const serviceWorkerPath = path.join(__dirname, 'service-worker.js');
  const distServiceWorkerPath = path.join(__dirname, 'dist', 'service-worker.js');
  fs.copyFileSync(serviceWorkerPath, distServiceWorkerPath);
  console.log('Service worker copied to dist folder');
} catch (error) {
  console.error('Error copying service worker:', error);
}

// Copy popup files
try {
  // First, copy the existing index.html from popup folder
  const srcPopupHtmlPath = path.join(__dirname, 'src', 'pages', 'popup', 'index.html');
  const distPopupHtmlPath = path.join(__dirname, 'dist', 'popup.html');
  
  // Read the original HTML
  let popupHtml = fs.readFileSync(srcPopupHtmlPath, 'utf8');
  
  // Adjust any relative paths if needed
  popupHtml = popupHtml.replace('./main.jsx', './popup.js');
  
  // Write to the dist folder
  fs.writeFileSync(distPopupHtmlPath, popupHtml);
  console.log('Created popup.html in dist folder');
  
  // Check if we need to copy JS/CSS files from the build output
  const srcPopupJsDir = path.join(__dirname, 'dist', 'src', 'pages', 'popup');
  if (fs.existsSync(srcPopupJsDir)) {
    // Copy JS files as needed (Vite may have already built these)
    const files = fs.readdirSync(srcPopupJsDir);
    for (const file of files) {
      if (file.endsWith('.js') || file.endsWith('.css')) {
        fs.copyFileSync(
          path.join(srcPopupJsDir, file), 
          path.join(__dirname, 'dist', file)
        );
        console.log(`Copied ${file} to dist root`);
      }
    }
  }
} catch (error) {
  console.error('Error creating popup.html:', error);
}

// Create options.html in the dist folder
try {
  const optionsHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NordSales Extension Options</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      color: #333;
    }
    h1 {
      color: #0078d4;
    }
    .option-container {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    button {
      background-color: #0078d4;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    button:hover {
      background-color: #106ebe;
    }
  </style>
</head>
<body>
  <h1>NordSales Extension Options</h1>
  <p>Configure your extension settings here. Options will be available in future versions.</p>
  
  <!-- Placeholder for future options -->
  <div class="option-container">
    <p>No configuration options are currently available.</p>
  </div>
  
  <script>
    // Placeholder for future options script
    document.addEventListener('DOMContentLoaded', () => {
      console.log('Options page loaded');
    });
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(__dirname, 'dist', 'options.html'), optionsHtml);
  console.log('Created options.html in dist folder');
} catch (error) {
  console.error('Error creating options.html:', error);
}

// Copy icon files
try {
  const iconSizes = ['16', '48', '128'];
  const iconDir = path.join(__dirname, 'public');
  
  for (const size of iconSizes) {
    const srcIconPath = path.join(iconDir, `icon${size}.png`);
    const distIconPath = path.join(__dirname, 'dist', `icon${size}.png`);
    
    if (fs.existsSync(srcIconPath)) {
      fs.copyFileSync(srcIconPath, distIconPath);
      console.log(`Copied icon${size}.png to dist folder`);
    } else {
      console.warn(`Warning: icon${size}.png not found in public folder`);
    }
  }
} catch (error) {
  console.error('Error copying icon files:', error);
}

// Restore full manifest with all entries
try {
  const originalManifestPath = path.join(__dirname, 'manifest.json');
  const originalManifest = JSON.parse(fs.readFileSync(originalManifestPath, 'utf8'));
  
  // Write the full manifest to the dist folder
  fs.writeFileSync(
    path.join(__dirname, 'dist', 'manifest.json'), 
    JSON.stringify(originalManifest, null, 2)
  );
  console.log('Created complete manifest.json in dist folder');
} catch (error) {
  console.error('Error creating manifest.json:', error);
}

// Clean up the temporary build manifest
const buildManifestPath = path.join(__dirname, 'build-manifest.json');
if (fs.existsSync(buildManifestPath)) {
  fs.unlinkSync(buildManifestPath);
  console.log('Removed temporary build manifest');
}

console.log('Post-build process completed');