const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session'); 
const db = require('./models').sequelize;
const bookRoutes = require('./routes/bookRoutes');
const adminRoutes = require('./routes/adminRoutes');
const mainMenuRoutes = require('./routes/mainMenuRoutes');

const app = express();
const PORT = 4000;

app.use(session({
    secret: "secret_key_admin", 
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 jam
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public')); 
app.use("/image", express.static(path.join(__dirname, "public/image"))); 
app.use(bodyParser.urlencoded({ extended: false })); 
app.use(bodyParser.json()); 

// --- Routing ---
app.use('/', mainMenuRoutes);
app.use('/books', bookRoutes);
app.use("/admin", adminRoutes);

// --- Trust proxy (untuk session) ---
app.set('trust proxy', true);

// --- Sinkronisasi database lalu jalankan server ---
console.log('Sedang sinkronisasi database...');

db.authenticate()
    .then(() => {
        console.log('Database terhubung! Melewati alter table otomatis, gunakan migrasi.');
        app.listen(PORT, () => {
            console.log(`Sistem Referensi SIAP berjalan di http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('Gagal koneksi atau sinkronisasi database:', err);
    });