const path = require("path");
const express = require("express");

module.exports = function (app) {
    // Middleware untuk serve folder public/image
    app.use("/image", express.static(path.join(__dirname, "../public/image")));
};