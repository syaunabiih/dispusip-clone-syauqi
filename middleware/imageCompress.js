const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

module.exports.compressImage = async function (inputPath, outputPath = inputPath) {
    try {
        const ext = path.extname(inputPath).toLowerCase();
        const tempPath = outputPath + ".tmp";

        let image = sharp(inputPath)
            .rotate()
            .resize({
                width: 1200,
                withoutEnlargement: true
            });

        if (ext === ".png") {
            await image.png({
                compressionLevel: 9,
                palette: true
            }).toFile(tempPath);
        } else {
            await image.jpeg({
                quality: 75,
                mozjpeg: true
            }).toFile(tempPath);
        }

        await fs.promises.rename(tempPath, outputPath);

        const stat = await fs.promises.stat(outputPath);

        return {
            success: true,
            sizeKB: Math.round(stat.size / 1024)
        };
    } catch (err) {
        console.error("Image compress error:", err);
        return {
            success: false,
            error: err.message
        };
    }
};