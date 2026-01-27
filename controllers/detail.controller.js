const { Op } = require("sequelize");
const {
    Book,
    Author,
    Publisher,
    Category,
    Subject,
    BookAuthor,
    BookPublisher,
    BookSubject,
    BookCopy,
    BookView
} = require("../models");
const QRCode = require("qrcode");

module.exports = {
    async getDetailPage(req, res) {
        try {
            const bookId = req.params.id;
            await BookView.create({ book_id: bookId }).catch(err => {
                console.error("Gagal mencatat statistik:", err);
            });
            // ================================
            // 1. Ambil Data Buku Lengkap
            // ================================
            const book = await Book.findOne({
                where: { id: bookId },
                include: [
                    { model: Author, through: { model: BookAuthor, attributes: [] }, required: false },
                    { model: Publisher, through: { model: BookPublisher, attributes: [] }, required: false },
                    { model: Subject, through: { model: BookSubject, attributes: [] }, required: false },
                    { model: Category, required: false },
                    {
                        model: BookCopy,
                        as: 'copies',
                        attributes: ['id', 'no_induk', 'status'],
                        required: false
                    }
                ]
            });

            if (!book) {
                return res.status(404).render("404", { message: "Buku tidak ditemukan" });
            }

            const totalBooks = book.copies ? book.copies.length : 0;

            // Flatten data untuk EJS
            const bookData = {
                id: book.id,
                title: book.title || "-",
                edition: book.edition || "-",
                publish_place: book.publish_place || "-",
                publish_year: book.publish_year || "-",
                physical_description: book.physical_description || "-",
                isbn: book.isbn || "-",
                abstract: book.abstract || "-",
                notes: book.notes || "-",
                language: book.language || "-",
                call_number: book.call_number || "-",
                shelf_location: book.shelf_location || "-",

                publisher: book.Publishers?.[0]?.name || "-",
                author: book.Authors?.[0]?.name || "-",
                // Untuk penulis tambahan jika ada lebih dari 1
                additional_author: book.Authors?.length > 1 ? book.Authors.slice(1).map(a => a.name).join(', ') : null,
                
                subject: book.Subjects?.map(s => s.name).join(', ') || '-',
                category: book.Category?.name || "-",
                category_id: book.category_id, // Simpan ID kategori untuk logic related

                total_books: totalBooks,
                stock_total: book.stock_total,
                stock_available: book.stock_available,
                image: book.image || null
            };

            // Siapkan data eksemplar
            const copyRows = (book.copies || []).map(copy => ({
                no_induk: copy.no_induk || '-',
                title: book.title || '-',
                location: book.shelf_location || '-',
                status: copy.status || 'tersedia'
            }));

            // ================================
            // 2. Generate QR Code
            // ================================
            let qrImage = null;
            try {
                const host = req.get("x-forwarded-host") || req.get("host");
                const protocol = req.get("x-forwarded-proto") || req.protocol;
                const baseUrl = `${protocol}://${host}`;
                const qrUrl = `${baseUrl}/book/${bookId}`;
                qrImage = await QRCode.toDataURL(qrUrl);
            } catch (err) {
                console.warn("QR Code gagal dibuat:", err);
            }

            // ================================
            // 3. Ambil Karya Terkait (LOGIC BARU)
            // ================================
            
            // A. Ambil ID Subjek dari buku ini
            const subjectIds = book.Subjects ? book.Subjects.map(s => s.id) : [];
            let relatedBookIdsFromSubject = [];

            // B. Cari ID buku lain yang punya subjek sama (jika ada subjectIds)
            if (subjectIds.length > 0) {
                const relatedSubjects = await BookSubject.findAll({
                    where: {
                        subject_id: { [Op.in]: subjectIds },
                        book_id: { [Op.ne]: book.id } // Jangan ambil buku ini sendiri
                    },
                    attributes: ['book_id'],
                    limit: 20 // Batasi pencarian awal
                });
                relatedBookIdsFromSubject = relatedSubjects.map(rs => rs.book_id);
            }

            // C. Query Utama Karya Terkait (Kategori ATAU Subjek)
            const relatedBooks = await Book.findAll({
                where: {
                    id: { [Op.ne]: book.id }, // Pastikan bukan buku yang sedang dibuka
                    [Op.or]: [
                        // 1. Kesamaan Kategori
                        { category_id: book.category_id },
                        // 2. Kesamaan Subjek (Berdasarkan ID buku yang ditemukan tadi)
                        relatedBookIdsFromSubject.length > 0 ? { id: { [Op.in]: relatedBookIdsFromSubject } } : undefined
                    ].filter(Boolean) // Hapus undefined jika tidak ada subjek
                },
                include: [
                    { model: Author, as: 'Authors', required: false }
                ],
                limit: 10,
                order: [['updatedAt', 'DESC']] // Urutkan berdasarkan updatedAt (buku yang terakhir di-update muncul di atas)
            });

            const relatedFormatted = relatedBooks.map(bk => ({
                id: bk.id,
                title: bk.title || "-",
                author: bk.Authors?.[0]?.name || "-"
            }));

            // ================================
            // 4. Render Halaman
            // ================================
            return res.render("user/detail", {
                title: bookData.title,
                book: bookData,
                qrImage,
                relatedBooks: relatedFormatted,
                copies: copyRows,
                query: req.query
            });

        } catch (err) {
            console.error("DETAIL ERROR:", err);
            return res.status(500).render("500", { message: "Terjadi kesalahan di server." });
        }
    }
};