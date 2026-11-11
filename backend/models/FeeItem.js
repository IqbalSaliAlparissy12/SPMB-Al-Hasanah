import { DataTypes } from "sequelize";
import db from "../config/database.js";

const FeeItem = db.define(
  "fee_items",
  {
    schoolId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    accountNumber: DataTypes.STRING,
  },
  { freezeTableName: true }
);

export default FeeItem;
