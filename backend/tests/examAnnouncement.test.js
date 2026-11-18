import { test } from "node:test";
import assert from "node:assert/strict";
import { AdmissionPayment, AnnualFeeAmount, AnnualFeeSetup, Applicant, ApplicantFeeAmount, Bill, db, DocumentFile, ExamAnnouncement, ExamResult, ExamSchedule, ExamScore, ExamSubject, FeePackage, SpmbWave } from "../models/index.js";
import { publishExamResults, saveExamResult } from "../controllers/Exam.Controller.js";
import { loadDashboard } from "../controllers/Auth.Controller.js";
import { getApplicantFeeDetails, saveApplicantFeeDetails } from "../controllers/Tu.Controller.js";
import { deleteWave } from "../controllers/SpmbWave.Controller.js";
import { requireTu } from "../middleware/verifyJWT.js";

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function transactionMock(t) {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  t.mock.method(db, "transaction", async (callback) => callback(transaction));
}

test("menyimpan hasil sebagai draf tanpa mengubah status atau hasil yang diumumkan", async (t) => {
  transactionMock(t);
  const applicant = { id: 7, schoolId: 3, currentStep: 4, announcementStatus: "MENUNGGU" };
  t.mock.method(Applicant, "findOne", async () => applicant);
  t.mock.method(FeePackage, "findOne", async () => ({ id: 5 }));
  t.mock.method(SpmbWave, "findOne", async () => ({ id: 6 }));
  t.mock.method(ExamSubject, "count", async () => 1);
  t.mock.method(ExamSubject, "findAll", async () => [{ id: 2, name: "Observasi" }]);
  t.mock.method(ExamAnnouncement, "findOne", async () => null);
  let created;
  t.mock.method(ExamAnnouncement, "create", async (values) => { created = values; });
  const res = response();
  await saveExamResult({
    staff: { schoolId: 3, name: "Guru" },
    body: { applicantId: 7, paymentPackageId: 5, waveId: 6, academicYear: "2026-2027", status: "LULUS", scores: [{ subjectId: 2, score: "90" }] },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(applicant.announcementStatus, "MENUNGGU");
  assert.equal(created.schoolId, 3);
  assert.equal(JSON.parse(created.draft).exam.status, "LULUS");
  assert.match(res.body.message, /draf/i);
});

test("mengubah hasil lama menjadi draf tidak menarik pengumuman yang sudah ada", async (t) => {
  transactionMock(t);
  const applicant = { id: 7, schoolId: 3, currentStep: 4, announcementStatus: "TIDAK_LULUS" };
  const announcement = { applicantId: 7, announcementDate: "2026-10-10", publishedAt: new Date(), async update(values) { Object.assign(this, values); } };
  t.mock.method(Applicant, "findOne", async () => applicant);
  t.mock.method(FeePackage, "findOne", async () => ({ id: 5 }));
  t.mock.method(SpmbWave, "findOne", async () => ({ id: 6 }));
  t.mock.method(ExamSubject, "count", async () => 1);
  t.mock.method(ExamSubject, "findAll", async () => [{ id: 2, name: "Observasi" }]);
  t.mock.method(ExamAnnouncement, "findOne", async () => announcement);
  const res = response();
  await saveExamResult({
    staff: { schoolId: 3, name: "Guru" },
    body: { applicantId: 7, paymentPackageId: 5, waveId: 6, academicYear: "2026-2027", status: "LULUS", scores: [{ subjectId: 2, score: "90" }] },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(applicant.announcementStatus, "TIDAK_LULUS");
  assert.equal(announcement.announcementDate, "2026-10-10");
  assert.equal(JSON.parse(announcement.draft).exam.status, "LULUS");
});

test("TU mengumumkan draf lembaganya dan menerapkan status sekaligus", async (t) => {
  transactionMock(t);
  const draft = { exam: { applicantId: 7, schoolId: 3, status: "LULUS" }, scores: [{ subjectId: 2, subjectName: "Observasi", score: "90" }], paymentPackageId: 5, waveId: 6 };
  const announcement = {
    applicantId: 7, draft: JSON.stringify(draft),
    async update(values) { Object.assign(this, values); },
  };
  const applicant = {
    id: 7, schoolId: 3, announcementStatus: "MENUNGGU", maxUnlockedStep: 4, currentStep: 4,
    async update(values) { Object.assign(this, values); },
  };
  t.mock.method(console, "error", () => {});
  t.mock.method(SpmbWave, "findOne", async () => ({ id: 6, schoolId: 3 }));
  t.mock.method(ExamAnnouncement, "findAll", async (options) => {
    assert.equal(options.where.schoolId, 3);
    return announcement.draft ? [announcement] : [];
  });
  t.mock.method(ExamAnnouncement, "findOne", async (options) => {
    assert.equal(options.where.schoolId, 3);
    return announcement;
  });
  t.mock.method(Applicant, "findOne", async (options) => {
    assert.deepEqual(options.where, { id: 7, schoolId: 3 });
    return applicant;
  });
  t.mock.method(ExamResult, "findOne", async () => null);
  let exam;
  t.mock.method(ExamResult, "create", async (values) => { exam = values; return { id: 11 }; });
  t.mock.method(ExamScore, "destroy", async () => {});
  let scores;
  t.mock.method(ExamScore, "bulkCreate", async (values) => { scores = values; });
  const res = response();
  await publishExamResults({ staff: { schoolId: 3 }, body: { announcementDate: "2026-12-01", waveId: 6 } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.publishedCount, 1);
  assert.equal(res.body.syncFailures, 1);
  assert.equal(exam.status, "LULUS");
  assert.equal(scores[0].examResultId, 11);
  assert.equal(applicant.announcementStatus, "LULUS");
  assert.equal(applicant.currentStep, 5);
  assert.equal(applicant.paymentPackageId, 5);
  assert.equal(announcement.draft, null);
  assert.equal(announcement.announcementDate, "2026-12-01");
  const repeated = response();
  await publishExamResults({ staff: { schoolId: 3 }, body: { announcementDate: "2026-12-01", waveId: 6 } }, repeated);
  assert.equal(repeated.statusCode, 409);
});

test("dashboard orang tua tidak menampilkan status draf yang belum diumumkan", async (t) => {
  t.mock.method(Applicant, "findOne", async () => ({ id: 7, schoolId: 3, announcementStatus: "MENUNGGU", currentStep: 4 }));
  t.mock.method(Bill, "findOne", async () => null);
  t.mock.method(DocumentFile, "findAll", async () => []);
  t.mock.method(ExamSchedule, "findOne", async () => null);
  t.mock.method(ExamAnnouncement, "findOne", async () => ({ draft: JSON.stringify({ exam: { status: "LULUS" } }), announcementDate: "2026-12-01", publishedAt: null }));
  const dashboard = await loadDashboard({ uuid: "test", name: "Wali", role: "ORTU" });
  assert.equal(dashboard.applicant.announcementStatus, "MENUNGGU");
  assert.equal(dashboard.applicant.currentStep, 4);
  assert.equal(dashboard.applicant.announcementDate, null);
  assert.equal(dashboard.applicant.exam, undefined);
});

test("hasil selain lulus tetap di tahap 4 setelah diumumkan", async (t) => {
  transactionMock(t);
  const draft = { exam: { applicantId: 8, schoolId: 3, status: "TIDAK_LULUS" }, scores: [], paymentPackageId: 5, waveId: 6 };
  const announcement = { applicantId: 8, draft: JSON.stringify(draft), async update(values) { Object.assign(this, values); } };
  const applicant = { id: 8, currentStep: 4, maxUnlockedStep: 4, async update(values) { Object.assign(this, values); } };
  t.mock.method(SpmbWave, "findOne", async () => ({ id: 6, schoolId: 3 }));
  t.mock.method(ExamAnnouncement, "findAll", async () => [announcement]);
  t.mock.method(ExamAnnouncement, "findOne", async () => announcement);
  t.mock.method(Applicant, "findOne", async () => applicant);
  t.mock.method(ExamResult, "findOne", async () => null);
  t.mock.method(ExamResult, "create", async () => ({ id: 11 }));
  t.mock.method(ExamScore, "destroy", async () => {});
  t.mock.method(ExamScore, "bulkCreate", async () => {});
  const res = response();
  await publishExamResults({ staff: { schoolId: 3 }, body: { announcementDate: "2026-12-01", waveId: 6 } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(applicant.announcementStatus, "TIDAK_LULUS");
  assert.equal(applicant.currentStep, 4);
});

test("hanya menerbitkan draf gelombang terpilih dan memeriksa ulang gelombang setelah penguncian", async (t) => {
  transactionMock(t);
  const makeDraft = (id, waveId) => JSON.stringify({
    exam: { applicantId: id, schoolId: 3, status: "TIDAK_LULUS" }, scores: [], paymentPackageId: 5, waveId,
  });
  const chosen = { applicantId: 7, draft: makeDraft(7, 6), async update(values) { Object.assign(this, values); } };
  const other = { applicantId: 8, draft: makeDraft(8, 9) };
  const changedBeforeLock = { applicantId: 10, draft: makeDraft(10, 6) };
  const changedAfterLock = { applicantId: 10, draft: makeDraft(10, 9) };
  const lockedIds = [];
  t.mock.method(SpmbWave, "findOne", async ({ where }) => {
    assert.deepEqual(where, { id: 6, schoolId: 3 });
    return { id: 6 };
  });
  t.mock.method(ExamAnnouncement, "findAll", async () => [chosen, other, changedBeforeLock]);
  t.mock.method(ExamAnnouncement, "findOne", async ({ where }) => where.applicantId === 7 ? chosen : changedAfterLock);
  t.mock.method(Applicant, "findOne", async ({ where }) => {
    lockedIds.push(where.id);
    return { id: where.id, currentStep: 4, maxUnlockedStep: 4, async update(values) { Object.assign(this, values); } };
  });
  t.mock.method(ExamResult, "findOne", async () => null);
  t.mock.method(ExamResult, "create", async () => ({ id: 11 }));
  t.mock.method(ExamScore, "destroy", async () => {});
  t.mock.method(ExamScore, "bulkCreate", async () => {});
  const res = response();
  await publishExamResults({ staff: { schoolId: 3 }, body: { announcementDate: "2026-12-01", waveId: 6 } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.publishedCount, 1);
  assert.deepEqual(lockedIds, [7, 10]);
  assert.equal(chosen.draft, null);
  assert.equal(JSON.parse(other.draft).waveId, 9);
  assert.equal(JSON.parse(changedAfterLock.draft).waveId, 9);
});

test("menolak gelombang yang tidak dipilih atau bukan milik lembaga", async (t) => {
  transactionMock(t);
  const missing = response();
  await publishExamResults({ staff: { schoolId: 3 }, body: { announcementDate: "2026-12-01" } }, missing);
  assert.equal(missing.statusCode, 400);
  t.mock.method(SpmbWave, "findOne", async ({ where }) => {
    assert.deepEqual(where, { id: 9, schoolId: 3 });
    return null;
  });
  const foreign = response();
  await publishExamResults({ staff: { schoolId: 3 }, body: { announcementDate: "2026-12-01", waveId: 9 } }, foreign);
  assert.equal(foreign.statusCode, 400);
});

test("gelombang yang digunakan draf tidak dapat dihapus", async (t) => {
  transactionMock(t);
  let destroyed = false;
  let drafts = [{ draft: JSON.stringify({ waveId: 6 }) }];
  t.mock.method(SpmbWave, "findOne", async () => ({ id: 6, async destroy() { destroyed = true; } }));
  t.mock.method(Applicant, "findOne", async () => null);
  t.mock.method(ExamAnnouncement, "findAll", async () => drafts);
  const res = response();
  await deleteWave({ staff: { schoolId: 3 }, params: { id: 6 } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(destroyed, false);
  drafts = [{ draft: JSON.stringify({ waveId: 9 }) }];
  const unused = response();
  await deleteWave({ staff: { schoolId: 3 }, params: { id: 6 } }, unused);
  assert.equal(unused.statusCode, 200);
  assert.equal(destroyed, true);
});

test("penyimpanan draf gagal jika gelombang terhapus sebelum penguncian", async (t) => {
  transactionMock(t);
  let waveReads = 0;
  t.mock.method(Applicant, "findOne", async () => ({ id: 7, schoolId: 3, currentStep: 4 }));
  t.mock.method(FeePackage, "findOne", async () => ({ id: 5 }));
  t.mock.method(SpmbWave, "findOne", async () => (++waveReads === 1 ? { id: 6 } : null));
  t.mock.method(ExamSubject, "count", async () => 1);
  t.mock.method(ExamSubject, "findAll", async () => [{ id: 2, name: "Observasi" }]);
  let created = false;
  t.mock.method(ExamAnnouncement, "create", async () => { created = true; });
  const res = response();
  await saveExamResult({
    staff: { schoolId: 3, name: "Guru" },
    body: { applicantId: 7, paymentPackageId: 5, waveId: 6, academicYear: "2026-2027", status: "LULUS", scores: [{ subjectId: 2, score: "90" }] },
  }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(created, false);
});

test("TU dapat menyiapkan rincian biaya dari draf sebelum pengumuman", async (t) => {
  transactionMock(t);
  const draft = { exam: { academicYear: "2026-2027", status: "LULUS" }, paymentPackageId: 5 };
  const applicant = {
    id: 7, schoolId: 3, announcementStatus: "MENUNGGU", examAnnouncement: { draft: JSON.stringify(draft) },
    toJSON() { return { id: 7, schoolId: 3, studentName: "Siswa", announcementStatus: "MENUNGGU" }; },
  };
  t.mock.method(Applicant, "findOne", async () => applicant);
  t.mock.method(Applicant, "findByPk", async () => applicant);
  t.mock.method(AdmissionPayment, "update", async () => {});
  t.mock.method(AdmissionPayment, "findAll", async () => []);
  t.mock.method(FeePackage, "findOne", async (options) => {
    assert.equal(options.where.id, 5);
    return { id: 5, name: "Paket" };
  });
  t.mock.method(AnnualFeeSetup, "findOne", async (options) => {
    assert.equal(options.where.academicYear, "2026-2027");
    return { id: 9 };
  });
  t.mock.method(AnnualFeeAmount, "findAll", async () => [{ groupId: 2, groupName: "Biaya masuk", amount: 1000 }]);
  t.mock.method(ApplicantFeeAmount, "findAll", async () => []);
  let savedPackage;
  t.mock.method(ApplicantFeeAmount, "findOrCreate", async (options) => {
    savedPackage = options.where.packageId;
    return [{}, true];
  });
  const req = { staff: { schoolId: 3 }, params: { id: 7 }, body: { items: [{ groupId: 2, deductionAmount: 100, oasisAmount: 0 }] } };
  const loaded = response();
  await getApplicantFeeDetails(req, loaded);
  assert.equal(loaded.statusCode, 200);
  assert.equal(loaded.body.academicYear, "2026-2027");
  const saved = response();
  await saveApplicantFeeDetails(req, saved);
  assert.equal(saved.statusCode, 200);
  assert.equal(savedPackage, 5);
  assert.equal(applicant.announcementStatus, "MENUNGGU");
});

test("tanggal tidak valid dan akun selain TU ditolak", async () => {
  const invalid = response();
  await publishExamResults({ staff: { schoolId: 3 }, body: { announcementDate: "2026-02-31" } }, invalid);
  assert.equal(invalid.statusCode, 400);
  const forbidden = response();
  let nextCalled = false;
  requireTu({ staff: { role: "GURU" } }, forbidden, () => { nextCalled = true; });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(nextCalled, false);
});
