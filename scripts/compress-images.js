const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const UPLOAD_DIR = path.join(
    __dirname,
    '..',
    'public',
    'image',
    'uploads'
);
const MAX_SIZE_KB = 100;
const MAX_WIDTH = 1200;

const SUPPORTED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];

async function compressImage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXT.includes(ext)) return;

    const stat = fs.statSync(filePath);
    const originalSizeKB = stat.size / 1024;

    if (originalSizeKB <= MAX_SIZE_KB) {
        console.log(`✓ Skip: ${path.basename(filePath)} (${Math.round(originalSizeKB)} KB)`);
        return;
    }

    const tempPath = filePath + '.tmp';

    let quality = 80;
    let outputBuffer;

    while (quality >= 30) {
        outputBuffer = await sharp(filePath)
            .rotate()
            .resize({ width: MAX_WIDTH, withoutEnlargement: true })
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();

        if (outputBuffer.length / 1024 <= MAX_SIZE_KB) break;
        quality -= 5;
    }

    // tulis ke file sementara dulu
    await fs.promises.writeFile(tempPath, outputBuffer);

    // replace file lama
    await fs.promises.rename(tempPath, filePath);

    console.log(
        `🗜️ ${path.basename(filePath)} | ` +
        `${Math.round(originalSizeKB)} KB → ${Math.round(outputBuffer.length / 1024)} KB`
    );
}

async function walk(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            await walk(fullPath);
        } else {
            await compressImage(fullPath);
        }
    }
}

(async () => {
    console.log('🚀 Mulai kompresi gambar...');
    console.log('📁 Folder:', UPLOAD_DIR);

    if (!fs.existsSync(UPLOAD_DIR)) {
        console.error('❌ Folder uploads tidak ditemukan');
        process.exit(1);
    }

    await walk(UPLOAD_DIR);

    console.log('✅ Selesai! Semua gambar telah dikompres.');
})();