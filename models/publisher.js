module.exports = (sequelize, DataTypes) => {
    const Publisher = sequelize.define('Publisher', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: DataTypes.STRING
    }, {
        timestamps: true,           
        createdAt: 'createdAt',     
        updatedAt: 'updatedAt'
    });

    Publisher.associate = (models) => {
        Publisher.belongsToMany(models.Book, {
            through: 'BookPublisher',
            foreignKey: 'publisher_id',
            timestamps: true
        });
    };

    return Publisher;
};