// controllers/room.controller.js
const { Ruangan, User, sequelize } = require('../models');
const bcrypt = require('bcryptjs');

module.exports = {
    // 1. TAMPILKAN DAFTAR RUANGAN
    index: async (req, res) => {
        try {
            const rooms = await Ruangan.findAll({
                include: [{ 
                    model: User, 
                    as: 'admin',
                    attributes: ['username'] // Ambil username adminnya
                }],
                order: [['createdAt', 'DESC']]
            });

            res.render('super-admin/room_list', {
                title: 'Kelola Ruangan',
                rooms,
                user: req.session.user,
                active: 'rooms'
            });
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    },

    // 2. TAMPILKAN FORM TAMBAH
    showAdd: (req, res) => {
        res.render('super-admin/room_add', {
            title: 'Tambah Ruangan Baru',
            user: req.session.user,
            error: null
        });
    },

    // 3. PROSES SIMPAN RUANGAN (DAN USER ADMINNYA)
    store: async (req, res) => {
        const t = await sequelize.transaction(); // Mulai transaksi database
        
        try {
            const { nama_ruangan, username, password } = req.body;

            // Validasi sederhana
            if (!nama_ruangan || !username || !password) {
                return res.render('super-admin/room_add', {
                    title: 'Tambah Ruangan',
                    user: req.session.user,
                    error: "Semua kolom wajib diisi!"
                });
            }

            // Cek apakah username sudah ada
            const existingUser = await User.findOne({ where: { username } });
            if (existingUser) {
                return res.render('super-admin/room_add', {
                    title: 'Tambah Ruangan',
                    user: req.session.user,
                    error: "Username admin sudah digunakan!"
                });
            }

            // A. Buat User Admin Ruangan dulu
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = await User.create({
                username,
                password: hashedPassword,
                role: 'admin_ruangan'
            }, { transaction: t });

            // B. Buat Ruangan yang terhubung ke User tersebut
            await Ruangan.create({
                nama_ruangan,
                id_admin_ruangan: newUser.id
            }, { transaction: t });

            // Commit transaksi jika sukses
            await t.commit();

            res.redirect('/admin/rooms?success=created');

        } catch (err) {
            // Rollback jika terjadi error
            await t.rollback();
            console.error(err);
            res.render('super-admin/room_add', {
                title: 'Tambah Ruangan',
                user: req.session.user,
                error: "Terjadi kesalahan sistem: " + err.message
            });
        }
    },

    // 4. TAMPILKAN FORM EDIT
    showEdit: async (req, res) => {
        try {
            const room = await Ruangan.findByPk(req.params.id, {
                include: [{ model: User, as: 'admin' }]
            });

            if (!room) return res.status(404).send("Ruangan tidak ditemukan");

            res.render('super-admin/room_edit', {
                title: 'Edit Ruangan',
                room,
                user: req.session.user,
                error: null
            });
        } catch (err) {
            console.error(err);
            res.status(500).send("Error");
        }
    },

    // 5. PROSES UPDATE
    update: async (req, res) => {
        const t = await sequelize.transaction();
        try {
            const { id } = req.params;
            const { nama_ruangan, username, new_password } = req.body;

            const room = await Ruangan.findByPk(id, { include: ['admin'] });
            if (!room) return res.status(404).send("Ruangan tidak ditemukan");

            // Update Info Ruangan
            await room.update({ nama_ruangan }, { transaction: t });

            // Update Info Admin (User)
            const updateData = { username };
            if (new_password) {
                updateData.password = await bcrypt.hash(new_password, 10);
            }
            
            await User.update(updateData, { 
                where: { id: room.id_admin_ruangan },
                transaction: t 
            });

            await t.commit();
            res.redirect('/admin/rooms?success=updated');

        } catch (err) {
            await t.rollback();
            console.error(err);
            res.redirect(`/admin/rooms/edit/${req.params.id}?error=gagal`);
        }
    },

    // 6. HAPUS RUANGAN (DAN ADMINNYA)
    delete: async (req, res) => {
        const t = await sequelize.transaction();
        try {
            const { id } = req.params;
            const room = await Ruangan.findByPk(id);
            
            if (!room) return res.status(404).send("Data tidak ditemukan");

            const adminId = room.id_admin_ruangan;

            // Hapus Ruangan dulu (karena foreign key ada di ruangan)
            await room.destroy({ transaction: t });

            // Hapus User Adminnya juga (Opsional, tapi disarankan agar tidak ada user sampah)
            if (adminId) {
                await User.destroy({ where: { id: adminId }, transaction: t });
            }

            await t.commit();
            res.redirect('/admin/rooms?success=deleted');

        } catch (err) {
            await t.rollback();
            console.error(err);
            res.status(500).send("Gagal menghapus data");
        }
    }
};