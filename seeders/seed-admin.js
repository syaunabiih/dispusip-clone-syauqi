'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
    async up(queryInterface, Sequelize) {
        const passwordSuper = bcrypt.hashSync('admin123', 10);
        const passwordRuangan = bcrypt.hashSync('ruangan123', 10);

        await queryInterface.bulkInsert('users', [
            {
                username: 'admin',
                password: passwordSuper,
                role: 'super_admin',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                username: 'admin_ruangan',
                password: passwordRuangan,
                role: 'admin_ruangan',   // 🔑 role baru
                createdAt: new Date(),
                updatedAt: new Date(),
            }
        ]);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('users', {
            username: ['admin', 'admin_ruangan']
        }, {});
    }
};