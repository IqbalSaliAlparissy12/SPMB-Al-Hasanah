import { DataTypes } from "sequelize";
import db from "../config/database.js";

const AnnualFeeSetup = db.define(
  "annual_fee_setups",
  {
    schoolId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    academicYear: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    updatedBy: DataTypes.STRING,
  },
  {
    freezeTableName: true,
    indexes: [{ unique: true, fields: ["schoolId", "academicYear"] }],
  }
);

export default AnnualFeeSetup;
