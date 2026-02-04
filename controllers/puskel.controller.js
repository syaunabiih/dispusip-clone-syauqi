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

module.exports = {
    // ==========================================
    // 1. DASHBOARD LOGISTIK (Tabel Utama)
    // ==========================================
    index: async (req, res) => {
        try {
            const copies = await BookCopy.findAll({
                where: {
                    status: { [Op.or]: ['tersedia_puskel', 'dipinjam_puskel'] }
                },
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
                order: [['updatedAt', 'DESC']]
            });

            res.render('admin/puskel/index', { 
                copies, 
                title: 'Logistik Pustaka Keliling',
                active: 'logistik'
            });
        } catch (error) {
            console.error(error);
            res.status(500).send(error.message);
        }
    },

    // ==========================================
    // 2. DATA PEMINJAM (LEMBAGA) - LOGIKA FILTER
    // ==========================================
    listBorrowers: async (req, res) => {
        try {
            // Ambil SEMUA Lembaga (Tanpa filter 'active' di query)
            const allInstitutions = await Institution.findAll({
                include: [{
                    model: PuskelLoan,
                    as: 'PuskelLoans',
                    required: false, 
                    include: [{
                        model: BookCopy, 
                        as: 'bookCopy',
                        include: [{ model: Book, attributes: ['title', 'isbn'] }]
                    }] 
                }],
                order: [['name', 'ASC']]
            });

            // FILTER: Tampilkan (Baru OR Ada Aktif). Sembunyikan (Semua Selesai).
            const activeData = allInstitutions.map(inst => {
                const loans = inst.PuskelLoans || [];
                const hasActive = loans.some(l => l.status === 'active');
                const isNew = loans.length === 0; 

                if (isNew || hasActive) {
                    const plainInst = inst.get({ plain: true });
                    // Hanya tampilkan hitungan buku yang sedang dipinjam (active)
                    plainInst.PuskelLoans = plainInst.PuskelLoans.filter(l => l.status === 'active');
                    return plainInst;
                }
                return null;
            }).filter(item => item !== null); 

            res.render('admin/puskel/borrowers', {
                institutions: activeData, 
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
            if (!name || !address) {
                return res.send('<script>alert("Nama Lembaga dan Alamat wajib diisi!"); window.history.back();</script>');
            }
            await Institution.create({ 
                name: name.trim(), 
                address: address.trim(), 
                contact_person: contact_person || '-', 
                phone: phone || '-', 
                email: '-' 
            });
            if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
                // Jika AJAX (seperti dari SweetAlert), kirim JSON sukses
                return res.status(200).json({ success: true, message: "Lembaga berhasil ditambahkan" });
            }
            res.redirect('/admin/puskel/borrowers');
        } catch (error) {
            if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
                return res.status(500).json({ success: false, message: error.message });
            }
            res.status(500).send("Gagal tambah lembaga: " + error.message);
        }
    },

    // ==========================================
    // DETAIL LEMBAGA
    // ==========================================
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

            res.render('admin/puskel/detail_institution', {
                institution,
                title: 'Detail Peminjaman Lembaga',
                active: 'borrowers'
            });
        } catch (error) {
            console.error(error);
            res.status(500).send("Error detail: " + error.message);
        }
    },

    // ==========================================
    // 3. LOGISTIK & SIRKULASI (SELECTION PAGE & BATCH LOAN)
    // ==========================================
    
    // [BARU] HALAMAN PILIH BUKU (SELECTION PAGE)
    showLoanSelection: async (req, res) => {
        try {
            const { institution_id } = req.params;
            const institution = await Institution.findByPk(institution_id);
            if (!institution) return res.status(404).send("Lembaga tidak ditemukan");

            // Ambil semua buku tersedia + call_number untuk filter
            const availableBooks = await BookCopy.findAll({
                where: { status: 'tersedia_puskel' },
                include: [{ 
                    model: Book, 
                    attributes: ['title', 'isbn', 'call_number', 'publish_year'] 
                }],
                order: [[{ model: Book }, 'title', 'ASC']]
            });

            res.render('admin/puskel/loan_selection', {
                institution,
                availableBooks,
                title: 'Pilih Buku Pinjaman',
                active: 'borrowers'
            });
        } catch (error) {
            console.error(error);
            res.status(500).send(error.message);
        }
    },

    // [UPDATE] PROSES PINJAM BANYAK BUKU (BATCH)
    loanBook: async (req, res) => {
        try {
            const { institution_id, book_copy_ids, duration } = req.body;
            
            if (!book_copy_ids) {
                return res.send('<script>alert("Pilih minimal satu buku!"); window.history.back();</script>');
            }

            // Normalisasi ke array (jika user pilih 1, HTML kirim string)
            const ids = Array.isArray(book_copy_ids) ? book_copy_ids : [book_copy_ids];

            const loanDate = new Date();
            const dueDate = new Date();
            dueDate.setMonth(dueDate.getMonth() + parseInt(duration));

            // Loop simpan setiap buku
            for (const copyId of ids) {
                await PuskelLoan.create({
                    book_copy_id: copyId,
                    institution_id,
                    loan_date: loanDate,
                    due_date: dueDate,
                    status: 'active'
                });

                await BookCopy.update({ status: 'dipinjam_puskel' }, { where: { id: copyId } });
            }

            res.redirect('/admin/puskel/institution/' + institution_id);
        } catch (error) {
            console.error(error);
            res.status(500).send(error.message);
        }
    },

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

    // INPUT BUKU MANUAL
    addStock: async (req, res) => {
        try {
            let { title, author, no_induk, call_number, quantity } = req.body;
            if (!title || !no_induk) return res.send('<script>alert("Judul & No Induk wajib!");history.back();</script>');

            quantity = parseInt(quantity) || 1;
            let authorId = null;
            if (author) {
                const [auth] = await Author.findOrCreate({ where: { name: author.trim() } });
                authorId = auth.id;
            }

            const [book] = await Book.findOrCreate({
                where: { title: title.trim() },
                defaults: {
                    title: toTitleCase(title),
                    call_number: call_number || '-',
                    id_ruangan: 1 
                }
            });

            if (authorId) {
                const hasAuthor = await book.hasAuthor(authorId);
                if (!hasAuthor) await book.addAuthor(authorId, { through: { role: 'penulis' } });
            }

            if (call_number && (!book.call_number || book.call_number === '-')) {
                await book.update({ call_number: call_number });
            }

            let successCount = 0;
            for (let i = 0; i < quantity; i++) {
                let currentNoInduk = (quantity === 1) ? no_induk : (i === 0 ? no_induk : `${no_induk}-${i}`);
                const existingCopy = await BookCopy.findOne({ where: { no_induk: currentNoInduk } });

                if (existingCopy) {
                    existingCopy.status = 'tersedia_puskel';
                    await existingCopy.save();
                } else {
                    await BookCopy.create({
                        book_id: book.id,
                        no_induk: currentNoInduk,
                        status: 'tersedia_puskel',
                        condition: 'baik'
                    });
                }
                successCount++;
            }
            if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
                return res.status(200).json({ success: true, message: "Buku berhasil ditambahkan" });
            }
            res.send(`<script>alert("Berhasil memproses ${successCount} buku ke Puskel!"); window.location.href="/admin/puskel";</script>`);
        } catch (error) {
            console.error("Error addStock:", error);
            res.status(500).send("Gagal memuat buku: " + error.message);
        }
    },

    removeStock: async (req, res) => {
        try {
            const { id } = req.params;
            const copy = await BookCopy.findByPk(id);
            if (copy.status === 'dipinjam_puskel') return res.send('<script>alert("Buku sedang dipinjam!");history.back();</script>');
            
            copy.status = 'tersedia';
            await copy.save();
            res.redirect('/admin/puskel');
        } catch (error) { res.status(500).send(error.message); }
    },

    // ==========================================
    // 4. CRUD MASTER BUKU (Agar Route tidak error)
    // ==========================================
    showAddPage: async (req, res) => { /* Placeholder: Logika CRUD sama seperti sebelumnya */ res.send("Fitur Add Manual"); },
    addBook: async (req, res) => { res.send("Fitur Add Book"); },
    showEditPage: async (req, res) => { res.send("Fitur Edit Page"); },
    updateBook: async (req, res) => { res.send("Fitur Update Book"); },
    deleteMultiple: async (req, res) => { res.send("Fitur Delete"); },

    // ============================================================
    // 5. IMPORT / EXPORT EXCEL
    // ============================================================
    downloadTemplate: async (req, res) => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Format Import Puskel');
            worksheet.columns = [
                { header: 'No', key: 'no', width: 5 },
                { header: 'Judul Buku', key: 'title', width: 30 },
                { header: 'Nama Pengarang', key: 'author', width: 25 },
                { header: 'No. Induk', key: 'no_induk', width: 20 },
                { header: 'No. Panggil', key: 'call_number', width: 20 },
                { header: 'EKS', key: 'qty', width: 10 }
            ];
            worksheet.addRow({ no: 1, title: 'Laskar Pelangi', author: 'Andrea Hirata', no_induk: 'PUS-001', call_number: '813 HIR l', qty: 1 });
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
                { header: 'No', key: 'no', width: 5 },
                { header: 'Judul Buku', key: 'title', width: 30 },
                { header: 'Nama Pengarang', key: 'author', width: 25 },
                { header: 'No. Induk', key: 'no_induk', width: 20 },
                { header: 'No. Panggil', key: 'call_number', width: 20 },
                { header: 'EKS', key: 'qty', width: 10 }
            ];
            const copies = await BookCopy.findAll({
                where: { status: { [Op.or]: ['tersedia_puskel', 'dipinjam_puskel'] } },
                include: [{ model: Book, include: [{model: Author, as: 'Authors'}] }]
            });
            copies.forEach((copy, index) => {
                const authorsName = (copy.Book && copy.Book.Authors && copy.Book.Authors.length > 0) 
                    ? copy.Book.Authors.map(a => a.name).join(', ') : '-';
                worksheet.addRow({
                    no: index + 1,
                    title: copy.Book ? copy.Book.title : '-',
                    author: authorsName,
                    no_induk: copy.no_induk,
                    call_number: copy.Book ? copy.Book.call_number : '-',
                    qty: 1
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
                const title = row.getCell(2).text;        
                const authorName = row.getCell(3).text;   
                const noInduk = row.getCell(4).text;      
                const callNumber = row.getCell(5).text;   
                if (!noInduk || !title) continue; 
                const [book] = await Book.findOrCreate({
                    where: { title: title }, 
                    defaults: { title: toTitleCase(title), call_number: callNumber, id_ruangan: 1 }
                });
                if (authorName) {
                    const [author] = await Author.findOrCreate({ where: { name: authorName } });
                    const hasAuthor = await book.hasAuthor(author);
                    if (!hasAuthor) await book.addAuthor(author, { through: { role: 'penulis' } });
                }
                const existingCopy = await BookCopy.findOne({ where: { no_induk: noInduk } });
                if (existingCopy) {
                    existingCopy.status = 'tersedia_puskel';
                    await existingCopy.save();
                } else {
                    await BookCopy.create({ book_id: book.id, no_induk: noInduk, status: 'tersedia_puskel', condition: 'baik' });
                }
                countSuccess++;
            }
            if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
                return res.status(200).json({ success: true, message: "Import berhasil" });
            }
            res.send(`<script>alert("Berhasil import ${countSuccess} buku ke Puskel!"); window.location.href="/admin/puskel";</script>`);
        } catch (error) { res.status(500).send('Gagal import: ' + error.message); }
    },

    // [BARU] EXPORT DATA PEMINJAMAN PER LEMBAGA (CUSTOM FORMAT)
    exportLoanByInstitution: async (req, res) => {
        try {
            const { id } = req.params;
            const institution = await Institution.findByPk(id, {
                include: [{
                    model: PuskelLoan,
                    as: 'PuskelLoans',
                    where: { status: 'active' },
                    required: false, // Tetap export meski kosong (nanti excelnya cuma header)
                    include: [{
                        model: BookCopy,
                        as: 'bookCopy',
                        include: [{ 
                            model: Book, 
                            include: [{ model: Author, as: 'Authors' }] // Perlu Author untuk kolom Pengarang
                        }]
                    }]
                }]
            });

            if (!institution) return res.status(404).send("Lembaga tidak ditemukan");

            // --- SETUP EXCEL ---
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Daftar Koleksi');

            // 1. JUDUL & KOP (Row 1-2)
            const currentYear = new Date().getFullYear();
            worksheet.mergeCells('A1:G1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = `DAFTAR KOLEKSI DIPINJAM DI POS-POS LAYANAN PUSKEL TAHUN ${currentYear}`;
            titleCell.font = { name: 'Arial', size: 12, bold: true };
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

            worksheet.mergeCells('A2:G2');
            const subTitleCell = worksheet.getCell('A2');
            subTitleCell.value = 'BIDANG LAYANAN PERPUSTAKAAN';
            subTitleCell.font = { name: 'Arial', size: 12, bold: true };
            subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

            // 2. INFORMASI LEMBAGA (Row 4-6)
            // Kabupaten
            worksheet.getCell('A4').value = 'Kabupaten/Kota';
            worksheet.getCell('C4').value = ': Padang'; // Bisa disesuaikan
            
            // Pos Layanan (Nama Lembaga)
            worksheet.getCell('A5').value = 'Pos Layanan';
            worksheet.getCell('C5').value = ': ' + institution.name;

            // Hari/Tanggal
            const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            worksheet.getCell('A6').value = 'Hari/Tanggal';
            worksheet.getCell('C6').value = ': ' + today;

            // 3. HEADER TABEL (Row 8)
            const headerRow = worksheet.getRow(8);
            headerRow.values = ['NO', 'JUDUL', 'PENGARANG', 'NO. INDUK', 'CALL NUMBER', 'EKS.', 'KET.*)'];
            
            // Style Header
            headerRow.eachCell((cell) => {
                cell.font = { bold: true };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            // 4. ISI DATA (Row 9 dst)
            let rowIndex = 9;
            if (institution.PuskelLoans && institution.PuskelLoans.length > 0) {
                institution.PuskelLoans.forEach((loan, index) => {
                    const book = loan.bookCopy && loan.bookCopy.Book ? loan.bookCopy.Book : null;
                    const authors = book && book.Authors ? book.Authors.map(a => a.name).join(', ') : '-';
                    
                    const row = worksheet.getRow(rowIndex);
                    row.values = [
                        index + 1,                                  // NO
                        book ? book.title : 'Judul Error',          // JUDUL
                        authors,                                    // PENGARANG
                        loan.bookCopy ? loan.bookCopy.no_induk : '-', // NO INDUK
                        book ? book.call_number : '-',              // CALL NUMBER
                        1,                                          // EKS (Selalu 1 per baris)
                        ''                                          // KET
                    ];

                    // Style Data Row (Border & Alignment)
                    row.eachCell((cell, colNumber) => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                        // Kolom Judul & Pengarang (2 & 3) rata kiri, sisanya tengah
                        if (colNumber === 2 || colNumber === 3) {
                            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                        } else {
                            cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        }
                    });

                    rowIndex++;
                });
            }

            // 5. ATUR LEBAR KOLOM
            worksheet.getColumn(1).width = 5;  // No
            worksheet.getColumn(2).width = 40; // Judul
            worksheet.getColumn(3).width = 25; // Pengarang
            worksheet.getColumn(4).width = 20; // No Induk
            worksheet.getColumn(5).width = 20; // Call Number
            worksheet.getColumn(6).width = 5;  // Eks
            worksheet.getColumn(7).width = 10; // Ket

            // --- KIRIM FILE ---
            const filename = `Peminjaman_${institution.name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error("Error export detail:", error);
            res.status(500).send("Gagal export data: " + error.message);
        }
    },

    // ==========================================
    // 6. RIWAYAT PEMINJAMAN (HISTORY) - FIXED
    // ==========================================
    historyBorrowers: async (req, res) => {
        try {
            const allInstitutions = await Institution.findAll({
                include: [{
                    model: PuskelLoan,
                    as: 'PuskelLoans',
                    include: [{
                        model: BookCopy, 
                        as: 'bookCopy',
                        include: [{ model: Book, attributes: ['title'] }]
                    }] 
                }],
                order: [['updatedAt', 'DESC']]
            });

            const historyData = allInstitutions.map(inst => {
                const loans = inst.PuskelLoans || [];
                const activeLoans = loans.filter(l => l.status === 'active');
                const returnedLoans = loans.filter(l => l.status === 'returned');

                if (activeLoans.length === 0 && returnedLoans.length > 0) {
                    returnedLoans.sort((a, b) => new Date(b.return_date) - new Date(a.return_date));
                    const lastTransaction = returnedLoans[0];
                    return {
                        name: inst.name,
                        address: inst.address,
                        contact: inst.contact_person,
                        phone: inst.phone,
                        total_books: returnedLoans.length, 
                        loan_date: lastTransaction ? lastTransaction.loan_date : null,
                        return_date: lastTransaction ? lastTransaction.return_date : null
                    };
                }
                return null;
            }).filter(item => item !== null); 

            res.render('admin/puskel/history', {
                historyData,
                title: 'Riwayat Peminjaman',
                active: 'puskel_history'
            });
        } catch (error) {
            console.error("Error history:", error); 
            res.status(500).send("Gagal memuat riwayat: " + error.message);
        }
    }
};