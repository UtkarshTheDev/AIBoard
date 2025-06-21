const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Create bin directory if it doesn't exist
const binDir = path.join(process.cwd(), 'bin');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir);
}

// Determine platform and architecture
const platform = process.platform;
const arch = process.arch;

console.log(`Detected platform: ${platform}, architecture: ${arch}`);

// Define Stockfish download URLs
const stockfishUrls = {
  win32: {
    x64: 'https://stockfishchess.org/files/stockfish-windows-x86-64-avx2.zip',
    ia32: 'https://stockfishchess.org/files/stockfish-windows-x86-64-avx2.zip',
  },
  darwin: {
    x64: 'https://stockfishchess.org/files/stockfish-macos-x86-64-modern.zip',
    arm64: 'https://stockfishchess.org/files/stockfish-macos-arm64.zip',
  },
  linux: {
    x64: 'https://stockfishchess.org/files/stockfish-ubuntu-x86-64-avx2.zip',
    arm64: 'https://stockfishchess.org/files/stockfish-ubuntu-arm64.zip',
  },
};

// Get download URL for current platform
const platformUrls = stockfishUrls[platform];
if (!platformUrls) {
  console.error(`Unsupported platform: ${platform}`);
  process.exit(1);
}

const downloadUrl = platformUrls[arch];
if (!downloadUrl) {
  console.error(`Unsupported architecture: ${arch} for platform: ${platform}`);
  process.exit(1);
}

console.log(`Downloading Stockfish from: ${downloadUrl}`);

// Download and extract Stockfish
const zipFilePath = path.join(binDir, 'stockfish.zip');
const file = fs.createWriteStream(zipFilePath);

https.get(downloadUrl, (response) => {
  response.pipe(file);

  file.on('finish', () => {
    file.close();
    console.log('Download completed. Extracting...');

    try {
      // Extract the ZIP file
      if (platform === 'win32') {
        // On Windows, use PowerShell to extract
        execSync(`powershell -command "Expand-Archive -Path '${zipFilePath}' -DestinationPath '${binDir}' -Force"`, { stdio: 'inherit' });
      } else {
        // On Unix-like systems, use unzip
        execSync(`unzip -o "${zipFilePath}" -d "${binDir}"`, { stdio: 'inherit' });
      }

      console.log('Extraction completed.');

      // Find and rename the Stockfish executable
      let stockfishExe;
      const files = fs.readdirSync(binDir, { recursive: true });
      
      for (const file of files) {
        const filePath = path.join(binDir, file);
        if (file.toLowerCase().includes('stockfish') && 
            !file.endsWith('.zip') && 
            fs.statSync(filePath).isFile()) {
          stockfishExe = filePath;
          break;
        }
      }

      if (!stockfishExe) {
        console.error('Could not find Stockfish executable in the extracted files.');
        process.exit(1);
      }

      // Rename and make executable
      const targetPath = path.join(binDir, platform === 'win32' ? 'stockfish.exe' : 'stockfish');
      fs.copyFileSync(stockfishExe, targetPath);
      
      if (platform !== 'win32') {
        fs.chmodSync(targetPath, 0o755); // Make executable on Unix-like systems
      }

      console.log(`Stockfish executable is now available at: ${targetPath}`);
      
      // Clean up
      fs.unlinkSync(zipFilePath);
      console.log('Cleanup completed.');
      
    } catch (error) {
      console.error('Error during extraction:', error);
      process.exit(1);
    }
  });
}).on('error', (err) => {
  fs.unlinkSync(zipFilePath);
  console.error('Error during download:', err);
  process.exit(1);
}); 