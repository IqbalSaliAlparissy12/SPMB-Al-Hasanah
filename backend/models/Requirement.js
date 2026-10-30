import { DataTypes } from "sequelize";
import db from "../config/database.js";

const Requirement = db.define(
  "requirements",
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
    updatedBy: DataTypes.STRING,
  },
  { freezeTableName: true }
);

export default Requirement;
