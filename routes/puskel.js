const router = require('express').Router();
const puskelController = require('../controllers/puskel.controller'); // Pastikan ada titik (.)
const { isAdminLoggedIn } = require('../middleware/auth'); // Sesuaikan path folder middleware

// --- KONFIGURASI UPLOAD ---

// 1. Upload Gambar (Untuk Cover Buku)
// Pastikan file imageMiddleware.js ada di folder middleware
const uploadImage = require('../middleware/imageMiddleware')(); 

// 2. Upload Excel (Untuk Import Data)
const multer = require('multer');
const storage = multer.memoryStorage(); // Excel cukup di memori, tidak perlu disimpan ke disk
const uploadExcel = multer({ storage: storage });

// --- MIDDLEWARE KEAMANAN ---
// 1. Cek Login
router.use(isAdminLoggedIn);

// 2. Cek Hak Akses (Hanya Super Admin & Admin Ruangan Puskel)
const verifyPuskelAccess = (req, res, next) => {
    const user = req.session.user;
    if (user && (user.role === 'super_admin' || (user.role === 'admin_ruangan' && user.nama_ruangan === 'Ruangan Pustaka Keliling'))) {
        next();
    } else {
        res.status(403).send("Akses Ditolak: Anda bukan petugas Pustaka Keliling.");
    }
};
router.use(verifyPuskelAccess);


// ==========================================
// DEFINISI RUTE
// ==========================================

// 1. DASHBOARD LOGISTIK PUSKEL
router.get('/', puskelController.index);

// 2. MANAJEMEN DATA PEMINJAM (LEMBAGA)
router.get('/borrowers', puskelController.listBorrowers);
router.post('/institution/add', puskelController.addInstitution);
router.get('/institution/:id', puskelController.detailInstitution);

// 3. MANAJEMEN STOK & SIRKULASI (LOGISTIK)
// Muat buku dari Gudang Utama ke Mobil Puskel (Scan)
router.post('/add-stock', puskelController.addStock);
// Kembalikan buku dari Mobil Puskel ke Gudang Utama
router.get('/remove-stock/:id', puskelController.removeStock);
// Pinjamkan ke Lembaga
router.post('/loan', puskelController.loanBook);
// Terima Pengembalian dari Lembaga
router.post('/return', puskelController.returnBook);

// 4. CRUD BUKU (MASTER DATA KHUSUS PUSKEL)
// Tambah Buku Baru (Input Manual)
router.get('/add', puskelController.showAddPage);
router.post('/add', uploadImage.single('image'), puskelController.addBook);

// Edit Buku
router.get('/edit/:id', puskelController.showEditPage);
router.post('/edit/:id', uploadImage.single('image'), puskelController.updateBook);

// Hapus Buku
router.post('/delete', puskelController.deleteMultiple);

// 5. FITUR EXCEL
router.get('/export', puskelController.exportExcel);
router.get('/download-template', puskelController.downloadTemplate);
// Note: name='fileExcel' harus sama dengan di form EJS (<input name="fileExcel">)
router.post('/import', uploadExcel.single('fileExcel'), puskelController.importExcel);

module.exports = router;