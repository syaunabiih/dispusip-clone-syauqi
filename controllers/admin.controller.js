const { Book, Category, Author, Publisher, Subject, BookCopy } = require("../models");
const { Op } = require("sequelize");

module.exports = {
    // =========================
    // LIST BUKU
    // =========================
    listBooks: async (req, res) => {
        try {
            const q = req.query.q || "";

            // total semua buku (tanpa filter search)
            const totalTitle = await Book.count();
            const totalBook = await BookCopy.count();

            // daftar buku (dengan search jika ada)
            const books = await Book.findAll({
                where: q ? { title: { [Op.like]: `%${q}%` } } : {},
                include: [
                    { model: Category },
                    { model: Author, as: 'Authors' },
                    { model: Publisher, as: 'Publishers' },
                    { model: Subject, as: 'Subjects' }
                ],
                order: [['id', 'ASC']]
            });

            res.render("admin/admin_books_list", {
                title: "Daftar Buku",
                books,
                q,
                totalTitle,
                totalBook
            });

        } catch (err) {
            console.log(err);
            res.status(500).send("Gagal memuat daftar buku");
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