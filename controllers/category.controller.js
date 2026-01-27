const { Category } = require('../models');
const { Op } = require('sequelize');

exports.getAllCategories = async (req, res) => {
    try {
        const q = req.query.q || '';

        const categories = await Category.findAll({
            where: q
                ? {
                    name: {
                        [Op.like]: `%${q}%`
                    }
                }
                : {},
            order: [['name', 'ASC']]
        });

        res.render('admin/category', {
            title: 'Daftar Kategori',
            categories,
            q
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal mengambil data kategori');
    }
};

exports.getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findByPk(id);

        if (!category) {
            return res.status(404).send('Kategori tidak ditemukan');
        }

        res.render('admin/categories/edit', {
            title: 'Edit Kategori',
            category
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal mengambil data kategori');
    }
};

exports.addCategory = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).send('Nama kategori wajib diisi');
        }

        await Category.create({ name });

        res.redirect('/admin/categories');
    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal menambah kategori');
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        const category = await Category.findByPk(id);
        if (!category) {
            return res.status(404).send('Kategori tidak ditemukan');
        }

        await category.update({ name });

        res.redirect('/admin/categories');
    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal memperbarui kategori');
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findByPk(id);
        if (!category) {
            return res.status(404).send('Kategori tidak ditemukan');
        }

        await category.destroy();

        res.redirect('/admin/categories');
    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal menghapus kategori');
    }
};