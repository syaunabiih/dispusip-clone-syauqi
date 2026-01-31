const { Op } = require("sequelize");
const { Ruangan, Book, Author, Publisher, Subject, Category, BookCopy } = require("../models");

module.exports = {
    // Fungsi baru untuk menampilkan daftar ruangan
    pilihRuangan: async (req, res) => {
        try {
            const daftarRuangan = await Ruangan.findAll();
            res.render("user/pilih-ruangan", { 
                title: "Pilih Ruangan OPAC", 
                daftarRuangan 
            });
        } catch (err) {
            console.error(err);
            res.status(500).send("Gagal memuat daftar ruangan");
        }
    },
    indexPage: async (req, res) => {
        try {
            // 1. Tangkap id_ruangan dari query string (URL)
            const id_ruangan = req.query.id_ruangan;
            // 2. Jika tidak ada id_ruangan, paksa user pilih ruangan dulu
            if (!id_ruangan) {
                return res.redirect('/ruangan'); 
            }
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
            
            // =========================
            // LOGIKA SORTING KHUSUS UNTUK TANGGAL
            // =========================
            // Untuk updatedAt dan createdAt:
            // - "Naik" (ASC) = Terbaru dulu → Terlama (harus DESC)
            // - "Turun" (DESC) = Terlama dulu → Terbaru (harus ASC)
            // Untuk title tetap normal (ASC = A-Z, DESC = Z-A)
            let actualSortOrder = finalSortOrder;
            if (finalSortBy === 'updatedAt' || finalSortBy === 'createdAt') {
                // Balikkan logika: ASC menjadi DESC, DESC menjadi ASC
                actualSortOrder = finalSortOrder === 'ASC' ? 'DESC' : 'ASC';
            }

            // Validasi dan sanitasi page dan limit
            const currentPage = Math.max(1, parseInt(page) || 1);
            const perPage = Math.max(1, Math.min(100, parseInt(limit) || 12)); // Max 100 items per page
            const offset = (currentPage - 1) * perPage;

            // =========================
            // MATCH TYPE
            // =========================
            // Normalize q untuk search (pastikan string)
            const rawQ = getFirstValue(req.query.q, "");
            // 1. Trim: Hapus spasi depan belakang
            // 2. Replace: Ubah spasi ganda menjadi satu spasi ("  " -> " ")
            const normalizedQ = String(rawQ).trim().replace(/\s+/g, ' ');
            
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
            const whereCondition = {
                id_ruangan: id_ruangan
            };

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
            if (normalizedQ !== "") {
                // 1. Pecah kata kunci menjadi array token
                const tokens = normalizedQ.split(' ').filter(t => t.length > 0);
                // 2. Fungsi Helper untuk membuat query Token-Based
                const createTokenCondition = (field) => {
                    // Jika matchType 'exact', cari persis
                    if (matchType === "exact") {
                        return { [field]: { [Op.eq]: normalizedQ } };
                    }
                    
                    // Jika 'startsWith', token pertama harus di awal (opsional, tapi search "kamus" biasanya mengandung)
                    // Disini kita gunakan logika: Semua token harus ada (AND) di dalam field tersebut
                    return {
                        [Op.and]: tokens.map(token => ({
                            [field]: { [Op.like]: `%${token}%` }
                        }))
                    };
                };

                switch (searchBy) {
                    case "title":
                        Object.assign(whereCondition, createTokenCondition('title'));
                        break;

                    case "call_number":
                        Object.assign(whereCondition, createTokenCondition('call_number'));
                        break;

                    case "author":
                        const authorInclude = includeOptions.find(opt => opt.model === Author);
                        if (authorInclude) {
                            authorInclude.required = true;
                            const condition = createTokenCondition('name');
                            
                            // Gabungkan dengan where yang sudah ada (jika ada)
                            if (authorInclude.where) {
                                authorInclude.where = { [Op.and]: [authorInclude.where, condition] };
                            } else {
                                authorInclude.where = condition;
                            }
                        }
                        break;

                    case "publisher":
                        const publisherInclude = includeOptions.find(opt => opt.model === Publisher);
                        if (publisherInclude) {
                            publisherInclude.required = true;
                            const condition = createTokenCondition('name');
                            
                            if (publisherInclude.where) {
                                publisherInclude.where = { [Op.and]: [publisherInclude.where, condition] };
                            } else {
                                publisherInclude.where = condition;
                            }
                        }
                        break;

                    case "subject":
                        const subjectSearchInclude = includeOptions.find(opt => opt.model === Subject);
                        if (subjectSearchInclude) {
                            subjectSearchInclude.required = true;
                            const condition = createTokenCondition('name');

                            if (subjectSearchInclude.where) {
                                subjectSearchInclude.where = { [Op.and]: [subjectSearchInclude.where, condition] };
                            } else {
                                subjectSearchInclude.where = condition;
                            }
                        }
                        break;

                    case "all":
                        // Untuk pencarian "Semua", agak tricky dengan token based.
                        // Logika: Judul mengandung (Token A DAN Token B) ATAU No Panggil mengandung (Token A DAN Token B)
                        const titleCondition = {
                            [Op.and]: tokens.map(token => ({ title: { [Op.like]: `%${token}%` } }))
                        };
                        const callNumCondition = {
                            [Op.and]: tokens.map(token => ({ call_number: { [Op.like]: `%${token}%` } }))
                        };

                        whereCondition[Op.and] = [
                            { id_ruangan: id_ruangan },
                            {
                                [Op.or]: [
                                    { title: { [Op.like]: `%${normalizedQ}%` } },
                                    { call_number: { [Op.like]: `%${normalizedQ}%` } }
                                ]
                            }
                        ];
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
            console.log("Sorting:", { sortBy: finalSortBy, sortOrder: finalSortOrder, actualSortOrder: actualSortOrder });
            console.log("Pagination:", { page: currentPage, limit: perPage, offset });
            console.log("===================");
            
            // Urutkan berdasarkan parameter sortBy dan sortOrder (sudah divalidasi di atas)
            // Gunakan actualSortOrder yang sudah disesuaikan untuk tanggal
            const { count, rows } = await Book.findAndCountAll({
                where: whereCondition,
                include: safeIncludeOptions,
                limit: perPage,
                offset,
                order: [[finalSortBy, actualSortOrder]],
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
                // Optimasi: Gunakan satu query GROUP BY untuk menghitung semua sekaligus
                // Lebih efisien daripada multiple count queries
                const exemplarsCount = await BookCopy.findAll({
                    attributes: [
                        'book_id',
                        [BookCopy.sequelize.fn('COUNT', BookCopy.sequelize.col('id')), 'count']
                    ],
                    where: {
                        book_id: { [Op.in]: bookIds }
                    },
                    group: ['book_id'],
                    raw: true
                });
                
                // Buat map untuk akses cepat jumlah eksemplar per buku
                exemplarsCount.forEach((item) => {
                    exemplarsMap[item.book_id] = parseInt(item.count) || 0;
                });
                
                // Set 0 untuk buku yang tidak memiliki eksemplar (tidak muncul di hasil GROUP BY)
                bookIds.forEach(bookId => {
                    if (!exemplarsMap.hasOwnProperty(bookId)) {
                        exemplarsMap[bookId] = 0;
                    }
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
                    id_ruangan: id_ruangan,
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