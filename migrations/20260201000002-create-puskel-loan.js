'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('puskel_loans', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      book_copy_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'BookCopies', // <--- PERBAIKAN: Harus 'BookCopies' (Sesuai nama tabel asli)
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      institution_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'institutions', // Ini sudah benar (sesuai tabel yang baru kita buat)
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      loan_date: {
        type: Sequelize.DATEONLY
      },
      due_date: {
        type: Sequelize.DATEONLY
      },
      return_date: {
        type: Sequelize.DATEONLY
      },
      status: {
        type: Sequelize.ENUM('active', 'returned'),
        defaultValue: 'active'
      },
      notes: {
        type: Sequelize.TEXT
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
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('puskel_loans');
  }
};