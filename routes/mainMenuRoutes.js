const express = require('express');
const router = express.Router();
const searchPageController = require('../controllers/searchPage.controller');

// Halaman Pertama (Root)
router.get('/', (req, res) => {
    res.render('../views/user/main-menu', { title: 'Main Menu' });
});
router.get('/search', searchPageController.indexPage);
// Anda bisa menambahkan route untuk fitur lain di sini nanti
router.get('/pilih-ruangan', searchPageController.pilihRuangan);

router.get('/buku-tamu', (req, res) => {
    res.send('Halaman Buku Tamu (Coming Soon)');
});

module.exports = router;