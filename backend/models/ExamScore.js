import { DataTypes } from "sequelize";
import db from "../config/database.js";
import ExamResult from "./ExamResult.js";

const ExamScore = db.define(
  "exam_scores",
  {
    examResultId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    subjectId: DataTypes.INTEGER,
    subjectName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    score: DataTypes.STRING,
    note: DataTypes.TEXT,
  },
  { freezeTableName: true }
);

ExamResult.hasMany(ExamScore, { foreignKey: "examResultId", as: "scores" });
ExamScore.belongsTo(ExamResult, { foreignKey: "examResultId" });

export default ExamScore;
