const { Publisher } = require('../models');

module.exports = {
  // Menampilkan halaman list penerbit
  index: async (req, res) => {
    try {
      const publishers = await Publisher.findAll({
        order: [['createdAt', 'DESC']]
      });
      res.render('admin/publisher', {
        title: 'Kelola Penerbit',
        publishers,
        user: req.session.user || { name: 'Admin' },
        active: 'publishers'
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  },

  // Menambah penerbit baru
  store: async (req, res) => {
    try {
      const { name } = req.body;
      await Publisher.create({ name });
      res.redirect('/admin/publishers');
    } catch (error) {
      console.error(error);
      res.status(500).send('Gagal menambahkan penerbit');
    }
  },

  // Mengupdate data penerbit
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      await Publisher.update({ name }, { where: { id } });
      res.redirect('/admin/publishers');
    } catch (error) {
      console.error(error);
      res.status(500).send('Gagal mengupdate penerbit');
    }
  },

  // Menghapus penerbit
  destroy: async (req, res) => {
    try {
      const { id } = req.params;
      await Publisher.destroy({ where: { id } });
      res.redirect('/admin/publishers');
    } catch (error) {
      console.error(error);
      res.status(500).send('Gagal menghapus penerbit');
    }
  }
};