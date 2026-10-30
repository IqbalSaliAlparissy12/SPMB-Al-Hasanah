import { Sequelize } from "sequelize";

export function isAmanahConfigured() {
  return process.env.AMANAH_SYNC_ENABLED === "true";
}

export function createAmanahSequelize() {
  return new Sequelize(
    process.env.AMANAH_DB_NAME || "rapor",
    process.env.AMANAH_DB_USER || "root",
    process.env.AMANAH_DB_PASS || "",
    {
      host: process.env.AMANAH_DB_HOST || "localhost",
      dialect: "mysql",
      logging: false,
    }
  );
}
