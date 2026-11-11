import { DataTypes } from "sequelize";
import db from "../config/database.js";

const FeeGroup = db.define(
  "fee_groups",
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

export default FeeGroup;
