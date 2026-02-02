'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PuskelLoan extends Model {
    static associate(models) {
      // Hubungkan ke Buku & Lembaga
      PuskelLoan.belongsTo(models.BookCopy, { foreignKey: 'book_copy_id', as: 'bookCopy' });
      PuskelLoan.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
    }
  }
  PuskelLoan.init({
    book_copy_id: DataTypes.INTEGER,
    institution_id: DataTypes.INTEGER,
    loan_date: DataTypes.DATEONLY,   // Tanggal Pinjam
    due_date: DataTypes.DATEONLY,    // Rencana Kembali
    return_date: DataTypes.DATEONLY, // Tanggal Asli Kembali
    status: {
      type: DataTypes.ENUM('active', 'returned'), // active = sedang dipinjam
      defaultValue: 'active'
    },
    notes: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'PuskelLoan',
    tableName: 'puskel_loans',
  });
  return PuskelLoan;
};