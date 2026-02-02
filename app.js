const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session'); 
const db = require('./models').sequelize;
const bookRoutes = require('./routes/bookRoutes');
const adminRoutes = require('./routes/adminRoutes');
const mainMenuRoutes = require('./routes/mainMenuRoutes');
const puskelRouter = require('./routes/puskel');

const app = express();
const PORT = 4000;

// 1. SETTING SESSION (Ditaruh Paling Atas setelah inisialisasi app)
app.use(session({
    secret: "secret_key_admin", 
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 jam
}));

// 2. MIDDLEWARE LAINNYA
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.title = 'Admin Panel'; 
    res.locals.active = ''; 
    next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public')); 
app.use("/image", express.static(path.join(__dirname, "public/image"))); 
app.use(bodyParser.urlencoded({ extended: false })); 
app.use(bodyParser.json()); 

// 3. ROUTING (BARU DIPANGGIL DI SINI SETELAH SEMUA SIAP)
app.use('/', mainMenuRoutes);
app.use('/books', bookRoutes);
app.use("/admin", adminRoutes);

// ✅ BENAR: Route Puskel ditaruh di sini (Setelah Session aktif)
app.use('/admin/puskel', puskelRouter); 

// --- Trust proxy ---
app.set('trust proxy', true);

// --- Sinkronisasi database ---
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