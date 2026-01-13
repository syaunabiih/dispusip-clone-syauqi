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
    { header: 'Penulis*', key: 'authors_penulis', width: 30 },
    { header: 'Editor', key: 'authors_editor', width: 30 },
    { header: 'Penanggung Jawab', key: 'authors_pj', width: 30 },
    { header: 'Penerbit (pisahkan dengan koma)', key: 'publishers', width: 30 },
    { header: 'Subjek* (pisahkan dengan koma)', key: 'subjects', width: 30 },
    { header: 'Nomor Induk* (pisahkan dengan koma)', key: 'no_induk', width: 40 },
    { header: 'Catatan', key: 'notes', width: 30 },
    { header: 'Abstrak', key: 'abstract', width: 50 }
];

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const downloadImage = async (url, title) => {
    try {
        if (!url || !url.startsWith('http')) return null;
        
        const fileName = `${Date.now()}-${title.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 50)}.jpg`;
        const uploadPath = path.join(__dirname, '../public/image/uploads', fileName);
        
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(uploadPath);
            response.data.pipe(writer);
            writer.on('finish', () => resolve(fileName));
            writer.on('error', (err) => {
                console.error("Download Error:", err);
                resolve(null);
            });
        });
    } catch (error) {
        console.error("URL Image Error:", error.message);
        return null;
    }
};

