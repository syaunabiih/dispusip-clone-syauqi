const express = require('express');
const router = express.Router();

// Halaman Pertama (Root)
router.get('/', (req, res) => {
    res.render('../views/user/main-menu', { title: 'Main Menu' });
});

// Anda bisa menambahkan route untuk fitur lain di sini nanti
router.get('/ruangan', (req, res) => {
    res.send('Halaman OPAC Ruangan (Coming Soon)');
});

router.get('/buku-tamu', (req, res) => {
    res.send('Halaman Buku Tamu (Coming Soon)');
});

module.exports = router;