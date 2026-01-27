'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Ruangan extends Model {
        static associate(models) {
            Ruangan.belongsTo(models.User, {
                foreignKey: 'id_admin_ruangan',
                as: 'admin'
            });
        }
    }

    Ruangan.init(
        {
            id_ruangan: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            id_admin_ruangan: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            nama_ruangan: {
                type: DataTypes.STRING,
                allowNull: false
            }
        },
        {
            sequelize,
            modelName: 'Ruangan',
            tableName: 'ruangan'
        }
    );

    return Ruangan;
};