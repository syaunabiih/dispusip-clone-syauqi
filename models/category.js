module.exports = (sequelize, DataTypes) => {
    const Category = sequelize.define('Category', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: DataTypes.STRING
    }, {
        timestamps: true,           
        createdAt: 'createdAt',     
        updatedAt: 'updatedAt'
    });

    Category.associate = (models) => {
        Category.hasMany(models.Book, { foreignKey: 'category_id' });
    };

    return Category;
};