const multer = require("multer");
const path = require("path");
const fs = require("fs");

module.exports = function () {
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            const uploadPath = path.join(__dirname, "../public/image/uploads");

            // cek folder, kalau tidak ada buat
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }

            cb(null, uploadPath);
        },
        filename: function (req, file, cb) {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    });

    return multer({ storage });
};