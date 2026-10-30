import { DataTypes } from "sequelize";
import db from "../config/database.js";

const SpmbStage = db.define(
  "spmb_stages",
  {
    schoolId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    step: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    updatedBy: DataTypes.STRING,
  },
  { freezeTableName: true }
);

export default SpmbStage;
