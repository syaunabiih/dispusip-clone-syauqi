const { Book, Category, Author, Publisher, Subject, BookCopy } = require("../models");
const { Op } = require("sequelize");
const ExcelJS = require('exceljs');

const EXCEL_COLUMNS = [
    { header: 'Judul Buku*', key: 'title', width: 30 },
    { header: 'Edisi', key: 'edition', width: 10 },
    { header: 'Tahun Terbit', key: 'publish_year', width: 12 },
    { header: 'Tempat Terbit', key: 'publish_place', width: 20 },
    { header: 'Deskripsi Fisik', key: 'physical_description', width: 25 },
    { header: 'ISBN', key: 'isbn', width: 20 },
    { header: 'No Panggil', key: 'call_number', width: 15 },
    { header: 'Bahasa', key: 'language', width: 15 },
    { header: 'Lokasi Rak*', key: 'shelf_location', width: 15 },
    { header: 'Kategori*', key: 'category', width: 20 },
    { header: 'Pengarang (pisahkan dengan koma)', key: 'authors', width: 30 },
    { header: 'Penerbit (pisahkan dengan koma)', key: 'publishers', width: 30 },
    { header: 'Subjek* (pisahkan dengan koma)', key: 'subjects', width: 30 },
    { header: 'Nomor Induk* (pisahkan dengan koma)', key: 'no_induk', width: 40 },
    { header: 'Catatan', key: 'notes', width: 30 },
    { header: 'Abstrak', key: 'abstract', width: 50 }
];

