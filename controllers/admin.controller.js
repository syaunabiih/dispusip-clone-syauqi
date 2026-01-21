const { Book, Category, Author, Publisher, Subject, BookCopy, Sequelize } = require("../models");
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


module.exports = {
    listBooks: async (req, res) => {
        try {
            const {
                q = "", searchBy = "title", matchType = "contains",
                category = "", subject = "", year = "",
                page = 1, incomplete = ""
            } = req.query;

            const isIncomplete = incomplete === "1";
            const limit = 100;
            const currentPage = parseInt(page) || 1;
            const offset = (currentPage - 1) * limit;

            let searchValue = q.trim();
            let operator = Op.like;
            
            // Tentukan operator pencarian
            if (q) {
                if (matchType === "startsWith") searchValue = `${q}%`;
                else if (matchType === "endsWith") searchValue = `%${q}`;
                else if (matchType === "exact") operator = Op.eq;
                else searchValue = `%${q}%`;
            }

            // 1. Inisialisasi Where Condition untuk Tabel Utama (Book)
            const whereCondition = {};
            
            // Filter Dropdown (Kategori & Tahun)
            if (category) whereCondition.category_id = category;
            if (year) whereCondition.publish_year = year;

            // 2. Inisialisasi Include Options
            // Kita definisikan include di awal agar bisa dimodifikasi berdasarkan pencarian
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
                    subjectInclude.required = true; // Inner join agar hanya buku dengan subjek ini yang muncul
                }
            }

            // 4. Logika Pencarian (Search Bar)
            if (q) {
                if (searchBy === "title") {
                    whereCondition.title = { [operator]: searchValue };
                } 
                else if (searchBy === "isbn") {
                    whereCondition.isbn = { [operator]: searchValue };
                } 
                else if (searchBy === "author") {
                    // Cari di tabel Authors
                    const authorInclude = includeOptions.find(opt => opt.model === Author);
                    if (authorInclude) {
                        authorInclude.where = { name: { [operator]: searchValue } };
                        authorInclude.required = true;
                    }
                } 
                else if (searchBy === "publisher") {
                    // Cari di tabel Publishers
                    const publisherInclude = includeOptions.find(opt => opt.model === Publisher);
                    if (publisherInclude) {
                        publisherInclude.where = { name: { [operator]: searchValue } };
                        publisherInclude.required = true;
                    }
                } 
                else if (searchBy === "subject") {
                    // Cari di tabel Subjects
                    const subjectInclude = includeOptions.find(opt => opt.model === Subject);
                    if (subjectInclude) {
                        // Jika sudah ada filter ID (dari dropdown), kita timpa atau gabung (disini kita timpa untuk pencarian teks)
                        // Atau gunakan Op.and jika ingin menggabungkan dropdown + search text
                        subjectInclude.where = { 
                            ...subjectInclude.where, // Pertahankan filter ID jika ada (opsional)
                            name: { [operator]: searchValue } 
                        };
                        subjectInclude.required = true;
                    }
                }
                else if (searchBy === "category") {
                    // Cari di tabel Categories
                    const categoryInclude = includeOptions.find(opt => opt.model === Category);
                    if (categoryInclude) {
                        categoryInclude.where = { name: { [operator]: searchValue } };
                        categoryInclude.required = true;
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
                distinct: true, // Penting agar count akurat meski ada join many-to-many
                col: 'id',
                subQuery: false // [PENTING] Nonaktifkan subquery agar where clause pada include terbaca
            });

            // Hitung total eksemplar (Logika sebelumnya)
            let totalFilteredCopies;
            const hasFilter = q || category || subject || year || isIncomplete;
            
            if (!hasFilter) {
                totalFilteredCopies = await BookCopy.count();
                console.log(`[LIST BOOKS] Tidak ada filter - Total Buku dari database: ${totalFilteredCopies}`);
            } else {
                // Gunakan query yang sama (tanpa limit/offset) untuk mendapatkan ID buku terfilter
                const filteredBookRecords = await Book.findAll({
                    where: whereCondition,
                    include: includeOptions,
                    attributes: ['id'],
                    distinct: true,
                    subQuery: false // Konsisten dengan query utama
                });
                
                const filteredBookIds = filteredBookRecords.map(book => book.id);
                console.log(`[LIST BOOKS] Filter aktif - Jumlah buku terfilter: ${filteredBookIds.length}`);
                
                if (filteredBookIds.length > 0) {
                    totalFilteredCopies = await BookCopy.count({
                        where: {
                            book_id: { [Op.in]: filteredBookIds }
                        }
                    });
                    console.log(`[LIST BOOKS] Total Buku (nomor induk) dari database: ${totalFilteredCopies}`);
                } else {
                    totalFilteredCopies = 0;
                    console.log(`[LIST BOOKS] Tidak ada buku terfilter - Total Buku: 0`);
                }
            }
            
            console.log(`[LIST BOOKS] FINAL - Total Judul (Book): ${count}, Total Buku (BookCopy/nomor induk): ${totalFilteredCopies}`);

            const allCategories = await Category.findAll({ order: [['name', 'ASC']] });
            const allSubjects = await Subject.findAll({ order: [['name', 'ASC']] });
            const allYearsRaw = await Book.findAll({
                attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("publish_year")), "year"]],
                where: { publish_year: { [Op.ne]: null } },
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
            // Pastikan import Op dari sequelize
            const { Book, Category, Author, Publisher, Subject, BookCopy, BookAuthor, Sequelize } = require("../models");
            
            console.log(`\n${'='.repeat(60)}`);
            console.log(`[IMPORT EXCEL] Memulai proses import dengan Normalisasi Judul...`);
            console.log(`${'='.repeat(60)}\n`);
            
            if (!req.file) return res.status(400).send("Tidak ada file yang diunggah");

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(req.file.buffer); 
            const worksheet = workbook.getWorksheet(1);

            let successCount = 0;
            let existingCount = 0;

            const booksData = [];
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header

                // Ambil judul mentah
                const rawTitle = row.getCell(1).text.trim();
                
                // Jika judul kosong, skip
                if (!rawTitle) return;

                // 1. NORMALISASI JUDUL DI SINI
                // Ubah format menjadi Title Case (Huruf Depan Besar) agar rapi di DB
                const formattedTitle = toTitleCase(rawTitle);

                booksData.push({
                    title: formattedTitle, // Simpan yang sudah rapi
                    edition: row.getCell(2).text,
                    publish_year: row.getCell(3).text,
                    publish_place: row.getCell(4).text,
                    physical_description: row.getCell(5).text,
                    isbn: row.getCell(6).text,
                    call_number: row.getCell(7).text,
                    language: row.getCell(8).text,
                    shelf_location: row.getCell(9).text,
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
                // 2. CEK DUPLIKAT YANG LEBIH KUAT (CASE INSENSITIVE)
                // Kita cari buku dimana Lowercase(title_di_db) == Lowercase(title_excel)
                let book = await Book.findOne({ 
                    where: Sequelize.where(
                        Sequelize.fn('LOWER', Sequelize.col('title')), 
                        Sequelize.fn('LOWER', data.title)
                    )
                });
                
                // --- LOGIKA GAMBAR (TETAP SAMA) ---
                let finalImageName = null;
                if (data.imageInput) {
                    if (data.imageInput.startsWith('http')) {
                        try {
                            // Cek dulu apakah buku sudah punya gambar, kalau belum baru download
                            // Atau jika user memaksa update gambar (opsional logic)
                            finalImageName = await downloadImage(data.imageInput, data.title);
                        } catch (err) {
                            console.error(`Error download gambar:`, err.message);
                        }
                    } else {
                        const checkPath = path.join(__dirname, '../public/image/uploads', data.imageInput);
                        if (fs.existsSync(checkPath)) finalImageName = data.imageInput;
                    }
                }

                if (!book) {
                    // --- BUKU BARU (INSERT) ---
                    console.log(`[BARU] Menyimpan: ${data.title}`);
                    
                    const finalCategoryName = (data.categoryName && data.categoryName.trim() !== "") ? data.categoryName.trim() : 'Tanpa Kategori';
                    const [cat] = await Category.findOrCreate({ where: { name: finalCategoryName } });

                    book = await Book.create({
                        title: data.title, // Judul sudah Title Case
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
                    // --- UPDATE BUKU YANG ADA ---
                    console.log(`[UPDATE] Buku ditemukan: ${book.title} (Update data...)`);

                    const updateData = {};
                    
                    // Update judul ke format yang rapi (Title Case) jika sebelumnya berantakan
                    if (book.title !== data.title) {
                        updateData.title = data.title;
                    }

                    const fields = ['edition', 'publish_year', 'publish_place', 'physical_description', 'isbn', 'call_number', 'language', 'shelf_location', 'notes', 'abstract'];
                    fields.forEach(f => {
                        // Logic: Update jika data di DB kosong/strip DAN data di Excel ada isinya
                        if ((!book[f] || book[f] === '-' || book[f] === '') && data[f]) {
                            updateData[f] = data[f];
                        }
                    });
                    
                    // Logic Gambar (Sama seperti sebelumnya)
                    if (finalImageName) {
                        const oldImageName = book.image;
                        updateData.image = finalImageName;
                        
                        if (oldImageName && oldImageName !== finalImageName) {
                            try {
                                const oldImagePath = path.join(__dirname, '../public/image/uploads', oldImageName);
                                if (fs.existsSync(oldImagePath)) {
                                    const booksUsingOldImage = await Book.count({
                                        where: { image: oldImageName, id: { [Op.ne]: book.id } }
                                    });
                                    if (booksUsingOldImage === 0) fs.unlinkSync(oldImagePath);
                                }
                            } catch (err) { console.error("Gagal hapus gambar lama:", err); }
                        }
                    } else if ((!book.image || book.image === '') && finalImageName) {
                        updateData.image = finalImageName;
                    }
                    
                    if (Object.keys(updateData).length > 0) await book.update(updateData);
                    existingCount++;
                }

                // --- LOGIKA NOMOR INDUK (TETAP SAMA) ---
                if (data.noInduk) {
                    const nos = data.noInduk.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== "");
                    for (const n of nos) {
                        await BookCopy.findOrCreate({
                            where: { no_induk: n }, 
                            defaults: { book_id: book.id, status: 'tersedia' }
                        });
                    }
                    // Update total stok real time
                    const countTotal = await BookCopy.count({ where: { book_id: book.id } });
                    await book.update({ stock_total: countTotal });
                }

                // --- LOGIKA RELASI AUTHOR & SUBJECT (TETAP SAMA) ---
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
                    { category_id: null }, { shelf_location: null }, { shelf_location: "" }, { shelf_location: "-" },
                    { isbn: null }, { isbn: "" }, { call_number: null }, { call_number: "" },
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

            if (!data.title || !data.category_id || !data.subjects || !data.no_induk || !data.call_number || !data.publishers || !data.authors_penulis) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Judul, Kategori, Subjek, Nomor Induk, Nomor Panggil, Penerbit, dan Penulis wajib diisi!" 
                });
            }

            // 1. Logika Kategori (Gunakan findOrCreate agar aman)
            let categoryId = data.category_id;
            if (isNaN(categoryId)) {
                const [newCategory] = await Category.findOrCreate({ where: { name: String(categoryId).trim() } });
                categoryId = newCategory.id;
            }

            // 2. CREATE BUKU DULU (PENTING: Variabel 'book' harus dibuat dulu)
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
            if (!data.title || !data.category_id || !data.no_induk|| !data.call_number || !data.publishers || !data.authors_penulis) {
                return res.status(400).json({ success: false, message: "Gagal: Judul, Kategori, dan Nomor Induk, Nomor Panggil, Penerbit, dan Penulis wajib diisi!" });
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

            // 3. Handle Gambar
            const oldImageName = book.image;
            console.log(`\n[UPDATE BOOK] Memproses gambar untuk buku ID ${book.id}`);
            console.log(`  Gambar lama: ${oldImageName || 'Tidak ada'}`);
            console.log(`  File baru diupload: ${req.file ? req.file.filename : 'Tidak ada'}`);
            console.log(`  Remove image flag: ${data.remove_image || 'false'}`);
            
            // Cek apakah ada file baru yang diupload
            if (req.file) {
                // Ada file baru, gunakan filename baru
                console.log(`  ✓ File baru ditemukan: ${req.file.filename}`);
                
                // Hapus gambar lama jika berbeda dengan gambar baru dan tidak digunakan buku lain
                if (oldImageName && oldImageName !== req.file.filename) {
                    try {
                        const oldImagePath = path.join(__dirname, '../public/image/uploads', oldImageName);
                        if (fs.existsSync(oldImagePath)) {
                            // Cek apakah gambar lama masih digunakan oleh buku lain
                            const booksUsingOldImage = await Book.count({
                                where: { 
                                    image: oldImageName,
                                    id: { [Op.ne]: book.id }
                                }
                            });
                            
                            if (booksUsingOldImage === 0) {
                                // Tidak ada buku lain yang menggunakan gambar lama, hapus file
                                fs.unlinkSync(oldImagePath);
                                console.log(`  ✓ Gambar lama dihapus dari filesystem: ${oldImageName}`);
                            } else {
                                console.log(`  ⚠️  Gambar lama ${oldImageName} masih digunakan oleh ${booksUsingOldImage} buku lain, tidak dihapus`);
                            }
                        }
                    } catch (err) {
                        console.error(`  ❌ Error menghapus gambar lama ${oldImageName}:`, err.message);
                    }
                }
            } else if (data.remove_image === 'true') {
                // User menghapus gambar (dari tombol remove)
                console.log(`  ✓ User menghapus gambar lama`);
                
                // Hapus file gambar lama jika tidak digunakan buku lain
                if (oldImageName) {
                    try {
                        const oldImagePath = path.join(__dirname, '../public/image/uploads', oldImageName);
                        if (fs.existsSync(oldImagePath)) {
                            const booksUsingOldImage = await Book.count({
                                where: { 
                                    image: oldImageName,
                                    id: { [Op.ne]: book.id }
                                }
                            });
                            
                            if (booksUsingOldImage === 0) {
                                fs.unlinkSync(oldImagePath);
                                console.log(`  ✓ Gambar lama dihapus dari filesystem: ${oldImageName}`);
                            }
                        }
                    } catch (err) {
                        console.error(`  ❌ Error menghapus gambar lama:`, err.message);
                    }
                }
            } else {
                // Tidak ada file baru dan tidak ada request untuk hapus
                console.log(`  ✓ Tidak ada perubahan gambar, pertahankan gambar lama`);
            }

            // 4. Update Data Utama Buku
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
                shelf_location: data.shelf_location,
                category_id: categoryId
            };
            
            // Selalu update image jika ada perubahan (file baru, dihapus, atau tetap sama)
            // Ini memastikan gambar tersimpan dengan benar
            if (req.file) {
                // Ada file baru yang diupload - GUNAKAN FILE BARU
                updateData.image = req.file.filename;
                console.log(`  ✓✓✓ GAMBAR BARU AKAN DISIMPAN: ${req.file.filename} ✓✓✓`);
            } else if (data.remove_image === 'true') {
                // User menghapus gambar - SET NULL
                updateData.image = null;
                console.log(`  ✓✓✓ GAMBAR AKAN DIHAPUS DARI DATABASE ✓✓✓`);
            } else {
                // Tidak ada perubahan - PERTAHANKAN GAMBAR LAMA (atau null jika tidak ada)
                updateData.image = oldImageName || null;
                console.log(`  ✓ Gambar lama dipertahankan: ${oldImageName || 'Tidak ada'}`);
            }
            
            console.log(`\n[UPDATE BOOK] Data yang akan diupdate:`);
            console.log(`  Title: ${updateData.title}`);
            console.log(`  Image: ${updateData.image || 'null'}`);
            console.log(`  Has File: ${!!req.file}`);
            console.log(`  Remove Image Flag: ${data.remove_image || 'false'}\n`);
            
            await book.update(updateData);
            
            // Verifikasi bahwa gambar tersimpan
            await book.reload();
            console.log(`✓✓✓ VERIFIKASI: Gambar di database setelah update: ${book.image || 'null'} ✓✓✓\n`);

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

            // 5. Update Nomor Induk (hanya jika benar-benar berubah)
            if (data.no_induk) {
                const noIndukArray = data.no_induk.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== "");
                
                // Ambil nomor induk yang sudah ada untuk buku ini
                const currentCopies = await BookCopy.findAll({
                    where: { book_id: book.id },
                    attributes: ['no_induk']
                });
                const currentNoInduks = currentCopies.map(c => c.no_induk).sort();
                const newNoInduks = [...noIndukArray].sort();
                
                // Bandingkan apakah ada perubahan
                const hasChanges = currentNoInduks.length !== newNoInduks.length || 
                                 !currentNoInduks.every((val, idx) => val === newNoInduks[idx]);
                
                // Hanya update jika ada perubahan nomor induk
                if (hasChanges) {
                    const existingCopies = await BookCopy.findAll({
                        where: { no_induk: { [Op.in]: noIndukArray }, book_id: { [Op.ne]: book.id } }
                    });

                    if (existingCopies.length > 0) {
                        return res.status(400).json({ success: false, message: `Nomor Induk [${existingCopies.map(c => c.no_induk).join(', ')}] sudah terdaftar!` });
                    }

                    // Hapus nomor induk lama dan buat yang baru
                    await BookCopy.destroy({ where: { book_id: book.id } });
                    await BookCopy.bulkCreate(noIndukArray.map(n => ({ book_id: book.id, no_induk: n, status: 'tersedia' })));
                    
                    // Update stock_total dengan menghitung ulang dari database (lebih akurat)
                    const actualCount = await BookCopy.count({ where: { book_id: book.id } });
                    await book.update({ stock_total: actualCount });
                    console.log(`✓ Nomor induk diupdate untuk buku ID ${book.id}, total sekarang: ${actualCount}`);
                } else {
                    console.log(`✓ Nomor induk tidak berubah untuk buku ID ${book.id}, tidak perlu update`);
                }
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
    },
    // =========================
    // SHELF MANAGEMENT
    // =========================
    showShelfManagementPage: async (req, res) => {
        try {
            // 1. Ambil Parameter (termasuk page)
            const { q = "", category = "", subject = "", year = "", shelf = "", page = 1 } = req.query;
            
            // --- KONFIGURASI PAGINATION ---
            const limit = 200; // Batas data per halaman
            const currentPage = Math.max(1, parseInt(page) || 1);
            const offset = (currentPage - 1) * limit;

            // 2. Setup Include
            const includeOptions = [
                { model: Category, attributes: ['name'], required: false },
                { model: BookCopy, as: 'copies', attributes: ['no_induk'], required: false } 
            ];

            // 3. Setup Filter
            const whereCondition = {};
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

            if (subject) {
                includeOptions.push({
                    model: Subject,
                    as: 'Subjects',
                    where: { id: subject },
                    required: true 
                });
            }

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

            // 4. QUERY UTAMA: Gunakan findAndCountAll (PENTING untuk Pagination)
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

            // 5. Data Pendukung Filter (Dropdown)
            const categories = await Category.findAll({ order: [['name', 'ASC']], attributes: ['id', 'name'] });
            const subjects = await Subject.findAll({ order: [['name', 'ASC']], attributes: ['id', 'name'] });
            
            const yearsRaw = await Book.findAll({
                attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("publish_year")), "year"]],
                where: { publish_year: { [Op.ne]: null } },
                raw: true,
                order: [['publish_year', 'DESC']]
            });
            const years = yearsRaw.map(y => y.year).filter(y => y);

            const shelvesRaw = await Book.findAll({
                attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("shelf_location")), "location"]],
                where: { 
                    shelf_location: { 
                        [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }, { [Op.ne]: "-" }] 
                    } 
                },
                raw: true,
                order: [['shelf_location', 'ASC']]
            });
            const shelves = shelvesRaw.map(s => s.location);

            // 6. RENDER VIEW (PENTING: Kirim objek pagination)
            res.render("admin/shelf_management", {
                title: "Manajemen Lokasi Rak",
                books,
                categories,
                subjects,
                years,
                shelves,
                query: req.query,
                // --- INI YANG MENYEBABKAN ERROR JIKA HILANG ---
                pagination: {
                    currentPage,
                    totalPages: Math.ceil(count / limit),
                    totalItems: count,
                    limit
                }
                // ----------------------------------------------
            });

        } catch (err) {
            console.error("Shelf Management Error:", err);
            res.status(500).send("Gagal memuat halaman: " + err.message);
        }
    },
    bulkUpdateShelf: async (req, res) => {
        try {
            // isSelectAll: boolean, true jika user centang "Pilih Semua"
            // filterParams: object, berisi { q, category, subject, year, shelf }
            const { bookIds, newLocation, isSelectAll, filterParams } = req.body;

            if (!newLocation) {
                return res.status(400).json({ success: false, message: "Lokasi baru tidak valid." });
            }

            let affectedCount = 0;

            if (isSelectAll && filterParams) {
                // === MODE: UPDATE SELURUH HASIL FILTER ===
                // Kita harus menyusun ulang query WHERE yang sama persis dengan halaman pencarian
                
                const { q, category, subject, year, shelf } = filterParams;
                const whereCondition = {};
                const includeOptions = []; 

                // 1. Replikasi Filter Kategori & Tahun
                if (category) whereCondition.category_id = category;
                if (year) whereCondition.publish_year = year;

                // 2. Replikasi Filter Lokasi Rak
                if (shelf) {
                    if (shelf === 'unassigned') {
                        whereCondition.shelf_location = { 
                            [Op.or]: [{ [Op.eq]: null }, { [Op.eq]: "" }, { [Op.eq]: "-" }] 
                        };
                    } else {
                        whereCondition.shelf_location = shelf;
                    }
                }

                // 3. Replikasi Filter Subjek (Butuh Include)
                if (subject) {
                    includeOptions.push({
                        model: Subject, as: 'Subjects', where: { id: subject }, required: true
                    });
                }
                
                // 4. Replikasi Search Keyword (Butuh Include BookCopy jika cari no induk)
                // Kita include BookCopy hanya untuk filtering, attributes kosong agar ringan
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

                // EKSEKUSI UPDATE
                // Karena MySQL tidak support update dengan join yang kompleks secara langsung di Sequelize,
                // Cara teraman: Ambil semua ID dulu, lalu Update berdasarkan ID.
                
                // A. Ambil semua ID buku yang cocok filter
                const booksToUpdate = await Book.findAll({
                    where: whereCondition,
                    include: includeOptions,
                    attributes: ['id'],
                    subQuery: false, // Penting agar filter $copies.no_induk$ jalan
                    distinct: true
                });

                const allIds = booksToUpdate.map(b => b.id);

                if (allIds.length === 0) {
                    return res.status(400).json({ success: false, message: "Tidak ada data yang cocok untuk diupdate." });
                }

                // B. Update Massal
                const [updateCount] = await Book.update(
                    { shelf_location: newLocation },
                    { where: { id: { [Op.in]: allIds } } }
                );
                affectedCount = updateCount;

            } else {
                // === MODE: UPDATE MANUAL (CHECKBOX DIPILIH SATU-SATU) ===
                if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
                    return res.status(400).json({ success: false, message: "Tidak ada buku yang dipilih." });
                }

                const [updateCount] = await Book.update(
                    { shelf_location: newLocation },
                    { where: { id: { [Op.in]: bookIds } } }
                );
                affectedCount = updateCount;
            }

            return res.status(200).json({ 
                success: true, 
                message: `Berhasil memindahkan ${affectedCount} buku ke ${newLocation}.` 
            });

        } catch (err) {
            console.error("Bulk Update Shelf Error:", err);
            res.status(500).json({ success: false, message: "Terjadi kesalahan server: " + err.message });
        }
    }
};