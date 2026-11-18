import { Applicant, StudentValidation, db } from "../models/index.js";
import { pullForStudentValidation } from "../services/amanahSync.js";
import {
  sanitizeStudentValidation,
  studentValidationErrors,
  studentValidationSections,
} from "../utils/studentValidation.js";

async function acceptedApplicant(req, res) {
  const applicant = await Applicant.findOne({ where: { userId: req.user.id } });
  if (!applicant) {
    res.status(404).json({ message: "Pendaftar tidak ditemukan." });
    return null;
  }
  if (applicant.announcementStatus !== "LULUS" || applicant.maxUnlockedStep < 5) {
    res.status(403).json({ message: "Validasi data dibuka setelah dinyatakan lulus." });
    return null;
  }
  return applicant;
}

export async function getStudentValidation(req, res) {
  try {
    const applicant = await acceptedApplicant(req, res);
    if (!applicant) return;
    const saved = await StudentValidation.findOne({ where: { applicantId: applicant.id } });
    const initial = {
      studentName: applicant.studentName,
      nisn: applicant.nisn,
      nik: applicant.nik,
      gender: applicant.gender,
      previousSchool: applicant.previousSchool,
      fatherName: applicant.fatherName,
      fatherNik: applicant.fatherNik,
      fatherJob: applicant.fatherJob,
      motherName: applicant.motherName,
      motherNik: applicant.motherNik,
      motherJob: applicant.motherJob,
      address: applicant.address,
      village: applicant.village,
      district: applicant.district,
      city: applicant.city,
      province: applicant.province,
      studentPhone: req.user.wa,
    };
    let values = sanitizeStudentValidation(saved ? JSON.parse(saved.data) : initial);
    let importWarning = "";
    if (applicant.isAlumni) {
      const result = await pullForStudentValidation(applicant.nisn, applicant.id, applicant.amanahSiswaId);
      if (result.ok) {
        values = mergeMissingValues(values, result.values);
      } else {
        importWarning = result.message;
      }
    }
    res.set("Cache-Control", "no-store");
    return res.json({ sections: studentValidationSections, values, isAlumni: applicant.isAlumni, importWarning });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

function mergeMissingValues(values, imported) {
  const merged = { ...values };
  for (const [key, value] of Object.entries(imported)) {
    if (Object.hasOwn(merged, key) && !merged[key] && typeof value === "string" && value.trim()) {
      merged[key] = value.trim();
    }
  }
  return merged;
}

export async function saveStudentValidation(req, res) {
  try {
    const applicant = await acceptedApplicant(req, res);
    if (!applicant) return;
    let values;
    try {
      values = sanitizeStudentValidation(req.body.values);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    const errors = studentValidationErrors(values);
    await db.transaction(async (transaction) => {
      await StudentValidation.upsert({ applicantId: applicant.id, data: JSON.stringify(values) }, { transaction });
      if (!errors.length) {
        const keys = ["studentName", "nisn", "nik", "gender", "previousSchool", "fatherName", "fatherNik",
          "fatherJob", "motherName", "motherNik", "motherJob", "address", "village", "district", "city", "province"];
        await applicant.update(Object.fromEntries(keys.map((key) => [key, values[key] || null])), { transaction });
      }
    });
    res.set("Cache-Control", "no-store");
    return res.json({ message: errors.length ? "Draf data tersimpan. Lengkapi data wajib sebelum menyelesaikan pendaftaran." : "Data siswa tersimpan.", errors });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

