import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { Sequelize } from "sequelize";
import { findAmanahParentByStudentName } from "../services/amanahSync.js";
import { lookupAmanahParent } from "../controllers/Auth.Controller.js";

const original = {
  authenticate: Sequelize.prototype.authenticate,
  query: Sequelize.prototype.query,
  close: Sequelize.prototype.close,
  enabled: process.env.AMANAH_SYNC_ENABLED,
};
let rows = [];

before(() => {
  process.env.AMANAH_SYNC_ENABLED = "true";
  Sequelize.prototype.authenticate = async () => {};
  Sequelize.prototype.query = async () => rows;
  Sequelize.prototype.close = async () => {};
});

after(() => {
  Sequelize.prototype.authenticate = original.authenticate;
  Sequelize.prototype.query = original.query;
  Sequelize.prototype.close = original.close;
  if (original.enabled === undefined) delete process.env.AMANAH_SYNC_ENABLED;
  else process.env.AMANAH_SYNC_ENABLED = original.enabled;
});

test("mengambil hanya nama dan WhatsApp wali yang cocok", async () => {
  rows = [{ id: 1, strNamaOrtu: "Wali Contoh", strNoWA: "081234567890" }];
  const result = await findAmanahParentByStudentName(" Siswa Contoh ");
  assert.deepEqual(result, {
    ok: true,
    parent: { name: "Wali Contoh", wa: "081234567890" },
  });
});

test("tidak memilih wali secara sembarangan ketika nama siswa ambigu", async () => {
  rows = [
    { id: 1, strNamaOrtu: "Wali Pertama", strNoWA: "081234567890" },
    { id: 2, strNamaOrtu: "Wali Kedua", strNoWA: "081234567891" },
  ];
  const result = await findAmanahParentByStudentName("Siswa Contoh");
  assert.equal(result.code, "AMBIGUOUS");
  assert.equal(result.parent, undefined);
});

test("menggunakan nomor siswa jika nomor wali kosong dan nomor siswa tidak ambigu", async () => {
  rows = [{ id: 1, strNamaOrtu: "Wali Contoh", strNoWA: "", studentWaCount: 1, studentWa: "081234567890" }];
  const result = await findAmanahParentByStudentName("Siswa Contoh");
  assert.equal(result.parent.wa, "081234567890");

  rows[0].studentWaCount = 2;
  const ambiguous = await findAmanahParentByStudentName("Siswa Contoh");
  assert.equal(ambiguous.parent.wa, "");
});

test("memberi tahu jika data wali tidak ditemukan", async () => {
  rows = [];
  const result = await findAmanahParentByStudentName("Siswa Contoh");
  assert.equal(result.code, "NOT_FOUND");
});

test("menolak pencarian tanpa status alumni", async () => {
  let status;
  let body;
  const res = {
    status(value) { status = value; return this; },
    json(value) { body = value; return this; },
  };
  await lookupAmanahParent({ body: { isAlumni: false, studentName: "Siswa Contoh" } }, res);
  assert.equal(status, 400);
  assert.match(body.message, /alumni/);
});
