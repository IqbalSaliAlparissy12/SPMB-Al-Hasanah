import { DataTypes } from "sequelize";
import db from "../config/database.js";

export default db.define("student_validations", {
  applicantId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  data: { type: DataTypes.TEXT("long"), allowNull: false },
}, { freezeTableName: true });
