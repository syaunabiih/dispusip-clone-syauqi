'use strict';

const bcrypt = require('bcryptjs');
const { User, Ruangan } = require('../models');

/**
 * HELPER: Fungsi internal untuk memproses autentikasi dasar
 * agar kita tidak menulis ulang kode bcrypt.compare berkali-kali.
 */
const authenticateUser = async (username, password, checkCriteria) => {
    const user = await User.findOne({ 
        where: { username },
        include: [{ model: Ruangan, as: 'ruangan' }] 
    });

    if (!user) return { error: "Username tidak ditemukan" };

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return { error: "Password salah" };

    console.log("User Found:", user.username);
    console.log("Role in DB:", `'${user.role}'`); // Tanda kutip untuk cek spasi tersembunyi
    console.log("Room in DB:", user.ruangan ? user.ruangan.nama_ruangan : "NULL");

    // Validasi kriteria tambahan (Role atau Nama Ruangan)
    if (!checkCriteria(user)) {
        return { error: "Anda tidak memiliki akses ke halaman login ini" };
    }

    return { user };
};

// ---------------------------------------------------------
// 1. SUPER ADMIN LOGIN
// ---------------------------------------------------------
const loginSuperAdminPage = (req, res) => {
    res.render('super-admin/login-super', { error: req.query.error || null });
};

const loginSuperAdminAction = async (req, res) => {
    const { username, password } = req.body;
    const { user, error } = await authenticateUser(username, password, (u) => u.role === 'super_admin');

    if (error) return res.render("super-admin/login-super", { error });

    req.session.user = { id: user.id, username: user.username, role: user.role };
    return res.redirect("/admin/super-dashboard");
};

// ---------------------------------------------------------
// 2. ADMIN PUSKEL (PUSTAKA KELILING) LOGIN
// ---------------------------------------------------------
const loginPuskelPage = (req, res) => {
    res.render('admin/puskel/login-puskel', { error: req.query.error || null });
};

const loginPuskelAction = async (req, res) => {
    const { username, password } = req.body;

    const { user, error } = await authenticateUser(username, password, (u) => {
        // 1. Pastikan Role-nya adalah admin_puskel
        const isAdminPuskel = u.role.trim().toLowerCase() === 'admin_puskel';
        const isPuskel = u.ruangan && 
            u.ruangan.nama_ruangan.trim().toLowerCase() === 'ruangan pustaka keliling';


        return isAdminPuskel && isPuskel;
    });

    if (error) {
        // Pesan error lebih spesifik agar admin tidak bingung
        return res.render("admin/puskel/login-puskel", { 
            error: "Akses ditolak: Akun ini tidak terdaftar sebagai Admin Pustaka Keliling." 
        });
    }

    // Simpan ke Session
    req.session.user = { 
        id: user.id, 
        username: user.username,
        role: user.role,
        nama_ruangan: user.ruangan ? user.ruangan.nama_ruangan : 'Umum',
        id_ruangan: user.ruangan ? user.ruangan.id_ruangan : null 
    };

    return res.redirect("/admin/puskel");
};

// ---------------------------------------------------------
// 3. ADMIN RUANGAN REGULER LOGIN
// ---------------------------------------------------------
const loginRegularPage = (req, res) => {
    res.render('admin/login', { error: req.query.error || null });
};

const loginRegularAction = async (req, res) => {
    const { username, password } = req.body;

    const { user, error } = await authenticateUser(username, password, (u) => {
        // 1. Pastikan Role-nya adalah admin_ruangan
        const isAdminRuangan = u.role === 'admin_ruangan';

        // 2. Pastikan Ruangannya BUKAN Pustaka Keliling
        // Kita cek: jika tidak punya ruangan atau nama ruangannya bukan 'Ruangan Pustaka Keliling'
        const isNotPuskel = !u.ruangan || u.ruangan.nama_ruangan !== 'Ruangan Pustaka Keliling';

        return isAdminRuangan && isNotPuskel;
    });

    if (error) {
        // Pesan error lebih spesifik agar admin tidak bingung
        return res.render("admin/login", { 
            error: "Akses ditolak: Akun ini tidak terdaftar sebagai Admin Ruangan Reguler." 
        });
    }

    // Simpan ke Session
    req.session.user = { 
        id: user.id, 
        username: user.username,
        role: user.role,
        nama_ruangan: user.ruangan ? user.ruangan.nama_ruangan : 'Umum',
        id_ruangan: user.ruangan ? user.ruangan.id_ruangan : null 
    };

    return res.redirect("/admin/dashboard");
};

const logoutAction = (req, res) => {
    req.session.destroy(() => res.redirect("/"));
};

module.exports = { 
    loginSuperAdminPage, loginSuperAdminAction,
    loginPuskelPage, loginPuskelAction,
    loginRegularPage, loginRegularAction,
    logoutAction 
};