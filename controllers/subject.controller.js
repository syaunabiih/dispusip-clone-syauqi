const { Subject } = require('../models');
const { Op } = require('sequelize');

exports.getAllSubjects = async (req, res) => {
    try {
        const q = req.query.q || '';

        const subjects = await Subject.findAll({
            where: q
                ? { name: { [Op.like]: `%${q}%` } }
                : {},
            order: [['name', 'ASC']]
        });

        res.render('admin/subject', {
            title: 'Daftar Subjek',
            subjects,
            q
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal mengambil data subjek');
    }
};

exports.addSubject = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.redirect('/admin/subjects');

        await Subject.create({ name });
        res.redirect('/admin/subjects');
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal menambah subjek');
    }
};

exports.updateSubject = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        const subject = await Subject.findByPk(id);
        if (!subject) return res.status(404).send('Subjek tidak ditemukan');

        await subject.update({ name });
        res.redirect('/admin/subjects');
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal memperbarui subjek');
    }
};

exports.deleteSubject = async (req, res) => {
    try {
        const { id } = req.params;

        const subject = await Subject.findByPk(id);
        if (!subject) return res.status(404).send('Subjek tidak ditemukan');

        await subject.destroy();
        res.redirect('/admin/subjects');
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal menghapus subjek');
    }
};