import { DataTypes } from "sequelize";
import db from "../config/database.js";
import Applicant from "./Applicant.js";

const DocumentFile = db.define(
  "documents",
  {
    applicantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    kind: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    path: DataTypes.STRING,
    originalName: DataTypes.STRING,
  },
  { freezeTableName: true }
);

Applicant.hasMany(DocumentFile, { foreignKey: "applicantId" });
DocumentFile.belongsTo(Applicant, { foreignKey: "applicantId" });

export default DocumentFile;
