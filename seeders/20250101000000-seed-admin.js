'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
    async up(queryInterface, Sequelize) {
        const passwordSuper = bcrypt.hashSync('admin123', 10);
        const passwordRuangan = bcrypt.hashSync('ruangan123', 10);

        const layoutReferensi = {
            cols: 40,
            rows: 25,
            items: [
                { c1: 6, c2: 14, id: "lib_desk", r1: 3, r2: 4, name: "Meja Pustakawan", role: null, type: "table" },
                { c1: 2, c2: 5, id: "visit_h_1", r1: 22, r2: 23, name: "Meja Pengunjung", role: null, type: "table" },
                { c1: 6, c2: 9, id: "visit_h_2", r1: 22, r2: 23, name: "Meja Pengunjung", role: null, type: "table" },
                { c1: 10, c2: 13, id: "visit_h_3", r1: 22, r2: 23, name: "Meja Pengunjung", role: null, type: "table" },
                { c1: 15, c2: 16, id: "guest_book", r1: 17, r2: 18, name: "Buku Tamu", role: null, type: "table" },
                { c1: 37, c2: 39, id: "corner_red", r1: 22, r2: 23, name: "Meja Pojok", role: null, type: "table" },
                { c1: 17, c2: 18, id: "rack_top_0", r1: 2, r2: 7, name: "A1", role: null, type: "rack" },
                { c1: 20, c2: 21, id: "rack_top_1", r1: 2, r2: 7, name: "B1", role: null, type: "rack" },
                { c1: 23, c2: 24, id: "rack_top_2", r1: 2, r2: 7, name: "C1", role: null, type: "rack" },
                { c1: 26, c2: 27, id: "rack_top_3", r1: 2, r2: 7, name: "D1", role: null, type: "rack" },
                { c1: 29, c2: 30, id: "rack_top_4", r1: 2, r2: 7, name: "E1", role: null, type: "rack" },
                { c1: 32, c2: 33, id: "rack_top_5", r1: 2, r2: 7, name: "F1", role: null, type: "rack" },
                { c1: 35, c2: 36, id: "rack_top_6", r1: 2, r2: 7, name: "G1", role: null, type: "rack" },
                { c1: 38, c2: 39, id: "rack_top_7", r1: 2, r2: 7, name: "H1", role: null, type: "rack" },
                { c1: 17, c2: 18, id: "rack_bot_0", r1: 17, r2: 22, name: "A2", role: null, type: "rack" },
                { c1: 20, c2: 21, id: "rack_bot_1", r1: 17, r2: 22, name: "B2", role: null, type: "rack" },
                { c1: 23, c2: 24, id: "rack_bot_2", r1: 17, r2: 22, name: "C2", role: null, type: "rack" },
                { c1: 26, c2: 27, id: "rack_bot_3", r1: 17, r2: 22, name: "D2", role: null, type: "rack" },
                { c1: 29, c2: 30, id: "rack_gap", r1: 20, r2: 22, name: "E2", role: null, type: "rack" },
                { c1: 32, c2: 33, id: "rack_bot_5", r1: 17, r2: 22, name: "F2", role: null, type: "rack" },
                { c1: 35, c2: 36, id: "rack_bot_6", r1: 17, r2: 22, name: "G2", role: null, type: "rack" },
                { c1: 39, c2: 40, id: "rack_right_combined", r1: 16, r2: 21, name: "H2", role: null, type: "rack" },
                { c1: 14, c2: 15, id: "door_1769657464764_f13a0e17228768", r1: 24, r2: 24, name: "Pintu masuk", role: null, type: "door" },
                { c1: 1, c2: 2, id: "table_1769822607168_70818d4d7fddf8", r1: 9, r2: 12, name: "Meja Pengunjung 1", role: "visitor", type: "table" },
                { c1: 1, c2: 2, id: "table_1769822612030_7dde19f2d2195", r1: 13, r2: 16, name: "Meja Pengunjung 2", role: "visitor", type: "table" },
                { c1: 1, c2: 2, id: "table_1769822615680_ecbfcb01a1b43", r1: 17, r2: 20, name: "Meja Pengunjung 3", role: "visitor", type: "table" },
                { c1: 2, c2: 3, id: "table_1769822797262_4a655047f8af08", r1: 3, r2: 6, name: "Meja Pustakawan 1", role: "librarian", type: "table" },
                { c1: 31, c2: 36, id: "table_1769822875477_de0a24dc92c3c8", r1: 10, r2: 14, name: "Meja Pengunjung 4", role: "visitor", type: "table" },
                { c1: 25, c2: 30, id: "table_1769822890443_ffde105bc16208", r1: 10, r2: 14, name: "Meja Pengunjung 5", role: "visitor", type: "table" },
                { c1: 17, c2: 23, id: "table_1769822902449_a7024ef63ca6d8", r1: 10, r2: 14, name: "Meja Pengunjung 6", role: "visitor", type: "table" }
            ],
            version: 1
        };

        // Layout Default untuk Puskel (Kosong) agar tidak error
        const layoutDefault = { cols: 20, rows: 20, items: [], version: 1 };

        // 0. Hapus data lama jika ada (agar seed bisa dijalankan ulang)
        await queryInterface.bulkDelete('ruangan', null, {});
        // Tambahkan 'admin_puskel' di sini
        await queryInterface.bulkDelete('users', {
            username: ['admin', 'admin_referensi', 'admin_tandon', 'admin_puskel']
        }, {});

        // 1. Masukkan data ke tabel 'users'
        await queryInterface.bulkInsert('users', [
            {
                id: 1,
                username: 'admin',
                password: passwordSuper,
                role: 'super_admin',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 2,
                username: 'admin_referensi',
                password: passwordRuangan,
                role: 'admin_ruangan',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 3,
                username: 'admin_tandon',
                password: passwordRuangan,
                role: 'admin_ruangan',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            // === TAMBAHAN UNTUK PUSKEL ===
            {
                id: 4,
                username: 'admin_puskel',
                password: passwordRuangan,
                role: 'admin_ruangan',
                createdAt: new Date(),
                updatedAt: new Date(),
            }
        ]);

        // 2. Hubungkan admin ke tabel 'ruangan'
        await queryInterface.bulkInsert('ruangan', [
            {
                id_ruangan: 1,
                nama_ruangan: 'Ruangan Referensi',
                id_admin_ruangan: 2, // Merujuk ke id admin_referensi
                layout_json: JSON.stringify(layoutReferensi),
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id_ruangan: 2,
                nama_ruangan: 'Ruangan Tandon',
                id_admin_ruangan: 3, // Merujuk ke id admin_tandon
                // Biarkan Tandon tanpa layout_json seperti format asli kamu
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            // === TAMBAHAN UNTUK PUSKEL ===
            {
                id_ruangan: 3,
                nama_ruangan: 'Ruangan Pustaka Keliling',
                id_admin_ruangan: 4, // Merujuk ke id admin_puskel
                layout_json: JSON.stringify(layoutDefault), // Layout kosong
                createdAt: new Date(),
                updatedAt: new Date(),
            }
        ]);
    },

    async down(queryInterface, Sequelize) {
        // Hapus data dari kedua tabel dalam urutan yang benar (child first)
        await queryInterface.bulkDelete('ruangan', null, {});
        await queryInterface.bulkDelete('users', {
            username: ['admin', 'admin_referensi', 'admin_tandon', 'admin_puskel']
        }, {});
    }
};