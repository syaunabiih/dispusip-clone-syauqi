'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Institution extends Model {
    static associate(models) {
      // Lembaga bisa punya banyak transaksi peminjaman
      Institution.hasMany(models.PuskelLoan, { foreignKey: 'institution_id' });
    }
  }
  Institution.init({
    name: DataTypes.STRING,        // Nama Lembaga (cth: SDN 01 Padang)
    address: DataTypes.TEXT,       // Alamat
    contact_person: DataTypes.STRING, // Nama Penanggung Jawab
    phone: DataTypes.STRING,       // No HP
    email: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Institution',
    tableName: 'institutions',
  });
  return Institution;
};