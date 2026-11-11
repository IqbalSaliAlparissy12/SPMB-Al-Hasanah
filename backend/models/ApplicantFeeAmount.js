import { DataTypes } from "sequelize";
import db from "../config/database.js";

const ApplicantFeeAmount = db.define(
  "applicant_fee_amounts",
  {
    applicantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    setupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    packageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    deductionAmount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    oasisAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    freezeTableName: true,
    indexes: [{ unique: true, fields: ["applicantId", "setupId", "packageId", "groupId"] }],
  }
);

export default ApplicantFeeAmount;
