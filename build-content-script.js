import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths
const srcPath = path.join(__dirname, 'src', 'contentScript.js');
const distPath = path.join(__dirname, 'dist', 'contentScript.js');

// Make sure the dist directory exists
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
  fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
}

// Copy the content script to the dist folder
try {
  fs.copyFileSync(srcPath, distPath);
  console.log('Content script copied to dist folder successfully');
} catch (error) {
  console.error('Error copying content script:', error);
  process.exit(1);
}