import { DataTypes } from "sequelize";
import db from "../config/database.js";
import Applicant from "./Applicant.js";

const ExamResult = db.define(
  "exam_results",
  {
    applicantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    schoolId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    academicYear: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    examinerName: DataTypes.STRING,
    examinerAmanahUserId: DataTypes.INTEGER,
    status: {
      type: DataTypes.ENUM("LULUS", "TIDAK_LULUS"),
      allowNull: false,
    },
    observasiScore: DataTypes.STRING,
    observasiNote: DataTypes.TEXT,
    wawancaraScore: DataTypes.STRING,
    wawancaraNote: DataTypes.TEXT,
    note: DataTypes.TEXT,
  },
  { freezeTableName: true }
);

Applicant.hasOne(ExamResult, { foreignKey: "applicantId", as: "examResult" });
ExamResult.belongsTo(Applicant, { foreignKey: "applicantId", as: "applicant" });

export default ExamResult;
