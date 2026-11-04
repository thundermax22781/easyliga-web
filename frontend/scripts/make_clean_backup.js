const fs = require('fs');
const path = require('path');

const sourceDir = path.resolve(__dirname, '..');
const backupDir = path.resolve(sourceDir, 'backups', 'Backup Stabile 2026-11-04');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      // Skip node_modules, .expo, .git, android/build, backups folder itself
      if (['node_modules', '.expo', '.git', '.metro-cache', 'backups'].includes(childItemName)) {
        return;
      }
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log("Creating backup at:", backupDir);
copyRecursiveSync(sourceDir, backupDir);
console.log("Backup Stabile 2026-11-04 created successfully!");
