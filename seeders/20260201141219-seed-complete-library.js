'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    
    // STEP 0 SUDAH DITANGANI OLEH SEED-ADMIN (YANG SUDAH DI-RENAME)

    // 1. ISI KATEGORI
    await queryInterface.bulkInsert('Categories', [
      { id: 1, name: 'Fiksi', createdAt: new Date(), updatedAt: new Date() },
      { id: 2, name: 'Sains & Teknologi', createdAt: new Date(), updatedAt: new Date() },
      { id: 3, name: 'Sejarah', createdAt: new Date(), updatedAt: new Date() }
    ]);

    // 2. ISI PENULIS
    await queryInterface.bulkInsert('Authors', [
      { id: 1, name: 'Andrea Hirata', createdAt: new Date(), updatedAt: new Date() },
      { id: 2, name: 'J.K. Rowling', createdAt: new Date(), updatedAt: new Date() },
      { id: 3, name: 'Prof. Rhenald Kasali', createdAt: new Date(), updatedAt: new Date() }
    ]);

    // 3. ISI PENERBIT
    await queryInterface.bulkInsert('Publishers', [
      { id: 1, name: 'Bentang Pustaka', createdAt: new Date(), updatedAt: new Date() },
      { id: 2, name: 'Gramedia Pustaka Utama', createdAt: new Date(), updatedAt: new Date() }
    ]);

    // 4. ISI BUKU (Data Bibliografi)
    await queryInterface.bulkInsert('Books', [
      {
        id: 1,
        title: 'Laskar Pelangi',
        id_ruangan: 1, 
        category_id: 1, 
        isbn: '978-979-3062-79-2',
        publish_year: '2005',
        edition: 'Cetakan Pertama',
        language: 'Indonesia',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        title: 'Harry Potter and the Philosophers Stone',
        id_ruangan: 1, 
        category_id: 1, 
        isbn: '978-0-7475-3269-9',
        publish_year: '1997',
        edition: 'First Edition',
        language: 'English',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        title: 'Disruption',
        id_ruangan: 1, 
        category_id: 2, 
        isbn: '978-979-22-9884-2',
        publish_year: '2017',
        edition: 'Edisi Revisi',
        language: 'Indonesia',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    // 5. ISI BOOK COPIES (Fisik Buku - REVISI: HAPUS CONDITION & SOURCE)
    await queryInterface.bulkInsert('BookCopies', [
      // Stok Laskar Pelangi
      { id: 1, book_id: 1, no_induk: 'B001', status: 'tersedia', createdAt: new Date(), updatedAt: new Date() },
      { id: 2, book_id: 1, no_induk: 'B002', status: 'tersedia', createdAt: new Date(), updatedAt: new Date() },
      
      // Stok Harry Potter
      { id: 3, book_id: 2, no_induk: 'HP001', status: 'tersedia', createdAt: new Date(), updatedAt: new Date() },
      
      // Stok Disruption
      { id: 4, book_id: 3, no_induk: 'TECH01', status: 'tersedia', createdAt: new Date(), updatedAt: new Date() },
      { id: 5, book_id: 3, no_induk: 'TECH02', status: 'tersedia', createdAt: new Date(), updatedAt: new Date() }
    ]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('BookCopies', null, {});
    await queryInterface.bulkDelete('Books', null, {});
    await queryInterface.bulkDelete('Publishers', null, {});
    await queryInterface.bulkDelete('Authors', null, {});
    await queryInterface.bulkDelete('Categories', null, {});
  }
};