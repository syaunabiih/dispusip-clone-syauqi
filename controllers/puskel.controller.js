const { Book, BookCopy, Institution, PuskelLoan, Author, Category, Publisher, Ruangan, Subject, BookAuthor, Sequelize } = require('../models');
const { Op } = Sequelize;
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// --- FUNGSI HELPER ---
const cleanupUnusedImage = async (imageFilename) => {
    try {
        if (!imageFilename) return;
        const booksUsingImage = await Book.count({ where: { image: imageFilename } });
        if (booksUsingImage === 0) {
            const filePath = path.join(__dirname, '../public/image/uploads', imageFilename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    } catch (error) { console.error("Error cleaning up image:", error); }
};

const toTitleCase = (str) => {
    if (!str) return "";
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const standardizeShelfLocation = (rawLocation) => {
    if (rawLocation == null) return null;
    let loc = String(rawLocation).replace(/['"]+/g, '').trim();
    if (!loc || loc === '-') return null;
    return loc;
};

// Kolom Excel
const EXCEL_COLUMNS = [
    { header: 'No Induk*', key: 'no_induk', width: 15 },
    { header: 'Judul Buku', key: 'title', width: 30 },
    { header: 'Pengarang', key: 'author', width: 20 },
    { header: 'Penerbit', key: 'publisher', width: 20 },
    { header: 'Tahun', key: 'year', width: 10 },
    { header: 'Kategori', key: 'category', width: 15 },
    { header: 'No Panggil', key: 'call_number', width: 15 },
    { header: 'ISBN', key: 'isbn', width: 20 }
];

module.exports = {
    // ==========================================
    // 1. DASHBOARD LOGISTIK (View Utama)
    // ==========================================
    index: async (req, res) => {
        try {
            const { q = "", page = 1 } = req.query;
            const limit = 50;
            const offset = (Math.max(1, parseInt(page)) - 1) * limit;

            // Filter Dasar: Hanya buku yang statusnya 'Puskel'
            const whereCondition = {
                status: { [Op.or]: ['tersedia_puskel', 'dipinjam_puskel'] }
            };

            // Logika Search (No Induk atau Judul Buku)
            if (q) {
                whereCondition[Op.or] = [
                    { no_induk: { [Op.like]: `%${q}%` } },
                    { '$Book.title$': { [Op.like]: `%${q}%` } }
                ];
            }

            const { count, rows: copies } = await BookCopy.findAndCountAll({
                where: whereCondition,
                include: [
                    { 
                        model: Book, 
                        attributes: ['title', 'isbn', 'publish_year', 'call_number'],
                        include: [
                            { model: Author, as: 'Authors' },
                            { model: Category }
                        ]
                    },
                    { 
                        model: PuskelLoan, 
                        as: 'puskelLoans', 
                        where: { status: 'active' }, 
                        required: false, 
                        include: ['institution'] 
                    }
                ],
                order: [['updatedAt', 'DESC']],
                limit,
                offset
            });

            const allCategories = await Category.findAll({ order: [['name', 'ASC']] });

            res.render('admin/puskel/index', { 
                copies, 
                title: 'Logistik Pustaka Keliling',
                active: 'logistik',
                totalItems: count,
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                query: req.query,
                allCategories
            });
        } catch (error) {
            console.error(error);
            res.status(500).send(error.message);
        }
    },

    // ==========================================
    // 2. DATA PEMINJAM (LEMBAGA)
    // ==========================================
    listBorrowers: async (req, res) => {
        try {
            const institutions = await Institution.findAll({
                include: [{
                    model: PuskelLoan,
                    as: 'PuskelLoans',
                    where: { status: 'active' },
                    required: false,
                    include: [{
                        model: BookCopy, 
                        as: 'bookCopy',
                        include: [{ model: Book, attributes: ['title', 'isbn'] }]
                    }] 
                }],
                order: [['name', 'ASC']]
            });

            const availableBooks = await BookCopy.findAll({
                where: { status: 'tersedia_puskel' },
                include: [{ model: Book, attributes: ['title', 'isbn'] }] 
            });

            res.render('admin/puskel/borrowers', {
                institutions,
                availableBooks,
                title: 'Data Lembaga Peminjam',
                active: 'borrowers'
            });
        } catch (error) {
            console.error("Error listBorrowers:", error); 
            res.status(500).send("Gagal memuat data peminjam: " + error.message);
        }
    },

    addInstitution: async (req, res) => {
        try {
            const { name, address, contact_person, phone } = req.body;
            await Institution.create({ name, address, contact_person, phone, email: '-' });
            res.redirect('/admin/puskel/borrowers');
        } catch (error) {
            res.status(500).send("Gagal tambah lembaga: " + error.message);
        }
    },

    detailInstitution: async (req, res) => {
        try {
            const { id } = req.params;
            const institution = await Institution.findByPk(id, {
                include: [{
                    model: PuskelLoan,
                    as: 'PuskelLoans',
                    where: { status: 'active' },
                    required: false,
                    include: [{
                        model: BookCopy,
                        as: 'bookCopy',
                        include: [{ model: Book, attributes: ['title', 'isbn'] }]
                    }]
                }]
            });

            if (!institution) return res.status(404).send("Lembaga tidak ditemukan");

            const availableBooks = await BookCopy.findAll({
                where: { status: 'tersedia_puskel' },
                include: [{ model: Book, attributes: ['title', 'isbn'] }]
            });

            res.render('admin/puskel/detail_institution', {
                institution,
                availableBooks,
                title: 'Detail Peminjaman Lembaga',
                active: 'borrowers'
            });
        } catch (error) {
            console.error(error);
            res.status(500).send("Error detail: " + error.message);
        }
    },

    // ==========================================
    // 3. LOGISTIK & SIRKULASI (Stok Masuk/Keluar)
    // ==========================================
    
    // Pinjamkan Buku ke Lembaga
    loanBook: async (req, res) => {
        try {
            const { institution_id, book_copy_id, duration } = req.body;
            const loanDate = new Date();
            const dueDate = new Date();
            dueDate.setMonth(dueDate.getMonth() + parseInt(duration));

            await PuskelLoan.create({
                book_copy_id,
                institution_id,
                loan_date: loanDate,
                due_date: dueDate,
                status: 'active'
            });

            await BookCopy.update({ status: 'dipinjam_puskel' }, { where: { id: book_copy_id } });

            const referer = req.get('Referer');
            if (referer && referer.includes('/institution/')) {
                res.redirect(referer);
            } else {
                res.redirect('/admin/puskel/borrowers');
            }
        } catch (error) {
            console.error(error);
            res.status(500).send(error.message);
        }
    },

    // Terima Pengembalian
    returnBook: async (req, res) => {
        try {
            const { loan_id } = req.body;
            const loan = await PuskelLoan.findByPk(loan_id);
            if (!loan) return res.status(404).send("Transaksi tidak ditemukan");
            
            loan.status = 'returned';
            loan.return_date = new Date();
            await loan.save();

            await BookCopy.update({ status: 'tersedia_puskel' }, { where: { id: loan.book_copy_id } });
            
            const referer = req.get('Referer');
            if (referer) { res.redirect(referer); } else { res.redirect('/admin/puskel/borrowers'); }
        } catch (error) { res.status(500).send(error.message); }
    },

    // Muat Stok dari Gudang Utama (Scan)
    addStock: async (req, res) => {
        try {
            const { no_induk } = req.body;
            const copy = await BookCopy.findOne({ where: { no_induk } });
            
            if (!copy) return res.send('<script>alert("Buku tidak ditemukan!");window.history.back();</script>');
            if (copy.status !== 'tersedia') return res.send('<script>alert("Buku tidak tersedia di gudang utama (mungkin sedang dipinjam user)!");window.history.back();</script>');
            
            copy.status = 'tersedia_puskel';
            await copy.save();
            res.redirect('/admin/puskel');
        } catch (error) { res.status(500).send(error.message); }
    },

    // Kembalikan Stok ke Gudang Utama
    removeStock: async (req, res) => {
        try {
            const { id } = req.params;
            const copy = await BookCopy.findByPk(id);
            if (copy.status === 'dipinjam_puskel') return res.send('<script>alert("Buku sedang dipinjam lembaga, tidak bisa dikembalikan ke gudang!");window.history.back();</script>');
            
            copy.status = 'tersedia';
            await copy.save();
            res.redirect('/admin/puskel');
        } catch (error) { res.status(500).send(error.message); }
    },

    // ==========================================
    // 4. CRUD MASTER BUKU (Create, Edit, Delete)
    // ==========================================

    // Tampilkan Halaman Tambah
    showAddPage: async (req, res) => {
        try {
            const adminId = req.user.id;
            const ruanganAdmin = await Ruangan.findOne({ where: { id_admin_ruangan: adminId } });

            const categories = await Category.findAll({ order: [['name', 'ASC']] });
            const authors = await Author.findAll({ order: [['name', 'ASC']] });
            const publishers = await Publisher.findAll({ order: [['name', 'ASC']] });
            const subjects = await Subject.findAll({ order: [['name', 'ASC']] });

            res.render("admin/puskel/form_add", {
                title: "Tambah Koleksi Puskel",
                active: 'logistik',
                namaRuangan: ruanganAdmin ? ruanganAdmin.nama_ruangan : null,
                layoutJson: ruanganAdmin?.layout_json ?? null,
                categories, authors, publishers, subjects
            });

        } catch (err) {
            console.error(err);
            res.status(500).send("Gagal memuat halaman tambah");
        }
    },

    // Proses Tambah Buku
    addBook: async (req, res) => {
        try {
            const data = req.body;
            const adminId = req.user.id;
            const ruanganAdmin = await Ruangan.findOne({ where: { id_admin_ruangan: adminId } });

            if (!ruanganAdmin && req.user.role !== 'super_admin') {
                return res.status(403).json({ success: false, message: "Akses ditolak." });
            }
            const idRuangan = ruanganAdmin ? ruanganAdmin.id_ruangan : null;

            if (!data.title || !data.category_id || !data.no_induk) {
                return res.status(400).json({ success: false, message: "Data wajib belum lengkap!" });
            }

            let categoryId = data.category_id;
            if (isNaN(categoryId)) {
                const [newCategory] = await Category.findOrCreate({ where: { name: String(categoryId).trim() } });
                categoryId = newCategory.id;
            }

            const book = await Book.create({
                title: toTitleCase(data.title),
                edition: data.edition,
                publish_year: data.publish_year,
                publish_place: data.publish_place,
                physical_description: data.physical_description,
                isbn: data.isbn,
                call_number: data.call_number,
                abstract: data.abstract,
                notes: data.notes,
                language: data.language,
                shelf_location: standardizeShelfLocation(data.shelf_location),
                category_id: categoryId,
                id_ruangan: idRuangan,
                image: req.file ? req.file.filename : null
            });

            // Helper Proses Author
            const processRole = async (input, roleName) => {
                if (!input) return;
                const names = Array.isArray(input) ? input : [input];
                for (const nameOrId of names) {
                    if (!nameOrId) continue;
                    let authorId = isNaN(nameOrId) ? (await Author.findOrCreate({ where: { name: nameOrId.trim() } }))[0].id : nameOrId;
                    await BookAuthor.create({ book_id: book.id, author_id: authorId, role: roleName });
                }
            };
            await processRole(data.authors_penulis, 'penulis');
            await processRole(data.authors_editor, 'editor');
            await processRole(data.authors_pj, 'penanggung jawab');

            // Proses No Induk
            if (data.no_induk) {
                const noIndukArray = data.no_induk.split(/[\n,]+/).map(item => item.trim()).filter(item => item !== "");
                if (noIndukArray.length > 0) {
                     const existingCopies = await BookCopy.findAll({ where: { no_induk: { [Op.in]: noIndukArray } } });
                     if (existingCopies.length > 0) {
                        await book.destroy(); 
                        return res.status(400).json({ success: false, message: `Nomor Induk [${existingCopies.map(c=>c.no_induk).join(', ')}] sudah ada!` });
                     }
                     // SET STATUS = 'tersedia_puskel' agar langsung masuk stok puskel
                     const copyData = noIndukArray.map(nomor => ({ book_id: book.id, no_induk: nomor, status: 'tersedia_puskel' })); 
                     await BookCopy.bulkCreate(copyData);
                     await book.update({ stock_total: noIndukArray.length });
                }
            }

            // Proses Publisher & Subject
            if (data.publishers) {
                const pubs = Array.isArray(data.publishers) ? data.publishers : [data.publishers];
                const pubIds = [];
                for (const p of pubs) {
                    if(!p) continue;
                    pubIds.push(isNaN(p) ? (await Publisher.findOrCreate({ where: { name: p.trim() } }))[0].id : p);
                }
                await book.setPublishers(pubIds);
            }
            if (data.subjects) {
                const subs = Array.isArray(data.subjects) ? data.subjects : [data.subjects];
                const subIds = [];
                for (const s of subs) {
                    if(!s) continue;
                    subIds.push(isNaN(s) ? (await Subject.findOrCreate({ where: { name: s.trim() } }))[0].id : s);
                }
                await book.setSubjects(subIds);
            }

            return res.status(200).json({ 
                success: true, 
                redirectUrl: "/admin/puskel?addSuccess=1", 
                message: "Buku berhasil ditambahkan ke Puskel"
            });

        } catch (err) {
            console.error("PUSKEL ADD ERROR:", err);
            res.status(500).json({ success: false, message: err.message });
        }
    },

    // Tampilkan Halaman Edit
    showEditPage: async (req, res) => {
        try {
            const adminId = req.user.id;
            const ruanganAdmin = await Ruangan.findOne({ where: { id_admin_ruangan: adminId } });
            
            const book = await Book.findByPk(req.params.id, {
                include: [Category, {model:Author, as:'Authors'}, {model:Publisher, as:'Publishers'}, {model:Subject, as:'Subjects'}, {model:BookCopy, as:'copies'}]
            });

            if (!book) return res.status(404).send("Buku tidak ditemukan");
            if (req.user.role !== 'super_admin') {
                if (!ruanganAdmin || book.id_ruangan !== ruanganAdmin.id_ruangan) return res.status(403).send("Akses Ditolak.");
            }

            const categories = await Category.findAll({ order: [['name', 'ASC']] });
            const authors = await Author.findAll({ order: [['name', 'ASC']] });
            const publishers = await Publisher.findAll({ order: [['name', 'ASC']] });
            const subjects = await Subject.findAll({ order: [['name', 'ASC']] });

            res.render("admin/puskel/form_edit", {
                title: "Edit Buku Puskel",
                active: 'logistik',
                namaRuangan: ruanganAdmin ? ruanganAdmin.nama_ruangan : null,
                layoutJson: ruanganAdmin?.layout_json ?? null,
                book, categories, authors, publishers, subjects,
                query: req.query
            });
        } catch (err) {
            console.error(err);
            res.status(500).send("Error edit page");
        }
    },

    // Proses Update Buku
    updateBook: async (req, res) => {
        try {
            const adminId = req.user.id;
            const ruanganAdmin = await Ruangan.findOne({ where: { id_admin_ruangan: adminId } });
            const book = await Book.findByPk(req.params.id);
            
            if (!book) return res.status(404).json({ success: false, message: "Buku tidak ditemukan" });
            if (req.user.role !== 'super_admin') {
                if (!ruanganAdmin || book.id_ruangan !== ruanganAdmin.id_ruangan) {
                    return res.status(403).json({ success: false, message: "Akses Ditolak." });
                }
            }

            const data = req.body;
            let categoryId = data.category_id;
            if (isNaN(categoryId)) {
                const [newCategory] = await Category.findOrCreate({ where: { name: String(categoryId).trim() } });
                categoryId = newCategory.id;
            }
            
            const updateData = {
                title: toTitleCase(data.title),
                edition: data.edition,
                publish_year: data.publish_year,
                publish_place: data.publish_place,
                physical_description: data.physical_description,
                isbn: data.isbn,
                call_number: data.call_number,
                abstract: data.abstract,
                notes: data.notes,
                language: data.language,
                shelf_location: standardizeShelfLocation(data.shelf_location),
                category_id: categoryId
            };

            if (req.file) {
                 updateData.image = req.file.filename;
                 await cleanupUnusedImage(book.image);
            } else if (data.remove_image === 'true') {
                 updateData.image = null;
                 await cleanupUnusedImage(book.image);
            }

            await book.update(updateData);

            // Update Authors
            await BookAuthor.destroy({ where: { book_id: book.id } });
            const processRole = async (input, roleName) => {
                if (!input) return;
                const names = Array.isArray(input) ? input : [input];
                for (const item of names) {
                    if (!item) continue;
                    let authorId = isNaN(item) ? (await Author.findOrCreate({ where: { name: item.trim() } }))[0].id : item;
                    await BookAuthor.create({ book_id: book.id, author_id: authorId, role: roleName });
                }
            };
            await processRole(data.authors_penulis, 'penulis');
            await processRole(data.authors_editor, 'editor');
            await processRole(data.authors_pj, 'penanggung jawab');

            // Update No Induk
            if (data.no_induk) {
                const noIndukArray = data.no_induk.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== "");
                const currentCopies = await BookCopy.findAll({ where: { book_id: book.id }, attributes: ['no_induk'] });
                const currentNoInduks = currentCopies.map(c => c.no_induk).sort();
                const newNoInduks = [...noIndukArray].sort();

                if (JSON.stringify(currentNoInduks) !== JSON.stringify(newNoInduks)) {
                    // Hapus stok lama, buat stok baru dengan status 'tersedia_puskel'
                    await BookCopy.destroy({ where: { book_id: book.id } });
                    await BookCopy.bulkCreate(noIndukArray.map(n => ({ book_id: book.id, no_induk: n, status: 'tersedia_puskel' })));
                    const actualCount = await BookCopy.count({ where: { book_id: book.id } });
                    await book.update({ stock_total: actualCount });
                }
            }

            // Update Publisher & Subject
            if (data.publishers) {
                const pubs = Array.isArray(data.publishers) ? data.publishers : [data.publishers];
                const pubIds = [];
                for (const p of pubs) {
                    if(!p) continue;
                    pubIds.push(isNaN(p) ? (await Publisher.findOrCreate({ where: { name: p.trim() } }))[0].id : p);
                }
                await book.setPublishers(pubIds);
            }
            if (data.subjects) {
                const subs = Array.isArray(data.subjects) ? data.subjects : [data.subjects];
                const subIds = [];
                for (const s of subs) {
                    if(!s) continue;
                    subIds.push(isNaN(s) ? (await Subject.findOrCreate({ where: { name: s.trim() } }))[0].id : s);
                }
                await book.setSubjects(subIds);
            }

            const queryParams = new URLSearchParams({ page: data.origin_page || "1", q: data.origin_q || "" });

            return res.status(200).json({ 
                success: true, 
                redirectUrl: `/admin/puskel?${queryParams.toString()}&updateSuccess=1`, 
                message: "Data buku Puskel diperbarui."
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: err.message });
        }
    },

    // Hapus Buku (Delete)
    deleteMultiple: async (req, res) => {
        try {
            const { bookIds, deleteAll, q } = req.body;
            // ... (Logika delete bisa disederhanakan) ...
            const idsToDelete = Array.isArray(bookIds) ? bookIds : [bookIds];
            
            if (idsToDelete && idsToDelete.length > 0) {
                 const booksToDelete = await Book.findAll({ where: { id: { [Op.in]: idsToDelete } }, attributes: ['image'] });
                 await Book.destroy({ where: { id: { [Op.in]: idsToDelete } } });
                 for(const b of booksToDelete) await cleanupUnusedImage(b.image);
            }
            
            res.redirect(`/admin/puskel?deleteSuccess=1`);
        } catch (err) {
            console.error(err);
            res.status(500).send(err.message);
        }
    },

    // ==========================================
    // 5. IMPORT / EXPORT EXCEL
    // ==========================================

    downloadTemplate: async (req, res) => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Format Import Puskel');
            worksheet.columns = EXCEL_COLUMNS;
            worksheet.addRow({
                no_induk: 'PUS-001',
                title: 'Laskar Pelangi',
                author: 'Andrea Hirata',
                publisher: 'Bentang Pustaka',
                year: '2005',
                category: 'Fiksi',
                call_number: '813',
                isbn: '978-xxx'
            });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=Format_Import_Puskel.xlsx');
            await workbook.xlsx.write(res);
            res.end();
        } catch (error) { res.status(500).send('Gagal download template'); }
    },

    exportExcel: async (req, res) => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Stok Puskel');

            worksheet.columns = [
                { header: 'No Induk', key: 'no_induk', width: 15 },
                { header: 'Judul Buku', key: 'title', width: 30 },
                { header: 'Status', key: 'status', width: 15 }
            ];

            const copies = await BookCopy.findAll({
                where: { status: { [Op.or]: ['tersedia_puskel', 'dipinjam_puskel'] } },
                include: [{ model: Book }]
            });

            copies.forEach(copy => {
                worksheet.addRow({
                    no_induk: copy.no_induk,
                    title: copy.Book ? copy.Book.title : '-',
                    status: copy.status
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=Stok_Puskel.xlsx');
            await workbook.xlsx.write(res);
            res.end();
        } catch (error) { res.status(500).send('Gagal export data'); }
    },

    importExcel: async (req, res) => {
        try {
            if (!req.file) return res.status(400).send('File tidak ditemukan');
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(req.file.buffer);
            const worksheet = workbook.getWorksheet(1);
            let countSuccess = 0;

            for (let i = 2; i <= worksheet.rowCount; i++) {
                const row = worksheet.getRow(i);
                const noInduk = row.getCell(1).text; 
                if (!noInduk) continue;
                // Logika: Cek Buku, Update Status ke Puskel
                const existingCopy = await BookCopy.findOne({ where: { no_induk: noInduk } });
                if (existingCopy) {
                    existingCopy.status = 'tersedia_puskel';
                    await existingCopy.save();
                    countSuccess++;
                }
            }
            res.send(`<script>alert("Berhasil import ${countSuccess} buku!"); window.location.href="/admin/puskel";</script>`);
        } catch (error) { res.status(500).send('Gagal import: ' + error.message); }
    }
};