import "dotenv/config";
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./models/index.js";
import routes from "./routes/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api", routes);

app.get("/health", (_req, res) => res.json({ ok: true, service: "ppdb-alhasanah" }));

async function ensureDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
  });
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || "ppdb_alhasanah"}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.end();
}

async function ensureApplicantColumn(name, ddl) {
  const [cols] = await db.query(`SHOW COLUMNS FROM applicants LIKE '${name}'`);
  if (!cols.length) {
    await db.query(`ALTER TABLE applicants ADD COLUMN ${ddl}`);
  }
}

async function ensureApplicantColumns() {
  await ensureApplicantColumn("schoolId", "schoolId INT NULL");
  await ensureApplicantColumn("kelasId", "kelasId INT NULL");
  await ensureApplicantColumn("kelasName", "kelasName VARCHAR(255) NULL");
  await ensureApplicantColumn("isAlumni", "isAlumni TINYINT(1) NOT NULL DEFAULT 0");
}

async function ensureStatementColumns() {
  const [tables] = await db.query("SHOW TABLES LIKE 'statements'");
  if (!tables.length) return;
  const add = async (name, ddl) => {
    const [cols] = await db.query(`SHOW COLUMNS FROM statements LIKE '${name}'`);
    if (!cols.length) await db.query(`ALTER TABLE statements ADD COLUMN ${ddl}`);
  };
  await add("filePath", "filePath VARCHAR(255) NULL");
  await add("originalName", "originalName VARCHAR(255) NULL");
}

async function ensureDocumentKind() {
  const [tables] = await db.query("SHOW TABLES LIKE 'documents'");
  if (!tables.length) return;
  const [cols] = await db.query("SHOW COLUMNS FROM documents LIKE 'kind'");
  const type = String(cols[0]?.Type || "").toLowerCase();
  if (type.startsWith("enum")) {
    await db.query("ALTER TABLE documents MODIFY kind VARCHAR(64) NOT NULL");
  }
}

async function start() {
  await ensureDatabase();
  await db.authenticate();
  await db.sync();
  await ensureApplicantColumns();
  await ensureStatementColumns();
  await ensureDocumentKind();
  app.listen(PORT, () => {
    console.log(`PPDB API berjalan di http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Gagal menjalankan server:", error);
  process.exit(1);
});
