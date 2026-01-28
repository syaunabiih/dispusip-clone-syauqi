module.exports = (sequelize, DataTypes) => {
    const Book = sequelize.define('Book', {
        id: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true 
        },
        title: DataTypes.STRING(500),
        edition: DataTypes.STRING,
        publish_year: DataTypes.STRING(20),
        publish_place: DataTypes.STRING,
        physical_description: DataTypes.STRING,
        isbn: DataTypes.STRING(50),
        call_number: DataTypes.STRING(50),
        abstract: DataTypes.TEXT,
        notes: DataTypes.TEXT,
        language: DataTypes.STRING,
        shelf_location: DataTypes.STRING,
        category_id: DataTypes.INTEGER,
        image: { 
            type: DataTypes.STRING, 
            allowNull: true 
        }

    }, {
        timestamps: true,
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    });

    Book.associate = (models) => {

        Book.hasMany(models.BookCopy, { 
            foreignKey: 'book_id', 
            as: 'copies',
            onDelete: 'CASCADE' // Jika buku dihapus, fisik/nomor induknya ikut terhapus
        });

        Book.belongsTo(models.Category, { 
            foreignKey: 'category_id' 
        });

        Book.belongsToMany(models.Author, {
            through: 'BookAuthor',
            foreignKey: 'book_id',
            timestamps: true
        });

        Book.belongsToMany(models.Publisher, {
            through: 'BookPublisher',
            foreignKey: 'book_id',
            timestamps: true
        });

        Book.belongsToMany(models.Subject, {
            through: 'BookSubject',
            foreignKey: 'book_id',
            timestamps: true
        });

        Book.hasMany(models.BookView, { 
            foreignKey: 'book_id',
            as: 'views' 
        });
    };

    return Book;
};