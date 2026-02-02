'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('institutions', [
      {
        name: 'SDN 01 Padang Barat',
        address: 'Jl. Ahmad Yani No. 1, Padang',
        contact_person: 'Ibu Ratna (Kepsek)',
        phone: '0812-3456-7890',
        email: 'sdn01pb@diknas.padang.go.id',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'SMP Negeri 5 Padang',
        address: 'Jl. Sudirman No. 45, Padang',
        contact_person: 'Pak Budi (Pustakawan)',
        phone: '0813-9876-5432',
        email: 'perpustakaan@smpn5padang.sch.id',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Kantor Camat Koto Tangah',
        address: 'Jl. Adinegoro, Lubuk Buaya',
        contact_person: 'Ibu Camat',
        phone: '0751-443322',
        email: 'kec.kototangah@padang.go.id',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'TK Aisyiyah Bustanul Athfal 1',
        address: 'Jl. M. Yamin, Padang',
        contact_person: 'Ibu Nurul',
        phone: '0852-1111-2222',
        email: 'tk.aisyiyah1@gmail.com',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Panti Asuhan Aisyiyah',
        address: 'Jl. H. Agus Salim, Padang',
        contact_person: 'Pengurus Panti',
        phone: '0811-2233-4455',
        email: 'pantiaisyiyah@yahoo.com',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('institutions', null, {});
  }
};