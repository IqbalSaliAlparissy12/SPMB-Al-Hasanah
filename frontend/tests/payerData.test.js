import { test } from "node:test";
import assert from "node:assert/strict";
import { updateValidationValue } from "../src/pages/steps/payerData.js";

test("memilih ayah atau ibu mengisi data penanggung biaya yang sesuai", () => {
  const values = {
    fatherName: "Ayah", fatherPhone: "0811111111", fatherJob: "Guru", fatherAddress: "Alamat ayah",
    motherName: "Ibu", motherPhone: "", motherJob: "Dokter", motherAddress: "Alamat ibu",
  };
  const father = updateValidationValue(values, "payerType", "Ayah");
  assert.deepEqual(
    [father.payerName, father.payerRelationship, father.payerPhone, father.payerJob, father.payerAddress],
    ["Ayah", "Ayah", "0811111111", "Guru", "Alamat ayah"]
  );
  const mother = updateValidationValue(father, "payerType", "Ibu");
  assert.deepEqual(
    [mother.payerName, mother.payerRelationship, mother.payerPhone, mother.payerJob, mother.payerAddress],
    ["Ibu", "Ibu", "", "Dokter", "Alamat ibu"]
  );
});

test("perubahan data orang tua terpilih memperbarui penanggung biaya", () => {
  const values = { payerType: "Ayah", fatherName: "Nama lama", payerName: "Nama lama", payerPhone: "0811111111" };
  const updated = updateValidationValue(values, "fatherName", "Nama baru");
  assert.equal(updated.payerName, "Nama baru");
  assert.equal(updated.payerPhone, "0811111111");
  assert.equal(updateValidationValue(updated, "motherName", "Ibu").payerName, "Nama baru");
  assert.equal(updateValidationValue(updated, "fatherPhone", "").payerPhone, "");
});

test("mengosongkan pilihan menghapus data penanggung biaya sebelumnya", () => {
  const values = { payerType: "Ibu", payerName: "Ibu", payerRelationship: "Ibu", payerPhone: "0811111111", payerJob: "Guru", payerAddress: "Alamat" };
  const cleared = updateValidationValue(values, "payerType", "");
  for (const key of ["payerName", "payerRelationship", "payerPhone", "payerJob", "payerAddress"]) {
    assert.equal(cleared[key], "");
  }
});
