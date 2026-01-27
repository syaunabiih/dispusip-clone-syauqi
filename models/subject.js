module.exports = (sequelize, DataTypes) => {
    const Subject = sequelize.define('Subject', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: DataTypes.STRING
    }, {
        timestamps: true,           
        createdAt: 'createdAt',     
        updatedAt: 'updatedAt'
    });

    Subject.associate = (models) => {
        Subject.belongsToMany(models.Book, {
            through: 'BookSubject',
            foreignKey: 'subject_id',
            timestamps: true
        });
    };

    return Subject;
};