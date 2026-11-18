import { Op } from "sequelize";
import {
  Applicant,
  AnnualFeeAmount,
  AnnualFeeSetup,
  ApplicantFeeAmount,
  AdmissionPayment,
  db,
  ExamAnnouncement,
  ExamResult,
  ExamScore,
  ExamSubject,
  FeePackage,
  SpmbWave,
  User,
} from "../models/index.js";
import { currentAcademicYear } from "./FeeSetup.Controller.js";
import { tryPushIfAccepted } from "../services/amanahSync.js";

const DEFAULT_SUBJECTS = ["OBSERVASI SISWA", "WAWANCARA ORANGTUA"];
const EXAM_STATUSES = {
  LULUS: "Lulus",
  TIDAK_LULUS: "Tidak Lulus",
  LULUS_CADANGAN: "Lulus Cadangan",
  MENGUNDURKAN_DIRI: "Mengundurkan Diri",
};

function staffSchoolId(req) {
  return Number(req.staff?.schoolId) || null;
}

async function ensureSubjects(schoolId) {
  const count = await ExamSubject.count({ where: { schoolId } });
  if (count > 0) return;
  await ExamSubject.bulkCreate(
    DEFAULT_SUBJECTS.map((name, index) => ({ schoolId, name, sortOrder: index + 1 }))
  );
}

function serializeSubject(row) {
  return { id: row.id, name: row.name, sortOrder: row.sortOrder };
}

function serializeExam(row) {
  if (!row) return null;
  const saved = row.scores || [];
  return {
    id: row.id,
    applicantId: row.applicantId,
    academicYear: row.academicYear,
    examinerName: row.examinerName,
    status: row.status,
    note: row.note || "",
    scores: saved.map((item) => ({
      subjectId: item.subjectId,
      subjectName: item.subjectName,
      score: item.score || "",
      note: item.note || "",
    })),
    updatedAt: row.updatedAt,
  };
}

