import { DataTypes } from "sequelize";
import db from "../config/database.js";
import Applicant from "./Applicant.js";

const ExamAnnouncement = db.define(
  "exam_announcements",
  {
    applicantId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    schoolId: { type: DataTypes.INTEGER, allowNull: false },
    draft: DataTypes.TEXT("long"),
    announcementDate: DataTypes.DATEONLY,
    publishedAt: DataTypes.DATE,
  },
  { freezeTableName: true }
);

Applicant.hasOne(ExamAnnouncement, { foreignKey: "applicantId", as: "examAnnouncement" });
ExamAnnouncement.belongsTo(Applicant, { foreignKey: "applicantId" });

export default ExamAnnouncement;
