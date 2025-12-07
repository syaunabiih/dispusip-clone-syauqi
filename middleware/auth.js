export const isAdminLoggedIn = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect("/admin/login");
    }
};