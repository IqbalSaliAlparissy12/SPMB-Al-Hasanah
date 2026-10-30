import { DataTypes } from "sequelize";
import db from "../config/database.js";

const Statement = db.define(
  "statements",
  {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    published: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    filePath: DataTypes.STRING,
    originalName: DataTypes.STRING,
    updatedBy: DataTypes.STRING,
  },
  { freezeTableName: true }
);

export default Statement;
