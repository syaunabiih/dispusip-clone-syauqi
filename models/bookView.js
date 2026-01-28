module.exports = (sequelize, DataTypes) => {
    const BookView = sequelize.define('BookView', {
        id: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true 
        },
        book_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        timestamps: true,
        updatedAt: false
    });

    BookView.associate = (models) => {
        BookView.belongsTo(models.Book, { foreignKey: 'book_id' });
    };

    return BookView;
};