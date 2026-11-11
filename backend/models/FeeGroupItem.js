import { DataTypes } from "sequelize";
import db from "../config/database.js";

const FeeGroupItem = db.define(
  "fee_group_items",
  {
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    itemId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    schoolId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    freezeTableName: true,
    indexes: [{ unique: true, fields: ["groupId", "itemId"] }],
  }
);

export default FeeGroupItem;
