'use strict';

const bcrypt = require('bcryptjs');
const { User } = require('../models');

const loginPage = (req, res) => {
    res.render('admin/login', { error: null });
};

const loginAction = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.render("admin/login", { error: "Username tidak ditemukan" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render("admin/login", { error: "Password salah" });
        }

        // 🔑 simpan session sebagai object
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role
        };

        console.log("ROLE LOGIN:", user.role);

        // redirect berdasarkan role
        if (user.role === 'super_admin') {
            return res.redirect("/admin/super-dashboard");
        } else {
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
        res.redirect("/admin/login"); // ✅ benar
    });
};

module.exports = { loginPage, loginAction, logoutAction };