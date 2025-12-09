/**
 * Copy built card to integration www folder
 * Cross-platform (works on Windows, Linux, Mac)
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'dist', 'meteoswiss-radar-card.js');
const TARGET_DIR = path.join(__dirname, '..', 'custom_components', 'meteoswiss_precipitation', 'www');
const TARGET = path.join(TARGET_DIR, 'meteoswiss-radar-card.js');

// Create target directory if it doesn't exist
if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
    console.log(`Created directory: ${TARGET_DIR}`);
}

// Copy file
try {
    fs.copyFileSync(SOURCE, TARGET);
    console.log(`✓ Copied card to integration: ${TARGET}`);

    // Show file size
    const stats = fs.statSync(TARGET);
    const sizeKB = Math.round(stats.size / 1024);
    console.log(`  File size: ${sizeKB} KB`);
} catch (err) {
    console.error(`✗ Failed to copy card: ${err.message}`);
    process.exit(1);
}
