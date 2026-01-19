const { Op } = require("sequelize");
const { Book, Author, Publisher, Subject, Category, BookCopy } = require("../models");

module.exports = {
    indexPage: async (req, res) => {
        try {
            // Helper function untuk handle array parameters (karena ada multiple form dengan name yang sama)
            const getFirstValue = (value, defaultValue = "") => {
                if (Array.isArray(value)) {
                    // Ambil nilai terakhir dari array (lebih relevan karena biasanya dari form yang terakhir di-submit)
                    // Jika nilai terakhir adalah string kosong atau "0", itu berarti user ingin menghapus filter
                    const lastValue = value.length > 0 ? value[value.length - 1] : defaultValue;
                    const strVal = String(lastValue || "").trim();
                    
                    // Jika nilai terakhir adalah kosong atau "0", return kosong (reset filter)
                    if (strVal === "" || strVal === "0") {
                        return "";
                    }
                    
                    // Jika nilai terakhir tidak kosong, return nilai tersebut
                    return lastValue;
                }
                // Jika bukan array, handle nilai kosong atau "0" sebagai reset
                const strVal = String(value || "").trim();
                if (strVal === "" || strVal === "0") {
                    return "";
                }
                return value || defaultValue;
            };

            // Extract dan normalize parameters (handle array jika ada)
            const q = getFirstValue(req.query.q, "");
            const searchBy = getFirstValue(req.query.searchBy, "title");
            const matchType = getFirstValue(req.query.matchType, "contains");
            const category = getFirstValue(req.query.category, "");
            const subject = getFirstValue(req.query.subject, "");
            const year = getFirstValue(req.query.year, "");
            const page = parseInt(getFirstValue(req.query.page, "1")) || 1;
            const limit = parseInt(getFirstValue(req.query.limit, "12")) || 12;
            const sortBy = getFirstValue(req.query.sortBy, "title");
            const sortOrder = getFirstValue(req.query.sortOrder, "ASC");

            // Validasi dan sanitasi parameter
            const validSortBy = ["title", "updatedAt", "createdAt"];
            const validSortOrder = ["ASC", "DESC"];
            
            // Pastikan sortBy valid
            const finalSortBy = (sortBy && validSortBy.includes(sortBy)) ? sortBy : "title";
            
            // Pastikan sortOrder valid (handle null/undefined)
            let finalSortOrder = "ASC";
            if (sortOrder && typeof sortOrder === 'string') {
                const upperSortOrder = sortOrder.toUpperCase();
                finalSortOrder = validSortOrder.includes(upperSortOrder) ? upperSortOrder : "ASC";
            }

            // Validasi dan sanitasi page dan limit
            const currentPage = Math.max(1, parseInt(page) || 1);
            const perPage = Math.max(1, Math.min(100, parseInt(limit) || 12)); // Max 100 items per page
            const offset = (currentPage - 1) * perPage;

            // =========================
            // MATCH TYPE
            // =========================
            // Normalize q untuk search (pastikan string)
            const normalizedQ = typeof q === 'string' ? q.trim() : (Array.isArray(q) ? (q.find(v => v && String(v).trim()) || "").trim() : String(q || "").trim());
            
            let searchValue = normalizedQ;
            let operator = Op.like;

            switch (matchType) {
                case "startsWith":
                    searchValue = `${normalizedQ}%`;
                    break;
                case "endsWith":
                    searchValue = `%${normalizedQ}`;
                    break;
                case "exact":
                    operator = Op.eq;
                    searchValue = normalizedQ;
                    break;
                default:
                    searchValue = `%${normalizedQ}%`;
            }

            // =========================
            // INCLUDE (DEFAULT – TIDAK TERFILTER)
            // =========================
            // Buat includeOptions yang akan dimodifikasi berdasarkan filter/search
            const includeOptions = [
                { model: Author, through: { attributes: [] }, required: false },
                { model: Publisher, through: { attributes: [] }, required: false },
                { model: Subject, through: { attributes: [] }, required: false },
                { model: Category, required: false }
            ];

            // =========================
            // WHERE CONDITION (BOOK)
            // =========================
            const whereCondition = {};

            // Validasi dan sanitasi category (pastikan numeric atau string kosong)
            if (category && category !== "" && category !== "0") {
                const categoryId = parseInt(category);
                if (!isNaN(categoryId) && categoryId > 0) {
                    whereCondition.category_id = categoryId;
                }
            }

            // Validasi dan sanitasi year (pastikan numeric atau string kosong)
            // Note: publish_year adalah STRING di model, jadi kita bandingkan sebagai string
            if (year && year !== "" && year !== "0") {
                whereCondition.publish_year = year.toString();
            }

            // =========================
            // FILTER SUBJECT
            // =========================
            // Filter subject menggunakan include dengan where condition
            if (subject && subject !== "" && subject !== "0") {
                const subjectId = parseInt(subject);
                if (!isNaN(subjectId) && subjectId > 0) {
                    // Pastikan Subject include ada dan set required + where
                    const subjectInclude = includeOptions.find(opt => opt.model === Subject);
                    if (subjectInclude) {
                        subjectInclude.required = true;
                        subjectInclude.where = {
                            id: subjectId
                        };
                    } else {
                        // Jika tidak ditemukan, tambahkan
                        includeOptions[2].required = true;
                        includeOptions[2].where = {
                            id: subjectId
                        };
                    }
                }
            }

            // =========================
            // SEARCH HANDLER
            // =========================
            // Gunakan normalizedQ yang sudah dinormalisasi
            if (normalizedQ !== "") {
                switch (searchBy) {
                    case "title":
                        whereCondition.title = { [operator]: searchValue };
                        break;

                    case "call_number":
                        whereCondition.call_number = { [operator]: searchValue };
                        break;

                    case "author":
                        // Cari Author include dan set required + where
                        const authorInclude = includeOptions.find(opt => opt.model === Author);
                        if (authorInclude) {
                            authorInclude.required = true;
                            // Jika sudah ada where (dari filter lain), gabungkan dengan Op.and
                            if (authorInclude.where) {
                                authorInclude.where = {
                                    [Op.and]: [
                                        authorInclude.where,
                                        { name: { [operator]: searchValue } }
                                    ]
                                };
                            } else {
                                authorInclude.where = { name: { [operator]: searchValue } };
                            }
                        }
                        break;

                    case "publisher":
                        const publisherInclude = includeOptions.find(opt => opt.model === Publisher);
                        if (publisherInclude) {
                            publisherInclude.required = true;
                            if (publisherInclude.where) {
                                publisherInclude.where = {
                                    [Op.and]: [
                                        publisherInclude.where,
                                        { name: { [operator]: searchValue } }
                                    ]
                                };
                            } else {
                                publisherInclude.where = { name: { [operator]: searchValue } };
                            }
                        }
                        break;

                    case "subject":
                        const subjectSearchInclude = includeOptions.find(opt => opt.model === Subject);
                        if (subjectSearchInclude) {
                            subjectSearchInclude.required = true;
                            // Jika sudah ada where dari filter subject, gabungkan
                            if (subjectSearchInclude.where) {
                                // Jika where adalah id (dari filter), tambahkan name search dengan Op.and
                                subjectSearchInclude.where = {
                                    [Op.and]: [
                                        subjectSearchInclude.where,
                                        { name: { [operator]: searchValue } }
                                    ]
                                };
                            } else {
                                subjectSearchInclude.where = { name: { [operator]: searchValue } };
                            }
                        }
                        break;

                    case "all":
                        whereCondition[Op.or] = [
                            { title: { [operator]: searchValue } },
                            { call_number: { [operator]: searchValue } }
                        ];
                        // Untuk search "all", kita tidak perlu required pada includes
                        // karena kita sudah search di title dan call_number
                        break;
                }
            }

            // =========================
            // QUERY BUKU
            // =========================
            // Pastikan includeOptions valid sebelum query
            const safeIncludeOptions = includeOptions.map(opt => {
                const safeOpt = { ...opt };
                // Pastikan required adalah boolean
                if (typeof safeOpt.required !== 'boolean') {
                    safeOpt.required = false;
                }
                // Pastikan through attributes ada untuk many-to-many
                if (safeOpt.model === Author || safeOpt.model === Publisher || safeOpt.model === Subject) {
                    if (!safeOpt.through) {
                        safeOpt.through = { attributes: [] };
                    }
                }
                return safeOpt;
            });
            
            // Debug logging (selalu aktif untuk troubleshooting)
            console.log("=== FILTER DEBUG ===");
            console.log("Request Query:", req.query);
            console.log("Normalized Parameters:", { 
                category: category, 
                subject: subject, 
                year: year, 
                q: q, 
                searchBy: searchBy, 
                matchType: matchType,
                sortBy: sortBy,
                sortOrder: sortOrder
            });
            console.log("Filter Parameters:", { category, subject, year, q, searchBy, matchType });
            console.log("Where Condition:", JSON.stringify(whereCondition, null, 2));
            console.log("Include Options:", safeIncludeOptions.map(opt => ({
                model: opt.model ? opt.model.name : 'Unknown',
                required: opt.required,
                where: opt.where
            })));
            console.log("Sorting:", { sortBy: finalSortBy, sortOrder: finalSortOrder });
            console.log("Pagination:", { page: currentPage, limit: perPage, offset });
            console.log("===================");
            
            // Urutkan berdasarkan parameter sortBy dan sortOrder (sudah divalidasi di atas)
            const { count, rows } = await Book.findAndCountAll({
                where: whereCondition,
                include: safeIncludeOptions,
                limit: perPage,
                offset,
                order: [[finalSortBy, finalSortOrder]],
                distinct: true
            });
            
            // Debug hasil query
            if (process.env.NODE_ENV === "development") {
                console.log("Query Results:", { count, rowsCount: rows.length });
            }

            // =========================
            // SIDEBAR DATA (FULL, TIDAK TERFILTER)
            // =========================
            const categories = await Category.findAll({
                order: [["name", "ASC"]]
            });

            const subjects = await Subject.findAll({
                order: [["name", "ASC"]]
            });

            const yearsRaw = await Book.findAll({
                attributes: [
                    [Book.sequelize.fn("DISTINCT", Book.sequelize.col("publish_year")), "year"]
                ],
                where: { publish_year: { [Op.ne]: null } },
                raw: true,
                order: [[Book.sequelize.col("year"), "DESC"]]
            });

            // =========================
            // IMAGE PATH & COUNT EXEMPLARS (NOMOR INDUK)
            // =========================
            // Hitung jumlah eksemplar (nomor induk) untuk setiap buku
            const bookIds = rows.map(book => book.id);
            const exemplarsMap = {};
            
            if (bookIds.length > 0) {
                // Gunakan BookCopy.count() untuk setiap buku secara paralel
                const countPromises = bookIds.map(async (bookId) => {
                    const count = await BookCopy.count({
                        where: { book_id: bookId }
                    });
                    return { bookId, count };
                });
                
                const counts = await Promise.all(countPromises);
                
                // Buat map untuk akses cepat jumlah eksemplar per buku
                counts.forEach(({ bookId, count }) => {
                    exemplarsMap[bookId] = count || 0;
                });
            }

            const books = rows.map(book => {
                const bookData = book.get();
                const totalExemplars = exemplarsMap[book.id] || 0;
                return {
                    ...bookData,
                    image_full_path: book.image ? `/image/uploads/${book.image}` : null,
                    total_exemplars: totalExemplars // Jumlah eksemplar berdasarkan nomor induk
                };
            });

            return res.render("user/index", {
                title: "Katalog Buku",
                books,
                totalItems: count,
                currentPage,
                totalPages: Math.ceil(count / perPage),
                sidebarData: {
                    categories,
                    subjects,
                    years: yearsRaw
                },
                query: {
                    q: normalizedQ, // Gunakan normalizedQ untuk render
                    searchBy,
                    matchType,
                    category,
                    subject,
                    year,
                    sortBy: finalSortBy,
                    sortOrder: finalSortOrder
                }
            });

        } catch (err) {
            console.error("Error Search Index:", err);
            console.error("Error Stack:", err.stack);
            console.error("Request Query:", req.query);
            
            // Fallback: redirect ke halaman utama dengan error message
            try {
                return res.redirect("/?error=Terjadi kesalahan saat memproses filter. Silakan coba lagi.");
            } catch (redirectErr) {
                // Jika redirect juga gagal, kirim response sederhana
                return res.status(500).send(`
                    <html>
                        <head><title>Error</title></head>
                        <body>
                            <h1>Internal Server Error</h1>
                            <p>Terjadi kesalahan saat memproses permintaan Anda.</p>
                            <p><a href="/">Kembali ke Halaman Utama</a></p>
                            ${process.env.NODE_ENV === "development" ? `<pre>${err.message}\n${err.stack}</pre>` : ""}
                        </body>
                    </html>
                `);
            }
        }
    }
};