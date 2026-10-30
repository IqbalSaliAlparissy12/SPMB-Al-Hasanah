import { DataTypes } from "sequelize";
import db from "../config/database.js";
import Applicant from "./Applicant.js";

const SyncLog = db.define(
  "sync_logs",
  {
    applicantId: DataTypes.INTEGER,
    direction: DataTypes.STRING,
    status: DataTypes.STRING,
    message: DataTypes.TEXT,
    payload: DataTypes.JSON,
  },
  { freezeTableName: true }
);

Applicant.hasMany(SyncLog, { foreignKey: "applicantId" });
SyncLog.belongsTo(Applicant, { foreignKey: "applicantId" });

export default SyncLog;
