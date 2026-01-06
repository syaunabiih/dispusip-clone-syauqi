module.exports = (sequelize, DataTypes) => {
    return sequelize.define('BookPublisher', {
        book_id: DataTypes.INTEGER,
        publisher_id: DataTypes.INTEGER
    }, {
        timestamps: false
    });
};