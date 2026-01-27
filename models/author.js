module.exports = (sequelize, DataTypes) => {
    const Author = sequelize.define('Author', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: DataTypes.STRING
    }, {
        timestamps: true,           
        createdAt: 'createdAt',     
        updatedAt: 'updatedAt'
    });

    Author.associate = (models) => {
        Author.belongsToMany(models.Book, {
            through:    'BookAuthor',
            foreignKey: 'author_id',
            timestamps: true
        });
    };

    return Author;
};