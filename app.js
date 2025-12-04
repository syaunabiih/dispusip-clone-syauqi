const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./models').sequelize;
const bookRoutes = require('./routes/bookRoutes');

const app = express();
const PORT = 3000;

// Set View Engine ke EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware untuk file statis
app.use(express.static(path.join(__dirname, 'public')));

// Middleware parsing body request
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Routing Utama
app.use('/', bookRoutes);

// --- PERBAIKAN UTAMA ADA DI SINI ---
// Kita jalankan server (app.listen) HANYA SETELAH database selesai loading/sync

console.log('Sedang sinkronisasi database...');

db.authenticate()
    .then(() => {
        console.log('Database terhubung! Memulai update struktur tabel...');
        // Alter: true akan menambahkan kolom baru (series_title, dll) tanpa hapus data
        return db.sync({ alter: true }); 
    })
    .then(() => {
        console.log('Tabel database berhasil diperbarui!');
        
        // BARU DISINI KITA JALANKAN SERVER
        app.listen(PORT, () => {
            console.log(`Sistem Referensi SIAP berjalan di http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('Gagal koneksi atau sinkronisasi database:', err);
    });

app.set('trust proxy', true);