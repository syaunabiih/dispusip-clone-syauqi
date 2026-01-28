const { Book, Category, Author, Publisher, Ruangan, Subject, BookCopy, BookView, BookAuthor, sequelize, Sequelize } = require("../models");
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
    { header: 'Abstrak', key: 'abstract', width: 50 },
    { header: 'Gambar', key: 'image', width: 30 }
];

const axios = require('axios');
const fs = require('fs');
const path = require('path');


// Fungsi helper untuk cleanup gambar yang tidak digunakan
const cleanupUnusedImage = async (imageFilename) => {
    try {
        if (!imageFilename) return;
        
        // Cek apakah gambar masih digunakan oleh buku lain
        const booksUsingImage = await Book.count({
            where: { image: imageFilename }
        });
        
        if (booksUsingImage === 0) {
            // Tidak ada buku yang menggunakan gambar ini, hapus file
            const filePath = path.join(__dirname, '../public/image/uploads', imageFilename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            
        }
    } catch (error) {
        console.error("Error cleaning up image:", error);
    }
};

// Fungsi untuk normalisasi URL (trim, decode, hapus trailing slash)
const normalizeUrl = (url) => {
    if (!url) return null;
    let normalized = url.trim();
    
    // Decode URL encoding (misal %20 menjadi space, dll)
    try {
        normalized = decodeURIComponent(normalized);
    } catch (e) {
        // Jika decode gagal, gunakan URL asli
    }
    
    // Hapus trailing slash kecuali untuk root domain (http://example.com/)
    normalized = normalized.replace(/\/(?=\?|#|$)/, '');
    
    // Hapus multiple spaces
    normalized = normalized.replace(/\s+/g, ' ');
    
    // Hapus whitespace di awal dan akhir
    normalized = normalized.trim();
    
    return normalized;
};

const downloadImage = async (url, title) => {
    try {
        if (!url || !url.startsWith('http')) return null;
        
        // Normalisasi URL untuk konsistensi
        const normalizedUrl = normalizeUrl(url);
        
        // Pastikan folder uploads ada
        const uploadsDir = path.join(__dirname, '../public/image/uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        console.log(`[DOWNLOAD IMAGE] Memproses gambar untuk: "${title}"`);
        console.log(`  URL: "${normalizedUrl}"`);
        
        // URL belum pernah diunduh atau file hilang, lakukan download
        const fileName = `${Date.now()}-${title.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 50)}.jpg`;
        const uploadPath = path.join(uploadsDir, fileName);
        
        let response;
        try {
            response = await axios({
                url,
                method: 'GET',
                responseType: 'stream',
                timeout: 30000, // 30 detik timeout
                validateStatus: function (status) {
                    return status >= 200 && status < 300; // Hanya terima status 2xx
                }
            });
        } catch (axiosError) {
            console.error(`Error fetching image from URL ${url}:`, axiosError.message);
            return null;
        }

        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(uploadPath);
            
            writer.on('finish', () => {
                console.log(`✓ Gambar berhasil diunduh: ${fileName}`);
                resolve(fileName);
            });
            
            writer.on('error', (err) => {
                console.error("File Write Error:", err);
                // Hapus file yang tidak lengkap jika ada
                try {
                    if (fs.existsSync(uploadPath)) {
                        fs.unlinkSync(uploadPath);
                    }
                } catch (unlinkErr) {
                    console.error("Error deleting incomplete file:", unlinkErr);
                }
                resolve(null);
            });
            
            response.data.on('error', (err) => {
                console.error("Response Stream Error:", err);
                writer.end();
                resolve(null);
            });
            
            // Pipe response ke file
            response.data.pipe(writer);
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

// Helper untuk Format Judul (Title Case) ---
const toTitleCase = (str) => {
    if (!str) return "";
    return str.toLowerCase().split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
};

// Tambahkan Fungsi Standardisasi Lokasi Rak
const standardizeShelfLocation = (rawLocation) => {
    if (!rawLocation) return null;
    
    // 1. Ubah ke string
    let loc = String(rawLocation);
    
    // 2. Hapus tanda kutip ganda/tunggal, trim spasi
    loc = loc.replace(/['"]+/g, '').trim();
    
    // 3. Cek pola (misal: "A1" atau "a1")
    // Jika formatnya hanya huruf+angka (contoh: A1, B2), tambahkan prefix "Rak "
    if (loc.match(/^[A-H][1-9]$/i)) {
        return `Rak ${loc.toUpperCase()}`;
    }
    
    // 4. Jika formatnya sudah "Rak A1" tapi huruf kecil atau spasi aneh
    const match = loc.match(/^Rak\s*([A-H][1-9])$/i);
    if (match) {
        return `Rak ${match[1].toUpperCase()}`;
    }

    // Jika tidak sesuai pola (misal: "Gudang"), kembalikan apa adanya (tapi tanpa kutip)
    return loc;
};


module.exports = {
    getDashboard: async (req, res) => {
        try {
            // 1. Ambil ID Ruangan yang dikelola oleh admin yang login
            const adminId = req.user.id;
            const ruanganAdmin = await Ruangan.findOne({
                where: { id_admin_ruangan: adminId }
            });

            if (!ruanganAdmin) {
                return res.status(404).send("Error: Admin ini belum ditugaskan ke ruangan manapun.");
            }

            const idRuangan = ruanganAdmin.id_ruangan;

            // 2. Logika Rentang Waktu (Quarterly)
            const now = new Date();
            const currentYear = now.getFullYear();
            const selectedYear = parseInt(req.query.year) || currentYear;
            const selectedQuarter = parseInt(req.query.quarter) || Math.floor((now.getMonth() + 3) / 3);

            const startMonth = (selectedQuarter - 1) * 3 + 1;
            const endMonth = startMonth + 2;
            
            // Membuat objek Date untuk mendapatkan hari terakhir di bulan tersebut
            const lastDayOfMonth = new Date(selectedYear, endMonth, 0).getDate();
            
            const startDateStr = `${selectedYear}-${String(startMonth).padStart(2, '0')}-01 00:00:00`;
            const endDateStr = `${selectedYear}-${String(endMonth).padStart(2, '0')}-${lastDayOfMonth} 23:59:59`;

            // 3. Query Tren Mingguan
            // PERBAIKAN: Gunakan alias 'Book' (Huruf Besar) sesuai saran Sequelize EagerLoadingError
            const statsRaw = await BookView.findAll({
                attributes: [
                    [Sequelize.fn('WEEK', Sequelize.col('BookView.createdAt'), 3), 'week_number'],
                    [Sequelize.fn('COUNT', Sequelize.col('BookView.id')), 'total_views']
                ],
                include: [{
                    model: Book,
                    as: 'Book', // Sesuaikan dengan definisi di model (Case Sensitive)
                    attributes: [],
                    where: { id_ruangan: idRuangan }, 
                    required: true
                }],
                where: { 
                    createdAt: { [Op.gte]: startDateStr, [Op.lte]: endDateStr } 
                },
                group: ['week_number'],
                order: [[Sequelize.literal('week_number'), 'ASC']],
                raw: true
            });

            // --- LOGIKA MAPPING KE CHART ---
            const stats = [];
            // Mengambil nomor minggu awal di quarter tersebut menggunakan query helper
            const startWeekResult = await sequelize.query(
                `SELECT WEEK(:sd, 3) as w`, 
                { replacements: { sd: startDateStr }, type: Sequelize.QueryTypes.SELECT }
            );
            const startWeek = startWeekResult[0].w;

            // Loop untuk 13 minggu (rata-rata jumlah minggu dalam satu quarter)
            for (let i = 0; i < 13; i++) {
                const targetWeek = startWeek + i;
                const found = statsRaw.find(s => parseInt(s.week_number) === targetWeek);
                
                stats.push({ 
                    week: `Mngu ${i + 1}`, 
                    views: found ? parseInt(found.total_views) : 0 
                });
            }

            // 4. Query Kategori Terpopuler
            const allVisitedCategories = await Category.findAll({
                attributes: ['name', [Sequelize.fn('COUNT', Sequelize.col('Books->views.id')), 'viewCount']],
                include: [{
                    model: Book,
                    attributes: [],
                    required: true,
                    where: { id_ruangan: idRuangan },
                    include: [{ 
                        model: BookView, 
                        as: 'views', 
                        attributes: [], 
                        required: true,
                        where: { createdAt: { [Op.gte]: startDateStr, [Op.lte]: endDateStr } }
                    }]
                }],
                group: ['Category.id', 'Category.name'], // Tambahkan name di group untuk standar SQL
                order: [[Sequelize.literal('viewCount'), 'DESC']],
                subQuery: false
            });

            // 5. Data Ringkasan (KPI Cards)
            const totalBooks = await Book.count({ where: { id_ruangan: idRuangan } });
            
            const totalViewsInQuarter = await BookView.count({
                include: [{
                    model: Book,
                    as: 'Book', // Sesuaikan alias
                    where: { id_ruangan: idRuangan },
                    required: true
                }],
                where: { createdAt: { [Op.gte]: startDateStr, [Op.lte]: endDateStr } }
            });

            // 6. Data Tahun untuk filter
            const years = [currentYear - 1, currentYear, currentYear + 1];

            res.render("admin/dashboard", {
                title: `Dashboard`,
                active: 'dashboard',
                stats, 
                years, 
                selectedYear, 
                selectedQuarter,
                totalBooks, 
                totalViewsInQuarter,
                processedCategories: allVisitedCategories, 
                top5Categories: allVisitedCategories.slice(0, 5),
                user: req.user,
                namaRuangan: ruanganAdmin.nama_ruangan
            });

        } catch (err) {
            console.error("DASHBOARD ERROR:", err);
            res.status(500).send("Internal Server Error: " + err.message);
        }
    },

    listBooks: async (req, res) => {
        try {
            const {
                q = "", searchBy = "title", matchType = "contains",
                category = "", subject = "", year = "",
                page = 1, incomplete = ""
            } = req.query;

            // --- PROTEKSI & FILTER RUANGAN ---
            // 1. Ambil ID ruangan yang dikelola admin ini
            const adminId = req.user.id; // Diambil dari middleware isAdminLoggedIn
            const ruanganAdmin = await Ruangan.findOne({ 
                where: { id_admin_ruangan: adminId } 
            });

            // Jika admin tidak punya ruangan (misal super_admin mengakses halaman ini tanpa filter)
            // Anda bisa memutuskan apakah menampilkan semua atau memberikan error.
            // Di sini kita proteksi agar admin_ruangan hanya melihat miliknya.
            if (!ruanganAdmin && req.user.role !== 'super_admin') {
                return res.status(403).send("Akses ditolak: Anda tidak memiliki otoritas atas ruangan manapun.");
            }

            const isIncomplete = incomplete === "1";
            const limit = 100;
            const currentPage = parseInt(page) || 1;
            const offset = (currentPage - 1) * limit;

            // 1. Inisialisasi Where Condition untuk Tabel Utama (Book)
            const whereCondition = {};
            
            // --- KUNCI: Filter berdasarkan ruangan milik admin yang login ---
            if (ruanganAdmin) {
                whereCondition.id_ruangan = ruanganAdmin.id_ruangan;
            }

            // Filter Dropdown (Kategori & Tahun)
            if (category) whereCondition.category_id = category;
            if (year) whereCondition.publish_year = year;

            // 2. Inisialisasi Include Options
            const includeOptions = [
                { model: Category, required: false },
                { model: Author, as: 'Authors', required: false },
                { model: Publisher, as: 'Publishers', required: false },
                { model: Subject, as: 'Subjects', required: false },
                { model: BookCopy, as: 'copies', required: false }
            ];

            // 3. Logika Filter Dropdown Subjek
            if (subject) {
                const subjectInclude = includeOptions.find(opt => opt.model === Subject);
                if (subjectInclude) {
                    subjectInclude.where = { id: subject };
                    subjectInclude.required = true; 
                }
            }

            // 4. Logika Pencarian (Search Bar)
            if (q) {
                const cleanQ = String(q).trim().replace(/\s+/g, ' ');
                const tokens = cleanQ.split(' ').filter(t => t.length > 0);
                
                const createTokenQuery = (fieldName) => {
                    if (matchType === "exact") {
                        return { [fieldName]: { [Op.eq]: cleanQ } };
                    }
                    return {
                        [Op.and]: tokens.map(token => ({
                            [fieldName]: { [Op.like]: `%${token}%` }
                        }))
                    };
                };

                if (searchBy === "title") Object.assign(whereCondition, createTokenQuery('title'));
                else if (searchBy === "isbn") Object.assign(whereCondition, createTokenQuery('isbn'));
                else if (searchBy === "author") {
                    const authorInclude = includeOptions.find(opt => opt.model === Author);
                    if (authorInclude) {
                        authorInclude.where = createTokenQuery('name');
                        authorInclude.required = true;
                    }
                } 
                else if (searchBy === "publisher") {
                    const publisherInclude = includeOptions.find(opt => opt.model === Publisher);
                    if (publisherInclude) {
                        publisherInclude.where = createTokenQuery('name');
                        publisherInclude.required = true;
                    }
                } 
                else if (searchBy === "subject") {
                    const subjectInclude = includeOptions.find(opt => opt.model === Subject);
                    if (subjectInclude) {
                        const tokenCondition = createTokenQuery('name');
                        subjectInclude.where = subjectInclude.where 
                            ? { [Op.and]: [subjectInclude.where, tokenCondition] } 
                            : tokenCondition;
                        subjectInclude.required = true;
                    }
                }
            }

            // 5. Logika Filter "Data Tidak Lengkap"
            if (isIncomplete) {
                whereCondition[Op.or] = [
                    { category_id: null },
                    { call_number: null },
                    { call_number: "" },
                    Sequelize.literal(`NOT EXISTS (SELECT 1 FROM BookSubjects WHERE BookSubjects.book_id = Book.id)`),
                    Sequelize.literal(`NOT EXISTS (SELECT 1 FROM BookAuthors WHERE BookAuthors.book_id = Book.id AND BookAuthors.role = 'penulis')`),
                    Sequelize.literal(`NOT EXISTS (SELECT 1 FROM BookPublishers WHERE BookPublishers.book_id = Book.id)`),
                    Sequelize.literal(`(SELECT COUNT(*) FROM BookCopies WHERE BookCopies.book_id = Book.id) = 0`)
                ];
            }

            // 6. Eksekusi Query
            const { count, rows: books } = await Book.findAndCountAll({
                where: whereCondition,
                include: includeOptions,
                order: [['updatedAt', 'DESC']],
                limit: limit,
                offset: offset,
                distinct: true,
                col: 'id',
                subQuery: false 
            });

            // 7. Hitung total eksemplar (Hanya di ruangan terkait)
            let totalFilteredCopies;
            const filteredBookRecords = await Book.findAll({
                where: whereCondition,
                include: includeOptions,
                attributes: ['id'],
                distinct: true,
                subQuery: false
            });
            
            const filteredBookIds = filteredBookRecords.map(book => book.id);
            
            if (filteredBookIds.length > 0) {
                totalFilteredCopies = await BookCopy.count({
                    where: { book_id: { [Op.in]: filteredBookIds } }
                });
            } else {
                totalFilteredCopies = 0;
            }

            // 8. Data untuk Dropdown (Bisa difilter per ruangan juga jika perlu)
            const allCategories = await Category.findAll({ order: [['name', 'ASC']] });
            const allSubjects = await Subject.findAll({ order: [['name', 'ASC']] });
            
            // Ambil tahun hanya dari buku yang ada di ruangan ini
            const allYearsRaw = await Book.findAll({
                attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("publish_year")), "year"]],
                where: { 
                    publish_year: { [Op.ne]: null },
                    ...(ruanganAdmin && { id_ruangan: ruanganAdmin.id_ruangan }) // Filter tahun per ruangan
                },
                raw: true
            });

            res.render("admin/admin_books_list", {
                title: "Daftar Buku",
                books,
                totalTitle: count,
                totalBook: totalFilteredCopies,
                currentPage,
                totalPages: Math.ceil(count / limit),
                limit,
                query: req.query,
                allCategories,
                allSubjects,
                allYears: allYearsRaw.map(y => y.year).filter(y => y && y !== '-').sort((a, b) => b - a),
                incomplete: isIncomplete,
                namaRuangan: ruanganAdmin ? ruanganAdmin.nama_ruangan : "Semua Ruangan"
            });
        } catch (err) {
            console.error("DEBUG ERROR:", err);
            res.status(500).send("Gagal memuat daftar buku: " + err.message);
        }
    },

    exportToExcel: async (req, res) => {
        try {
            // 1. Ambil ID ruangan yang dikelola admin ini
            const adminId = req.user.id; 
            const ruanganAdmin = await Ruangan.findOne({ 
                where: { id_admin_ruangan: adminId } 
            });

            // Proteksi: Jika bukan super_admin dan tidak punya ruangan, gagalkan export
            if (!ruanganAdmin && req.user.role !== 'super_admin') {
                return res.status(403).send("Akses ditolak: Anda tidak memiliki otoritas atas ruangan manapun.");
            }

            // 2. Siapkan kondisi filter
            const whereCondition = {};
            if (ruanganAdmin) {
                whereCondition.id_ruangan = ruanganAdmin.id_ruangan;
            }

            // 3. Query buku berdasarkan filter ruangan
            const books = await Book.findAll({
                where: whereCondition, // KUNCI FILTER DI SINI
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
            
            // Buat nama file dinamis berdasarkan nama ruangan
            const namaRuanganText = ruanganAdmin ? ruanganAdmin.nama_ruangan.replace(/\s+/g, '_') : 'Semua_Ruangan';
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=Data_Buku_${namaRuanganText}_${Date.now()}.xlsx`);
            
            await workbook.xlsx.write(res);
            res.end();
        } catch (err) {
            console.error("EXPORT EXCEL ERROR:", err);
            res.status(500).send("Gagal Export: " + err.message);
        }
    },
    
    downloadTemplate: async (req, res) => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Template Import Buku');

            worksheet.columns = EXCEL_COLUMNS;

            worksheet.addRow({ 
                title: 'Laskar Pelangi', 
                category: 'Fiksi', 
                authors_penulis: 'Andrea Hirata', 
                isbn: '978-602-291-663-5',
                call_number: '813 AND l',
                shelf_location: 'Rak A1',
                no_induk: 'B001',
                publishers: 'Bentang Pustaka',
                subjects: 'Novel',
                image: 'https://upload.wikimedia.org/wikipedia/id/8/8e/Laskar_pelangi_sampul.jpg' // Contoh URL gambar
            });
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
            console.log(`\n${'='.repeat(60)}`);
            console.log(`[IMPORT EXCEL] Memulai proses import...`);
            console.log(`${'='.repeat(60)}\n`);
            
            if (!req.file) return res.status(400).send("Tidak ada file yang diunggah");

            // 1. Identifikasi Ruangan Admin yang Login
            const adminId = req.user.id;
            const ruanganAdmin = await Ruangan.findOne({ 
                where: { id_admin_ruangan: adminId } 
            });

            // Proteksi: Pastikan admin memiliki otoritas atas suatu ruangan
            if (!ruanganAdmin && req.user.role !== 'super_admin') {
                return res.status(403).send("Akses ditolak: Anda tidak memiliki otoritas atas ruangan manapun.");
            }

            const idRuangan = ruanganAdmin ? ruanganAdmin.id_ruangan : null;

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(req.file.buffer); 
            const worksheet = workbook.getWorksheet(1);

            let successCount = 0;
            let existingCount = 0;

            const booksData = [];
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header

                const rawTitle = row.getCell(1).text.trim();
                if (!rawTitle) return;

                // Normalisasi judul agar seragam di database
                const formattedTitle = toTitleCase(rawTitle);

                booksData.push({
                    title: formattedTitle,
                    edition: row.getCell(2).text,
                    publish_year: row.getCell(3).text,
                    publish_place: row.getCell(4).text,
                    physical_description: row.getCell(5).text,
                    isbn: row.getCell(6).text,
                    call_number: row.getCell(7).text,
                    language: row.getCell(8).text,
                    shelf_location: row.getCell(9).text, // Gunakan standarisasi rak jika ada
                    categoryName: row.getCell(10).text,
                    authorsPenulis: row.getCell(11).text,
                    authorsEditor: row.getCell(12).text,
                    authorsPJ: row.getCell(13).text,
                    publishers: row.getCell(14).text,
                    subjects: row.getCell(15).text,
                    noInduk: row.getCell(16).text,
                    notes: row.getCell(17).text,
                    abstract: row.getCell(18).text,
                    imageInput: row.getCell(19).text.trim()
                });
            });

            for (const data of booksData) {
                // 2. Cek Duplikat berdasarkan Judul DAN ID Ruangan
                // Ini penting agar admin ruangan lain bisa punya buku berjudul sama tanpa konflik data
                let book = await Book.findOne({ 
                    where: {
                        [Op.and]: [
                            Sequelize.where(
                                Sequelize.fn('LOWER', Sequelize.col('title')), 
                                Sequelize.fn('LOWER', data.title)
                            ),
                            { id_ruangan: idRuangan } // Kunci pencarian pada ruangan admin terkait
                        ]
                    }
                });

                // Penanganan Gambar (Logika download atau local check)
                let finalImageName = null;
                if (data.imageInput) {
                    if (data.imageInput.startsWith('http')) {
                        // Logika downloadImage() Anda di sini
                    } else {
                        const checkPath = path.join(__dirname, '../public/image/uploads', data.imageInput);
                        if (fs.existsSync(checkPath)) finalImageName = data.imageInput;
                    }
                }

                if (!book) {
                    // --- 3. BUKU BARU (INSERT) ---
                    console.log(`[BARU] Menyimpan: ${data.title} ke Ruangan: ${ruanganAdmin.nama_ruangan}`);
                    
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
                        id_ruangan: idRuangan, // OTOMATIS terikat ke ruangan admin yang login
                        image: finalImageName
                    });
                    successCount++;
                } else {
                    // --- 4. UPDATE BUKU (Jika ditemukan di ruangan yang sama) ---
                    console.log(`[UPDATE] Buku ditemukan di area ${ruanganAdmin.nama_ruangan}: ${book.title}`);
                    const updateData = {};
                    
                    const fields = ['edition', 'publish_year', 'publish_place', 'physical_description', 'isbn', 'call_number', 'language', 'shelf_location', 'notes', 'abstract'];
                    fields.forEach(f => {
                        if ((!book[f] || book[f] === '-' || book[f] === '') && data[f]) {
                            updateData[f] = data[f];
                        }
                    });

                    if (finalImageName) updateData.image = finalImageName;
                    if (Object.keys(updateData).length > 0) await book.update(updateData);
                    existingCount++;
                }

                // --- 5. LOGIKA RELASI (Nomor Induk, Author, Publisher, Subject) ---
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

                // Fungsi internal untuk import author dengan role
                const importAuthorWithRole = async (input, roleName) => {
                    if (!input) return;
                    const names = String(input).split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 0);
                    for (const name of names) {
                        const [authObj] = await Author.findOrCreate({ where: { name } });
                        await BookAuthor.findOrCreate({
                            where: { book_id: book.id, author_id: authObj.id, role: roleName }
                        });
                    }
                };
                await importAuthorWithRole(data.authorsPenulis, 'penulis');
                await importAuthorWithRole(data.authorsEditor, 'editor');
                await importAuthorWithRole(data.authorsPJ, 'penanggung jawab');

                // Relasi many-to-many lainnya (Publisher & Subject)
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
            console.error("IMPORT ERROR:", err);
            res.status(500).send("Gagal mengimport data: " + err.message);
        }
    },

    deleteMultiple: async (req, res) => {
        try {
            const { 
                bookIds, excludeIds, confirmation, deleteAll, 
                q, searchBy, matchType, category, subject, year, incomplete, page 
            } = req.body;

            // Gunakan origin_q jika q utama kosong, untuk konsistensi redirect
            const searchKeyword = q || req.body.origin_q || '';
            const redirectUrl = `/admin/books?q=${encodeURIComponent(searchKeyword)}&page=${page || 1}`;

            if (confirmation !== "HAPUS DATA") {
                return res.status(400).send("Konfirmasi salah.");
            }

            let whereCondition = {};
            
            if (category) whereCondition.category_id = category;
            if (year) whereCondition.publish_year = year;
            if (subject) whereCondition['$Subjects.id$'] = subject;

            // --- PERBAIKAN DI SINI ---
            if (q) {
                // Pastikan q dikonversi ke String dan ambil elemen pertama jika dia Array
                let searchValue = (Array.isArray(q) ? q[0] : String(q)).trim();
                
                let operator = Op.like;
                if (matchType === "startsWith") searchValue = `${searchValue}%`;
                else if (matchType === "endsWith") searchValue = `%${searchValue}`;
                else if (matchType === "exact") operator = Op.eq;
                else searchValue = `%${searchValue}%`;

                if (searchBy === "title") whereCondition.title = { [operator]: searchValue };
                if (searchBy === "isbn") whereCondition.isbn = { [operator]: searchValue };
                if (searchBy === "subject") whereCondition['$Subjects.name$'] = { [operator]: searchValue };
                if (searchBy === "category") whereCondition['$Category.name$'] = { [operator]: searchValue };
            }

            if (incomplete === "1") {
                whereCondition[Op.or] = [
                    { category_id: null }, { call_number: null }, { call_number: "" },
                    Sequelize.literal(`NOT EXISTS (SELECT 1 FROM BookSubjects WHERE BookSubjects.book_id = Book.id)`),
                    Sequelize.literal(`NOT EXISTS (SELECT 1 FROM BookAuthors WHERE BookAuthors.book_id = Book.id AND BookAuthors.role = 'penulis')`),
                    Sequelize.literal(`NOT EXISTS (SELECT 1 FROM BookPublishers WHERE BookPublishers.book_id = Book.id)`),
                    Sequelize.literal(`(SELECT COUNT(*) FROM BookCopies WHERE BookCopies.book_id = Book.id) = 0`)
                ];
            }

            // 3. Logika Eksekusi Hapus
            if (deleteAll === 'true') {
                const excluded = Array.isArray(excludeIds) ? excludeIds : (excludeIds ? [excludeIds] : []);
                
                // Gabungkan filter pencarian dengan pengecualian (excludeIds)
                whereCondition.id = { [Op.notIn]: excluded };

                // Ambil data untuk cleanup gambar (gunakan include agar filter Subject/Category jalan)
                const booksToDelete = await Book.findAll({
                    where: whereCondition,
                    include: [
                        { model: Subject, as: 'Subjects', required: false },
                        { model: Category, required: false }
                    ],
                    attributes: ['id', 'image']
                });
                
                const deleteIds = booksToDelete.map(b => b.id);

                // Hapus buku berdasarkan ID yang sudah terfilter
                await Book.destroy({
                    where: { id: { [Op.in]: deleteIds } }
                });
                
                // Cleanup gambar
                const uniqueImages = [...new Set(booksToDelete.map(b => b.image).filter(img => img))];
                for (const imageFilename of uniqueImages) {
                    await cleanupUnusedImage(imageFilename);
                }
                
                return res.redirect("/admin/books?deleteSuccess=all");
            }

            // Logika Manual (Checklist beberapa buku saja)
            const idsToDelete = Array.isArray(bookIds) ? bookIds : [bookIds];
            if (!idsToDelete || idsToDelete.length === 0) return res.redirect(redirectUrl);

            const booksToDelete = await Book.findAll({
                where: { id: { [Op.in]: idsToDelete } },
                attributes: ['image']
            });

            await Book.destroy({
                where: { id: { [Op.in]: idsToDelete } }
            });

            const uniqueImages = [...new Set(booksToDelete.map(b => b.image).filter(img => img))];
            for (const imageFilename of uniqueImages) {
                await cleanupUnusedImage(imageFilename);
            }

            res.redirect(`${redirectUrl}&deleteSuccess=${idsToDelete.length}`);
        } catch (err) {
            console.error("ERROR DELETE MULTIPLE:", err);
            res.status(500).send("Gagal menghapus data: " + err.message);
        }
    },
    // =========================
    // SHOW HALAMAN TAMBAH BUKU
    // =========================
    showAddPage: async (req, res) => {
        try {
            // 1. Import model Ruangan (pastikan sudah di-import di atas atau panggil di sini)
            const { Category, Author, Publisher, Subject, Ruangan } = require("../models");

            // 2. Identifikasi Ruangan Admin yang Login
            const adminId = req.user.id; // Diambil dari session/middleware login
            const ruanganAdmin = await Ruangan.findOne({ 
                where: { id_admin_ruangan: adminId } 
            });

            // 3. Ambil data pendukung untuk dropdown
            const categories = await Category.findAll({ order: [['name', 'ASC']] });
            const authors = await Author.findAll({ order: [['name', 'ASC']] });
            const publishers = await Publisher.findAll({ order: [['name', 'ASC']] });
            const subjects = await Subject.findAll({ order: [['name', 'ASC']] });

            // 4. Render ke view dengan mengirimkan variabel 'namaRuangan'
            res.render("admin/admin_add_book", {
                title: "Tambah Buku",
                active: 'add',
                // Kirim nama ruangan agar ditangkap oleh header.ejs
                namaRuangan: ruanganAdmin ? ruanganAdmin.nama_ruangan : null,
                categories,
                authors,
                publishers,
                subjects
            });

        } catch (err) {
            console.log("Error loading add page:", err);
            res.status(500).send("Gagal memuat halaman tambah buku");
        }
    },

    // =========================
    // ADD BOOK
    // =========================
    addBook: async (req, res) => {
        try {
            const data = req.body;
            const { BookAuthor, Author, Category, Subject, Book, BookCopy, Publisher, Ruangan, Sequelize } = require("../models");
            const { Op } = Sequelize;

            // 1. Identifikasi Ruangan Admin yang Login
            const adminId = req.user.id;
            const ruanganAdmin = await Ruangan.findOne({ 
                where: { id_admin_ruangan: adminId } 
            });

            // Proteksi: Jika bukan super_admin dan tidak punya ruangan, gagalkan proses
            if (!ruanganAdmin && req.user.role !== 'super_admin') {
                return res.status(403).json({ 
                    success: false, 
                    message: "Akses ditolak: Anda tidak ditugaskan di ruangan manapun." 
                });
            }

            const idRuangan = ruanganAdmin ? ruanganAdmin.id_ruangan : null;

            // Validasi Input Wajib
            if (!data.title || !data.category_id || !data.subjects || !data.no_induk || !data.call_number || !data.publishers || !data.authors_penulis) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Judul, Kategori, Subjek, Nomor Induk, Nomor Panggil, Penerbit, dan Penulis wajib diisi!" 
                });
            }

            // 2. Logika Kategori (findOrCreate)
            let categoryId = data.category_id;
            if (isNaN(categoryId)) {
                const [newCategory] = await Category.findOrCreate({ 
                    where: { name: String(categoryId).trim() } 
                });
                categoryId = newCategory.id;
            }

            const cleanShelfLocation = standardizeShelfLocation(data.shelf_location);

            // 3. CREATE BUKU (Sertakan id_ruangan)
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
                shelf_location: cleanShelfLocation,
                category_id: categoryId,
                id_ruangan: idRuangan, // KUNCI: Buku otomatis masuk ke ruangan admin
                image: req.file ? req.file.filename : null
            });

            // 4. PROSES ROLE PENULIS
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

            // 5. Logika Nomor Induk
            if (data.no_induk) {
                const noIndukArray = data.no_induk.split(/[\n,]+/).map(item => item.trim()).filter(item => item !== "");
                if (noIndukArray.length > 0) {
                    // Cek duplikat nomor induk di seluruh sistem
                    const existingCopies = await BookCopy.findAll({
                        where: { no_induk: { [Op.in]: noIndukArray } }
                    });

                    if (existingCopies.length > 0) {
                        const duplicateNumbers = existingCopies.map(c => c.no_induk).join(', ');
                        await book.destroy(); // Rollback buku jika nomor induk sudah ada
                        return res.status(400).json({ 
                            success: false, 
                            message: `Nomor Induk [${duplicateNumbers}] sudah terdaftar di sistem!` 
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

            // 6. Logika Publishers & Subjects
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

            return res.status(200).json({ 
                success: true, 
                redirectUrl: "/admin/books?addSuccess=1",
                message: `Buku berhasil ditambahkan ke ${ruanganAdmin.nama_ruangan}`
            });

        } catch (err) {
            console.error("ADD BOOK ERROR:", err);
            res.status(500).json({ success: false, message: "Terjadi kesalahan sistem: " + err.message });
        }
    },

    showEditPage: async (req, res) => {
        try {
            const { Book, Category, Author, Publisher, Subject, BookCopy, Ruangan } = require("../models");

            // 1. Identifikasi Ruangan Admin yang Login
            const adminId = req.user.id;
            const ruanganAdmin = await Ruangan.findOne({ 
                where: { id_admin_ruangan: adminId } 
            });

            // 2. Ambil data buku berdasarkan ID
            const book = await Book.findByPk(req.params.id, {
                include: [
                    Category,
                    { model: Author, as: 'Authors' },
                    { model: Publisher, as: 'Publishers' },
                    { model: Subject, as: 'Subjects' },
                    { model: BookCopy, as: 'copies' } 
                ]
            });

            // 3. PROTEKSI KEAMANAN: Cek apakah buku ini milik ruangan si admin
            if (!book) return res.status(404).send("Buku tidak ditemukan");

            if (req.user.role !== 'super_admin') {
                if (!ruanganAdmin || book.id_ruangan !== ruanganAdmin.id_ruangan) {
                    return res.status(403).send("Akses Ditolak: Anda tidak memiliki izin untuk mengedit buku dari ruangan lain.");
                }
            }

            // 4. Ambil data pendukung untuk dropdown
            const categories = await Category.findAll({ order: [['name', 'ASC']] });
            const authors = await Author.findAll({ order: [['name', 'ASC']] });
            const publishers = await Publisher.findAll({ order: [['name', 'ASC']] });
            const subjects = await Subject.findAll({ order: [['name', 'ASC']] });

            // 5. Render dengan menyertakan 'namaRuangan'
            res.render("admin/admin_edit_book", {
                title: "Edit Buku",
                active: 'books', // Navigasi tetap di menu buku
                namaRuangan: ruanganAdmin ? ruanganAdmin.nama_ruangan : null, // Muncul di header.ejs
                book,
                categories,
                authors,
                publishers,
                subjects,
                query: req.query
            });
        } catch (err) {
            console.error("EDIT PAGE ERROR:", err);
            res.status(500).send("Gagal memuat halaman edit buku");
        }
    },

    // =========================
    // UPDATE BOOK
    // =========================
    updateBook: async (req, res) => {
        try {
            const { BookAuthor, Author, Category, Subject, Book, BookCopy, Publisher, Ruangan, Sequelize } = require("../models");
            const { Op } = Sequelize;
            const path = require('path');
            const fs = require('fs');

            // 1. Identifikasi Ruangan Admin yang Login
            const adminId = req.user.id;
            const ruanganAdmin = await Ruangan.findOne({ 
                where: { id_admin_ruangan: adminId } 
            });

            // 2. Ambil data buku yang akan diupdate
            const book = await Book.findByPk(req.params.id);
            if (!book) return res.status(404).json({ success: false, message: "Buku tidak ditemukan" });

            // 3. PROTEKSI KEAMANAN: Pastikan buku milik ruangan admin tersebut
            if (req.user.role !== 'super_admin') {
                if (!ruanganAdmin || book.id_ruangan !== ruanganAdmin.id_ruangan) {
                    return res.status(403).json({ 
                        success: false, 
                        message: "Akses Ditolak: Anda tidak memiliki otoritas untuk mengubah buku dari ruangan lain." 
                    });
                }
            }

            const data = req.body;

            // Validasi Required
            if (!data.title || !data.category_id || !data.no_induk|| !data.call_number || !data.publishers || !data.authors_penulis) {
                return res.status(400).json({ success: false, message: "Gagal: Judul, Kategori, Nomor Induk, Nomor Panggil, Penerbit, dan Penulis wajib diisi!" });
            }

            // Simpan state pencarian asal agar redirect kembali ke posisi yang sama
            const queryParams = new URLSearchParams({
                q: data.origin_q || "",
                searchBy: data.origin_searchBy || "title",
                matchType: data.origin_matchType || "contains",
                category: data.origin_category || "",
                subject: data.origin_subject || "",
                year: data.origin_year || "",
                page: data.origin_page || "1"
            });

            // 4. Update Kategori (findOrCreate)
            let categoryId = data.category_id;
            if (isNaN(categoryId)) {
                const [newCategory] = await Category.findOrCreate({ where: { name: String(categoryId).trim() } });
                categoryId = newCategory.id;
            }

            // 5. Handle Gambar (Logika pembersihan file filesystem)
            const oldImageName = book.image;
            if (req.file) {
                if (oldImageName && oldImageName !== req.file.filename) {
                    try {
                        const oldImagePath = path.join(__dirname, '../public/image/uploads', oldImageName);
                        if (fs.existsSync(oldImagePath)) {
                            const booksUsingOldImage = await Book.count({
                                where: { image: oldImageName, id: { [Op.ne]: book.id } }
                            });
                            if (booksUsingOldImage === 0) fs.unlinkSync(oldImagePath);
                        }
                    } catch (err) { console.error("Error hapus gambar lama:", err.message); }
                }
            } else if (data.remove_image === 'true' && oldImageName) {
                try {
                    const oldImagePath = path.join(__dirname, '../public/image/uploads', oldImageName);
                    if (fs.existsSync(oldImagePath)) {
                        const booksUsingOldImage = await Book.count({
                            where: { image: oldImageName, id: { [Op.ne]: book.id } }
                        });
                        if (booksUsingOldImage === 0) fs.unlinkSync(oldImagePath);
                    }
                } catch (err) { console.error("Error hapus gambar:", err.message); }
            }

            const cleanShelfLocation = standardizeShelfLocation(data.shelf_location);

            // 6. Update Data Utama Buku (id_ruangan TIDAK BOLEH diubah oleh admin ruangan)
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
                shelf_location: cleanShelfLocation,
                category_id: categoryId
            };
            
            if (req.file) updateData.image = req.file.filename;
            else if (data.remove_image === 'true') updateData.image = null;
            
            await book.update(updateData);

            // 7. PROSES ULANG AUTHORS
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

            // 8. Update Nomor Induk
            if (data.no_induk) {
                const noIndukArray = data.no_induk.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== "");
                const currentCopies = await BookCopy.findAll({ where: { book_id: book.id }, attributes: ['no_induk'] });
                const currentNoInduks = currentCopies.map(c => c.no_induk).sort();
                const newNoInduks = [...noIndukArray].sort();
                
                if (JSON.stringify(currentNoInduks) !== JSON.stringify(newNoInduks)) {
                    const existingCopies = await BookCopy.findAll({
                        where: { no_induk: { [Op.in]: noIndukArray }, book_id: { [Op.ne]: book.id } }
                    });
                    if (existingCopies.length > 0) {
                        return res.status(400).json({ success: false, message: `Nomor Induk [${existingCopies.map(c => c.no_induk).join(', ')}] sudah terdaftar!` });
                    }
                    await BookCopy.destroy({ where: { book_id: book.id } });
                    await BookCopy.bulkCreate(noIndukArray.map(n => ({ book_id: book.id, no_induk: n, status: 'tersedia' })));
                    const actualCount = await BookCopy.count({ where: { book_id: book.id } });
                    await book.update({ stock_total: actualCount });
                }
            }

            // 9. Update Publisher & Subject
            if (data.publishers) {
                const pubs = Array.isArray(data.publishers) ? data.publishers : [data.publishers];
                const pubIds = [];
                for (const p of pubs) {
                    if (!p) continue;
                    pubIds.push(isNaN(p) ? (await Publisher.findOrCreate({ where: { name: p.trim() } }))[0].id : p);
                }
                await book.setPublishers(pubIds);
            }

            if (data.subjects) {
                const subs = Array.isArray(data.subjects) ? data.subjects : [data.subjects];
                const subIds = [];
                for (const s of subs) {
                    if (!s) continue;
                    subIds.push(isNaN(s) ? (await Subject.findOrCreate({ where: { name: s.trim() } }))[0].id : s);
                }
                await book.setSubjects(subIds);
            }

            return res.status(200).json({ 
                success: true, 
                redirectUrl: `/admin/books?${queryParams.toString()}&updateSuccess=1`,
                message: `Buku di ${ruanganAdmin.nama_ruangan} berhasil diperbarui.`
            });

        } catch (err) {
            console.error("UPDATE BOOK ERROR:", err);
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

            const imageFilename = book.image;
            await book.destroy();
            
            // Cleanup gambar yang tidak digunakan
            await cleanupUnusedImage(imageFilename);
            
            const redirectUrl = `/admin/books?deleteSuccess=1`;
            res.redirect(redirectUrl);
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
            const idRuangan = await getRoomFilter(req);
            const q = req.query.q || "";
            
            const categories = await Category.findAll({
                where: { name: { [Op.like]: `%${q}%` } },
                include: [{
                    model: Book,
                    attributes: [],
                    where: idRuangan ? { id_ruangan: idRuangan } : {},
                    required: true // Inner join: Hanya kategori yang ada bukunya di ruangan ini
                }],
                limit: 10,
                distinct: true
            });
            res.json(categories);
        } catch (err) {
            res.status(500).send("Gagal mencari kategori");
        }
    },

    findAuthor: async (req, res) => {
        try {
            const idRuangan = await getRoomFilter(req);
            const q = req.query.q || "";

            const authors = await Author.findAll({
                where: { name: { [Op.like]: `%${q}%` } },
                include: [{
                    model: Book,
                    as: 'Books',
                    attributes: [],
                    where: idRuangan ? { id_ruangan: idRuangan } : {},
                    required: true // Hanya penulis yang bukunya ada di ruangan admin
                }],
                limit: 10,
                distinct: true
            });
            res.json(authors);
        } catch (err) {
            res.status(500).send("Gagal mencari author");
        }
    },

    findPublisher: async (req, res) => {
        try {
            const idRuangan = await getRoomFilter(req);
            const q = req.query.q || "";

            const publishers = await Publisher.findAll({
                where: { name: { [Op.like]: `%${q}%` } },
                include: [{
                    model: Book,
                    as: 'Books',
                    attributes: [],
                    where: idRuangan ? { id_ruangan: idRuangan } : {},
                    required: true
                }],
                limit: 10,
                distinct: true
            });
            res.json(publishers);
        } catch (err) {
            res.status(500).send("Gagal mencari publisher");
        }
    },

    findSubject: async (req, res) => {
        try {
            const idRuangan = await getRoomFilter(req);
            const q = req.query.q || "";

            const subjects = await Subject.findAll({
                where: { name: { [Op.like]: `%${q}%` } },
                include: [{
                    model: Book,
                    as: 'Books',
                    attributes: [],
                    where: idRuangan ? { id_ruangan: idRuangan } : {},
                    required: true
                }],
                limit: 10,
                distinct: true
            });
            res.json(subjects);
        } catch (err) {
            res.status(500).send("Gagal mencari subject");
        }
    },
    // =========================
    // SHELF MANAGEMENT
    // =========================
    showShelfManagementPage: async (req, res) => {
        try {
            const { Category, Book, BookCopy, Subject, Ruangan, Sequelize } = require("../models");
            const { Op } = Sequelize;

            // 1. Identifikasi Ruangan Admin yang Login
            const adminId = req.user.id;
            const ruanganAdmin = await Ruangan.findOne({ 
                where: { id_admin_ruangan: adminId } 
            });

            // Proteksi akses
            if (!ruanganAdmin && req.user.role !== 'super_admin') {
                return res.status(403).send("Akses ditolak: Anda tidak memiliki otoritas atas ruangan manapun.");
            }

            const idRuangan = ruanganAdmin ? ruanganAdmin.id_ruangan : null;

            // 2. Ambil Parameter & Konfigurasi Pagination
            const { q = "", category = "", subject = "", year = "", shelf = "", page = 1 } = req.query;
            const limit = 200; 
            const currentPage = Math.max(1, parseInt(page) || 1);
            const offset = (currentPage - 1) * limit;

            // 3. Setup Filter & Condition
            const whereCondition = {};
            // KUNCI: Filter buku hanya yang berada di ruangan admin ini
            if (idRuangan) whereCondition.id_ruangan = idRuangan; 
            
            if (category) whereCondition.category_id = category;
            if (year) whereCondition.publish_year = year;

            if (shelf) {
                if (shelf === 'unassigned') {
                    whereCondition.shelf_location = { 
                        [Op.or]: [{ [Op.eq]: null }, { [Op.eq]: "" }, { [Op.eq]: "-" }] 
                    };
                } else {
                    whereCondition.shelf_location = shelf;
                }
            }

            // Include Options
            const includeOptions = [
                { model: Category, attributes: ['name'], required: false },
                { model: BookCopy, as: 'copies', attributes: ['no_induk'], required: false } 
            ];

            if (subject) {
                includeOptions.push({
                    model: Subject,
                    as: 'Subjects',
                    where: { id: subject },
                    required: true 
                });
            }

            // Search Query Logic
            if (q && q.trim() !== "") {
                const keyword = `%${q.trim()}%`;
                whereCondition[Op.and] = [
                    ...(whereCondition[Op.and] || []),
                    {
                        [Op.or]: [
                            { title: { [Op.like]: keyword } },
                            { isbn: { [Op.like]: keyword } },
                            { call_number: { [Op.like]: keyword } },
                            { '$copies.no_induk$': { [Op.like]: keyword } } 
                        ]
                    }
                ];
            }

            // 4. QUERY UTAMA
            const { count, rows: books } = await Book.findAndCountAll({
                where: whereCondition,
                attributes: ['id', 'title', 'call_number', 'shelf_location', 'image', 'isbn', 'publish_year'],
                include: includeOptions,
                order: [['title', 'ASC']],
                limit: limit,
                offset: offset,
                subQuery: false, 
                distinct: true   
            });

            // 5. Data Pendukung Filter (Hanya ambil data yang relevan dengan buku di ruangan ini)
            const categories = await Category.findAll({ order: [['name', 'ASC']] });
            const subjects = await Subject.findAll({ order: [['name', 'ASC']] });
            
            // Ambil daftar tahun unik hanya dari ruangan ini
            const yearsRaw = await Book.findAll({
                attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("publish_year")), "year"]],
                where: { 
                    publish_year: { [Op.ne]: null },
                    ...(idRuangan ? { id_ruangan: idRuangan } : {})
                },
                raw: true,
                order: [['publish_year', 'DESC']]
            });
            const years = yearsRaw.map(y => y.year).filter(y => y);

            // Ambil daftar rak unik hanya dari ruangan ini
            const shelvesRaw = await Book.findAll({
                attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("shelf_location")), "location"]],
                where: { 
                    shelf_location: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }, { [Op.ne]: "-" }] },
                    ...(idRuangan ? { id_ruangan: idRuangan } : {})
                },
                raw: true,
                order: [['shelf_location', 'ASC']]
            });
            const shelves = shelvesRaw.map(s => s.location);

            // 6. RENDER VIEW
            res.render("admin/shelf_management", {
                title: "Manajemen Lokasi Rak",
                namaRuangan: ruanganAdmin ? ruanganAdmin.nama_ruangan : 'Semua Ruangan', // Muncul di Header
                books,
                categories,
                subjects,
                years,
                shelves,
                query: req.query,
                pagination: {
                    currentPage,
                    totalPages: Math.ceil(count / limit),
                    totalItems: count,
                    limit
                }
            });

        } catch (err) {
            console.error("Shelf Management Error:", err);
            res.status(500).send("Gagal memuat halaman: " + err.message);
        }
    },

    bulkUpdateShelf: async (req, res) => {
        try {
            const { Book, BookCopy, Subject, Ruangan, Sequelize } = require("../models");
            const { Op } = Sequelize;

            // 1. Identifikasi Ruangan Admin yang Login
            const adminId = req.user.id;
            const ruanganAdmin = await Ruangan.findOne({ 
                where: { id_admin_ruangan: adminId } 
            });

            // Proteksi Akses
            if (!ruanganAdmin && req.user.role !== 'super_admin') {
                return res.status(403).json({ success: false, message: "Akses ditolak: Anda tidak memiliki otoritas ruangan." });
            }

            const idRuangan = ruanganAdmin ? ruanganAdmin.id_ruangan : null;
            const { bookIds, newLocation: rawLocation, isSelectAll, filterParams } = req.body;

            const newLocation = standardizeShelfLocation(rawLocation);
            if (!newLocation) {
                return res.status(400).json({ success: false, message: "Lokasi baru tidak valid." });
            }

            let affectedCount = 0;

            if (isSelectAll && filterParams) {
                // === MODE A: UPDATE SELURUH HASIL FILTER (DI RUANGAN TERKAIT) ===
                const { q, category, subject, year, shelf } = filterParams;
                const whereCondition = {};
                
                // KUNCI: Filter id_ruangan wajib disertakan agar tidak mengupdate buku ruangan lain
                if (idRuangan) whereCondition.id_ruangan = idRuangan;

                if (category) whereCondition.category_id = category;
                if (year) whereCondition.publish_year = year;

                if (shelf) {
                    if (shelf === 'unassigned') {
                        whereCondition.shelf_location = { 
                            [Op.or]: [{ [Op.eq]: null }, { [Op.eq]: "" }, { [Op.eq]: "-" }] 
                        };
                    } else {
                        whereCondition.shelf_location = shelf;
                    }
                }

                const includeOptions = [];
                if (subject) {
                    includeOptions.push({
                        model: Subject, as: 'Subjects', where: { id: subject }, required: true
                    });
                }
                
                includeOptions.push({ model: BookCopy, as: 'copies', attributes: [], required: false });

                if (q && q.trim() !== "") {
                    const keyword = `%${q.trim()}%`;
                    whereCondition[Op.and] = [
                        ...(whereCondition[Op.and] || []),
                        {
                            [Op.or]: [
                                { title: { [Op.like]: keyword } },
                                { isbn: { [Op.like]: keyword } },
                                { call_number: { [Op.like]: keyword } },
                                { '$copies.no_induk$': { [Op.like]: keyword } }
                            ]
                        }
                    ];
                }

                // Ambil ID buku yang hanya ada di ruangan admin ini dan sesuai filter
                const booksToUpdate = await Book.findAll({
                    where: whereCondition,
                    include: includeOptions,
                    attributes: ['id'],
                    subQuery: false,
                    distinct: true
                });

                const allIds = booksToUpdate.map(b => b.id);
                if (allIds.length === 0) {
                    return res.status(400).json({ success: false, message: "Tidak ada data di ruangan Anda yang cocok." });
                }

                const [updateCount] = await Book.update(
                    { shelf_location: newLocation },
                    { where: { id: { [Op.in]: allIds } } }
                );
                affectedCount = updateCount;

            } else {
                // === MODE B: UPDATE MANUAL (DIPILIH SATU-SATU) ===
                if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
                    return res.status(400).json({ success: false, message: "Tidak ada buku yang dipilih." });
                }

                // KUNCI: Meskipun ID dikirim manual, tambahkan filter id_ruangan di klausul WHERE 
                // untuk mencegah manipulasi ID buku dari ruangan lain via request.
                const updateCriteria = {
                    id: { [Op.in]: bookIds }
                };
                if (idRuangan) updateCriteria.id_ruangan = idRuangan;

                const [updateCount] = await Book.update(
                    { shelf_location: newLocation },
                    { where: updateCriteria }
                );
                affectedCount = updateCount;
            }

            return res.status(200).json({ 
                success: true, 
                message: `Berhasil memindahkan ${affectedCount} buku di ${ruanganAdmin.nama_ruangan} ke ${newLocation}.` 
            });

        } catch (err) {
            console.error("Bulk Update Shelf Error:", err);
            res.status(500).json({ success: false, message: "Terjadi kesalahan server: " + err.message });
        }
    }
};