export async function listExamCandidates(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ message: "Akun belum terhubung ke lembaga." });
    }
    await ensureSubjects(schoolId);
    const [rows, subjects, packages, waves, announcements] = await Promise.all([
      Applicant.findAll({
        where: { schoolId },
        include: [
          { model: ExamResult, as: "examResult", include: [{ model: ExamScore, as: "scores" }] },
        ],
        order: [["studentName", "ASC"]],
      }),
      ExamSubject.findAll({ where: { schoolId }, order: [["sortOrder", "ASC"], ["id", "ASC"]] }),
      FeePackage.findAll({
        where: { schoolId },
        attributes: ["id", "name", "kelasId", "studentType"],
        order: [["name", "ASC"]],
      }),
      SpmbWave.findAll({
        where: { schoolId },
        attributes: ["id", "name"],
        order: [["sortOrder", "ASC"], ["name", "ASC"]],
      }),
      ExamAnnouncement.findAll({ where: { schoolId } }),
    ]);
    const announcementsByApplicant = new Map(announcements.map((item) => [item.applicantId, item]));
    const draftFor = (row) => {
      const announcement = announcementsByApplicant.get(row.id);
      return announcement?.draft ? JSON.parse(announcement.draft) : null;
    };
    const ready = rows.filter(
      (row) => row.formSubmittedAt || Number(row.currentStep) === 4 || row.examResult || draftFor(row)
    );
    const applicantIds = ready.map((row) => row.id);
    if (applicantIds.length) {
      await AdmissionPayment.update(
        { status: "EXPIRED" },
        {
          where: {
            applicantId: { [Op.in]: applicantIds },
            status: "PENDING",
            expiresAt: { [Op.lte]: new Date() },
          },
        }
      );
    }
    const admissionPayments = applicantIds.length
      ? await AdmissionPayment.findAll({
          where: { applicantId: { [Op.in]: applicantIds } },
          order: [["createdAt", "DESC"]],
        })
      : [];
    const paymentsByApplicant = new Map();
    for (const payment of admissionPayments) {
      const payments = paymentsByApplicant.get(payment.applicantId) || [];
      payments.push(payment);
      paymentsByApplicant.set(payment.applicantId, payments);
    }
    const feeDraftFor = (row) => row.announcementStatus === "MENUNGGU" ? draftFor(row) : null;
    const feePackageFor = (row) => feeDraftFor(row)?.paymentPackageId || row.paymentPackageId;
    const feeYearFor = (row) => feeDraftFor(row)?.exam.academicYear || row.examResult?.academicYear || currentAcademicYear();
    const feeCandidates = ready.filter((row) => feePackageFor(row));
    const academicYears = [...new Set(feeCandidates.map(feeYearFor))];
    const packageIds = [...new Set(feeCandidates.map(feePackageFor))];
    const setups = academicYears.length && packageIds.length
      ? await AnnualFeeSetup.findAll({ where: { schoolId, academicYear: { [Op.in]: academicYears } } })
      : [];
    const setupIds = setups.map((item) => item.id);
    const [annualAmounts, overrides] = setupIds.length
      ? await Promise.all([
          AnnualFeeAmount.findAll({
            where: { setupId: { [Op.in]: setupIds }, packageId: { [Op.in]: packageIds } },
          }),
          ApplicantFeeAmount.findAll({
            where: {
              applicantId: { [Op.in]: feeCandidates.map((row) => row.id) },
              setupId: { [Op.in]: setupIds },
              packageId: { [Op.in]: packageIds },
            },
          }),
        ])
      : [[], []];
    const setupByYear = new Map(setups.map((item) => [item.academicYear, item]));
    const feesBySetupAndPackage = new Map();
    for (const item of annualAmounts) {
      const key = `${item.setupId}:${item.packageId}`;
      const amounts = feesBySetupAndPackage.get(key) || [];
      amounts.push(item);
      feesBySetupAndPackage.set(key, amounts);
    }
    const overridesByApplicantSetupPackage = new Map();
    for (const item of overrides) {
      const key = `${item.applicantId}:${item.setupId}:${item.packageId}`;
      const applicantOverrides = overridesByApplicantSetupPackage.get(key) || new Map();
      applicantOverrides.set(item.groupId, item);
      overridesByApplicantSetupPackage.set(key, applicantOverrides);
    }
    const packagesById = new Map(packages.map((item) => [item.id, item]));
    const paymentSummaryFor = (row, totalAmount) => {
      const payments = paymentsByApplicant.get(row.id) || [];
      const paidAmount = payments
        .filter((payment) => payment.status === "PAID")
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const pendingAmount = payments
        .filter((payment) => payment.status === "PENDING")
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const remainingAmount = totalAmount == null ? null : Math.max(0, totalAmount - paidAmount);
      const status = remainingAmount == null
        ? null
        : remainingAmount === 0
          ? "PAID"
          : pendingAmount > 0
            ? "PENDING"
            : paidAmount > 0
              ? "PARTIAL"
              : "UNPAID";
      return { paidAmount, pendingAmount, remainingAmount, status };
    };
    const admissionTotalFor = (row) => {
      const packageId = feePackageFor(row);
      if (!packageId) return null;
      const academicYear = feeYearFor(row);
      const setup = setupByYear.get(academicYear);
      if (!setup) return null;
      const amounts = feesBySetupAndPackage.get(`${setup.id}:${packageId}`) || [];
      const admissionAmounts = amounts.filter((item) => {
        const name = String(item.groupName || "").trim().toLocaleLowerCase("id-ID");
        return !["biaya pendaftaran", "bayar uang pendaftaran"].includes(name);
      });
      if (!admissionAmounts.length) return null;
      const applicantOverrides = overridesByApplicantSetupPackage.get(`${row.id}:${setup.id}:${packageId}`);
      return admissionAmounts.reduce((total, item) => {
        const globalAmount = Number(item.amount) || 0;
        const override = applicantOverrides?.get(item.groupId);
        const deductionAmount = !override
          ? 0
          : override.deductionAmount == null
            ? Math.max(0, globalAmount - (Number(override.amount) || globalAmount))
            : Number(override.deductionAmount) || 0;
        const oasisAmount = Number(override?.oasisAmount) || 0;
        return total + Math.max(0, globalAmount - deductionAmount) + oasisAmount;
      }, 0);
    };
    return res.json({
      schoolName: req.staff.schoolName || "",
      subjects: subjects.map(serializeSubject),
      packages,
      waves,
      applicants: ready.map((row) => {
        const draft = draftFor(row);
        const announcement = announcementsByApplicant.get(row.id);
        const paymentTotalAmount = admissionTotalFor(row);
        const paymentSummary = paymentSummaryFor(row, paymentTotalAmount);
        return {
          id: row.id,
          studentName: row.studentName,
          examNumber: row.examNumber,
          kelasId: row.kelasId,
          kelasName: row.kelasName,
          isAlumni: row.isAlumni,
          paymentPackageId: draft?.paymentPackageId || row.paymentPackageId,
          waveId: draft?.waveId || row.waveId,
          schoolTarget: row.schoolTarget,
          currentStep: row.currentStep,
          exam: draft ? { ...draft.exam, scores: draft.scores, updatedAt: announcement.updatedAt } : serializeExam(row.examResult),
          announcementPending: Boolean(draft),
          announcementDate: announcement?.announcementDate || null,
          paymentPackageName: packagesById.get(feePackageFor(row))?.name || null,
          draftPaymentPackageName: draft ? packagesById.get(draft.paymentPackageId)?.name || null : null,
          paymentAcademicYear: feeYearFor(row),
          paymentTotalAmount,
          paymentPaidAmount: paymentSummary.paidAmount,
          paymentPendingAmount: paymentSummary.pendingAmount,
          paymentRemainingAmount: paymentSummary.remainingAmount,
          paymentStatus: paymentSummary.status,
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function applyExamStatus(applicant, status, transaction) {
  if (status === "LULUS") {
    const patch = {
      announcementStatus: "LULUS",
      maxUnlockedStep: Math.max(applicant.maxUnlockedStep, 5),
    };
    if (Number(applicant.currentStep) === 4) patch.currentStep = 5;
    await applicant.update(patch, { transaction });
    return;
  }

  const patch = { announcementStatus: status };
  if (applicant.maxUnlockedStep > 4) patch.maxUnlockedStep = 4;
  if (applicant.currentStep > 4) patch.currentStep = 4;
  await applicant.update(patch, { transaction });
}

export async function saveExamResult(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ message: "Akun belum terhubung ke lembaga." });
    }

    const applicantId = Number(req.body.applicantId);
    const paymentPackageId = Number(req.body.paymentPackageId);
    const waveId = Number(req.body.waveId);
    const academicYear = String(req.body.academicYear || "").trim();
    const status = Object.hasOwn(EXAM_STATUSES, req.body.status) ? req.body.status : "";
    if (!applicantId || !paymentPackageId || !waveId || !academicYear || !status) {
      return res.status(400).json({ message: "Nama siswa, paket pembayaran, gelombang, tahun pelajaran, dan status kelulusan wajib diisi." });
    }

    const applicant = await Applicant.findOne({
      where: { id: applicantId, schoolId },
      include: [{ model: User }],
    });
    if (!applicant) {
      return res.status(404).json({ message: "Pendaftar tidak ditemukan di unit ini." });
    }
    const paymentPackage = await FeePackage.findOne({
      where: { id: paymentPackageId, schoolId },
    });
    if (!paymentPackage) {
      return res.status(400).json({ message: "Paket pembayaran tidak ditemukan pada lembaga ini." });
    }
    const wave = await SpmbWave.findOne({ where: { id: waveId, schoolId } });
    if (!wave) {
      return res.status(400).json({ message: "Gelombang tidak ditemukan pada lembaga ini." });
    }

    await ensureSubjects(schoolId);
    const subjects = await ExamSubject.findAll({ where: { schoolId } });
    const allowed = new Map(subjects.map((item) => [item.id, item]));
    const incoming = Array.isArray(req.body.scores) ? req.body.scores : [];
    const incomingBySubject = new Map();
    for (const item of incoming) {
      const subject = allowed.get(Number(item.subjectId));
      if (subject) incomingBySubject.set(subject.id, item);
    }
    const scoreRows = subjects.map((subject) => {
      const item = incomingBySubject.get(subject.id);
      return {
        subjectId: subject.id,
        subjectName: subject.name,
        score: String(item?.score ?? "").trim(),
        note: String(item?.note ?? "").trim(),
      };
    });
    if (scoreRows.some((item) => !item.score)) {
      return res.status(400).json({ message: "Nilai untuk semua penilaian wajib diisi sebelum hasil tes disimpan." });
    }

    const payload = {
      applicantId: applicant.id,
      schoolId,
      academicYear,
      examinerName: req.staff.name,
      examinerAmanahUserId: req.staff.amanahUserId || null,
      status,
      note: String(req.body.note || "").trim(),
    };

    const saved = await db.transaction(async (transaction) => {
      const lockedWave = await SpmbWave.findOne({
        where: { id: waveId, schoolId }, transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!lockedWave) {
        const error = new Error("Gelombang tidak ditemukan pada lembaga ini.");
        error.status = 400;
        throw error;
      }
      const lockedApplicant = await Applicant.findOne({
        where: { id: applicantId, schoolId }, transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!lockedApplicant || Number(lockedApplicant.currentStep) !== 4) return false;
      const draft = JSON.stringify({ exam: payload, scores: scoreRows, paymentPackageId, waveId });
      const announcement = await ExamAnnouncement.findOne({ where: { applicantId }, transaction, lock: transaction.LOCK.UPDATE });
      if (announcement) await announcement.update({ draft }, { transaction });
      else await ExamAnnouncement.create({ applicantId, schoolId, draft }, { transaction });
      return true;
    });
    if (!saved) {
      return res.status(409).json({ message: "Hasil tes hanya dapat diisi setelah pendaftar masuk tahap Ujian dan Wawancara." });
    }

    return res.json({
      message: `Hasil tes disimpan sebagai draf. Status: ${EXAM_STATUSES[status]}. Menunggu pengumuman TU.`,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
}

export async function publishExamResults(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    if (!schoolId) return res.status(400).json({ message: "Akun TU belum terhubung ke lembaga." });
    const date = typeof req.body.announcementDate === "string" ? req.body.announcementDate : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) ||
        new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
      return res.status(400).json({ message: "Tanggal pengumuman tidak valid." });
    }
    const waveId = Number(req.body.waveId);
    if (!Number.isSafeInteger(waveId) || waveId <= 0) {
      return res.status(400).json({ message: "Pilih gelombang pengumuman." });
    }
    const published = await db.transaction(async (transaction) => {
      const wave = await SpmbWave.findOne({
        where: { id: waveId, schoolId }, transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!wave) {
        const error = new Error("Gelombang tidak ditemukan pada lembaga ini.");
        error.status = 400;
        throw error;
      }
      const pending = await ExamAnnouncement.findAll({
        where: { schoolId, draft: { [Op.ne]: null } }, order: [["applicantId", "ASC"]], transaction,
      });
      const released = [];
      for (const entry of pending) {
        if (Number(JSON.parse(entry.draft).waveId) !== waveId) continue;
        const applicant = await Applicant.findOne({
          where: { id: entry.applicantId, schoolId }, include: [{ model: User }],
          transaction, lock: transaction.LOCK.UPDATE,
        });
        if (!applicant) throw new Error("Pendaftar untuk draf hasil tes tidak ditemukan di lembaga ini.");
        const announcement = await ExamAnnouncement.findOne({
          where: { applicantId: applicant.id, schoolId }, transaction, lock: transaction.LOCK.UPDATE,
        });
        if (!announcement?.draft) continue;
        const draft = JSON.parse(announcement.draft);
        if (Number(draft.waveId) !== waveId) continue;
        const existing = await ExamResult.findOne({ where: { applicantId: applicant.id }, transaction });
        const exam = existing
          ? await existing.update(draft.exam, { transaction })
          : await ExamResult.create(draft.exam, { transaction });
        await ExamScore.destroy({ where: { examResultId: exam.id }, transaction });
        await ExamScore.bulkCreate(draft.scores.map((score) => ({ ...score, examResultId: exam.id })), { transaction });
        await applicant.update({ paymentPackageId: draft.paymentPackageId, waveId: draft.waveId }, { transaction });
        await applyExamStatus(applicant, draft.exam.status, transaction);
        await announcement.update({ draft: null, announcementDate: date, publishedAt: new Date() }, { transaction });
        released.push(applicant);
      }
      return released;
    });
    if (!published.length) return res.status(409).json({ message: "Tidak ada draf hasil tes pada gelombang ini untuk diumumkan." });
    let syncFailures = 0;
    for (const applicant of published) {
      if (applicant.announcementStatus !== "LULUS") continue;
      if (!applicant.user) {
        console.error(`Gagal menyinkronkan pendaftar ${applicant.id}: akun orang tua tidak ditemukan.`);
        syncFailures += 1;
        continue;
      }
      try {
        const result = await tryPushIfAccepted(applicant, applicant.user);
        if (!result.ok) syncFailures += 1;
      } catch (error) {
        console.error("Gagal menyinkronkan siswa setelah pengumuman:", error);
        syncFailures += 1;
      }
    }
    return res.json({
      message: `${published.length} hasil tes diumumkan.${syncFailures ? ` Sinkronisasi Amanah gagal untuk ${syncFailures} siswa; periksa log sinkronisasi.` : ""}`,
      publishedCount: published.length,
      syncFailures,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
}

export async function listSubjects(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    if (!schoolId) return res.status(400).json({ message: "Akun belum terhubung ke lembaga." });
    await ensureSubjects(schoolId);
    const rows = await ExamSubject.findAll({
      where: { schoolId },
      order: [["sortOrder", "ASC"], ["id", "ASC"]],
    });
    return res.json({ subjects: rows.map(serializeSubject) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function createSubject(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    if (!schoolId) return res.status(400).json({ message: "Akun belum terhubung ke lembaga." });
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Nama mata pelajaran wajib diisi." });
    const last = await ExamSubject.max("sortOrder", { where: { schoolId } });
    const row = await ExamSubject.create({
      schoolId,
      name,
      sortOrder: (Number(last) || 0) + 1,
    });
    return res.status(201).json({ message: "Mata pelajaran ditambahkan.", subject: serializeSubject(row) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function updateSubject(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    if (!schoolId) return res.status(400).json({ message: "Akun belum terhubung ke lembaga." });
    const row = await ExamSubject.findOne({ where: { id: req.params.id, schoolId } });
    if (!row) return res.status(404).json({ message: "Mata pelajaran tidak ditemukan." });
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Nama mata pelajaran wajib diisi." });
    await row.update({ name });
    return res.json({ message: "Mata pelajaran diperbarui.", subject: serializeSubject(row) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function deleteSubject(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    if (!schoolId) return res.status(400).json({ message: "Akun belum terhubung ke lembaga." });
    const row = await ExamSubject.findOne({ where: { id: req.params.id, schoolId } });
    if (!row) return res.status(404).json({ message: "Mata pelajaran tidak ditemukan." });
    await row.destroy();
    return res.json({ message: "Mata pelajaran dihapus." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
