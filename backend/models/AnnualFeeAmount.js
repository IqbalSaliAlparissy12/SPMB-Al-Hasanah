import { DataTypes } from "sequelize";
import db from "../config/database.js";

const AnnualFeeAmount = db.define(
  "annual_fee_amounts",
  {
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
    packageName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    groupName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    freezeTableName: true,
    indexes: [{ unique: true, fields: ["setupId", "packageId", "groupId"] }],
  }
);

export default AnnualFeeAmount;
