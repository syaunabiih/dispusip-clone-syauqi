const express = require("express");
const router = express.Router();

const searchPageController = require("../controllers/searchPage.controller");
const detailController = require("../controllers/detail.controller");

// HALAMAN INDEX (SEARCH)
router.get(["/", "/search"], searchPageController.indexPage);

// DETAIL BUKU
router.get("/book/:id", detailController.getDetailPage);

module.exports = router;
