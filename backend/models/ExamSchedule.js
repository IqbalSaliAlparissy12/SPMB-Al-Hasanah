import { DataTypes } from "sequelize";
import db from "../config/database.js";

const ExamSchedule = db.define(
  "exam_schedules",
  {
    schoolId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    waveId: DataTypes.INTEGER,
    examDate: DataTypes.STRING,
    examLocation: DataTypes.STRING,
  },
  {
    freezeTableName: true,
    indexes: [{ unique: true, fields: ["schoolId", "waveId"] }],
  }
);

export default ExamSchedule;
