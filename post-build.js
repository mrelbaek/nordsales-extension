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

// Copy and fix popup HTML file
try {
  const srcPopupHtmlPath = path.join(__dirname, 'src', 'pages', 'popup', 'index.html');
  const distPopupHtmlPath = path.join(__dirname, 'dist', 'popup.html');
  
  // Read the source HTML
  let popupHtml = fs.readFileSync(srcPopupHtmlPath, 'utf8');
  
  // Add CSS link if it doesn't exist
  if (!popupHtml.includes('<link rel="stylesheet" href="popup.css">')) {
    popupHtml = popupHtml.replace('</head>', '  <link rel="stylesheet" href="popup.css">\n</head>');
  }
  
  // Fix script path if needed
  popupHtml = popupHtml.replace('src="./main.jsx"', 'src="popup.js"');
  
  // Write to the dist folder
  fs.writeFileSync(distPopupHtmlPath, popupHtml);
  console.log('Created popup.html in dist folder with CSS link');
} catch (error) {
  console.error('Error copying popup.html:', error);
}

// Copy popup CSS file
try {
  const srcPopupCssPath = path.join(__dirname, 'src', 'pages', 'popup', 'popup.css');
  const distPopupCssPath = path.join(__dirname, 'dist', 'popup.css');
  
  if (fs.existsSync(srcPopupCssPath)) {
    fs.copyFileSync(srcPopupCssPath, distPopupCssPath);
    console.log('Copied popup.css to dist folder');
  } else {
    console.warn('Warning: popup.css not found in src/pages/popup folder');
  }
} catch (error) {
  console.error('Error copying popup.css:', error);
}

// Create options.html in the dist folder
try {
  const srcOptionsHtmlPath = path.join(__dirname, 'src', 'pages', 'options', 'index.html');
  const distOptionsHtmlPath = path.join(__dirname, 'dist', 'options.html');
  
  // Check if source options file exists
  if (fs.existsSync(srcOptionsHtmlPath)) {
    // Copy existing options page
    let optionsHtml = fs.readFileSync(srcOptionsHtmlPath, 'utf8');
    
    // Fix script path if needed
    optionsHtml = optionsHtml.replace('src="./main.jsx"', 'src="options.js"');
    
    fs.writeFileSync(distOptionsHtmlPath, optionsHtml);
    console.log('Copied options.html to dist folder');
  } else {
    // Create a simple options page
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

    fs.writeFileSync(distOptionsHtmlPath, optionsHtml);
    console.log('Created options.html in dist folder');
  }
} catch (error) {
  console.error('Error creating options.html:', error);
}

// Copy extension icons from public folder
try {
  const iconSizes = ['16', '48', '128'];
  const publicDir = path.join(__dirname, 'public');
  
  for (const size of iconSizes) {
    const srcIconPath = path.join(publicDir, `icon${size}.png`);
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

// Create assets directory in dist and copy activity icons
try {
  const assetsDir = path.join(__dirname, 'dist', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  
  const activityIcons = [
    'calendar-dots.png', 
    'check-square.png', 
    'envelope-simple.png',
    'note-pencil.png', 
    'phone.png'
  ];
  
  const srcAssetsDir = path.join(__dirname, 'src', 'assets');
  
  if (fs.existsSync(srcAssetsDir)) {
    activityIcons.forEach(icon => {
      const srcPath = path.join(srcAssetsDir, icon);
      const distPath = path.join(assetsDir, icon);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, distPath);
        console.log(`Copied asset: ${icon}`);
      } else {
        console.warn(`Warning: Asset ${icon} not found in src/assets folder`);
      }
    });
  } else {
    console.warn('Warning: src/assets directory not found');
  }
  
  console.log('All assets copied successfully');
} catch (error) {
  console.error('Error copying assets:', error);
}

// Update the manifest in dist folder to include content scripts
const distManifestPath = path.join(__dirname, 'dist', 'manifest.json');
if (fs.existsSync(distManifestPath)) {
  const originalManifestPath = path.join(__dirname, 'manifest.json');
  const originalManifest = JSON.parse(fs.readFileSync(originalManifestPath, 'utf8'));
  
  const distManifest = JSON.parse(fs.readFileSync(distManifestPath, 'utf8'));
  distManifest.content_scripts = originalManifest.content_scripts;
  
  fs.writeFileSync(distManifestPath, JSON.stringify(distManifest, null, 2));
  console.log('Updated dist manifest with content scripts');
} else {
  console.error('Dist manifest not found');
}

// Clean up the temporary build manifest
const buildManifestPath = path.join(__dirname, 'build-manifest.json');
if (fs.existsSync(buildManifestPath)) {
  fs.unlinkSync(buildManifestPath);
  console.log('Removed temporary build manifest');
}

console.log('Post-build process completed');