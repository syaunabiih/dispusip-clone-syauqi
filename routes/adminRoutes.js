const express = require("express");
const router = express.Router();
const { isAdminLoggedIn } = require("../middleware/auth");
const adminBookController = require("../controllers/admin.controller");
// Pastikan middleware imageMiddleware mengembalikan fungsi multer atau instance yang sesuai
// Jika error "is not a function", ubah menjadi require("../middleware/imageMiddleware") tanpa ()
const upload = require("../middleware/imageMiddleware")(); 
const { loginPage, loginAction, logoutAction } = require("../controllers/auth.controller"); 
const categoryController = require('../controllers/category.controller');
const subjectController = require('../controllers/subject.controller');
const authorController = require('../controllers/author.controller');
const publisherController = require('../controllers/publisher.controller');
const multer = require('multer');
const storage = multer.memoryStorage();
const uploadExcel = multer({ storage: storage });

// =========================
// LOGIN & LOGOUT (TIDAK PERLU SESSION)
// =========================

router.get("/", (req, res) => {
    res.redirect("/admin/dashboard"); 
});

router.get("/login", loginPage);
router.post("/login", loginAction);
router.get("/logout", logoutAction);

// =========================
// SEMUA ROUTE ADMIN PERLU LOGIN
// =========================
// Middleware ini akan melindungi semua route di bawahnya
router.use(isAdminLoggedIn);

router.get("/dashboard", adminBookController.getDashboard);

// =========================
// LIST BUKU
// =========================
router.get("/books", adminBookController.listBooks);
router.get("/books/export", adminBookController.exportToExcel);
router.get("/books/template", adminBookController.downloadTemplate);
router.post("/books/import", uploadExcel.single("excelFile"), adminBookController.importExcel);

// =========================
// TAMBAH BUKU
// =========================
router.get("/books/add", adminBookController.showAddPage);
router.post(
    "/books/add",
    upload.single("image"),
    adminBookController.addBook
);

// =========================
// EDIT & UPDATE BUKU
// =========================
router.get("/books/edit/:id", adminBookController.showEditPage);
router.post(
    "/books/edit/:id",
    upload.single("image"),
    adminBookController.updateBook
);

// =========================
// DELETE BUKU
// =========================
router.get("/books/delete/:id", adminBookController.deleteBook);

// =========================
// AUTOCOMPLETE
// =========================
router.get("/autocomplete/category", adminBookController.findCategory);
router.get("/autocomplete/author", adminBookController.findAuthor);
router.get("/autocomplete/publisher", adminBookController.findPublisher);
router.get("/autocomplete/subject", adminBookController.findSubject);

// =========================
// KATEGORI & SUBJEK
// =========================
router.get('/categories', categoryController.getAllCategories);
router.post('/categories/add', categoryController.addCategory);
router.post('/categories/edit/:id', categoryController.updateCategory);
router.get('/categories/delete/:id', categoryController.deleteCategory);

router.get('/subjects', subjectController.getAllSubjects);
router.post('/subjects/add', subjectController.addSubject);
router.post('/subjects/edit/:id', subjectController.updateSubject);
router.get('/subjects/delete/:id', subjectController.deleteSubject);

router.post('/books/delete-multiple', adminBookController.deleteMultiple);

// =========================
// PENULIS (Authors)
// =========================
// 'requireAuth' dihapus karena sudah dicover oleh router.use(isAdminLoggedIn) di atas
router.get('/authors', authorController.index);
router.post('/authors', authorController.store);
router.post('/authors/update/:id', authorController.update);
router.post('/authors/delete/:id', authorController.destroy);

// =========================
// PENERBIT (Publishers)
// =========================
router.get('/publishers', publisherController.index);
router.post('/publishers', publisherController.store);
router.post('/publishers/update/:id', publisherController.update);
router.post('/publishers/delete/:id', publisherController.destroy);

// =========================
// MANAJEMEN RAK (SHELF MANAGEMENT)
// =========================
router.get("/shelf-management", adminBookController.showShelfManagementPage);
router.post("/shelf-management/update", adminBookController.bulkUpdateShelf);

module.exports = router;