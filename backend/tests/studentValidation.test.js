import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { Sequelize } from "sequelize";
import { Applicant, DocRequirement, DocumentFile, StudentValidation, db } from "../models/index.js";
import { finishRegistration } from "../controllers/Document.Controller.js";
import { getStudentValidation, saveStudentValidation } from "../controllers/StudentValidation.Controller.js";
import { pullForStudentValidation } from "../services/amanahSync.js";
import { sanitizeStudentValidation, studentValidationErrors, studentValidationSections } from "../utils/studentValidation.js";

const original = {
  authenticate: Sequelize.prototype.authenticate,
  query: Sequelize.prototype.query,
  close: Sequelize.prototype.close,
  enabled: process.env.AMANAH_SYNC_ENABLED,
};
let rows = [];
let lastQuery;

before(() => {
  process.env.AMANAH_SYNC_ENABLED = "true";
  Sequelize.prototype.authenticate = async () => {};
  Sequelize.prototype.query = async (sql, options) => {
    lastQuery = { sql, options };
    return rows;
  };
  Sequelize.prototype.close = async () => {};
});

after(() => {
  Sequelize.prototype.authenticate = original.authenticate;
  Sequelize.prototype.query = original.query;
  Sequelize.prototype.close = original.close;
  if (original.enabled === undefined) delete process.env.AMANAH_SYNC_ENABLED;
  else process.env.AMANAH_SYNC_ENABLED = original.enabled;
});

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    set() { return this; },
    json(body) { this.body = body; return this; },
  };
}

function completeValues() {
  return Object.fromEntries(studentValidationSections.flatMap((section) => section.fields).map((field) => {
    if (!field.required) return [field.key, ""];
    if (field.options) return [field.key, field.options[0]];
    if (field.pattern === "^\\d{16}$") return [field.key, "1234567890123456"];
    if (field.pattern === "^\\d{8,13}$") return [field.key, "081234567890"];
    if (field.type === "date") return [field.key, "2000-01-01"];
    if (field.type === "number") return [field.key, "1"];
    return [field.key, "Contoh"];
  }));
}

test("validasi wajib menolak data kosong dan menerima data lengkap", () => {
  assert.ok(studentValidationErrors(sanitizeStudentValidation({})).length > 0);
  const values = completeValues();
  assert.deepEqual(studentValidationErrors(sanitizeStudentValidation(values)), []);
  values.nik = "123";
  assert.ok(studentValidationErrors(sanitizeStudentValidation(values)).some((error) => error.includes("NIK Siswa")));
  values.birthDate = "2024-02-31";
  assert.ok(studentValidationErrors(sanitizeStudentValidation(values)).some((error) => error.includes("Tanggal Lahir")));
});

test("impor menggunakan NISN tersimpan dan mengecualikan baris yang dibuat SPMB", async () => {
  rows = [{ strNamaSiswa: "Siswa Contoh", strNISN: "1234567890", strTTL: "17/05/2021", strJenisKelamin: "L" }];
  const result = await pullForStudentValidation("1234567890", 17, 91);
  assert.equal(result.ok, true);
  assert.equal(result.values.birthDate, "2021-05-17");
  assert.equal(result.values.gender, "Laki-Laki");
  assert.match(lastQuery.sql, /id <> :syncedStudentId OR COALESCE\(strNIS, ''\) <> :spmbNis/);
  assert.deepEqual(lastQuery.options.replacements, { nisn: "1234567890", syncedStudentId: 91, spmbNis: "PPDB-17" });
  rows = [rows[0], { ...rows[0] }];
  assert.equal((await pullForStudentValidation("1234567890", 17, 91)).code, "AMBIGUOUS");
  rows = [];
  assert.equal((await pullForStudentValidation("1234567890", 17, 91)).code, "NOT_FOUND");
  assert.equal((await pullForStudentValidation("123", 17, 91)).code, "INVALID");
});

test("formulir alumni pertama mengisi kolom kosong tanpa menimpa data tahap 3", async (t) => {
  const applicant = { id: 17, studentName: "Nama tahap 3", nisn: "1234567890", address: "Alamat tahap 3", announcementStatus: "LULUS", maxUnlockedStep: 5, isAlumni: true, amanahSiswaId: 91 };
  rows = [{ strNamaSiswa: "Nama Amanah", strNISN: "1234567890", strTempat: "Bengkulu", strAlamatSiswa: "Alamat Amanah" }];
  t.mock.method(Applicant, "findOne", async () => applicant);
  t.mock.method(StudentValidation, "findOne", async () => null);
  const res = response();
  await getStudentValidation({ user: { id: 1 } }, res);
  assert.equal(res.body.values.studentName, "Nama tahap 3");
  assert.equal(res.body.values.address, "Alamat tahap 3");
  assert.equal(res.body.values.birthPlace, "Bengkulu");
  assert.equal(res.body.importWarning, "");
});

