import { DataTypes } from "sequelize";
import db from "../config/database.js";

const SpmbClass = db.define(
  "spmb_classes",
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
    published: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    updatedBy: DataTypes.STRING,
  },
  { freezeTableName: true }
);

export default SpmbClass;
