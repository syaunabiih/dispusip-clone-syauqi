'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('BookAuthors', {
      book_id: { 
        type: Sequelize.INTEGER, 
        allowNull: false,
        references: {
          model: 'Books',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      author_id: { 
        type: Sequelize.INTEGER, 
        allowNull: false,
        references: {
          model: 'Authors',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      role: Sequelize.STRING,
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
    await queryInterface.dropTable('BookAuthors');
  }
};