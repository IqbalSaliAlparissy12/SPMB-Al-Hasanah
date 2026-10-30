import { Op } from "sequelize";
import { Applicant, Bill, SpmbStage, User } from "../models/index.js";
import { tryPushIfAccepted } from "../services/amanahSync.js";

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
        { model: Bill, attributes: ["status", "amount", "paidAt"] },
      ],
      order: [["updatedAt", "DESC"]],
    });
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
        announcementLabel: row.announcementStatus === "LULUS" ? "Sudah lulus" : "Belum lulus",
        parentName: row.user?.name,
        parentWa: row.user?.wa,
        parentUsername: row.user?.username,
        billStatus: row.bill?.status || "UNPAID",
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
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

    const patch = {};
    if (req.body.maxUnlockedStep != null) {
      const max = Math.min(6, Math.max(1, Number(req.body.maxUnlockedStep)));
      patch.maxUnlockedStep = max;
      if (applicant.currentStep > max) patch.currentStep = max;
    }
    if (req.body.currentStep != null) {
      const step = Math.min(6, Math.max(1, Number(req.body.currentStep)));
      patch.currentStep = step;
      patch.maxUnlockedStep = Math.max(applicant.maxUnlockedStep, step, patch.maxUnlockedStep || 0);
    }
    if (req.body.announcementStatus && req.body.currentStep == null) {
      const status = ["MENUNGGU", "LULUS", "TIDAK_LULUS"].includes(req.body.announcementStatus)
        ? req.body.announcementStatus
        : null;
      if (status === "LULUS") {
        patch.announcementStatus = status;
        patch.currentStep = Math.max(applicant.currentStep, 5);
        patch.maxUnlockedStep = Math.max(applicant.maxUnlockedStep, 5);
      } else if (status === "TIDAK_LULUS") {
        patch.announcementStatus = status;
        patch.currentStep = Math.min(applicant.currentStep, 4);
        patch.maxUnlockedStep = Math.min(applicant.maxUnlockedStep, 4);
      } else if (status) {
        patch.announcementStatus = status;
      }
    }

    await applicant.update(patch);

    if (req.body.markPaid && applicant.bill && applicant.bill.status !== "PAID") {
      await applicant.bill.update({ status: "PAID", paidAt: new Date() });
      await applicant.update({
        maxUnlockedStep: Math.max(applicant.maxUnlockedStep, 3),
      });
    }

    if (patch.announcementStatus === "LULUS" && applicant.user) {
      await tryPushIfAccepted(applicant, applicant.user);
    }

    return res.json({ message: "Pendaftar diperbarui." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
