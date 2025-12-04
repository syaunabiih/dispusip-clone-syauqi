module.exports = (sequelize, DataTypes) => {
    const Book = sequelize.define('Book', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        title: DataTypes.STRING,
        original_title: DataTypes.STRING,
        statement_of_responsibility: DataTypes.STRING,
        series_title: DataTypes.STRING,
        edition: DataTypes.STRING,
        publish_year: DataTypes.STRING(4),
        publish_place: DataTypes.STRING,
        physical_description: DataTypes.STRING,
        content_type: DataTypes.STRING,
        media_type: DataTypes.STRING,
        carrier_type: DataTypes.STRING,
        isbn: DataTypes.STRING(20),
        call_number: DataTypes.STRING(50),
        abstract: DataTypes.TEXT,
        notes: DataTypes.TEXT,
        language: DataTypes.STRING,
        work_type: DataTypes.STRING,
        target_audience: DataTypes.STRING,
        shelf_location: DataTypes.STRING,
        stock_total: DataTypes.INTEGER,
        stock_available: DataTypes.INTEGER,
        category_id: DataTypes.INTEGER,
        image: { type: DataTypes.STRING, allowNull: true }
    }, {
        timestamps: true,           
        createdAt: 'createdAt',     
        updatedAt: 'updatedAt'
    });

    Book.associate = (models) => {
        Book.belongsTo(models.Category, { foreignKey: 'category_id' });

        Book.belongsToMany(models.Author, {
            through: 'BookAuthor',
            foreignKey: 'book_id'
        });

        Book.belongsToMany(models.Publisher, {
            through: 'BookPublisher',
            foreignKey: 'book_id'
        });

        Book.belongsToMany(models.Subject, {
            through: 'BookSubject',
            foreignKey: 'book_id'
        });
    };

    return Book;
};