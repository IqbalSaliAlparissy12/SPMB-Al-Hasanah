import { DataTypes } from "sequelize";
import db from "../config/database.js";

const DocRequirement = db.define(
  "doc_requirements",
  {
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
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

export default DocRequirement;
