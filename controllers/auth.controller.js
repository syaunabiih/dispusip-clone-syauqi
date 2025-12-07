'use strict';

const bcrypt = require('bcryptjs');
const { User } = require('../models'); // CommonJS

// Halaman login
const loginPage = (req, res) => {
    res.render('admin/login', { error: null });
};

// Login action
const loginAction = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Cari user berdasarkan username
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.render("admin/login", { error: "Username tidak ditemukan" });
        }

        // Cek password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render("admin/login", { error: "Password salah" });
        }

        // Simpan session
        req.session.userId = user.id;
        req.session.username = user.username;

        // Redirect ke halaman admin
        res.redirect("/admin/books");
    } catch (err) {
        console.error("Login error:", err);
        res.render("admin/login", { error: "Terjadi kesalahan server" });
    }
};

// Logout action
const logoutAction = (req, res) => {
    req.session.destroy(err => {
        if (err) console.error("Logout error:", err);
        res.redirect("/admin/login");
    });
};

module.exports = {
    loginPage,
    loginAction,
    logoutAction
};