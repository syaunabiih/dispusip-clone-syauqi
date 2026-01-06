'use strict';

/**
 * Menambahkan default value pada kolom createdAt/updatedAt di tabel relasi
 * agar insert tanpa field tersebut tidak gagal.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Normalisasi nilai zero-date jika ada
    await queryInterface.sequelize.query(`
      UPDATE BookAuthors 
      SET createdAt = NOW() 
      WHERE createdAt IS NULL OR createdAt = '0000-00-00 00:00:00';
    `);
    await queryInterface.sequelize.query(`
      UPDATE BookAuthors 
      SET updatedAt = NOW() 
      WHERE updatedAt IS NULL OR updatedAt = '0000-00-00 00:00:00';
    `);

    await queryInterface.sequelize.query(`
      UPDATE BookPublishers 
      SET createdAt = NOW() 
      WHERE createdAt IS NULL OR createdAt = '0000-00-00 00:00:00';
    `);
    await queryInterface.sequelize.query(`
      UPDATE BookPublishers 
      SET updatedAt = NOW() 
      WHERE updatedAt IS NULL OR updatedAt = '0000-00-00 00:00:00';
    `);

    await queryInterface.sequelize.query(`
      UPDATE BookSubjects 
      SET createdAt = NOW() 
      WHERE createdAt IS NULL OR createdAt = '0000-00-00 00:00:00';
    `);
    await queryInterface.sequelize.query(`
      UPDATE BookSubjects 
      SET updatedAt = NOW() 
      WHERE updatedAt IS NULL OR updatedAt = '0000-00-00 00:00:00';
    `);

    // Tambahkan default CURRENT_TIMESTAMP
    await queryInterface.changeColumn('BookAuthors', 'createdAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });
    await queryInterface.changeColumn('BookAuthors', 'updatedAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    });

    await queryInterface.changeColumn('BookPublishers', 'createdAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });
    await queryInterface.changeColumn('BookPublishers', 'updatedAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    });

    await queryInterface.changeColumn('BookSubjects', 'createdAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });
    await queryInterface.changeColumn('BookSubjects', 'updatedAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    });
  },

  async down(queryInterface, Sequelize) {
    // Kembalikan ke kolom tanpa default (membiarkan null)
    await queryInterface.changeColumn('BookAuthors', 'createdAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });
    await queryInterface.changeColumn('BookAuthors', 'updatedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.changeColumn('BookPublishers', 'createdAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });
    await queryInterface.changeColumn('BookPublishers', 'updatedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.changeColumn('BookSubjects', 'createdAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });
    await queryInterface.changeColumn('BookSubjects', 'updatedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });
  }
};

