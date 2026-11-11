import { DataTypes } from "sequelize";
import db from "../config/database.js";

const SpmbSchoolConfig = db.define(
  "spmb_school_configs",
  {
    schoolId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    registrationPrefix: {
      type: DataTypes.STRING(4),
      allowNull: false,
      unique: true,
    },
  },
  { freezeTableName: true }
);

export default SpmbSchoolConfig;
