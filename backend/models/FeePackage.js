import { DataTypes } from "sequelize";
import db from "../config/database.js";

const FeePackage = db.define(
  "fee_packages",
  {
    schoolId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    kelasId: DataTypes.INTEGER,
    studentType: DataTypes.STRING,
  },
  { freezeTableName: true }
);

export default FeePackage;
