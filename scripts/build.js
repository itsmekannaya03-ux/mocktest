const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[Build] Step 1: Building Vite client...');
execSync('npm --prefix client run build', { stdio: 'inherit' });

const clientDist = path.resolve(__dirname, '../client/dist');
const rootDist = path.resolve(__dirname, '../dist');

console.log(`[Build] Step 2: Preparing root distribution directory...`);
if (!fs.existsSync(rootDist)) {
  fs.mkdirSync(rootDist, { recursive: true });
}

if (fs.existsSync(clientDist)) {
  fs.cpSync(clientDist, rootDist, { recursive: true });
  console.log(`[Build] Successfully copied assets to ${rootDist}`);
} else {
  console.error('[Build Error] client/dist was not found!');
  process.exit(1);
}

console.log('✓ Build complete: Both root ./dist and ./client/dist are ready.');

