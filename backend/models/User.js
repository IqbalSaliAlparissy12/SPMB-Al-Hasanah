import { DataTypes, UUIDV4 } from "sequelize";
import db from "../config/database.js";

const User = db.define(
  "users",
  {
    uuid: {
      type: DataTypes.STRING,
      defaultValue: UUIDV4,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    wa: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: "users_wa_unique",
    },
    username: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: "users_username_unique",
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: "users_email_unique",
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "ORTU",
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  { freezeTableName: true }
);

export default User;
