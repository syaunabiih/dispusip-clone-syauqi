'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('BookPublishers', {
      book_id: { 
        type: Sequelize.INTEGER, 
        allowNull: false,
        references: {
          model: 'Books',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      publisher_id: { 
        type: Sequelize.INTEGER, 
        allowNull: false,
        references: {
          model: 'Publishers',
          key: 'id'
        },
        onDelete: 'CASCADE'
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
    await queryInterface.dropTable('BookPublishers');
  }
};