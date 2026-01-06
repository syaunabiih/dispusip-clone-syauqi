module.exports = (sequelize, DataTypes) => {
    return sequelize.define('BookSubject', {
        book_id: DataTypes.INTEGER,
        subject_id: DataTypes.INTEGER
    }, {
        timestamps: false
    });
};