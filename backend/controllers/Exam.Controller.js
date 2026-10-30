import { Applicant, ExamResult, ExamScore, ExamSubject, User } from "../models/index.js";
import { tryPushIfAccepted } from "../services/amanahSync.js";

const DEFAULT_SUBJECTS = ["OBSERVASI SISWA", "WAWANCARA ORANGTUA"];

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
    const [rows, subjects] = await Promise.all([
      Applicant.findAll({
        where: { schoolId },
        include: [{ model: ExamResult, as: "examResult", include: [{ model: ExamScore, as: "scores" }] }],
        order: [["studentName", "ASC"]],
      }),
      ExamSubject.findAll({ where: { schoolId }, order: [["sortOrder", "ASC"], ["id", "ASC"]] }),
    ]);
    const ready = rows.filter((row) => row.formSubmittedAt);
    return res.json({
      schoolName: req.staff.schoolName || "",
      subjects: subjects.map(serializeSubject),
      applicants: ready.map((row) => ({
        id: row.id,
        studentName: row.studentName,
        kelasName: row.kelasName,
        schoolTarget: row.schoolTarget,
        exam: serializeExam(row.examResult),
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function applyExamStatus(applicant, status) {
  if (status === "LULUS") {
    const patch = {
      announcementStatus: "LULUS",
      maxUnlockedStep: Math.max(applicant.maxUnlockedStep, 5),
    };
    if (applicant.currentStep >= 4) patch.currentStep = 5;
    await applicant.update(patch);
    if (applicant.user) {
      await tryPushIfAccepted(applicant, applicant.user);
    }
    return;
  }

  const patch = { announcementStatus: "TIDAK_LULUS" };
  if (applicant.maxUnlockedStep > 4) patch.maxUnlockedStep = 4;
  if (applicant.currentStep > 4) patch.currentStep = 4;
  await applicant.update(patch);
}

export async function saveExamResult(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ message: "Akun belum terhubung ke lembaga." });
    }

    const applicantId = Number(req.body.applicantId);
    const academicYear = String(req.body.academicYear || "").trim();
    const status = req.body.status === "TIDAK_LULUS" ? "TIDAK_LULUS" : req.body.status === "LULUS" ? "LULUS" : "";
    if (!applicantId || !academicYear || !status) {
      return res.status(400).json({ message: "Nama siswa, tahun pelajaran, dan status kelulusan wajib diisi." });
    }

    const applicant = await Applicant.findOne({
      where: { id: applicantId, schoolId },
      include: [{ model: User }],
    });
    if (!applicant || !applicant.formSubmittedAt) {
      return res.status(404).json({ message: "Pendaftar belum mengirim formulir." });
    }

    const subjects = await ExamSubject.findAll({ where: { schoolId } });
    const allowed = new Map(subjects.map((item) => [item.id, item]));
    const incoming = Array.isArray(req.body.scores) ? req.body.scores : [];
    const scoreRows = incoming
      .map((item) => {
        const subject = allowed.get(Number(item.subjectId));
        if (!subject) return null;
        return {
          subjectId: subject.id,
          subjectName: subject.name,
          score: String(item.score || "").trim(),
          note: String(item.note || "").trim(),
        };
      })
      .filter(Boolean);

    const payload = {
      applicantId: applicant.id,
      schoolId,
      academicYear,
      examinerName: req.staff.name,
      examinerAmanahUserId: req.staff.amanahUserId || null,
      status,
      note: String(req.body.note || "").trim(),
    };

    const existing = await ExamResult.findOne({ where: { applicantId: applicant.id } });
    const row = existing ? await existing.update(payload) : await ExamResult.create(payload);
    await ExamScore.destroy({ where: { examResultId: row.id } });
    if (scoreRows.length) {
      await ExamScore.bulkCreate(scoreRows.map((item) => ({ ...item, examResultId: row.id })));
    }
    await row.reload({ include: [{ model: ExamScore, as: "scores" }] });
    await applyExamStatus(applicant, status);

    return res.json({
      message: status === "LULUS" ? "Hasil tes disimpan. Siswa dinyatakan lulus." : "Hasil tes disimpan. Siswa belum lulus.",
      exam: serializeExam(row),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
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
