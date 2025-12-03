const { Op } = require("sequelize");
const {
    Book,
    Author,
    Publisher,
    Category,
    Subject,
    BookAuthor,
    BookPublisher,
    BookSubject
} = require("../models");
const QRCode = require("qrcode");

module.exports = {
    async getDetailPage(req, res) {
        try {
            const bookId = req.params.id;

            // ================================
            // 1. Ambil Data Buku Lengkap
            // ================================
            const book = await Book.findOne({
                where: { id: bookId },
                include: [
                    { model: Author, through: { model: BookAuthor, attributes: [] }, required: false },
                    { model: Publisher, through: { model: BookPublisher, attributes: [] }, required: false },
                    { model: Subject, through: { model: BookSubject, attributes: [] }, required: false },
                    { model: Category, required: false }
                ]
            });

            if (!book) {
                return res.status(404).render("404", { message: "Buku tidak ditemukan" });
            }

            // Flatten data untuk EJS
            const bookData = {
                id: book.id,
                title: book.title || "-",
                original_title: book.original_title || "-",
                edition: book.edition || "-",
                series_title: book.series_title || "-",
                publish_place: book.publish_place || "-",
                publish_year: book.publish_year || "-",
                physical_description: book.physical_description || "-",
                isbn: book.isbn || "-",
                abstract: book.abstract || "-",
                notes: book.notes || "-",
                language: book.language || "-",
                content_type: book.content_type || "-",
                media_type: book.media_type || "-",
                carrier_type: book.carrier_type || "-",
                work_type: book.work_type || "-",
                target_audience: book.target_audience || "-",
                call_number: book.call_number || "-",
                shelf_location: book.shelf_location || "-",
                publisher: book.Publishers?.[0]?.name || "-",
                author: book.Authors?.[0]?.name || "-",
                additional_author: book.Authors?.[1]?.name || null,
                subject: book.Subjects?.[0]?.name || "-",
                category: book.Category?.name || "-",
                stock_total: book.stock_total || 0,         
                stock_available: book.stock_available || 0
            };

            // ================================
            // 2. Generate QR Code
            // ================================
            let qrImage = null;
            try {
                const qrText = `Judul: ${bookData.title}\nNo. Panggil: ${bookData.call_number}`;
                qrImage = await QRCode.toDataURL(qrText);
            } catch (err) {
                console.warn("QR Code gagal dibuat:", err);
            }

            // ================================
            // 3. Ambil Karya Terkait
            // ================================
            const relatedBooks = await Book.findAll({
                where: {
                    id: { [Op.ne]: book.id },
                    [Op.or]: [
                        { title: { [Op.like]: `%${book.title.split(" ")[0]}%` } },
                        { shelf_location: book.shelf_location },
                        { call_number: { [Op.like]: `${book.call_number.substring(0, 3)}%` } }
                    ]
                },
                include: [
                    { model: Author, through: { attributes: [] }, required: false }
                ],
                limit: 10
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
                relatedBooks: relatedFormatted
            });

        } catch (err) {
            console.error("DETAIL ERROR:", err);
            return res.status(500).render("500", { message: "Terjadi kesalahan di server." });
        }
    }
};