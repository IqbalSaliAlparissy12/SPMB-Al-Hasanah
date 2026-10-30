import { Applicant, Bill } from "../models/index.js";
import { generateExamNumber } from "../utils/va.js";
import { loadDashboard } from "./Auth.Controller.js";
import { pullByNisn } from "../services/amanahSync.js";
import { getAmanahSchoolById } from "../services/amanahSchools.js";
import { getSpmbClassById } from "./SpmbClass.Controller.js";
import { isStageOpen } from "./Tu.Controller.js";

function parseAlumni(value) {
  if (value === true || value === "true" || value === "YA" || value === "ya") return true;
  if (value === false || value === "false" || value === "TIDAK" || value === "tidak") return false;
  return null;
}

function requiredFilled(body) {
  const keys = [
    "studentName",
    "nik",
    "gender",
    "schoolId",
    "kelasId",
    "previousSchool",
    "fatherName",
    "fatherJob",
    "motherName",
    "motherJob",
    "address",
  ];
  return keys.filter((k) => !String(body[k] || "").trim());
}

export async function updateForm(req, res) {
  try {
    const applicant = await Applicant.findOne({ where: { userId: req.user.id } });
    if (!applicant) return res.status(404).json({ message: "Data pendaftar tidak ditemukan." });

    const bill = await Bill.findOne({ where: { applicantId: applicant.id } });
    if (!bill || bill.status !== "PAID") {
      return res.status(403).json({ message: "Isi formulir dibuka setelah pembayaran lunas." });
    }

    const missing = requiredFilled(req.body);
    if (missing.length) {
      return res.status(400).json({ message: `Lengkapi field: ${missing.join(", ")}` });
    }

    if (req.body.nik && String(req.body.nik).length !== 16) {
      return res.status(400).json({ message: "NIK siswa harus 16 digit." });
    }

    let schoolId = applicant.schoolId;
    let schoolTarget = req.body.schoolTarget;
    let schoolCode = req.body.schoolCode || applicant.schoolCode;
    let kelasId = applicant.kelasId;
    let kelasName = applicant.kelasName;
    if (req.body.schoolId) {
      const school = await getAmanahSchoolById(req.body.schoolId);
      if (!school) {
        return res.status(400).json({ message: "Lembaga/unit tidak ditemukan di Amanah." });
      }
      schoolId = school.id;
      schoolTarget = school.name;
      schoolCode = school.uuid;
    }
    if (req.body.kelasId) {
      const kelas = await getSpmbClassById(req.body.kelasId, schoolId);
      if (!kelas) {
        return res.status(400).json({ message: "Kelas SPMB tidak ditemukan untuk lembaga itu." });
      }
      kelasId = kelas.id;
      kelasName = kelas.name;
    }
    const isAlumni = parseAlumni(req.body.isAlumni);
    const type =
      isAlumni === true || req.body.type === "MURID_LAMA" ? "MURID_LAMA" : "BARU";

    await applicant.update({
      studentName: req.body.studentName,
      nik: req.body.nik,
      nisn: req.body.nisn || null,
      gender: req.body.gender,
      type,
      isAlumni: isAlumni === null ? applicant.isAlumni : isAlumni,
      schoolId,
      schoolTarget,
      schoolCode,
      kelasId,
      kelasName,
      previousSchool: req.body.previousSchool,
      fatherName: req.body.fatherName,
      fatherJob: req.body.fatherJob,
      fatherNik: req.body.fatherNik || null,
      motherName: req.body.motherName,
      motherJob: req.body.motherJob,
      motherNik: req.body.motherNik || null,
      address: req.body.address,
      village: req.body.village || null,
      district: req.body.district || null,
      city: req.body.city || null,
      province: req.body.province || null,
      formSubmittedAt: new Date(),
      examNumber: applicant.examNumber || generateExamNumber(),
      currentStep: Math.max(applicant.currentStep, 4),
      maxUnlockedStep: Math.max(applicant.maxUnlockedStep, 4),
    });

    const dashboard = await loadDashboard(req.user);
    return res.json({ message: "Data pendaftaran tersimpan.", ...dashboard });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function setStep(req, res) {
  try {
    const step = Number(req.body.step);
    const applicant = await Applicant.findOne({ where: { userId: req.user.id } });
    if (!applicant) return res.status(404).json({ message: "Data pendaftar tidak ditemukan." });
    if (step < 1 || step > 6) {
      return res.status(400).json({ message: "Tahap tidak valid." });
    }
    const continueAfterDecision =
      step === 6 && applicant.announcementStatus === "LULUS" && applicant.maxUnlockedStep >= 5;
    if (step > applicant.maxUnlockedStep && !continueAfterDecision) {
      return res.status(403).json({ message: "Tahap ini masih terkunci." });
    }
    if (step >= 5 && applicant.announcementStatus !== "LULUS") {
      return res.status(403).json({ message: "Tahap ini terbuka setelah Guru atau TU menyimpan hasil tes lulus." });
    }
    const open = await isStageOpen(applicant.schoolId, step);
    if (!open) {
      return res.status(403).json({ message: "Tahap ini belum dibuka oleh TU." });
    }
    await applicant.update({
      currentStep: step,
      maxUnlockedStep: continueAfterDecision
        ? Math.max(applicant.maxUnlockedStep, 6)
        : applicant.maxUnlockedStep,
    });
    const dashboard = await loadDashboard(req.user);
    return res.json(dashboard);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function lookupNisn(req, res) {
  try {
    const nisn = String(req.query.nisn || "").trim();
    if (!nisn) return res.status(400).json({ message: "NISN wajib diisi." });
    const result = await pullByNisn(nisn);
    if (!result.ok) {
      const status = result.code === "DISABLED" ? 503 : result.code === "NOT_FOUND" ? 404 : 502;
      return res.status(status).json(result);
    }
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function uploadPhoto(req, res) {
  try {
    const applicant = await Applicant.findOne({ where: { userId: req.user.id } });
    if (!applicant) return res.status(404).json({ message: "Pendaftar tidak ditemukan." });
    const bill = await Bill.findOne({ where: { applicantId: applicant.id } });
    if (!bill || bill.status !== "PAID") {
      return res.status(403).json({ message: "Unggah foto dibuka setelah pembayaran lunas." });
    }
    if (!req.file) return res.status(400).json({ message: "Pilih file foto terlebih dahulu." });

    await applicant.update({ photoPath: `/uploads/${req.file.filename}` });
    return res.json({
      message: "Foto calon siswa berhasil diunggah.",
      ...(await loadDashboard(req.user)),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function simulateAnnouncement(req, res) {
  try {
    const applicant = await Applicant.findOne({ where: { userId: req.user.id } });
    if (!applicant) return res.status(404).json({ message: "Data pendaftar tidak ditemukan." });
    if (!applicant.formSubmittedAt) {
      return res.status(403).json({ message: "Lengkapi formulir terlebih dahulu." });
    }

    return res.status(403).json({
      message: "Hasil kelulusan diisi oleh Guru atau TU lewat menu Tes.",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
