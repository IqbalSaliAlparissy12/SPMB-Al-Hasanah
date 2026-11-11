import { DataTypes, UUIDV4 } from "sequelize";
import db from "../config/database.js";
import User from "./User.js";

const Applicant = db.define(
  "applicants",
  {
    uuid: {
      type: DataTypes.STRING,
      defaultValue: UUIDV4,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    studentName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    nik: DataTypes.STRING,
    nisn: DataTypes.STRING,
    gender: DataTypes.STRING,
    type: {
      type: DataTypes.ENUM("BARU", "MURID_LAMA"),
      defaultValue: "BARU",
    },
    schoolTarget: DataTypes.STRING,
    schoolCode: DataTypes.STRING,
    schoolId: DataTypes.INTEGER,
    kelasId: DataTypes.INTEGER,
    kelasName: DataTypes.STRING,
    paymentPackageId: DataTypes.INTEGER,
    waveId: DataTypes.INTEGER,
    isAlumni: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    previousSchool: DataTypes.STRING,
    fatherName: DataTypes.STRING,
    fatherJob: DataTypes.STRING,
    fatherNik: DataTypes.STRING,
    motherName: DataTypes.STRING,
    motherJob: DataTypes.STRING,
    motherNik: DataTypes.STRING,
    address: DataTypes.TEXT,
    village: DataTypes.STRING,
    district: DataTypes.STRING,
    city: DataTypes.STRING,
    province: DataTypes.STRING,
    currentStep: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    maxUnlockedStep: {
      type: DataTypes.INTEGER,
      defaultValue: 2,
    },
    formSubmittedAt: DataTypes.DATE,
    examNumber: DataTypes.STRING,
    photoPath: DataTypes.STRING,
    examDate: DataTypes.STRING,
    examLocation: DataTypes.STRING,
    announcementStatus: {
      type: DataTypes.ENUM("MENUNGGU", "LULUS", "TIDAK_LULUS", "LULUS_CADANGAN", "MENGUNDURKAN_DIRI"),
      defaultValue: "MENUNGGU",
    },
    amanahSiswaId: DataTypes.INTEGER,
    amanahOrtuId: DataTypes.INTEGER,
    amanahSyncedAt: DataTypes.DATE,
  },
  { freezeTableName: true }
);

User.hasOne(Applicant, { foreignKey: "userId" });
Applicant.belongsTo(User, { foreignKey: "userId" });

export default Applicant;
