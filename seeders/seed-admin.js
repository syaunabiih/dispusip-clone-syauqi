'use strict';

const { User } = require('../models');
const bcrypt = require('bcryptjs');

module.exports = {
async up(queryInterface, Sequelize) {
    const passwordHash = bcrypt.hashSync('admin123', 10); // password default admin

    await queryInterface.bulkInsert('Users', [
    {
        username: 'admin',
        password: passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    ]);
},

async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Users', { username: 'admin' }, {});
}
};