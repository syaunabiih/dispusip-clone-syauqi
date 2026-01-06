const express = require("express");
const router = express.Router();
const { isAdminLoggedIn } = require("../middleware/auth");
const adminBookController = require("../controllers/admin.controller");
const upload = require("../middleware/imageMiddleware")();
const { loginPage, loginAction, logoutAction } = require("../controllers/auth.controller"); 
const categoryController = require('../controllers/category.controller');
const subjectController = require('../controllers/subject.controller');
const multer = require('multer');
const storage = multer.memoryStorage();
const uploadExcel = multer({ storage: storage });

// =========================
// LOGIN & LOGOUT (TIDAK PERLU SESSION)
// =========================

router.get("/", (req, res) => {
    res.redirect("/admin/login");
});

router.get("/login", loginPage);
router.post("/login", loginAction);
router.get("/logout", logoutAction);

// =========================
// SEMUA ROUTE ADMIN PERLU LOGIN
// =========================
router.use(isAdminLoggedIn);

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

router.get('/categories', categoryController.getAllCategories);
router.post('/categories/add', categoryController.addCategory);
router.post('/categories/edit/:id', categoryController.updateCategory);
router.get('/categories/delete/:id', categoryController.deleteCategory);

router.get('/subjects', subjectController.getAllSubjects);
router.post('/subjects/add', subjectController.addSubject);
router.post('/subjects/edit/:id', subjectController.updateSubject);
router.get('/subjects/delete/:id', subjectController.deleteSubject);



module.exports = router;