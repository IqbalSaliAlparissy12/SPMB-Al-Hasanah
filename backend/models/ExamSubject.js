import { DataTypes } from "sequelize";
import db from "../config/database.js";

const ExamSubject = db.define(
  "exam_subjects",
  {
    schoolId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  { freezeTableName: true }
);

export default ExamSubject;
