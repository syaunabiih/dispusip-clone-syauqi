'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Books', {
      id: { 
        type: Sequelize.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
      },

      // 🔑 relasi ke ruangan
      id_ruangan: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ruangan',
          key: 'id_ruangan'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },

      title: { 
        type: Sequelize.STRING(500), 
        allowNull: false 
      },

      edition: Sequelize.STRING,
      publish_year: Sequelize.STRING(20),
      publish_place: Sequelize.STRING,
      physical_description: Sequelize.STRING,
      isbn: Sequelize.STRING(50),
      call_number: Sequelize.STRING(50),
      abstract: Sequelize.TEXT,
      notes: Sequelize.TEXT,
      language: Sequelize.STRING,
      shelf_location: Sequelize.STRING,
      category_id: { 
        type: Sequelize.INTEGER, 
        allowNull: false 
      },

      image: { 
        type: Sequelize.STRING, 
        allowNull: true 
      },

      createdAt: { 
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },

      updatedAt: { 
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Books');
  }
};