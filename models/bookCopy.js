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
        // Tambahkan 'tersedia_puskel' (Ada di Ruangan Puskel)
        // Tambahkan 'dipinjam_puskel' (Sedang dipinjam Lembaga)
        type: DataTypes.ENUM('tersedia', 'dipinjam', 'rusak', 'hilang', 'tersedia_puskel', 'dipinjam_puskel'),
        allowNull: false,
        defaultValue: 'tersedia'
    }
    });

    BookCopy.associate = (models) => {
        BookCopy.belongsTo(models.Book, { foreignKey: 'book_id' });
        BookCopy.hasMany(models.PuskelLoan, { foreignKey: 'book_copy_id', as: 'puskelLoans' });
    };

    return BookCopy;
};