const processAuthorsWithRoles = async (bookId, inputNames, inputRoles, Author, BookAuthor) => {
    if (!inputNames) return;

    const names = Array.isArray(inputNames) ? inputNames : [inputNames];
    const roles = Array.isArray(inputRoles) ? inputRoles : [inputRoles];

    for (let i = 0; i < names.length; i++) {
        let authorId;
        const nameOrId = names[i];
        if (!nameOrId) continue;

        if (isNaN(nameOrId)) {
            const [newAuthor] = await Author.findOrCreate({ where: { name: nameOrId.trim() } });
            authorId = newAuthor.id;
        } else {
            authorId = nameOrId;
        }

        await BookAuthor.create({
            book_id: bookId,
            author_id: authorId,
            role: roles[i] 
        });
    }
};


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
                page = 1,
                incomplete = ""
            } = req.query;

            const isIncomplete = incomplete === "1";

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
            if (subject) {
                whereCondition['$Subjects.id$'] = subject;
            }

            // Logika Kotak Pencarian Utama (Hanya kolom di tabel Book)
            if (q) {
                if (searchBy === "title") whereCondition.title = { [operator]: searchValue };
                if (searchBy === "isbn") whereCondition.isbn = { [operator]: searchValue };
            }

            if (q && searchBy === "subject") {
                whereCondition['$Subjects.name$'] = { [operator]: searchValue };
            }

            if (q && searchBy === "category") {
                whereCondition['$Category.name$'] = { [operator]: searchValue };
            }

            const includeOptions = [
                { model: Category, required: false },

                { model: Author, as: 'Authors', required: false },
                { model: Publisher, as: 'Publishers', required: false },
                { model: Subject, as: 'Subjects', required: false },

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

            let filteredBooks = books;

            if (isIncomplete) {
                filteredBooks = books.filter(book => {
                    const hasCategory = !!book.Category;
                    const hasSubjects = book.Subjects && book.Subjects.length > 0;
                    const hasShelf =
                        book.shelf_location &&
                        book.shelf_location.trim() !== "" &&
                        book.shelf_location !== "-";
                    const hasCopies = book.copies && book.copies.length > 0;
                    const hasIsbn = !!book.isbn && book.isbn.trim() !== "";
                    const hasCallNumber = !!book.call_number && book.call_number.trim() !== "";
                    const hasAuthors = book.Authors && book.Authors.length > 0;
                    const hasPublishers = book.Publishers && book.Publishers.length > 0;

                    return !hasCategory || !hasSubjects || !hasShelf || !hasCopies || !hasIsbn || !hasCallNumber || !hasAuthors || !hasPublishers;
                });
            }

            let totalFilteredCopies = 0;
            if (q || category || subject || year) {
                totalFilteredCopies = await BookCopy.count({
                    include: [{
                        model: Book,
                        where: whereCondition,
                        include: includeOptions.filter(opt => opt.model !== BookCopy), 
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
                books: filteredBooks,
                totalTitle: isIncomplete ? filteredBooks.length : count,
                totalBook: totalFilteredCopies,
                currentPage: currentPage,
                totalPages: Math.ceil(count / limit),
                limit: limit,
                query: req.query,
                allCategories,
                allSubjects,
                allYears: allYearsRaw.map(y => y.year).filter(y => y && y !== '-').sort((a, b) => b - a),
                incomplete: isIncomplete,
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
            worksheet.columns = EXCEL_COLUMNS;

            books.forEach(book => {
            // Fungsi helper untuk ambil nama berdasarkan role
            const getNamesByRole = (role) => {
                return book.Authors 
                    ? book.Authors.filter(a => a.BookAuthor.role === role).map(a => a.name).join(', ') 
                    : '';
            };

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
                authors_penulis: getNamesByRole('penulis'),
                authors_editor: getNamesByRole('editor'),
                authors_pj: getNamesByRole('penanggung jawab'),
                    publishers: book.Publishers ? book.Publishers.map(p => p.name).join(', ') : '',
                    subjects: book.Subjects ? book.Subjects.map(s => s.name).join(', ') : '',
                    no_induk: book.copies ? book.copies.map(c => c.no_induk).join(', ') : '',
                    notes: book.notes,
                    abstract: book.abstract,
                    image: book.image
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

            worksheet.columns = EXCEL_COLUMNS;

            worksheet.addRow({ title: 'Contoh Judul Buku', category: 'Fiksi', authors: 'Penulis A, Penulis B', no_induk: 'B001, B002',imageUrl: 'https://upload.wikimedia.org/wikipedia/id/8/8e/Laskar_pelangi_sampul.jpg' });

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
            const { Book, Category, Author, Publisher, Subject, BookCopy, BookAuthor } = require("../models");
            
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
                    // --- URUTAN BARU ---
                    authorsPenulis: row.getCell(11).text, // Kolom Penulis
                    authorsEditor: row.getCell(12).text,  // Kolom Editor
                    authorsPJ: row.getCell(13).text,      // Kolom PJ
                    // Kolom sisanya bergeser (+2 dari sebelumnya)
                    publishers: row.getCell(14).text,
                    subjects: row.getCell(15).text,
                    noInduk: row.getCell(16).text,
                    notes: row.getCell(17).text,
                    abstract: row.getCell(18).text,
                    imageInput: row.getCell(19).text.trim()
                });
            });

            for (const data of booksData) {
                if (!data.title) continue;

                let book = await Book.findOne({ where: { title: data.title } });
                
                // --- LOGIKA GAMBAR ---
                let finalImageName = null;
                if (data.imageInput) {
                    if (data.imageInput.startsWith('http')) {
                        finalImageName = await downloadImage(data.imageInput, data.title);
                    } else {
                        const checkPath = path.join(__dirname, '../public/image/uploads', data.imageInput);
                        if (fs.existsSync(checkPath)) finalImageName = data.imageInput;
                    }
                }

                if (!book) {
                    // --- BUKU BARU ---
                    const finalCategoryName = (data.categoryName && data.categoryName.trim() !== "") ? data.categoryName.trim() : 'Tanpa Kategori';
                    const [cat] = await Category.findOrCreate({ where: { name: finalCategoryName } });

                    book = await Book.create({
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
                        category_id: cat.id,
                        image: finalImageName
                    });
                    successCount++;
                } else {
                    // --- LENGKAPI DATA ---
                    const updateData = {};
                    const fields = ['edition', 'publish_year', 'publish_place', 'physical_description', 'isbn', 'call_number', 'language', 'shelf_location', 'notes', 'abstract'];
                    fields.forEach(f => {
                        if ((!book[f] || book[f] === '-' || book[f] === '') && data[f]) updateData[f] = data[f];
                    });
                    if ((!book.image || book.image === '') && finalImageName) updateData.image = finalImageName;
                    if (Object.keys(updateData).length > 0) await book.update(updateData);
                    existingCount++;
                }

                // --- LOGIKA NOMOR INDUK ---
                if (data.noInduk) {
                    const nos = data.noInduk.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== "");
                    for (const n of nos) {
                        await BookCopy.findOrCreate({
                            where: { no_induk: n }, 
                            defaults: { book_id: book.id, status: 'tersedia' }
                        });
                    }
                    const countTotal = await BookCopy.count({ where: { book_id: book.id } });
                    await book.update({ stock_total: countTotal });
                }

                // --- LOGIKA RELASI AUTHOR DENGAN ROLE (3 KOLOM) ---
                const importAuthorWithRole = async (input, roleName) => {
                    if (!input) return;
                    const names = String(input).split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 0);
                    for (const name of names) {
                        const [authObj] = await Author.findOrCreate({ where: { name } });
                        // findOrCreate di BookAuthor agar tidak duplikat jika import ulang
                        await BookAuthor.findOrCreate({
                            where: { 
                                book_id: book.id, 
                                author_id: authObj.id, 
                                role: roleName 
                            }
                        });
                    }
                };

                await importAuthorWithRole(data.authorsPenulis, 'penulis');
                await importAuthorWithRole(data.authorsEditor, 'editor');
                await importAuthorWithRole(data.authorsPJ, 'penanggung jawab');

                // --- LOGIKA RELASI PUBLISHER & SUBJECT ---
                const processRel = async (bookObj, input, Model, getter, setter) => {
                    if (!input) return;
                    const names = String(input).split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 0);
                    const currentItems = await bookObj[getter]();
                    const existingIds = currentItems.map(item => item.id);
                    const newIds = [];
                    for (const name of names) {
                        const [obj] = await Model.findOrCreate({ where: { name } });
                        newIds.push(obj.id);
                    }
                    const finalIds = [...new Set([...existingIds, ...newIds])];
                    await bookObj[setter](finalIds);
                };

                await processRel(book, data.publishers, Publisher, 'getPublishers', 'setPublishers');
                await processRel(book, data.subjects, Subject, 'getSubjects', 'setSubjects');
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
            const { BookAuthor, Author, Category, Subject, Book, BookCopy, Publisher } = require("../models");

            if (!data.title || !data.category_id || !data.subjects || !data.shelf_location || !data.no_induk|| !data.isbn || !data.call_number || !data.publishers || !data.authors_penulis) {
                return res.status(400).json({ success: false, message: "Judul, Kategori, Subjek, Lokasi Rak, dan Nomor Induk, ISBN, Call Number, Penerbit, dan Penulis wajib diisi!" });
            }

            // 1. Logika Kategori (Gunakan findOrCreate agar aman)
            let categoryId = data.category_id;
            if (isNaN(categoryId)) {
                const [newCategory] = await Category.findOrCreate({ where: { name: String(categoryId).trim() } });
                categoryId = newCategory.id;
            }

            // 2. CREATE BUKU DULU (PENTING: Variabel 'book' harus dibuat dulu)
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

            // 3. BARU PROSES ROLE (Sekarang variabel 'book' sudah ada)
            const processRole = async (input, roleName) => {
                if (!input) return;
                const names = Array.isArray(input) ? input : [input];
                for (const nameOrId of names) {
                    if (!nameOrId) continue;
                    let authorId;
                    if (isNaN(nameOrId)) {
                        const [newAuthor] = await Author.findOrCreate({ where: { name: nameOrId.trim() } });
                        authorId = newAuthor.id;
                    } else {
                        authorId = nameOrId;
                    }
                    // Sekarang variabel 'book.id' sudah bisa diakses
                    await BookAuthor.create({
                        book_id: book.id,
                        author_id: authorId,
                        role: roleName
                    });
                }
            };

            await processRole(data.authors_penulis, 'penulis');
            await processRole(data.authors_editor, 'editor');
            await processRole(data.authors_pj, 'penanggung jawab');

            // 4. Logika Nomor Induk (tetap sama)
            if (data.no_induk) {
                const noIndukArray = data.no_induk.split(/[\n,]+/).map(item => item.trim()).filter(item => item !== "");
                if (noIndukArray.length > 0) {
                    const existingCopies = await BookCopy.findAll({
                        where: { no_induk: { [Op.in]: noIndukArray } }
                    });

                    if (existingCopies.length > 0) {
                        const duplicateNumbers = existingCopies.map(c => c.no_induk).join(', ');
                        await book.destroy(); // Hapus buku yang baru dibuat karena nomor induk duplikat
                        return res.status(400).json({ 
                            success: false, 
                            message: `Nomor Induk [${duplicateNumbers}] sudah terdaftar!` 
                        });
                    }

                    const copyData = noIndukArray.map(nomor => ({
                        book_id: book.id,
                        no_induk: nomor,
                        status: 'tersedia'
                    }));

                    await BookCopy.bulkCreate(copyData);
                    await book.update({ stock_total: noIndukArray.length });
                }
            }

            // 5. Logika Publishers & Subjects (Gunakan findOrCreate)
            if (data.publishers) {
                const pubArray = Array.isArray(data.publishers) ? data.publishers : [data.publishers];
                const pubIds = [];
                for (const p of pubArray) {
                    if (!p) continue;
                    const [pub] = isNaN(p) 
                        ? await Publisher.findOrCreate({ where: { name: p.trim() } }) 
                        : [{ id: p }];
                    pubIds.push(pub.id);
                }
                await book.setPublishers(pubIds);
            }

            if (data.subjects) {
                const subArray = Array.isArray(data.subjects) ? data.subjects : [data.subjects];
                const subIds = [];
                for (const s of subArray) {
                    if (!s) continue;
                    const [sub] = isNaN(s) 
                        ? await Subject.findOrCreate({ where: { name: s.trim() } }) 
                        : [{ id: s }];
                    subIds.push(sub.id);
                }
                await book.setSubjects(subIds);
            }

            return res.status(200).json({ success: true, redirectUrl: "/admin/books?addSuccess=1" });

        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: "Terjadi kesalahan sistem: " + err.message });
        }
    },

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
            const { BookAuthor, Author, Category, Subject, Book, BookCopy, Publisher } = require("../models");
            const book = await Book.findByPk(req.params.id);
            if (!book) return res.status(404).json({ success: false, message: "Buku tidak ditemukan" });

            const data = req.body;

            // 1. Validasi Required
            if (!data.title || !data.category_id || !data.shelf_location || !data.no_induk|| !data.isbn || !data.call_number || !data.publishers || !data.authors_penulis) {
                return res.status(400).json({ success: false, message: "Gagal: Judul, Kategori, Lokasi, dan Nomor Induk, ISBN, Call Number, Penerbit, dan Penulis wajib diisi!" });
            }

            const queryParams = new URLSearchParams({
                q: data.origin_q || "",
                searchBy: data.origin_searchBy || "title",
                matchType: data.origin_matchType || "contains",
                category: data.origin_category || "",
                subject: data.origin_subject || "",
                year: data.origin_year || "",
                page: data.origin_page || "1"
            });

            // 2. Update Kategori
            let categoryId = data.category_id;
            if (isNaN(categoryId)) {
                const [newCategory] = await Category.findOrCreate({ where: { name: String(categoryId).trim() } });
                categoryId = newCategory.id;
            }

            // 3. Update Data Utama Buku
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
                category_id: categoryId
            });

            // 4. PROSES ULANG AUTHORS (Hapus Lama, Insert Baru)
            await BookAuthor.destroy({ where: { book_id: book.id } });

            const processRole = async (input, roleName) => {
                if (!input) return;
                const names = Array.isArray(input) ? input : [input];
                for (const item of names) {
                    if (!item) continue;
                    let authorId;
                    if (isNaN(item)) {
                        const [newAuth] = await Author.findOrCreate({ where: { name: item.trim() } });
                        authorId = newAuth.id;
                    } else {
                        authorId = item;
                    }
                    await BookAuthor.create({ book_id: book.id, author_id: authorId, role: roleName });
                }
            };

            await processRole(data.authors_penulis, 'penulis');
            await processRole(data.authors_editor, 'editor');
            await processRole(data.authors_pj, 'penanggung jawab');

            // 5. Update Nomor Induk (tetap sama)
            if (data.no_induk) {
                const noIndukArray = data.no_induk.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== "");
                const existingCopies = await BookCopy.findAll({
                    where: { no_induk: { [Op.in]: noIndukArray }, book_id: { [Op.ne]: book.id } }
                });

                if (existingCopies.length > 0) {
                    return res.status(400).json({ success: false, message: `Nomor Induk [${existingCopies.map(c => c.no_induk).join(', ')}] sudah terdaftar!` });
                }

                await BookCopy.destroy({ where: { book_id: book.id } });
                await BookCopy.bulkCreate(noIndukArray.map(n => ({ book_id: book.id, no_induk: n, status: 'tersedia' })));
                await book.update({ stock_total: noIndukArray.length });
            }

            // 6. Update Relasi Lainnya (Publisher & Subject)
            if (data.publishers) {
                const pubIds = [];
                const pubs = Array.isArray(data.publishers) ? data.publishers : [data.publishers];
                for (const p of pubs) {
                    if (!p) continue;
                    const [pub] = isNaN(p) ? await Publisher.findOrCreate({ where: { name: p.trim() } }) : [{ id: p }];
                    pubIds.push(pub.id);
                }
                await book.setPublishers(pubIds);
            }

            if (data.subjects) {
                const subIds = [];
                const subs = Array.isArray(data.subjects) ? data.subjects : [data.subjects];
                for (const s of subs) {
                    if (!s) continue;
                    const [sub] = isNaN(s) ? await Subject.findOrCreate({ where: { name: s.trim() } }) : [{ id: s }];
                    subIds.push(sub.id);
                }
                await book.setSubjects(subIds);
            }

            return res.status(200).json({ success: true, redirectUrl: `/admin/books?${queryParams.toString()}&updateSuccess=1` });

        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: "Gagal memperbarui buku: " + err.message });
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