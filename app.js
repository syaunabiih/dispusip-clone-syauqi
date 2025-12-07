const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session'); // ubah import menjadi require
const db = require('./models').sequelize;
const bookRoutes = require('./routes/bookRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = 4000;

// --- Konfigurasi session ---
app.use(session({
    secret: "secret_key_admin", // ganti dengan secret yang aman
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 } // 1 jam
}));

// --- Set View Engine ke EJS ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Middleware ---
app.use(express.static('public')); // file statis
app.use("/image", express.static(path.join(__dirname, "public/image"))); // folder image
app.use(bodyParser.urlencoded({ extended: false })); // parse form data
app.use(bodyParser.json()); // parse json

// --- Routing ---
app.use('/', bookRoutes);
app.use("/admin", adminRoutes);

// --- Trust proxy (untuk session) ---
app.set('trust proxy', true);

// --- Sinkronisasi database lalu jalankan server ---
console.log('Sedang sinkronisasi database...');

db.authenticate()
    .then(() => {
        console.log('Database terhubung! Memulai update struktur tabel...');
        // alter: true menambahkan kolom baru tanpa hapus data
        return db.sync({ alter: true }); 
    })
    .then(() => {
        console.log('Tabel database berhasil diperbarui!');
        // Jalankan server
        app.listen(PORT, () => {
            console.log(`Sistem Referensi SIAP berjalan di http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('Gagal koneksi atau sinkronisasi database:', err);
    });