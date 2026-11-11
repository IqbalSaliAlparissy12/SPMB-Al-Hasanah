import { DataTypes } from "sequelize";
import db from "../config/database.js";

const SpmbWave = db.define(
  "spmb_waves",
  {
    schoolId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    updatedBy: DataTypes.STRING,
  },
  { freezeTableName: true }
);

export default SpmbWave;
