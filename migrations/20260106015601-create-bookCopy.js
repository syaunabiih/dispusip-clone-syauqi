'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('BookCopies', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      book_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Books', // Harus sama dengan nama tabel Books
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      no_induk: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      no_barcode: { 
        type: Sequelize.STRING,
        allowNull: true, 
        unique: true
      },
      status: {
        // Update baris ini: Tambahkan 'tersedia_puskel' dan 'dipinjam_puskel'
        type: Sequelize.ENUM('tersedia', 'dipinjam', 'rusak', 'hilang', 'tersedia_puskel', 'dipinjam_puskel'),
        allowNull: false,
        defaultValue: 'tersedia'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('BookCopies');
  }
};