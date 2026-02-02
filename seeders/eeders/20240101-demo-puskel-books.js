'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    
    // 1. DATA PENGARANG
    await queryInterface.bulkInsert('Authors', [
      { id: 101, name: 'Tere Liye', createdAt: new Date(), updatedAt: new Date() },
      { id: 102, name: 'Andrea Hirata', createdAt: new Date(), updatedAt: new Date() },
      { id: 103, name: 'J.K. Rowling', createdAt: new Date(), updatedAt: new Date() },
      { id: 104, name: 'Pramoedya Ananta Toer', createdAt: new Date(), updatedAt: new Date() },
      { id: 105, name: 'Mark Manson', createdAt: new Date(), updatedAt: new Date() }
    ], { ignoreDuplicates: true }); // Agar tidak error kalau dijalankan 2x

    // 2. DATA KATEGORI
    await queryInterface.bulkInsert('Categories', [
      { id: 101, name: 'Novel Fiksi', createdAt: new Date(), updatedAt: new Date() },
      { id: 102, name: 'Self Improvement', createdAt: new Date(), updatedAt: new Date() },
      { id: 103, name: 'Sastra Indonesia', createdAt: new Date(), updatedAt: new Date() }
    ], { ignoreDuplicates: true });

    // 3. DATA BUKU (Master)
    await queryInterface.bulkInsert('Books', [
      {
        id: 101, title: 'Bumi', author_id: 101, category_id: 101,
        isbn: '978-602-03-3295-6', publish_year: '2014', call_number: '813 LIY b',
        createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: 102, title: 'Laskar Pelangi', author_id: 102, category_id: 103,
        isbn: '978-979-3062-79-2', publish_year: '2005', call_number: '813 HIR l',
        createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: 103, title: 'Harry Potter and the Sorcerers Stone', author_id: 103, category_id: 101,
        isbn: '978-0-7475-3269-9', publish_year: '1997', call_number: '823 ROW h',
        createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: 104, title: 'Bumi Manusia', author_id: 104, category_id: 103,
        isbn: '978-979-97312-3-4', publish_year: '1980', call_number: '899.221 TOE b',
        createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: 105, title: 'Sebuah Seni untuk Bersikap Bodo Amat', author_id: 105, category_id: 102,
        isbn: '978-602-03-3295-X', publish_year: '2016', call_number: '158 MAN s',
        createdAt: new Date(), updatedAt: new Date()
      }
    ], { ignoreDuplicates: true });

    // 4. DATA STOK BUKU (Beberapa masuk ke Puskel, beberapa di gudang)
    await queryInterface.bulkInsert('BookCopies', [
      // Buku: Bumi
      { book_id: 101, no_induk: 'B001', status: 'tersedia_puskel', createdAt: new Date(), updatedAt: new Date() },
      { book_id: 101, no_induk: 'B002', status: 'tersedia_puskel', createdAt: new Date(), updatedAt: new Date() },
      
      // Buku: Laskar Pelangi
      { book_id: 102, no_induk: 'L001', status: 'tersedia_puskel', createdAt: new Date(), updatedAt: new Date() },
      
      // Buku: Harry Potter
      { book_id: 103, no_induk: 'HP01', status: 'tersedia', createdAt: new Date(), updatedAt: new Date() }, // Masih di gudang
      
      // Buku: Bumi Manusia (Banyak stok di puskel)
      { book_id: 104, no_induk: 'BM01', status: 'tersedia_puskel', createdAt: new Date(), updatedAt: new Date() },
      { book_id: 104, no_induk: 'BM02', status: 'tersedia_puskel', createdAt: new Date(), updatedAt: new Date() },
      { book_id: 104, no_induk: 'BM03', status: 'tersedia_puskel', createdAt: new Date(), updatedAt: new Date() },

      // Buku: Seni Bodo Amat
      { book_id: 105, no_induk: 'SB01', status: 'tersedia_puskel', createdAt: new Date(), updatedAt: new Date() },
    ]);
  },

  async down (queryInterface, Sequelize) {
    // Hapus data jika rollback (hati-hati)
    await queryInterface.bulkDelete('BookCopies', null, {});
    await queryInterface.bulkDelete('Books', { id: [101,102,103,104,105] }, {});
    await queryInterface.bulkDelete('Categories', { id: [101,102,103] }, {});
    await queryInterface.bulkDelete('Authors', { id: [101,102,103,104,105] }, {});
  }
};