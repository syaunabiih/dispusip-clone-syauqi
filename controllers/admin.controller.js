const { Book, Category, Author, Publisher, Subject, BookCopy } = require("../models");
const { Op } = require("sequelize");
const ExcelJS = require('exceljs');

module.exports = {
    listBooks: async (req, res) => {
    try {
        const q = req.query.q || "";
        const page = parseInt(req.query.page) || 1; 
        const limit = 100;
        const offset = (page - 1) * limit;

        const totalTitle = await Book.count();
        const totalBook = await BookCopy.count();

        const { count, rows: books } = await Book.findAndCountAll({
            where: q ? { title: { [Op.like]: `%${q}%` } } : {},
            include: [
                { model: Category },
                { model: Author, as: 'Authors' },
                { model: Publisher, as: 'Publishers' },
                { model: Subject, as: 'Subjects' }
            ],
            order: [['id', 'DESC']],
            limit: limit,
            offset: offset,
            distinct: true
        });

        const totalPages = Math.ceil(count / limit);

        res.render("admin/admin_books_list", {
            title: "Daftar Buku",
            books,
            q,
            totalTitle,
            totalBook,
            currentPage: page,
            totalPages: totalPages,
            limit: limit,
            query: req.query
        });

    } catch (err) {
        console.log(err);
        res.status(500).send("Gagal memuat daftar buku");
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

            worksheet.columns = [
                { header: 'Judul Buku', key: 'title', width: 35 },
                { header: 'Edisi', key: 'edition', width: 10 },
                { header: 'Tahun', key: 'publish_year', width: 10 },
                { header: 'Tempat Terbit', key: 'publish_place', width: 20 },
                { header: 'ISBN', key: 'isbn', width: 20 },
                { header: 'Kategori', key: 'category', width: 20 },
                { header: 'Pengarang', key: 'authors', width: 30 },
                { header: 'Penerbit', key: 'publishers', width: 30 },
                { header: 'Nomor Induk', key: 'no_induk', width: 25 }, 
                { header: 'Lokasi Rak', key: 'shelf_location', width: 15 }
            ];

            books.forEach(book => {
                if (book.copies && book.copies.length > 0) {
                    book.copies.forEach(copy => {
                        worksheet.addRow({
                            title: book.title,
                            edition: book.edition,
                            publish_year: book.publish_year,
                            publish_place: book.publish_place,
                            isbn: book.isbn,
                            category: book.Category ? book.Category.name : '-',
                            authors: book.Authors.map(a => a.name).join(', '),
                            publishers: book.Publishers.map(p => p.name).join(', '),
                            no_induk: copy.no_induk,
                            shelf_location: book.shelf_location
                        });
                    });
                } else {
                    worksheet.addRow({
                        title: book.title,
                        no_induk: '-'
                    });
                }
            });

            worksheet.getRow(1).font = { bold: true };
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=Data_Buku_${Date.now()}.xlsx`);
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
            const { bookIds, excludeIds, confirmation, deleteAll } = req.body;
            
            // 1. Logika HAPUS SELURUH DATABASE (Bisa dengan pengecualian)
            if (deleteAll === 'true') {
                const excluded = Array.isArray(excludeIds) ? excludeIds : (excludeIds ? [excludeIds] : []);
                await Book.destroy({
                    where: {
                        id: { [Op.notIn]: excluded } // Hapus semua KECUALI yang ID-nya ada di list uncheck
                    }
                });
                return res.redirect("/admin/books?deleteSuccess=all");
            }

            // 2. Logika HAPUS YANG DICENTANG SAJA (Mode Normal)
            if (confirmation !== "HAPUS DATA") {
                return res.status(400).send("Konfirmasi salah.");
            }

            const idsToDelete = Array.isArray(bookIds) ? bookIds : [bookIds];
            if (!idsToDelete || idsToDelete.length === 0) return res.redirect("/admin/books");

            await Book.destroy({
                where: { id: { [Op.in]: idsToDelete } }
            });

            res.redirect("/admin/books?deleteSuccess=" + idsToDelete.length);
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
                subjects
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
                category_id: categoryId,
                image: req.file ? req.file.filename : book.image
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

            res.redirect("/admin/books");

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
            res.redirect("/admin/books");
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