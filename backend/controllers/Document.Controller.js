import { Applicant, DocRequirement, DocumentFile, StudentValidation } from "../models/index.js";
import { loadDashboard, raporUrlFor } from "./Auth.Controller.js";
import { ensureDocRequirements } from "./DocRequirement.Controller.js";
import { sanitizeStudentValidation, studentValidationErrors } from "../utils/studentValidation.js";

export async function uploadDocument(req, res) {
  try {
    const applicant = await Applicant.findOne({ where: { userId: req.user.id } });
    if (!applicant) return res.status(404).json({ message: "Pendaftar tidak ditemukan." });
    if (applicant.announcementStatus !== "LULUS") {
      return res.status(403).json({ message: "Unggah dokumen dibuka setelah dinyatakan lulus." });
    }
    if (!req.file) return res.status(400).json({ message: "File belum dipilih." });

    await ensureDocRequirements();
    const kind = String(req.body.kind || "").trim();
    const requirement = await DocRequirement.findOne({ where: { code: kind, published: true } });
    if (!requirement) return res.status(400).json({ message: "Jenis dokumen tidak berlaku." });
    const existing = await DocumentFile.findOne({ where: { applicantId: applicant.id, kind } });
    const payload = {
      path: `/uploads/${req.file.filename}`,
      originalName: req.file.originalname,
    };
    if (existing) await existing.update(payload);
    else await DocumentFile.create({ applicantId: applicant.id, kind, ...payload });

    return res.json({
      message: `${requirement.name} berhasil diunggah.`,
      ...(await loadDashboard(req.user)),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function finishRegistration(req, res) {
  try {
    const applicant = await Applicant.findOne({ where: { userId: req.user.id } });
    if (!applicant) return res.status(404).json({ message: "Pendaftar tidak ditemukan." });
    if (applicant.announcementStatus !== "LULUS" || applicant.maxUnlockedStep < 5) {
      return res.status(403).json({ message: "Pendaftaran dapat diselesaikan setelah dinyatakan lulus." });
    }
    await ensureDocRequirements();
    const required = await DocRequirement.findAll({ where: { published: true } });
    const docs = await DocumentFile.findAll({ where: { applicantId: applicant.id } });
    const kinds = new Set(docs.map((d) => d.kind));
    const missing = required.filter((item) => !kinds.has(item.code));
    if (missing.length) {
      return res.status(400).json({ message: `Unggah dulu: ${missing.map((item) => item.name).join(", ")}.` });
    }
    const validation = await StudentValidation.findOne({ where: { applicantId: applicant.id } });
    if (!validation) return res.status(400).json({ message: "Simpan dan lengkapi data siswa terlebih dahulu." });
    const errors = studentValidationErrors(sanitizeStudentValidation(JSON.parse(validation.data)));
    if (errors.length) {
      return res.status(400).json({ message: `Lengkapi data siswa: ${errors.slice(0, 3).join(", ")}.` });
    }
    await applicant.update({ currentStep: 6, maxUnlockedStep: 6 });
    const raporUrl = await raporUrlFor(req.user);
    return res.json({
      message: "Pendaftaran selesai. Panitia akan meninjau dokumen Anda.",
      raporUrl,
      ...(await loadDashboard(req.user)),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
