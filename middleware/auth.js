exports.isAdminLoggedIn = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect("/admin/login");
    }

    if (
        req.session.user.role !== 'admin_ruangan' &&
        req.session.user.role !== 'super_admin'
    ) {
        return res.status(403).send("Akses ditolak");
    }

    next();
};