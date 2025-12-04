"use strict";

module.exports = {
async up(queryInterface, Sequelize) {

    // ===============================
    // 1. Categories
    // ===============================
    await queryInterface.bulkInsert("categories", [
        { id: 1, name: "Teknologi" },
        { id: 2, name: "Sains" },
        { id: 3, name: "Sejarah" },
        { id: 4, name: "Filsafat" },
        { id: 5, name: "Sastra" }
    ]);

    // ===============================
    // 2. Authors
    // ===============================
    await queryInterface.bulkInsert("authors", [
        { id: 1, name: "John Doe" },
        { id: 2, name: "Maria Smith" },
        { id: 3, name: "Akira Tanaka" },
        { id: 4, name: "Lisa Wong" },
        { id: 5, name: "James Brown" },
        { id: 6, name: "Siti Aminah" },
        { id: 7, name: "Andi Prasetyo" },
        { id: 8, name: "Rina Kusuma" },
        { id: 9, name: "David Lee" },
        { id: 10, name: "Fajar Hidayat" }
    ]);

    // ===============================
    // 3. Subjects
    // ===============================
    await queryInterface.bulkInsert("subjects", [
        { id: 1, name: "Pemrograman" },
        { id: 2, name: "Jaringan" },
        { id: 3, name: "Basis Data" },
        { id: 4, name: "Sejarah Dunia" },
        { id: 5, name: "Filsafat Modern" }
    ]);

    // ===============================
    // 4. Publishers
    // ===============================
    await queryInterface.bulkInsert("publishers", [
        { id: 1, name: "Gramedia" },
        { id: 2, name: "O'Reilly Media" },
        { id: 3, name: "Packt Publishing" },
        { id: 4, name: "Springer" },
        { id: 5, name: "Cambridge University Press" }
    ]);

    // ===============================
    // 5. Books (with Images)
    // ===============================
    const imageFiles = [
        "Feixiao.full.4279930.png",
        "Skadi.The.Corrupting.Heart.full.3322675.jpg",
        "Specter.the.Unchained.full.3862148.jpg"
    ];

    const books = [];
    for (let i = 1; i <= 20; i++) {

        // Assign image for 18 books (1–18)
        let image = null;
        if (i <= 18) {
            image = imageFiles[(i - 1) % 3];
        }

        books.push({
            id: i,
            title: `Buku Contoh ${i}`,
            original_title: `Original Title ${i}`,
            statement_of_responsibility: `Author ${i}`,
            series_title: `Series ${Math.ceil(i / 5)}`,
            edition: `${i}`,
            publish_year: `${2015 + (i % 9)}`,
            publish_place: `Kota ${i}`,
            physical_description: `${100 + i} halaman`,
            content_type: "text",
            media_type: "printed",
            carrier_type: "volume",
            isbn: `97860200${100 + i}`,
            call_number: `000.${i} ABC`,
            abstract: `Abstract buku contoh ${i}.`,
            notes: `Catatan buku ${i}`,
            language: "Indonesia",
            work_type: "Book",
            target_audience: "Mahasiswa",
            shelf_location: `Rak ${i}A`,
            stock_total: 10 + i,
            stock_available: 5 + i,
            category_id: (i % 5) + 1,

            // Added image
            image: image
        });
    }

    await queryInterface.bulkInsert("books", books);

    // ===============================
    // 6. BookAuthors (Pivot)
    // ===============================
    const bookAuthors = [];
    for (let i = 1; i <= 20; i++) {
        bookAuthors.push({
            book_id: i,
            author_id: ((i - 1) % 10) + 1,
            role: "Penulis Utama"
        });
        if (i % 4 === 0) {
            bookAuthors.push({
                book_id: i,
                author_id: ((i) % 10) + 1,
                role: "Kontributor"
            });
        }
    }
    await queryInterface.bulkInsert("bookauthors", bookAuthors);

    // ===============================
    // 7. BookSubjects (Pivot)
    // ===============================
    const bookSubjects = [];
    for (let i = 1; i <= 20; i++) {
        bookSubjects.push({ book_id: i, subject_id: ((i - 1) % 5) + 1 });
        if (i % 3 === 0) {
            bookSubjects.push({ book_id: i, subject_id: ((i) % 5) + 1 });
        }
    }
    await queryInterface.bulkInsert("booksubjects", bookSubjects);

    // ===============================
    // 8. BookPublishers (Pivot)
    // ===============================
    const bookPublishers = [];
    for (let i = 1; i <= 20; i++) {
        bookPublishers.push({ book_id: i, publisher_id: ((i - 1) % 5) + 1 });
    }
    await queryInterface.bulkInsert("bookpublishers", bookPublishers);
},

// ===============================
// DOWN
// ===============================
async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("bookpublishers", null, {});
    await queryInterface.bulkDelete("booksubjects", null, {});
    await queryInterface.bulkDelete("bookauthors", null, {});
    await queryInterface.bulkDelete("books", null, {});
    await queryInterface.bulkDelete("publishers", null, {});
    await queryInterface.bulkDelete("subjects", null, {});
    await queryInterface.bulkDelete("authors", null, {});
    await queryInterface.bulkDelete("categories", null, {});
}
};