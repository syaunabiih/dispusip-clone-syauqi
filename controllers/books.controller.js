const { Book, Category, Author, Publisher, Ruangan, Subject, BookCopy, BookAuthor , Sequelize } = require("../models");
const { Op } = Sequelize;

const fs = require('fs');
const path = require('path');

const adminBookController = require("./admin.controller");

module.exports = {
    showAddPage: async (req, res) => {
        try {
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
                layoutJson: ruanganAdmin?.layout_json ?? null,
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

            // Validasi Input Wajib (Ditambahkan pengecekan no_barcode jika ingin diwajibkan)
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

            const cleanShelfLocation = adminBookController.standardizeShelfLocation(data.shelf_location);

            // 3. CREATE BUKU
            const book = await Book.create({
                title: adminBookController.toTitleCase(data.title),
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
                id_ruangan: idRuangan,
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

            // 5. Logika Nomor Induk & Barcode (PERBAIKAN LENGKAP)
            if (data.no_induk) {
                const noIndukArray = data.no_induk.split(/[\n,]+/).map(item => item.trim()).filter(item => item !== "");
                const noBarcodeArray = data.no_barcode 
                    ? data.no_barcode.split(/[\n,]+/).map(item => item.trim()).filter(item => item !== "") 
                    : [];

                if (noIndukArray.length > 0) {
                    const existingCopies = await BookCopy.findAll({
                        where: {
                            [Op.or]: [
                                { no_induk: { [Op.in]: noIndukArray } },
                                { no_barcode: { [Op.in]: noBarcodeArray.filter(b => b !== "") } }
                            ]
                        }
                    });

                    if (existingCopies.length > 0) {
                        // Filter mana saja yang benar-benar bentrok
                        const dupInduk = existingCopies.filter(c => noIndukArray.includes(c.no_induk)).map(c => c.no_induk);
                        const dupBarcode = existingCopies.filter(c => c.no_barcode && noBarcodeArray.includes(c.no_barcode)).map(c => c.no_barcode);
                        
                        // Susun pesan secara dinamis
                        let errorMessages = [];
                        if (dupInduk.length > 0) errorMessages.push(`No. Induk: [${dupInduk.join(', ')}]`);
                        if (dupBarcode.length > 0) errorMessages.push(`No. Barcode: [${dupBarcode.join(', ')}]`);

                        await book.destroy(); // Rollback
                        
                        return res.status(400).json({ 
                            success: false, 
                            message: `Duplikat terdeteksi! ${errorMessages.join(' | ')}` 
                        });
                    }

                    // Susun data untuk bulk insert
                    const copyData = noIndukArray.map((nomor, index) => ({
                        book_id: book.id,
                        no_induk: nomor,
                        no_barcode: noBarcodeArray[index] || null,
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
                message: `Buku berhasil ditambahkan ke ${ruanganAdmin ? ruanganAdmin.nama_ruangan : 'ruangan'}`
            });

        } catch (err) {
            console.error("ADD BOOK ERROR:", err);
            res.status(500).json({ success: false, message: "Terjadi kesalahan sistem: " + err.message });
        }
    },

    showEditPage: async (req, res) => {
        try {
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
                namaRuangan: ruanganAdmin ? ruanganAdmin.nama_ruangan : null, 
                layoutJson: ruanganAdmin?.layout_json ?? null,
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
            // 1. Identifikasi Ruangan Admin yang Login
            const adminId = req.user.id;
            const ruanganAdmin = await Ruangan.findOne({ 
                where: { id_admin_ruangan: adminId } 
            });

            // 2. Ambil data buku yang akan diupdate
            const book = await Book.findByPk(req.params.id);
            if (!book) return res.status(404).json({ success: false, message: "Buku tidak ditemukan" });

            // 3. PROTEKSI KEAMANAN
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
            if (!data.title || !data.category_id || !data.no_induk || !data.call_number || !data.publishers || !data.authors_penulis) {
                return res.status(400).json({ success: false, message: "Gagal: Judul, Kategori, Nomor Induk, Nomor Panggil, Penerbit, dan Penulis wajib diisi!" });
            }

            // State pencarian asal untuk redirect
            const queryParams = new URLSearchParams({
                q: data.origin_q || "",
                searchBy: data.origin_searchBy || "title",
                matchType: data.origin_matchType || "contains",
                category: data.origin_category || "",
                subject: data.origin_subject || "",
                year: data.origin_year || "",
                page: data.origin_page || "1"
            });

            // 4. Update Kategori
            let categoryId = data.category_id;
            if (isNaN(categoryId)) {
                const [newCategory] = await Category.findOrCreate({ where: { name: String(categoryId).trim() } });
                categoryId = newCategory.id;
            }

            // 5. Handle Gambar
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

            const cleanShelfLocation = adminBookController.standardizeShelfLocation(data.shelf_location);

            // 6. Update Data Utama Buku
            const updateData = {
                title: adminBookController.toTitleCase(data.title),
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

            // 8. UPDATE NOMOR INDUK & BARCODE (SINKRONISASI)
            if (data.no_induk) {
                const noIndukArray = data.no_induk.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== "");
                const noBarcodeArray = data.no_barcode 
                    ? data.no_barcode.split(/[\n,]+/).map(item => item.trim()).filter(item => item !== "") 
                    : [];

                // Ambil data eksemplar lama untuk perbandingan
                const currentCopies = await BookCopy.findAll({ where: { book_id: book.id } });
                const currentNoInduks = currentCopies.map(c => c.no_induk).sort();
                const currentBarcodes = currentCopies.map(c => c.no_barcode || "").sort();
                
                const sortedNewInduks = [...noIndukArray].sort();
                const sortedNewBarcodes = [...noBarcodeArray].sort();

                // Hanya proses jika ada perubahan data induk atau barcode
                if (JSON.stringify(currentNoInduks) !== JSON.stringify(sortedNewInduks) || 
                    JSON.stringify(currentBarcodes) !== JSON.stringify(sortedNewBarcodes)) {
                    
                    // Cek duplikat di database (kecuali milik buku ini sendiri)
                    const existingCopies = await BookCopy.findAll({
                        where: {
                            book_id: { [Op.ne]: book.id },
                            [Op.or]: [
                                { no_induk: { [Op.in]: noIndukArray } },
                                { no_barcode: { [Op.in]: noBarcodeArray.filter(b => b !== "") } }
                            ]
                        }
                    });

                    if (existingCopies.length > 0) {
                        const dupInduk = existingCopies.filter(c => noIndukArray.includes(c.no_induk)).map(c => c.no_induk);
                        const dupBarcode = existingCopies.filter(c => c.no_barcode && noBarcodeArray.includes(c.no_barcode)).map(c => c.no_barcode);
                        
                        let errorMessages = [];
                        if (dupInduk.length > 0) errorMessages.push(`No. Induk: [${dupInduk.join(', ')}]`);
                        if (dupBarcode.length > 0) errorMessages.push(`No. Barcode: [${dupBarcode.join(', ')}]`);

                        return res.status(400).json({ 
                            success: false, 
                            message: `Gagal Update! Duplikat ditemukan di buku lain. ${errorMessages.join(' | ')}` 
                        });
                    }

                    // Refresh data eksemplar: Hapus yang lama, buat yang baru
                    await BookCopy.destroy({ where: { book_id: book.id } });
                    
                    const copyData = noIndukArray.map((nomor, index) => ({
                        book_id: book.id,
                        no_induk: nomor,
                        no_barcode: noBarcodeArray[index] || null,
                        status: 'tersedia'
                    }));

                    await BookCopy.bulkCreate(copyData);
                    
                    // Update total stok berdasarkan jumlah baris di tabel
                    await book.update({ stock_total: noIndukArray.length });
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
                message: `Buku "${book.title}" berhasil diperbarui.`
            });

        } catch (err) {
            console.error("UPDATE BOOK ERROR:", err);
            res.status(500).json({ success: false, message: "Gagal memperbarui buku: " + err.message });
        }
    }
};