test("draf alumni diisi otomatis tanpa menimpa data dan kegagalan impor ditampilkan", async (t) => {
  const applicant = { id: 17, studentName: "Nama tahap 3", nisn: "1234567890", announcementStatus: "LULUS", maxUnlockedStep: 5, isAlumni: true };
  t.mock.method(Applicant, "findOne", async () => applicant);
  let saved = { data: JSON.stringify({ birthPlace: "", address: "Alamat draf" }) };
  t.mock.method(StudentValidation, "findOne", async () => saved);
  rows = [{ strTempat: "Bengkulu", strAlamatSiswa: "Alamat Amanah" }];
  const draft = response();
  await getStudentValidation({ user: { id: 1 } }, draft);
  assert.equal(draft.body.values.birthPlace, "Bengkulu");
  assert.equal(draft.body.values.address, "Alamat draf");
  assert.equal(lastQuery.options.replacements.nisn, "1234567890");
  saved = null;
  rows = [{}, {}];
  const ambiguous = response();
  await getStudentValidation({ user: { id: 1 } }, ambiguous);
  assert.match(ambiguous.body.importWarning, /beberapa data/);
  assert.equal(ambiguous.body.values.studentName, "Nama tahap 3");
});

test("data draf tersimpan dan dapat dibaca kembali", async (t) => {
  const applicant = { id: 1, studentName: "Siswa Contoh", announcementStatus: "LULUS", maxUnlockedStep: 5, isAlumni: false };
  let saved;
  t.mock.method(Applicant, "findOne", async () => applicant);
  t.mock.method(db, "transaction", async (callback) => callback({}));
  t.mock.method(StudentValidation, "upsert", async (values) => { saved = values; });
  t.mock.method(StudentValidation, "findOne", async () => saved);
  const req = { user: { id: 2, wa: "081234567890" }, body: { values: { studentName: "Siswa Contoh", birthPlace: "Bengkulu" } } };
  const result = response();
  await saveStudentValidation(req, result);
  assert.equal(result.statusCode, 200);
  assert.ok(result.body.errors.length > 0);
  const loaded = response();
  await getStudentValidation(req, loaded);
  assert.equal(loaded.body.values.birthPlace, "Bengkulu");
});

test("pengisian otomatis hanya berlaku bagi alumni yang lulus", async (t) => {
  t.mock.method(Applicant, "findOne", async () => ({ id: 17, nisn: "1234567890", announcementStatus: "LULUS", maxUnlockedStep: 5, isAlumni: false }));
  t.mock.method(StudentValidation, "findOne", async () => null);
  lastQuery = undefined;
  const res = response();
  await getStudentValidation({ user: { id: 1 } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(lastQuery, undefined);
  t.mock.method(Applicant, "findOne", async () => ({ announcementStatus: "MENUNGGU", maxUnlockedStep: 5, isAlumni: true }));
  const pending = response();
  await getStudentValidation({ user: { id: 1 } }, pending);
  assert.equal(pending.statusCode, 403);
  assert.equal(lastQuery, undefined);
});

test("pendaftaran tidak selesai tanpa data validasi meskipun dokumen lengkap", async (t) => {
  t.mock.method(Applicant, "findOne", async () => ({ id: 1, announcementStatus: "LULUS", maxUnlockedStep: 5 }));
  t.mock.method(DocRequirement, "count", async () => 1);
  t.mock.method(DocRequirement, "findAll", async () => [{ code: "KK", name: "Kartu Keluarga" }]);
  t.mock.method(DocumentFile, "findAll", async () => [{ kind: "KK" }]);
  t.mock.method(StudentValidation, "findOne", async () => null);
  const res = response();
  await finishRegistration({ user: { id: 1 } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /data siswa/i);
});

test("pendaftaran selesai ketika dokumen dan data wajib lengkap", async (t) => {
  let updated = false;
  const applicant = {
    id: 1, announcementStatus: "LULUS", maxUnlockedStep: 5,
    update: async () => { updated = true; },
  };
  let lookups = 0;
  t.mock.method(Applicant, "findOne", async () => (++lookups === 1 ? applicant : null));
  t.mock.method(DocRequirement, "count", async () => 1);
  t.mock.method(DocRequirement, "findAll", async () => [{ code: "KK", name: "Kartu Keluarga" }]);
  t.mock.method(DocumentFile, "findAll", async () => [{ kind: "KK" }]);
  t.mock.method(StudentValidation, "findOne", async () => ({ data: JSON.stringify(completeValues()) }));
  const previousUrl = process.env.RAPOR_APP_URL;
  process.env.RAPOR_APP_URL = "";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.RAPOR_APP_URL;
    else process.env.RAPOR_APP_URL = previousUrl;
  });
  const res = response();
  await finishRegistration({ user: { id: 1, role: "ORTU" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(updated, true);
});
