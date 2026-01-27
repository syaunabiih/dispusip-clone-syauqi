'use strict';
const { Book, User, Ruangan } = require('../models');

const getSuperDashboard = async (req, res) => {
    try {
        // Mengambil statistik dasar secara paralel untuk efisiensi
        const [totalBooks, totalUsers, totalRuangan] = await Promise.all([
            Book.count(),
            User.count({ where: { role: 'admin_ruangan' } }),
            Ruangan.count()
        ]);

        // Kirim data ke view
        res.render('super-admin/super-admin-dashboard', {
            title: 'Super Admin Dashboard',
            user: req.session.username,
            role: req.session.role,
            stats: {
                totalBooks,
                totalUsers,
                totalRuangan
            }
        });
    } catch (error) {
        console.error("Error loading Super Admin Dashboard:", error);
        res.status(500).send("Internal Server Error");
    }
};

module.exports = {
    getSuperDashboard
};