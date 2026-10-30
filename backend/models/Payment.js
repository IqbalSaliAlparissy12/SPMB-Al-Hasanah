import { DataTypes } from "sequelize";
import db from "../config/database.js";
import Bill from "./Bill.js";

const Payment = db.define(
  "payments",
  {
    billId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    method: DataTypes.STRING,
    amount: DataTypes.INTEGER,
    status: {
      type: DataTypes.STRING,
      defaultValue: "SIMULATED",
    },
    simulated: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  { freezeTableName: true }
);

Bill.hasMany(Payment, { foreignKey: "billId" });
Payment.belongsTo(Bill, { foreignKey: "billId" });

export default Payment;