module.exports = {
    listBooks: async (req, res) => {
        try {
            const {
                q = "",
                searchBy = "title",
                matchType = "contains",
                category = "",
                subject = "",
                year = "",
                page = 1
            } = req.query;

            const limit = 100;
            const currentPage = parseInt(page) || 1;
            const offset = (currentPage - 1) * limit;

            let searchValue = q.trim();
            let operator = Op.like;
            if (q) {
                if (matchType === "startsWith") searchValue = `${q}%`;
                else if (matchType === "endsWith") searchValue = `%${q}`;
                else if (matchType === "exact") operator = Op.eq;
                else searchValue = `%${q}%`;
            }

            const whereCondition = {};
            if (category) whereCondition.category_id = category;
            if (year) whereCondition.publish_year = year;

            // Logika Kotak Pencarian Utama (Hanya kolom di tabel Book)
            if (q) {
                if (searchBy === "title") whereCondition.title = { [operator]: searchValue };
                if (searchBy === "isbn") whereCondition.isbn = { [operator]: searchValue };
            }

            const includeOptions = [
                { model: Category, required: false },
                { 
                    model: Author, 
                    as: 'Authors', 
                    required: (q && searchBy === "author"),
                    where: (q && searchBy === "author") ? { name: { [operator]: searchValue } } : null
                },
                { 
                    model: Publisher, 
                    as: 'Publishers', 
                    required: (q && searchBy === "publisher"),
                    where: (q && searchBy === "publisher") ? { name: { [operator]: searchValue } } : null
                },
                { 
                    model: Subject, 
                    as: 'Subjects', 
                    required: (!!subject || (q && searchBy === "subject")),
                    where: subject ? { id: subject } : ((q && searchBy === "subject") ? { name: { [operator]: searchValue } } : null)
                },
                { model: BookCopy, as: 'copies', required: false }
            ];

            // EKSEKUSI QUERY DENGAN PERBAIKAN LIMIT & COUNT
            const { count, rows: books } = await Book.findAndCountAll({
                where: whereCondition,
                include: includeOptions,
                order: [['id', 'DESC']],
                limit: limit,
                offset: offset,
                distinct: true, // Menghitung buku berdasarkan ID yang unik saja
                col: 'id'       // Memaksa count dilakukan hanya pada kolom Book.id untuk menghindari 'id' duplikat
            });

            let totalFilteredCopies = 0;
            if (q || category || subject || year) {
                // Jika ada filter, hitung jumlah eksemplar dari buku yang terfilter saja
                totalFilteredCopies = await BookCopy.count({
                    include: [{
                        model: Book,
                        where: whereCondition,
                        include: includeOptions.filter(opt => opt.model !== BookCopy), // Hindari circular include
                        required: true
                    }]
                });
            } else {
                // Jika tidak ada filter, hitung semua (lebih cepat)
                totalFilteredCopies = await BookCopy.count();
            }

            // Ambil Data untuk Dropdown
            const allCategories = await Category.findAll({ order: [['name', 'ASC']] });
            const allSubjects = await Subject.findAll({ order: [['name', 'ASC']] });
            
            // Ambil list tahun yang unik
            const allYearsRaw = await Book.findAll({
                attributes: [[Book.sequelize.fn("DISTINCT", Book.sequelize.col("publish_year")), "year"]],
                where: { publish_year: { [Op.ne]: null } },
                raw: true
            });

            res.render("admin/admin_books_list", {
                title: "Daftar Buku",
                books,
                totalTitle: count, 
                totalBook: totalFilteredCopies,
                currentPage: currentPage,
                totalPages: Math.ceil(count / limit),
                limit: limit,
                query: req.query,
                allCategories,
                allSubjects,
                allYears: allYearsRaw.map(y => y.year).filter(y => y && y !== '-').sort((a, b) => b - a)
            });
        } catch (err) {
            console.error("DEBUG ERROR:", err);
            res.status(500).send("Gagal memuat daftar buku: " + err.message);
        }
    },

    exportToExcel: async (req, res) => {
        try {
            const books = await Book.findAll({
                include: [
                    { model: Category },
                    { model: Author, as: 'Authors' },
                    { model: Publisher, as: 'Publishers' },
                    { model: Subject, as: 'Subjects' },
                    { model: BookCopy, as: 'copies' }
                ],
                order: [['id', 'ASC']]
            });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Data Buku');

            // KOLOM DISAMAKAN DENGAN TEMPLATE
            worksheet.columns = [
                { header: 'Judul Buku*', key: 'title', width: 30 },
                { header: 'Edisi', key: 'edition', width: 10 },
                { header: 'Tahun Terbit', key: 'publish_year', width: 12 },
                { header: 'Tempat Terbit', key: 'publish_place', width: 20 },
                { header: 'Deskripsi Fisik', key: 'physical_description', width: 25 },
                { header: 'ISBN', key: 'isbn', width: 20 },
                { header: 'No Panggil', key: 'call_number', width: 15 },
                { header: 'Bahasa', key: 'language', width: 15 },
                { header: 'Lokasi Rak', key: 'shelf_location', width: 15 },
                { header: 'Kategori', key: 'category', width: 20 },
                { header: 'Pengarang (pisahkan dengan koma)', key: 'authors', width: 30 },
                { header: 'Penerbit (pisahkan dengan koma)', key: 'publishers', width: 30 },
                { header: 'Subjek (pisahkan dengan koma)', key: 'subjects', width: 30 },
                { header: 'Nomor Induk (pisahkan dengan koma)', key: 'no_induk', width: 40 },
                { header: 'Catatan', key: 'notes', width: 30 },
                { header: 'Abstrak', key: 'abstract', width: 50 }
            ];

            books.forEach(book => {
                worksheet.addRow({
                    title: book.title,
                    edition: book.edition,
                    publish_year: book.publish_year,
                    publish_place: book.publish_place,
                    physical_description: book.physical_description,
                    isbn: book.isbn,
                    call_number: book.call_number,
                    language: book.language,
                    shelf_location: book.shelf_location,
                    category: book.Category ? book.Category.name : '',
                    authors: book.Authors ? book.Authors.map(a => a.name).join(', ') : '',
                    publishers: book.Publishers ? book.Publishers.map(p => p.name).join(', ') : '',
                    subjects: book.Subjects ? book.Subjects.map(s => s.name).join(', ') : '',
                    no_induk: book.copies ? book.copies.map(c => c.no_induk).join(', ') : '',
                    notes: book.notes,
                    abstract: book.abstract
                });
            });

            worksheet.getRow(1).font = { bold: true };
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=Export_Buku_${Date.now()}.xlsx`);
            await workbook.xlsx.write(res);
            res.end();
        } catch (err) {
            res.status(500).send("Gagal Export: " + err.message);
        }
    },
    
    downloadTemplate: async (req, res) => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Template Import Buku');

            worksheet.columns = [
                { header: 'Judul Buku*', key: 'title', width: 30 },
                { header: 'Edisi', key: 'edition', width: 10 },
                { header: 'Tahun Terbit', key: 'publish_year', width: 12 },
                { header: 'Tempat Terbit', key: 'publish_place', width: 20 },
                { header: 'Deskripsi Fisik', key: 'physical_description', width: 25 },
                { header: 'ISBN', key: 'isbn', width: 20 },
                { header: 'No Panggil', key: 'call_number', width: 15 },
                { header: 'Bahasa', key: 'language', width: 15 },
                { header: 'Lokasi Rak', key: 'shelf_location', width: 15 },
                { header: 'Kategori', key: 'category', width: 20 },
                { header: 'Pengarang (pisahkan dengan koma)', key: 'authors', width: 30 },
                { header: 'Penerbit (pisahkan dengan koma)', key: 'publishers', width: 30 },
                { header: 'Subjek (pisahkan dengan koma)', key: 'subjects', width: 30 },
                { header: 'Nomor Induk (pisahkan dengan koma)', key: 'no_induk', width: 40 },
                { header: 'Catatan', key: 'notes', width: 30 },
                { header: 'Abstrak', key: 'abstract', width: 50 }
            ];

            worksheet.addRow({ title: 'Contoh Judul Buku', category: 'Fiksi', authors: 'Penulis A, Penulis B', no_induk: 'B001, B002' });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=Template_Import_Buku.xlsx');
            await workbook.xlsx.write(res);
            res.end();
        } catch (err) {
            res.status(500).send("Gagal mengunduh template");
        }
    },

    importExcel: async (req, res) => {
        try {
            if (!req.file) return res.status(400).send("Tidak ada file yang diunggah");

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(req.file.buffer); 
            const worksheet = workbook.getWorksheet(1);

            let successCount = 0;
            let existingCount = 0;

            const booksData = [];
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; 
                booksData.push({
                    title: row.getCell(1).text.trim(),
                    edition: row.getCell(2).text,
                    publish_year: row.getCell(3).text,
                    publish_place: row.getCell(4).text,
                    physical_description: row.getCell(5).text,
                    isbn: row.getCell(6).text,
                    call_number: row.getCell(7).text,
                    language: row.getCell(8).text,
                    shelf_location: row.getCell(9).text,
                    categoryName: row.getCell(10).text,
                    authors: row.getCell(11).text,
                    publishers: row.getCell(12).text,
                    subjects: row.getCell(13).text,
                    noInduk: row.getCell(14).text,
                    notes: row.getCell(15).text,
                    abstract: row.getCell(16).text
                });
            });

            const processRel = async (book, input, Model, setter) => {
                if (input === null || input === undefined) return;

                // ⛑️ paksa jadi string
                const safeInput = String(input).trim();
                if (!safeInput) return;

                const names = safeInput
                    .split(/[\n,]+/)
                    .map(n => n.trim())
                    .filter(n => n.length > 0);

                const ids = [];

                for (const name of names) {
                    if (name.length > 191) {
                        console.log(`⚠️ Skip terlalu panjang: ${name}`);
                        continue;
                    }

                    const [obj] = await Model.findOrCreate({
                        where: { name }
                    });

                    ids.push(obj.id);
                }

                if (ids.length && typeof book[setter] === 'function') {
                    await book[setter](ids);
                }
            };

            for (const data of booksData) {
                if (!data.title) continue;

                let categoryId = null;
                const finalCategoryName = (data.categoryName && data.categoryName.trim() !== "") 
                                          ? data.categoryName.trim() 
                                          : 'Tanpa Kategori';
                
                const [cat] = await Category.findOrCreate({ 
                    where: { name: finalCategoryName } 
                });
                categoryId = cat.id;
                const [book, created] = await Book.findOrCreate({
                    where: { title: data.title },
                    defaults: {
                        title: data.title,
                        edition: data.edition,
                        publish_year: data.publish_year,
                        publish_place: data.publish_place,
                        physical_description: data.physical_description,
                        isbn: data.isbn,
                        call_number: data.call_number,
                        language: data.language,
                        shelf_location: data.shelf_location,
                        notes: data.notes,
                        abstract: data.abstract,
                        category_id: categoryId
                    }
                });

                if (created) {
                    successCount++;
                } else {
                    existingCount++;
                }

                if (data.noInduk) {
                    const nos = data.noInduk.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== "");
                    
                    for (const n of nos) {
                        try {
                            const [copy, copyCreated] = await BookCopy.findOrCreate({
                                where: { no_induk: n }, 
                                defaults: { 
                                    book_id: book.id, 
                                    status: 'tersedia' 
                                }
                            });

                        } catch (copyErr) {
                            console.log(`---> Skip Nomor Induk [${n}]: Sudah digunakan oleh buku lain.`);
                            continue; 
                        }
                    }
                    
                    const countTotal = await BookCopy.count({ where: { book_id: book.id } });
                    await book.update({ stock_total: countTotal });
                }

                const processAuthors = async (input) => {
                    if (!input) return;

                    const authors = input
                        .replace(/\(pengarang\)/gi, ',')
                        .replace(/\(editor\)/gi, ',')
                        .split(/[\n,]+/)
                        .map(a => a.trim())
                        .filter(a => a.length > 0);

                    const ids = [];

                    for (const name of authors) {
                        if (name.length > 191) {
                            console.log(`⚠️ Skip author terlalu panjang: ${name}`);
                            continue;
                        }

                        const [author] = await Author.findOrCreate({
                            where: { name }
                        });

                        ids.push(author.id);
                    }

                    if (ids.length) {
                        await book.setAuthors(ids);
                    }
                };

                await processAuthors(data.authors);
                await processRel(book, data.publishers, Publisher, 'setPublishers');
                await processRel(book, data.subjects, Subject, 'setSubjects');
            }

            res.redirect(`/admin/books?importSuccess=${successCount}&importExisting=${existingCount}`);
        } catch (err) {
            console.error(err);
            res.status(500).send("Gagal mengimport data: " + err.message);
        }
    },
    

    deleteMultiple: async (req, res) => {
        try {
            const { bookIds, excludeIds, confirmation, deleteAll, q, page } = req.body;
            const redirectUrl = `/admin/books?q=${encodeURIComponent(q || '')}&page=${page || 1}`;

            if (confirmation !== "HAPUS DATA") {
                return res.status(400).send("Konfirmasi salah.");
            }

            if (deleteAll === 'true') {
                // Konversi excludeIds ke array jika cuma 1 string
                const excluded = Array.isArray(excludeIds) ? excludeIds : (excludeIds ? [excludeIds] : []);
                
                await Book.destroy({
                    where: {
                        id: { [Op.notIn]: excluded } // HAPUS SEMUA KECUALI ID DI LIST INI
                    }
                });
                return res.redirect("/admin/books?deleteSuccess=all");
            }

            // Logika Normal (Manual per ID)
            const idsToDelete = Array.isArray(bookIds) ? bookIds : [bookIds];
            if (!idsToDelete || idsToDelete.length === 0) return res.redirect(redirectUrl);

            await Book.destroy({
                where: { id: { [Op.in]: idsToDelete } }
            });

            res.redirect(`${redirectUrl}&deleteSuccess=${idsToDelete.length}`); // Ganti ids.length jadi idsToDelete.length
        } catch (err) {
            console.error(err);
            res.status(500).send("Gagal menghapus data");
        }
    }, 
    // =========================
    // SHOW HALAMAN TAMBAH BUKU
    // =========================
    showAddPage: async (req, res) => {
        try {
            const categories = await Category.findAll();
            const authors = await Author.findAll();
            const publishers = await Publisher.findAll();
            const subjects = await Subject.findAll();

            res.render("admin/admin_add_book", {
                title: "Tambah Buku",
                categories,
                authors,
                publishers,
                subjects
            });

        } catch (err) {
            console.log(err);
            res.status(500).send("Gagal memuat halaman tambah buku");
        }
    },

    // =========================
    // ADD BOOK
    // =========================
    addBook: async (req, res) => {
        try {
            const data = req.body;

            // 1. Logika Kategori (Tetap sama)
            let categoryId = null;
            if (data.category_id) {
                const cat = Array.isArray(data.category_id) ? data.category_id[0] : data.category_id;
                if (isNaN(cat)) {
                    const newCategory = await Category.create({ name: String(cat) });
                    categoryId = newCategory.id;
                } else {
                    categoryId = cat;
                }
            }

            // =====================
            // AUTHORS
            // =====================
            let authorIds = [];
            if (data.authors) {
                const authorsArray = Array.isArray(data.authors) ? data.authors : [data.authors];
                for (const a of authorsArray) {
                    if (isNaN(a)) {
                        const newAuthor = await Author.create({ name: String(a) });
                        authorIds.push(newAuthor.id);
                    } else {
                        authorIds.push(a);
                    }
                }
            }

            // =====================
            // PUBLISHERS
            // =====================
            let publisherIds = [];
            if (data.publishers) {
                const publishersArray = Array.isArray(data.publishers) ? data.publishers : [data.publishers];
                for (const p of publishersArray) {
                    if (isNaN(p)) {
                        const newPublisher = await Publisher.create({ name: String(p) });
                        publisherIds.push(newPublisher.id);
                    } else {
                        publisherIds.push(p);
                    }
                }
            }

            // =====================
            // SUBJECTS
            // =====================
            let subjectIds = [];
            if (data.subjects) {
                const subjectsArray = Array.isArray(data.subjects) ? data.subjects : [data.subjects];
                for (const s of subjectsArray) {
                    if (isNaN(s)) {
                        const newSubject = await Subject.create({ name: String(s) });
                        subjectIds.push(newSubject.id);
                    } else {
                        subjectIds.push(s);
                    }
                }
            }

            // =====================
            // CREATE BOOK (FINAL)
            // =====================
            const book = await Book.create({
                title: data.title,
                edition: data.edition,
                publish_year: data.publish_year,
                publish_place: data.publish_place,
                physical_description: data.physical_description,
                isbn: data.isbn,
                call_number: data.call_number,
                abstract: data.abstract,
                notes: data.notes,
                language: data.language,
                shelf_location: data.shelf_location,
                category_id: categoryId,
                image: req.file ? req.file.filename : null
            });

            if (data.no_induk) {
                // Kita asumsikan input no_induk dikirim sebagai string (dipisah koma atau baris baru)
                // Contoh input: "B001, B002, B003"
                const noIndukRaw = data.no_induk;
                
                // Bersihkan input: pecah string menjadi array, hapus spasi kosong, buang nilai kosong
                const noIndukArray = noIndukRaw.split(/[\n,]+/).map(item => item.trim()).filter(item => item !== "");

                if (noIndukArray.length > 0) {
                    // Siapkan data untuk bulkInsert
                    const copyData = noIndukArray.map(nomor => ({
                        book_id: book.id,
                        no_induk: nomor,
                        status: 'tersedia'
                    }));

                    // Simpan semua nomor induk sekaligus
                    await BookCopy.bulkCreate(copyData);
                    
                    // Update total stok di tabel Book secara otomatis berdasarkan jumlah nomor induk
                    await book.update({ stock_total: noIndukArray.length });
                }
            }

            // =====================
            // RELATIONS
            // =====================
            if (authorIds.length) await book.setAuthors(authorIds);
            if (publisherIds.length) await book.setPublishers(publisherIds);
            if (subjectIds.length) await book.setSubjects(subjectIds);

            res.redirect("/admin/books");

        } catch (err) {
            console.log("Error creating book:", err);
            res.status(500).send("Error creating book: " + err.message);
        }
    },

    // =========================
    // SHOW HALAMAN EDIT BUKU
    // =========================
    showEditPage: async (req, res) => {
        try {
            const book = await Book.findByPk(req.params.id, {
                include: [
                    Category,
                    { model: Author, as: 'Authors' },
                    { model: Publisher, as: 'Publishers' },
                    { model: Subject, as: 'Subjects' },
                    { model: BookCopy, as: 'copies' } 
                ]
            });

            if (!book) return res.status(404).send("Buku tidak ditemukan");

            const categories = await Category.findAll();
            const authors = await Author.findAll();
            const publishers = await Publisher.findAll();
            const subjects = await Subject.findAll();

            res.render("admin/admin_edit_book", {
                title: "Edit Buku",
                book,
                categories,
                authors,
                publishers,
                subjects,
                query: req.query
            });
        } catch (err) {
            console.log(err);
            res.status(500).send("Gagal memuat halaman edit buku");
        }
    },

    // =========================
    // UPDATE BOOK
    // =========================
   updateBook: async (req, res) => {
        try {
            const book = await Book.findByPk(req.params.id);
            if (!book) return res.status(404).send("Buku tidak ditemukan");

            const data = req.body;
            const originQ = data.origin_q || "";
            const originPage = data.origin_page || "1";
            const originSearchBy = data.origin_searchBy || "title";
            const originMatchType = data.origin_matchType || "contains";
            
            const originCategory = data.origin_category || "";
            const originSubject = data.origin_subject || "";
            const originYear = data.origin_year || "";

            const queryParams = new URLSearchParams({
                q: originQ,
                searchBy: originSearchBy,
                matchType: originMatchType,
                category: originCategory,
                subject: originSubject,
                year: originYear,
                page: originPage
            });

            // =========================
            // CATEGORY
            // =========================
            let categoryId = null;
            if (data.category_id) {
                const cat = Array.isArray(data.category_id)
                    ? data.category_id[0]
                    : data.category_id;

                if (isNaN(cat)) {
                    const newCategory = await Category.create({ name: String(cat) });
                    categoryId = newCategory.id;
                } else {
                    categoryId = cat;
                }
            }

            // =========================
            // AUTHORS
            // =========================
            let authorIds = [];
            if (data.authors) {
                const authorsArray = Array.isArray(data.authors)
                    ? data.authors
                    : [data.authors];

                for (const a of authorsArray) {
                    if (isNaN(a)) {
                        const newAuthor = await Author.create({ name: String(a) });
                        authorIds.push(newAuthor.id);
                    } else {
                        authorIds.push(a);
                    }
                }
            }

            // =========================
            // PUBLISHERS
            // =========================
            let publisherIds = [];
            if (data.publishers) {
                const publishersArray = Array.isArray(data.publishers)
                    ? data.publishers
                    : [data.publishers];

                for (const p of publishersArray) {
                    if (isNaN(p)) {
                        const newPublisher = await Publisher.create({ name: String(p) });
                        publisherIds.push(newPublisher.id);
                    } else {
                        publisherIds.push(p);
                    }
                }
            }

            // =========================
            // SUBJECTS
            // =========================
            let subjectIds = [];
            if (data.subjects) {
                const subjectsArray = Array.isArray(data.subjects)
                    ? data.subjects
                    : [data.subjects];

                for (const s of subjectsArray) {
                    if (isNaN(s)) {
                        const newSubject = await Subject.create({ name: String(s) });
                        subjectIds.push(newSubject.id);
                    } else {
                        subjectIds.push(s);
                    }
                }
            }

            // =========================
            // UPDATE BOOK DATA (TANPA STOCK)
            // =========================
            await book.update({
                title: data.title,
                edition: data.edition,
                publish_year: data.publish_year,
                publish_place: data.publish_place,
                physical_description: data.physical_description,
                isbn: data.isbn,
                call_number: data.call_number,
                abstract: data.abstract,
                notes: data.notes,
                language: data.language,
                shelf_location: data.shelf_location,
                category_id: data.category_id
            });

            // =========================
            // UPDATE BOOK COPIES (NO INDUK)
            // =========================
            if (data.no_induk) {
                const noIndukArray = data.no_induk
                    .split(/[\n,]+/)
                    .map(n => n.trim())
                    .filter(n => n !== "");

                // 1. Hapus semua copy lama
                await BookCopy.destroy({
                    where: { book_id: book.id }
                });

                // 2. Insert ulang copy baru
                if (noIndukArray.length > 0) {
                    const copyData = noIndukArray.map(nomor => ({
                        book_id: book.id,
                        no_induk: nomor,
                        status: 'tersedia'
                    }));

                    await BookCopy.bulkCreate(copyData);

                    // 3. Update stock_total otomatis
                    await book.update({
                        stock_total: noIndukArray.length
                    });
                }
            }

            // =========================
            // UPDATE RELATIONS
            // =========================
            if (authorIds.length) await book.setAuthors(authorIds);
            if (publisherIds.length) await book.setPublishers(publisherIds);
            if (subjectIds.length) await book.setSubjects(subjectIds);

            res.redirect(`/admin/books?${queryParams.toString()}`);

        } catch (err) {
            console.error(err);
            res.status(500).send("Gagal memperbarui buku: " + err.message);
        }
    },

    // =========================
    // DELETE BOOK
    // =========================
    deleteBook: async (req, res) => {
        try {
            const book = await Book.findByPk(req.params.id);
            if (!book) return res.status(404).send("Buku tidak ditemukan");

            await book.destroy();
            res.redirect(`${redirectUrl}&deleteSuccess=${ids.length}`);
        } catch (err) {
            console.log(err);
            res.status(500).send("Gagal menghapus buku");
        }
    },

    // =========================
    // AUTOCOMPLETE FUNCTIONS
    // =========================
    findCategory: async (req, res) => {
        try {
            const q = req.query.q || "";
            const categories = await Category.findAll({
                where: { name: { [Op.like]: `%${q}%` } },
                limit: 10
            });
            res.json(categories);
        } catch (err) {
            console.log(err);
            res.status(500).send("Gagal mencari kategori");
        }
    },

    findAuthor: async (req, res) => {
        try {
            const q = req.query.q || "";
            const authors = await Author.findAll({
                where: { name: { [Op.like]: `%${q}%` } },
                limit: 10
            });
            res.json(authors);
        } catch (err) {
            console.log(err);
            res.status(500).send("Gagal mencari author");
        }
    },

    findPublisher: async (req, res) => {
        try {
            const q = req.query.q || "";
            const publishers = await Publisher.findAll({
                where: { name: { [Op.like]: `%${q}%` } },
                limit: 10
            });
            res.json(publishers);
        } catch (err) {
            console.log(err);
            res.status(500).send("Gagal mencari publisher");
        }
    },

    findSubject: async (req, res) => {
        try {
            const q = req.query.q || "";
            const subjects = await Subject.findAll({
                where: { name: { [Op.like]: `%${q}%` } },
                limit: 10
            });
            res.json(subjects);
        } catch (err) {
            console.log(err);
            res.status(500).send("Gagal mencari subject");
        }
    }
};