import { DataTypes } from "sequelize";
import db from "../config/database.js";
import Applicant from "./Applicant.js";

const Bill = db.define(
  "bills",
  {
    applicantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 350000,
    },
    status: {
      type: DataTypes.ENUM("UNPAID", "PAID", "EXPIRED"),
      defaultValue: "UNPAID",
    },
    selectedMethod: DataTypes.STRING,
    vaBni: DataTypes.STRING,
    vaBca: DataTypes.STRING,
    vaMandiri: DataTypes.STRING,
    expiresAt: DataTypes.DATE,
    paidAt: DataTypes.DATE,
  },
  { freezeTableName: true }
);

Applicant.hasOne(Bill, { foreignKey: "applicantId" });
Bill.belongsTo(Applicant, { foreignKey: "applicantId" });

export default Bill;
