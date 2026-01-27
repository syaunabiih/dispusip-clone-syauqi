const { Author } = require('../models');

module.exports = {
  // Menampilkan halaman list penulis
  index: async (req, res) => {
    try {
      const authors = await Author.findAll({
        order: [['createdAt', 'DESC']]
      });
      res.render('admin/author', {
        title: 'Kelola Penulis',
        authors,
        user: req.session.user || { name: 'Admin' },
        active: 'authors'
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  },

  // Menambah penulis baru
  store: async (req, res) => {
    try {
      const { name } = req.body;
      await Author.create({ name });
      res.redirect('/admin/authors');
    } catch (error) {
      console.error(error);
      res.status(500).send('Gagal menambahkan penulis');
    }
  },

  // Mengupdate data penulis
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      await Author.update({ name }, { where: { id } });
      res.redirect('/admin/authors');
    } catch (error) {
      console.error(error);
      res.status(500).send('Gagal mengupdate penulis');
    }
  },

  // Menghapus penulis
  destroy: async (req, res) => {
    try {
      const { id } = req.params;
      await Author.destroy({ where: { id } });
      res.redirect('/admin/authors');
    } catch (error) {
      console.error(error);
      res.status(500).send('Gagal menghapus penulis');
    }
  }
};