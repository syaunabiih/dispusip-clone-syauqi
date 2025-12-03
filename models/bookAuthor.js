module.exports = (sequelize, DataTypes) => {
    return sequelize.define('BookAuthor', {
        book_id: DataTypes.INTEGER,
        author_id: DataTypes.INTEGER,
        role: DataTypes.STRING
    }, {
        timestamps: true,           
        createdAt: 'createdAt',     
        updatedAt: 'updatedAt'
    });
};