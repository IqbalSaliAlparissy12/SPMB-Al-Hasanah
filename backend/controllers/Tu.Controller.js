import { Op } from "sequelize";
import {
  AnnualFeeAmount,
  AnnualFeeSetup,
  Applicant,
  ApplicantFeeAmount,
  AdmissionPayment,
  Bill,
  db,
  DocRequirement,
  DocumentFile,
  ExamResult,
  ExamSchedule,
  FeePackage,
  SpmbStage,
  SpmbWave,
  User,
} from "../models/index.js";

export const STAGE_DEFS = [
  { step: 1, name: "Registrasi" },
  { step: 2, name: "Pembayaran" },
  { step: 3, name: "Isi Data" },
  { step: 4, name: "Ujian dan Wawancara" },
  { step: 5, name: "Surat Keputusan dan Biaya Masuk" },
  { step: 6, name: "Dokumen" },
];

function staffSchoolId(req) {
  return Number(req.staff?.schoolId) || null;
}

function announcementLabel(status) {
  return {
    MENUNGGU: "Menunggu hasil tes",
    LULUS: "Lulus",
    TIDAK_LULUS: "Tidak lulus",
    LULUS_CADANGAN: "Lulus cadangan",
    MENGUNDURKAN_DIRI: "Mengundurkan diri",
  }[status] || "Menunggu hasil tes";
}

export async function ensureStages(schoolId) {
  if (!schoolId) return [];
  const rows = [];
  for (const def of STAGE_DEFS) {
    const [row] = await SpmbStage.findOrCreate({
      where: { schoolId, step: def.step },
      defaults: { schoolId, step: def.step, enabled: true },
    });
    rows.push(row);
  }
  return rows.sort((a, b) => a.step - b.step);
}

export async function isStageOpen(schoolId, step) {
  if (!schoolId) return true;
  await ensureStages(schoolId);
  const row = await SpmbStage.findOne({ where: { schoolId, step } });
  return row ? Boolean(row.enabled) : true;
}

function serializeStages(rows) {
  return STAGE_DEFS.map((def) => {
    const row = rows.find((r) => r.step === def.step);
    return {
      step: def.step,
      name: def.name,
      enabled: row ? Boolean(row.enabled) : true,
    };
  });
}

