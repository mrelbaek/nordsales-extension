import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the original manifest
const manifestPath = path.join(__dirname, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Create a build manifest with minimal entries to avoid Vite trying to resolve files
const buildManifest = { 
  manifest_version: manifest.manifest_version,
  name: manifest.name,
  version: manifest.version,
  description: manifest.description,
  icons: manifest.icons,
  // Remove action, options_page, content_scripts to avoid Vite errors
  background: {
    service_worker: manifest.background.service_worker,
    type: manifest.background.type
  },
  permissions: manifest.permissions,
  host_permissions: manifest.host_permissions
};

// Write the temporary build manifest
const buildManifestPath = path.join(__dirname, 'build-manifest.json');
fs.writeFileSync(buildManifestPath, JSON.stringify(buildManifest, null, 2));

console.log('Created minimal build manifest for Vite');