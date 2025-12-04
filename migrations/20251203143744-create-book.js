'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Books', {
      id: { 
        type: Sequelize.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
      },
      title: { type: Sequelize.STRING, allowNull: false },
      original_title: Sequelize.STRING,
      statement_of_responsibility: Sequelize.STRING,
      series_title: Sequelize.STRING,
      edition: Sequelize.STRING,
      publish_year: Sequelize.STRING(4),
      publish_place: Sequelize.STRING,
      physical_description: Sequelize.STRING,
      content_type: Sequelize.STRING,
      media_type: Sequelize.STRING,
      carrier_type: Sequelize.STRING,
      isbn: Sequelize.STRING(20),
      call_number: Sequelize.STRING(50),
      abstract: Sequelize.TEXT,
      notes: Sequelize.TEXT,
      language: Sequelize.STRING,
      work_type: Sequelize.STRING,
      target_audience: Sequelize.STRING,
      shelf_location: Sequelize.STRING,
      stock_total: Sequelize.INTEGER,
      stock_available: Sequelize.INTEGER,
      category_id: { type: Sequelize.INTEGER, allowNull: false },
      // Menambahkan kolom image_url
      image: { type: Sequelize.STRING, allowNull: true },
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