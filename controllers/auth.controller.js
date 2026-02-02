'use strict';

const bcrypt = require('bcryptjs');
// IMPORT MODEL RUANGAN AGAR BISA DICEK
const { User, Ruangan } = require('../models'); 

const loginPage = (req, res) => {
    // Jika ada error dari url query, ambil. Jika tidak, null.
    const error = req.query.error || null;
    res.render('admin/login', { error });
};

const loginAction = async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. CARI USER BESERTA DATA RUANGANNYA
        const user = await User.findOne({ 
            where: { username },
            include: [{ model: Ruangan, as: 'ruangan' }] // Penting! Ambil data ruangan
        });

        if (!user) {
            return res.render("admin/login", { error: "Username tidak ditemukan" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render("admin/login", { error: "Password salah" });
        }

        // 2. SIMPAN DATA LENGKAP KE SESSION (TERMASUK NAMA RUANGAN)
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role,
            // Simpan nama ruangan biar Sidebar tahu ini Puskel atau bukan
            nama_ruangan: user.ruangan ? user.ruangan.nama_ruangan : null, 
            id_ruangan: user.ruangan ? user.ruangan.id_ruangan : null
        };

        console.log("LOGIN BERHASIL:", user.username, "| RUANGAN:", req.session.user.nama_ruangan);

        // 3. REDIRECT SPESIFIK
        if (user.role === 'super_admin') {
            return res.redirect("/admin/super-dashboard");
        } 
        // JIKA ADMIN PUSKEL -> LEMPAR KE VIEW KHUSUS PUSKEL
        else if (user.ruangan && user.ruangan.nama_ruangan === 'Ruangan Pustaka Keliling') {
            return res.redirect("/admin/puskel");
        } 
        // JIKA ADMIN LAIN -> LEMPAR KE DASHBOARD BIASA
        else {
            return res.redirect("/admin/dashboard");
        }

    } catch (err) {
        console.error("Login error:", err);
        res.render("admin/login", { error: "Terjadi kesalahan server" });
    }
};

const logoutAction = (req, res) => {
    req.session.destroy(err => {
        if (err) console.error("Logout error:", err);
        res.redirect("/admin/login");
    });
};

module.exports = { loginPage, loginAction, logoutAction };