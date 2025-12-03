const { Op } = require("sequelize");
const { Book, Author, Publisher, Subject, Category } = require("../models");

module.exports = {
    indexPage: async (req, res) => {
        try {
            const {
                q = "",
                searchBy = "title",
                matchType = "contains",
                category = "",
                year = "",
                page = 1,
                limit = 12
            } = req.query;

            const keyword = q;
            const offset = (page - 1) * limit;

            // ============================
            // 🔍 MATCH TYPE HANDLER
            // ============================
            let searchValue = keyword;
            let operator = Op.like;

            switch (matchType) {
                case "startsWith":
                    searchValue = `${keyword}%`;
                    break;
                case "endsWith":
                    searchValue = `%${keyword}`;
                    break;
                case "exact":
                    operator = Op.eq;
                    break;
                default:
                    searchValue = `%${keyword}%`;
            }

            // ============================
            // 📚 QUERY BUKU
            // ============================
            const includeOptions = [
                { model: Author, through: { attributes: [] }, required: false },
                { model: Publisher, through: { attributes: [] }, required: false },
                { model: Subject, through: { attributes: [] }, required: false },
                { model: Category, required: false }
            ];

            const whereCondition = {};
            if (category) whereCondition.category_id = category;
            if (year) whereCondition.publish_year = year;

            // ============================
            // 🔍 SEARCH BY FIELD
            // ============================
            if (keyword) {
                switch (searchBy) {
                    case "title":
                        whereCondition.title = { [operator]: searchValue };
                        break;
                    case "isbn":
                        whereCondition.isbn = { [operator]: searchValue };
                        break;
                    case "call_number":
                        whereCondition.call_number = { [operator]: searchValue };
                        break;
                    case "author":
                        includeOptions[0].required = true; // Author
                        includeOptions[0].where = { name: { [operator]: searchValue } };
                        break;
                    case "publisher":
                        includeOptions[1].required = true; // Publisher
                        includeOptions[1].where = { name: { [operator]: searchValue } };
                        break;
                    case "subject":
                        includeOptions[2].required = true; // Subject
                        includeOptions[2].where = { name: { [operator]: searchValue } };
                        break;
                    case "all":
                        // Semua field: title, isbn, call_number + associations
                        whereCondition[Op.or] = [
                            { title: { [operator]: searchValue } },
                            { isbn: { [operator]: searchValue } },
                            { call_number: { [operator]: searchValue } }
                        ];
                        includeOptions[0].required = true;
                        includeOptions[0].where = { name: { [operator]: searchValue } };
                        includeOptions[1].required = true;
                        includeOptions[1].where = { name: { [operator]: searchValue } };
                        includeOptions[2].required = true;
                        includeOptions[2].where = { name: { [operator]: searchValue } };
                        break;
                }
            }

            const booksData = await Book.findAndCountAll({
                where: whereCondition,
                include: includeOptions,
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [["title", "ASC"]],
                distinct: true
            });

            // ============================
            // 📌 DATA SIDEBAR
            // ============================
            const categories = await Category.findAll({ order: [["name", "ASC"]] });
            const years = await Book.findAll({
                attributes: [[Book.sequelize.fn("DISTINCT", Book.sequelize.col("publish_year")), "publish_year"]],
                order: [["publish_year", "DESC"]]
            });

            return res.render("user/index", {
                title: "Katalog Buku",
                books: booksData.rows,
                totalItems: booksData.count,
                currentPage: parseInt(page),
                totalPages: Math.ceil(booksData.count / limit),
                sidebarData: {
                    categories,
                    years: years.map(y => ({ year: y.publish_year }))
                },
                query: {
                    q: keyword,
                    searchBy,
                    matchType,
                    category,
                    year
                }
            });

        } catch (err) {
            console.error("Error Search Index:", err);
            return res.status(500).send("Internal Server Error");
        }
    }
};