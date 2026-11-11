import { DataTypes } from "sequelize";
import db from "../config/database.js";

const AdmissionPayment = db.define(
  "admission_payments",
  {
    applicantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    method: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("PENDING", "PAID", "EXPIRED", "FAILED"),
      allowNull: false,
      defaultValue: "PENDING",
    },
    bniTrxId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    virtualAccount: DataTypes.STRING,
    expiresAt: DataTypes.DATE,
    paidAt: DataTypes.DATE,
    recordedBy: DataTypes.STRING,
    note: DataTypes.STRING,
  },
  { freezeTableName: true }
);

export default AdmissionPayment;
