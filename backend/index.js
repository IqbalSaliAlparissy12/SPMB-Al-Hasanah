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
  await ensureApplicantColumn("paymentPackageId", "paymentPackageId INT NULL");
  await ensureApplicantColumn("waveId", "waveId INT NULL");
  await ensureApplicantColumn("isAlumni", "isAlumni TINYINT(1) NOT NULL DEFAULT 0");
}

async function ensureFeePackageColumns() {
  const [tables] = await db.query("SHOW TABLES LIKE 'fee_packages'");
  if (!tables.length) return;
  const [kelasColumns] = await db.query("SHOW COLUMNS FROM fee_packages LIKE 'kelasId'");
  if (!kelasColumns.length) await db.query("ALTER TABLE fee_packages ADD COLUMN kelasId INT NULL");
  const [typeColumns] = await db.query("SHOW COLUMNS FROM fee_packages LIKE 'studentType'");
  if (!typeColumns.length) await db.query("ALTER TABLE fee_packages ADD COLUMN studentType VARCHAR(16) NULL");
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

async function ensureBillColumns() {
  const [tables] = await db.query("SHOW TABLES LIKE 'bills'");
  if (!tables.length) return;
  const [cols] = await db.query("SHOW COLUMNS FROM bills LIKE 'bniTrxId'");
  if (!cols.length) await db.query("ALTER TABLE bills ADD COLUMN bniTrxId VARCHAR(255) NULL");
}

async function ensureApplicantFeeAmountColumns() {
  const [tables] = await db.query("SHOW TABLES LIKE 'applicant_fee_amounts'");
  if (!tables.length) return;
  const [columns] = await db.query("SHOW COLUMNS FROM applicant_fee_amounts LIKE 'deductionAmount'");
  if (!columns.length) {
    await db.query("ALTER TABLE applicant_fee_amounts ADD COLUMN deductionAmount INT NULL");
  }
  const [descriptionColumns] = await db.query("SHOW COLUMNS FROM applicant_fee_amounts LIKE 'description'");
  if (!descriptionColumns.length) {
    await db.query("ALTER TABLE applicant_fee_amounts ADD COLUMN description TEXT NULL");
  }
  const [oasisColumns] = await db.query("SHOW COLUMNS FROM applicant_fee_amounts LIKE 'oasisAmount'");
  if (!oasisColumns.length) {
    await db.query("ALTER TABLE applicant_fee_amounts ADD COLUMN oasisAmount INT NOT NULL DEFAULT 0");
  }
}

async function ensureExamScheduleColumns() {
  const [tables] = await db.query("SHOW TABLES LIKE 'exam_schedules'");
  if (!tables.length) return;
  const [waveColumns] = await db.query("SHOW COLUMNS FROM exam_schedules LIKE 'waveId'");
  if (!waveColumns.length) {
    await db.query("ALTER TABLE exam_schedules ADD COLUMN waveId INT NULL");
  }
  const [indexes] = await db.query("SHOW INDEX FROM exam_schedules");
  const indexColumns = new Map();
  for (const index of indexes) {
    const name = index.Key_name;
    if (!name || name === "PRIMARY" || Number(index.Non_unique) !== 0) continue;
    const columns = indexColumns.get(name) || [];
    columns.push({ sequence: Number(index.Seq_in_index), column: index.Column_name });
    indexColumns.set(name, columns);
  }
  for (const [name, columns] of indexColumns) {
    const orderedColumns = columns.sort((a, b) => a.sequence - b.sequence).map((item) => item.column);
    if (orderedColumns.length === 1 && orderedColumns[0] === "schoolId") {
      await db.query(`ALTER TABLE exam_schedules DROP INDEX \`${name}\``);
    }
  }
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

async function ensureExamStatusEnums() {
  const statuses = ["LULUS", "TIDAK_LULUS", "LULUS_CADANGAN", "MENGUNDURKAN_DIRI"];
  const enumValues = statuses.map((status) => `'${status}'`).join(", ");
  const applicantStatuses = ["MENUNGGU", ...statuses];
  const applicantEnumValues = applicantStatuses.map((status) => `'${status}'`).join(", ");

  const [applicantColumns] = await db.query("SHOW COLUMNS FROM applicants LIKE 'announcementStatus'");
  const applicantType = String(applicantColumns[0]?.Type || "").toLowerCase();
  if (applicantType.startsWith("enum") && applicantStatuses.some((status) => !applicantType.includes(`'${status.toLowerCase()}'`))) {
    await db.query(
      `ALTER TABLE applicants MODIFY announcementStatus ENUM(${applicantEnumValues}) NOT NULL DEFAULT 'MENUNGGU'`
    );
  }

  const [examColumns] = await db.query("SHOW COLUMNS FROM exam_results LIKE 'status'");
  const examType = String(examColumns[0]?.Type || "").toLowerCase();
  if (examType.startsWith("enum") && statuses.some((status) => !examType.includes(`'${status.toLowerCase()}'`))) {
    await db.query(`ALTER TABLE exam_results MODIFY status ENUM(${enumValues}) NOT NULL`);
  }
}

async function start() {
  await ensureDatabase();
  await db.authenticate();
  await ensureExamScheduleColumns();
  await db.sync();
  await ensureApplicantColumns();
  await ensureFeePackageColumns();
  await ensureExamStatusEnums();
  await ensureStatementColumns();
  await ensureDocumentKind();
  await ensureBillColumns();
  await ensureApplicantFeeAmountColumns();
  app.listen(PORT, () => {
    console.log(`SPMB API berjalan di http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Gagal menjalankan server:", error);
  process.exit(1);
});
