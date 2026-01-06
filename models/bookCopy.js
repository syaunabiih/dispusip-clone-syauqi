module.exports = (sequelize, DataTypes) => {
    const BookCopy = sequelize.define('BookCopy', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        book_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        no_induk: {
            type: DataTypes.STRING,
            unique: true, // Nomor induk tidak boleh sama antar fisik buku
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('tersedia', 'dipinjam', 'rusak', 'hilang'),
            defaultValue: 'tersedia'
        }
    });

    BookCopy.associate = (models) => {
        BookCopy.belongsTo(models.Book, { foreignKey: 'book_id' });
    };

    return BookCopy;
};