export async function listPublishedStages(req, res) {
  try {
    const schoolId = Number(req.params.schoolId);
    if (!schoolId) return res.json({ stages: serializeStages([]) });
    const rows = await ensureStages(schoolId);
    return res.json({ stages: serializeStages(rows) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function listStages(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ message: "Akun TU belum terhubung ke lembaga." });
    }
    const rows = await ensureStages(schoolId);
    return res.json({ stages: serializeStages(rows) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function updateStage(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ message: "Akun TU belum terhubung ke lembaga." });
    }
    const step = Number(req.params.step);
    if (step < 1 || step > 6) {
      return res.status(400).json({ message: "Tahap tidak valid." });
    }
    await ensureStages(schoolId);
    const row = await SpmbStage.findOne({ where: { schoolId, step } });
    await row.update({
      enabled: req.body.enabled !== false && req.body.enabled !== "false",
      updatedBy: req.staff.name,
    });
    const rows = await ensureStages(schoolId);
    return res.json({ message: "Tahap diperbarui.", stages: serializeStages(rows) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getExamSchedule(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ message: "Akun TU belum terhubung ke lembaga." });
    }
    const waveId = Number(req.query.waveId);
    if (!Number.isSafeInteger(waveId) || waveId < 1) {
      return res.status(400).json({ message: "Gelombang wajib dipilih." });
    }
    const wave = await SpmbWave.findOne({ where: { id: waveId, schoolId } });
    if (!wave) return res.status(404).json({ message: "Gelombang tidak ditemukan pada lembaga ini." });
    const schedule = await ExamSchedule.findOne({ where: { schoolId, waveId } })
      || await ExamSchedule.findOne({ where: { schoolId, waveId: null } });
    return res.json({
      waveId,
      examDate: schedule?.examDate || "",
      examLocation: schedule?.examLocation || "",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function saveExamSchedule(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ message: "Akun TU belum terhubung ke lembaga." });
    }
    const waveId = Number(req.body.waveId);
    if (!Number.isSafeInteger(waveId) || waveId < 1) {
      return res.status(400).json({ message: "Gelombang wajib dipilih." });
    }
    const wave = await SpmbWave.findOne({ where: { id: waveId, schoolId } });
    if (!wave) return res.status(404).json({ message: "Gelombang tidak ditemukan pada lembaga ini." });
    const examDate = String(req.body.examDate || "").trim();
    const examLocation = String(req.body.examLocation || "").trim();
    if (examDate) {
      const parsedDate = new Date(`${examDate}T00:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(examDate) ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== examDate
      ) {
        return res.status(400).json({ message: "Format tanggal ujian tidak valid." });
      }
    }
    if (examLocation.length > 255) {
      return res.status(400).json({ message: "Lokasi ujian maksimal 255 karakter." });
    }
    const [schedule] = await ExamSchedule.findOrCreate({
      where: { schoolId, waveId },
      defaults: { schoolId, waveId, examDate, examLocation },
    });
    if (schedule.examDate !== examDate || schedule.examLocation !== examLocation) {
      await schedule.update({ examDate, examLocation });
    }
    return res.json({
      message: `Jadwal ujian ${wave.name} diperbarui.`,
      waveId,
      examDate: schedule.examDate || "",
      examLocation: schedule.examLocation || "",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function listApplicants(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ message: "Akun TU belum terhubung ke lembaga." });
    }
    const q = String(req.query.q || "").trim();
    const where = { schoolId };
    if (q) {
      where[Op.or] = [
        { studentName: { [Op.like]: `%${q}%` } },
        { kelasName: { [Op.like]: `%${q}%` } },
      ];
    }
    const rows = await Applicant.findAll({
      where,
      include: [
        { model: User, attributes: ["name", "wa", "username"] },
        { model: Bill, attributes: ["status", "amount", "paidAt", "selectedMethod", "expiresAt"] },
        { model: ExamResult, as: "examResult", attributes: ["academicYear", "status"] },
      ],
      order: [["updatedAt", "DESC"]],
    });
    const applicantIds = rows.map((row) => row.id);
    const [uploadedFiles, documentRequirements] = applicantIds.length
      ? await Promise.all([
          DocumentFile.findAll({
            where: { applicantId: { [Op.in]: applicantIds } },
            attributes: ["id", "applicantId", "kind", "path", "originalName"],
            order: [["updatedAt", "DESC"]],
          }),
          DocRequirement.findAll({ attributes: ["code", "name"] }),
        ])
      : [[], []];
    const documentNames = new Map(documentRequirements.map((item) => [item.code, item.name]));
    const filesByApplicant = new Map();
    for (const file of uploadedFiles) {
      const files = filesByApplicant.get(file.applicantId) || [];
      files.push({
        id: file.id,
        kind: file.kind,
        name: documentNames.get(file.kind) || file.kind,
        path: file.path,
        originalName: file.originalName,
      });
      filesByApplicant.set(file.applicantId, files);
    }
    const packageIds = [...new Set(rows.map((row) => row.paymentPackageId).filter(Boolean))];
    const packages = packageIds.length
      ? await FeePackage.findAll({
          where: { schoolId, id: packageIds },
          attributes: ["id", "name"],
        })
      : [];
    const packageNames = new Map(packages.map((item) => [item.id, item.name]));
    const waveIds = [...new Set(rows.map((row) => row.waveId).filter(Boolean))];
    const waves = waveIds.length
      ? await SpmbWave.findAll({
          where: { schoolId, id: waveIds },
          attributes: ["id", "name"],
        })
      : [];
    const waveNames = new Map(waves.map((item) => [item.id, item.name]));
    return res.json({
      applicants: rows.map((row) => ({
        id: row.id,
        uuid: row.uuid,
        studentName: row.studentName,
        kelasName: row.kelasName,
        isAlumni: row.isAlumni,
        currentStep: row.currentStep,
        maxUnlockedStep: row.maxUnlockedStep,
        announcementStatus: row.announcementStatus,
        announcementLabel: announcementLabel(row.announcementStatus),
        examAcademicYear: row.examResult?.academicYear || null,
        examStatus: row.examResult?.status || null,
        parentName: row.user?.name,
        parentWa: row.user?.wa,
        parentUsername: row.user?.username,
        paymentPackageName: packageNames.get(row.paymentPackageId) || null,
        waveName: waveNames.get(row.waveId) || null,
        billStatus: row.bill?.status || "UNPAID",
        billAmount: row.bill?.amount ?? null,
        billPaidAt: row.bill?.paidAt || null,
        billMethod: row.bill?.selectedMethod || null,
        billExpiresAt: row.bill?.expiresAt || null,
        documents: filesByApplicant.get(row.id) || [],
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

function isRegistrationFeeGroup(name) {
  const normalized = String(name || "").trim().toLocaleLowerCase("id-ID");
  return ["biaya pendaftaran", "bayar uang pendaftaran"].includes(normalized);
}

async function loadApplicantFeeDetails(applicant, transaction) {
  await AdmissionPayment.update(
    { status: "EXPIRED" },
    {
      where: {
        applicantId: applicant.id,
        status: "PENDING",
        expiresAt: { [Op.lte]: new Date() },
      },
      transaction,
    }
  );
  const examResult = applicant.examResult || await ExamResult.findOne({
    where: { applicantId: applicant.id, schoolId: applicant.schoolId },
    transaction,
  });
  if (!examResult) {
    const error = new Error("Hasil tes belum disimpan untuk calon siswa ini.");
    error.status = 409;
    throw error;
  }
  if (!applicant.paymentPackageId) {
    const error = new Error("Paket pembayaran belum dipilih pada form hasil tes.");
    error.status = 409;
    throw error;
  }

  const [paymentPackage, setup] = await Promise.all([
    FeePackage.findOne({
      where: { id: applicant.paymentPackageId, schoolId: applicant.schoolId },
      transaction,
    }),
    AnnualFeeSetup.findOne({
      where: { schoolId: applicant.schoolId, academicYear: examResult.academicYear },
      transaction,
    }),
  ]);
  if (!paymentPackage) {
    const error = new Error("Paket pembayaran yang dipilih tidak lagi tersedia.");
    error.status = 409;
    throw error;
  }
  if (!setup) {
    const error = new Error(`Setup tahunan ${examResult.academicYear} belum dibuat.`);
    error.status = 409;
    throw error;
  }

  const [globalAmounts, overrides] = await Promise.all([
    AnnualFeeAmount.findAll({
      where: { setupId: setup.id, packageId: paymentPackage.id },
      order: [["groupName", "ASC"]],
      transaction,
    }),
    ApplicantFeeAmount.findAll({
      where: { applicantId: applicant.id, setupId: setup.id, packageId: paymentPackage.id },
      transaction,
    }),
  ]);
  const admissionAmounts = globalAmounts.filter((item) => !isRegistrationFeeGroup(item.groupName));
  if (!admissionAmounts.length) {
    const error = new Error(`Belum ada rincian biaya masuk untuk paket "${paymentPackage.name}" pada setup tahunan ${examResult.academicYear}.`);
    error.status = 409;
    throw error;
  }
  const overrideByGroup = new Map(overrides.map((item) => [item.groupId, item]));
  const items = admissionAmounts.map((item) => {
    const override = overrideByGroup.get(item.groupId);
    const globalAmount = Number(item.amount) || 0;
    const deductionAmount = override?.deductionAmount == null
      ? Math.max(0, globalAmount - (Number(override?.amount) || globalAmount))
      : Number(override.deductionAmount) || 0;
    const oasisAmount = Number(override?.oasisAmount) || 0;
    return {
      groupId: item.groupId,
      name: item.groupName,
      globalAmount,
      deductionAmount,
      oasisAmount,
      description: override?.description || "",
      amount: Math.max(0, globalAmount - deductionAmount) + oasisAmount,
      customized: Boolean(override),
    };
  });
  const payments = await AdmissionPayment.findAll({
    where: { applicantId: applicant.id },
    order: [["createdAt", "DESC"]],
    transaction,
  });
  const paidAmount = payments
    .filter((item) => item.status === "PAID")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const pendingAmount = payments
    .filter((item) => item.status === "PENDING")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const totalAmount = items.reduce((total, item) => total + item.amount, 0);
  return {
    applicant: {
      id: applicant.id,
      studentName: applicant.studentName,
      parentName: applicant.user?.name || null,
      kelasName: applicant.kelasName || null,
    },
    packageName: paymentPackage.name,
    academicYear: examResult.academicYear,
    items,
    totalAmount,
    paidAmount,
    pendingAmount,
    remainingAmount: Math.max(0, totalAmount - paidAmount),
    payments: payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      virtualAccount: payment.virtualAccount || null,
      expiresAt: payment.expiresAt || null,
      paidAt: payment.paidAt || null,
      createdAt: payment.createdAt,
      recordedBy: payment.recordedBy || null,
      note: payment.note || null,
    })),
  };
}

async function findApplicantForFeeDetails(req) {
  const schoolId = staffSchoolId(req);
  if (!schoolId) {
    const error = new Error("Akun TU belum terhubung ke lembaga.");
    error.status = 400;
    throw error;
  }
  const applicant = await Applicant.findOne({
    where: { id: req.params.id, schoolId },
    include: [
      { model: User, attributes: ["name"] },
      { model: ExamResult, as: "examResult" },
    ],
  });
  if (!applicant) {
    const error = new Error("Calon siswa tidak ditemukan pada lembaga ini.");
    error.status = 404;
    throw error;
  }
  return applicant;
}

export async function getApplicantFeeDetails(req, res) {
  try {
    const applicant = await findApplicantForFeeDetails(req);
    return res.json(await loadApplicantFeeDetails(applicant));
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
}

export async function recordAdmissionPayment(req, res) {
  try {
    const applicant = await findApplicantForFeeDetails(req);
    if (applicant.announcementStatus !== "LULUS") {
      return res.status(409).json({ message: "Pembayaran biaya masuk hanya dapat dicatat untuk calon siswa yang dinyatakan lulus." });
    }
    const amount = Number(req.body?.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647) {
      return res.status(400).json({ message: "Nominal pembayaran harus berupa bilangan bulat lebih dari Rp0." });
    }

    const saved = await db.transaction(async (transaction) => {
      await Applicant.findByPk(applicant.id, { transaction, lock: transaction.LOCK.UPDATE });
      const current = await loadApplicantFeeDetails(applicant, transaction);
      const pending = current.payments.find(
        (payment) => payment.status === "PENDING" && (!payment.expiresAt || new Date(payment.expiresAt) > new Date())
      );
      if (pending) {
        const error = new Error("Masih ada pembayaran online yang menunggu konfirmasi; pembayaran manual belum dapat dicatat.");
        error.status = 409;
        throw error;
      }
      if (amount > current.remainingAmount) {
        const error = new Error(`Nominal melebihi sisa tagihan ${current.remainingAmount.toLocaleString("id-ID")}.`);
        error.status = 400;
        throw error;
      }
      await AdmissionPayment.create({
        applicantId: applicant.id,
        amount,
        method: "MANUAL",
        status: "PAID",
        paidAt: new Date(),
        recordedBy: req.staff.name || "TU",
      }, { transaction });
      return loadApplicantFeeDetails(applicant, transaction);
    });
    return res.json({ message: "Pembayaran biaya masuk berhasil dicatat.", ...saved });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
}

export async function saveApplicantFeeDetails(req, res) {
  try {
    const applicant = await findApplicantForFeeDetails(req);
    const requested = req.body?.items;
    if (!Array.isArray(requested) || requested.length === 0) {
      return res.status(400).json({ message: "Rincian nominal tagihan wajib diisi." });
    }

    const saved = await db.transaction(async (transaction) => {
      await Applicant.findByPk(applicant.id, { transaction, lock: transaction.LOCK.UPDATE });
      const current = await loadApplicantFeeDetails(applicant, transaction);
      const activePending = current.payments.find(
        (payment) => payment.status === "PENDING" && (!payment.expiresAt || new Date(payment.expiresAt) > new Date())
      );
      if (activePending) {
        const error = new Error("Rincian tagihan tidak dapat diubah saat pembayaran online menunggu konfirmasi.");
        error.status = 409;
        throw error;
      }
      const allowedIds = new Set(current.items.map((item) => item.groupId));
      const submitted = new Map();
      for (const item of requested) {
        if (!item || typeof item !== "object") {
          const error = new Error("Format rincian biaya tidak valid.");
          error.status = 400;
          throw error;
        }
        const groupId = Number(item.groupId);
        const feeItem = current.items.find((fee) => fee.groupId === groupId);
        if (!Number.isSafeInteger(groupId) || !allowedIds.has(groupId) || submitted.has(groupId)) {
          const error = new Error("Rincian grup biaya tidak valid atau terduplikasi.");
          error.status = 400;
          throw error;
        }
        const deductionAmount = item.deductionAmount == null
          ? feeItem.deductionAmount
          : item.deductionAmount;
        const oasisAmount = item.oasisAmount == null
          ? feeItem.oasisAmount
          : item.oasisAmount;
        if (!Number.isSafeInteger(deductionAmount) || deductionAmount < 0 || deductionAmount > feeItem.globalAmount) {
          const error = new Error("Nominal pengurang harus berupa bilangan bulat dari Rp0 sampai nominal global.");
          error.status = 400;
          throw error;
        }
        const amountBeforeOasis = feeItem.globalAmount - deductionAmount;
        if (!Number.isSafeInteger(oasisAmount) || oasisAmount < 0 || oasisAmount > 2147483647 - amountBeforeOasis) {
          const error = new Error("Nominal penambahan Oasis harus berupa bilangan bulat nol atau lebih.");
          error.status = 400;
          throw error;
        }
        const description = String(item.description || "").trim();
        if (description.length > 2000) {
          const error = new Error("Keterangan maksimal 2.000 karakter.");
          error.status = 400;
          throw error;
        }
        submitted.set(groupId, { deductionAmount, oasisAmount, description });
      }
      if (submitted.size !== allowedIds.size) {
        const error = new Error("Semua rincian tagihan wajib disertakan.");
        error.status = 400;
        throw error;
      }
      const updatedTotal = current.items.reduce((sum, feeItem) => {
        const entry = submitted.get(feeItem.groupId);
        return sum + feeItem.globalAmount - entry.deductionAmount + entry.oasisAmount;
      }, 0);
      if (updatedTotal < current.paidAmount) {
        const error = new Error("Total tagihan baru tidak boleh lebih kecil daripada pembayaran yang sudah diterima.");
        error.status = 400;
        throw error;
      }

      const setup = await AnnualFeeSetup.findOne({
        where: { schoolId: applicant.schoolId, academicYear: current.academicYear },
        transaction,
      });
      for (const [groupId, { deductionAmount, oasisAmount, description }] of submitted) {
        const feeItem = current.items.find((item) => item.groupId === groupId);
        const amount = feeItem.globalAmount - deductionAmount + oasisAmount;
        const [row, created] = await ApplicantFeeAmount.findOrCreate({
          where: {
            applicantId: applicant.id,
            setupId: setup.id,
            packageId: applicant.paymentPackageId,
            groupId,
          },
          defaults: { amount, deductionAmount, oasisAmount, description },
          transaction,
        });
        if (!created) await row.update({ amount, deductionAmount, oasisAmount, description }, { transaction });
      }
      return loadApplicantFeeDetails(applicant, transaction);
    });
    return res.json({ message: "Rincian tagihan siswa berhasil diperbarui.", ...saved });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
}

export async function controlApplicant(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ message: "Akun TU belum terhubung ke lembaga." });
    }
    const applicant = await Applicant.findOne({
      where: { id: req.params.id, schoolId },
      include: [{ model: User }, { model: Bill }],
    });
    if (!applicant) return res.status(404).json({ message: "Pendaftar tidak ditemukan." });

    if (req.body.announcementStatus != null) {
      return res.status(400).json({ message: "Status kelulusan ditetapkan melalui form hasil tes." });
    }

    const patch = {};
    if (req.body.maxUnlockedStep != null) {
      const max = Math.min(6, Math.max(1, Number(req.body.maxUnlockedStep)));
      if (max >= 5 && applicant.announcementStatus !== "LULUS") {
        return res.status(403).json({ message: "Tahap 5 hanya terbuka setelah hasil tes menyatakan siswa lulus." });
      }
      patch.maxUnlockedStep = max;
      if (applicant.currentStep > max) patch.currentStep = max;
    }
    if (req.body.currentStep != null) {
      const step = Math.min(6, Math.max(1, Number(req.body.currentStep)));
      if (step >= 5 && applicant.announcementStatus !== "LULUS") {
        return res.status(403).json({ message: "Tahap 5 hanya terbuka setelah hasil tes menyatakan siswa lulus." });
      }
      patch.currentStep = step;
      patch.maxUnlockedStep = Math.max(applicant.maxUnlockedStep, step, patch.maxUnlockedStep || 0);
    }
    await applicant.update(patch);

    if (req.body.markPaid && applicant.bill && applicant.bill.status !== "PAID") {
      await applicant.bill.update({ status: "PAID", paidAt: new Date() });
      await applicant.update({
        maxUnlockedStep: Math.max(applicant.maxUnlockedStep, 3),
      });
    }

    return res.json({ message: "Pendaftar diperbarui." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
