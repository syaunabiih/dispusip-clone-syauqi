const express = require("express");
const router = express.Router();
const { isAdminLoggedIn } = require("../middleware/auth");
const adminBookController = require("../controllers/admin.controller");

// Middleware Upload Image
const upload = require("../middleware/imageMiddleware")(); 

// Controllers
const { loginPage, loginAction, logoutAction } = require("../controllers/auth.controller"); 
const categoryController = require('../controllers/category.controller');
const subjectController = require('../controllers/subject.controller');
const authorController = require('../controllers/author.controller');
const publisherController = require('../controllers/publisher.controller');
const superAdminController = require("../controllers/superAdmin.controller");
const roomController = require("../controllers/room.controller");
const puskelController = require('../controllers/puskel.controller');

// Multer untuk Excel
const multer = require('multer');
const storage = multer.memoryStorage();
const uploadExcel = multer({ storage: storage });


// =========================
// LOGIN & LOGOUT (TIDAK PERLU SESSION CHECK DI SINI)
// =========================

router.get("/", (req, res) => {
    const user = req.session.user;
    if (user?.role === 'super_admin') {
        res.redirect("/admin/super-dashboard");
    } 
    // Redirect khusus Puskel
    else if (user?.role === 'admin_ruangan' && user.nama_ruangan === 'Ruangan Pustaka Keliling') {
        res.redirect("/admin/puskel");
    } 
    else {
        res.redirect("/admin/dashboard");
    }
});

router.get("/login", loginPage);
router.post("/login", loginAction);
router.get("/logout", logoutAction);

// =========================
// SEMUA ROUTE DI BAWAH INI PERLU LOGIN
// =========================
// Middleware ini akan melindungi semua route di bawahnya (Cek Session)
router.use(isAdminLoggedIn);

// Middleware Khusus Super Admin (Inline)
const verifySuperAdmin = (req, res, next) => {
    if (req.session.user.role !== 'super_admin') {
        return res.redirect('/admin/dashboard');
    }
    next();
};

// Dashboard Super Admin
router.get("/super-dashboard", verifySuperAdmin, superAdminController.getSuperDashboard);

// =========================
// MANAJEMEN RUANGAN (SUPER ADMIN)
// =========================
router.get("/rooms", verifySuperAdmin, roomController.index);
router.get("/rooms/add", verifySuperAdmin, roomController.showAdd);
router.post("/rooms/add", verifySuperAdmin, roomController.store);
router.get("/rooms/edit/:id", verifySuperAdmin, roomController.showEdit);
router.post("/rooms/edit/:id", verifySuperAdmin, roomController.update);
router.get("/rooms/delete/:id", verifySuperAdmin, roomController.delete);

// Dashboard Admin Biasa
router.get("/dashboard", adminBookController.getDashboard);

// =========================
// MANAJEMEN BUKU
// =========================
router.get("/books", adminBookController.listBooks);
router.get("/books/export", adminBookController.exportToExcel);
router.get("/books/template", adminBookController.downloadTemplate);
router.post("/books/import", uploadExcel.single("excelFile"), adminBookController.importExcel);
router.get("/books/add", adminBookController.showAddPage);
router.post("/books/add", upload.single("image"), adminBookController.addBook);
router.get("/books/edit/:id", adminBookController.showEditPage);
router.post("/books/edit/:id", upload.single("image"), adminBookController.updateBook);
router.get("/books/delete/:id", adminBookController.deleteBook);
router.post('/books/delete-multiple', adminBookController.deleteMultiple);

// =========================
// AUTOCOMPLETE
// =========================
router.get("/autocomplete/category", adminBookController.findCategory);
router.get("/autocomplete/author", adminBookController.findAuthor);
router.get("/autocomplete/publisher", adminBookController.findPublisher);
router.get("/autocomplete/subject", adminBookController.findSubject);

// =========================
// MASTER DATA (Kategori, Subjek, Penulis, Penerbit)
// =========================
router.get('/categories', categoryController.getAllCategories);
router.post('/categories/add', categoryController.addCategory);
router.post('/categories/edit/:id', categoryController.updateCategory);
router.get('/categories/delete/:id', categoryController.deleteCategory);

router.get('/subjects', subjectController.getAllSubjects);
router.post('/subjects/add', subjectController.addSubject);
router.post('/subjects/edit/:id', subjectController.updateSubject);
router.get('/subjects/delete/:id', subjectController.deleteSubject);

router.get('/authors', authorController.index);
router.post('/authors', authorController.store);
router.post('/authors/update/:id', authorController.update);
router.post('/authors/delete/:id', authorController.destroy);

router.get('/publishers', publisherController.index);
router.post('/publishers', publisherController.store);
router.post('/publishers/update/:id', publisherController.update);
router.post('/publishers/delete/:id', publisherController.destroy);

// =========================
// MANAJEMEN RAK (SHELF MANAGEMENT)
// =========================
router.get("/shelf-management", adminBookController.showShelfManagementPage);
router.post("/shelf-management/update", adminBookController.bulkUpdateShelf);

// ===========================================
// ROUTE KHUSUS PUSTAKA KELILING (PUSKEL)
// ===========================================

// Middleware Cek Akses: Hanya Super Admin & Admin Puskel
const verifyPuskelAccess = (req, res, next) => {
    const user = req.session.user;
    // Pastikan user ada (meskipun sudah dicek isAdminLoggedIn, double check is safe)
    if (user && (user.role === 'super_admin' || (user.role === 'admin_ruangan' && user.nama_ruangan === 'Ruangan Pustaka Keliling'))) {
        next();
    } else {
        res.status(403).send("Akses Ditolak: Anda bukan petugas Pustaka Keliling.");
    }
};

// 1. Dashboard Logistik
router.get('/puskel', verifyPuskelAccess, puskelController.index);

// 2. Data Peminjam & Tambah Lembaga
router.get('/puskel/borrowers', verifyPuskelAccess, puskelController.listBorrowers);
router.post('/puskel/institution/add', verifyPuskelAccess, puskelController.addInstitution); // <-- ROUTE BARU

// 3. Kelola Stok (Masuk/Keluar Gudang)
router.post('/puskel/add-stock', verifyPuskelAccess, puskelController.addStock);
router.get('/puskel/remove-stock/:id', verifyPuskelAccess, puskelController.removeStock);
router.get('/puskel/template', verifyPuskelAccess, puskelController.downloadTemplate); // Download Format
router.get('/puskel/export', verifyPuskelAccess, puskelController.exportExcel); // Export Data
router.post('/puskel/import', verifyPuskelAccess, uploadExcel.single('excelFile'), puskelController.importExcel); // Import Action

// 4. Sirkulasi
router.post('/puskel/loan', verifyPuskelAccess, puskelController.loanBook);
router.post('/puskel/return', verifyPuskelAccess, puskelController.returnBook);


// === ROUTE BARU UNTUK DETAIL ===
router.get('/puskel/institution/:id', verifyPuskelAccess, puskelController.detailInstitution);

module.exports = router;