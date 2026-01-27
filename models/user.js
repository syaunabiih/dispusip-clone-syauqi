'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class User extends Model {
        static associate(models) {
            // 1 admin_ruangan punya 1 ruangan
            User.hasOne(models.Ruangan, {
                foreignKey: 'id_admin_ruangan',
                as: 'ruangan'
            });
        }
    }

    User.init(
        {
            username: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            password: {
                type: DataTypes.STRING,
                allowNull: false
            },
            role: {
                type: DataTypes.ENUM('super_admin', 'admin_ruangan'),
                allowNull: false,
                defaultValue: 'admin_ruangan'
            }
        },
        {
            sequelize,
            modelName: 'User',
            tableName: 'users',
        }
    );

    return User;
};