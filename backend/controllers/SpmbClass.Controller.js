import { SpmbClass } from "../models/index.js";
import { getAmanahSchoolById } from "../services/amanahSchools.js";

function toPublic(row) {
  return {
    id: row.id,
    schoolId: row.schoolId,
    name: row.name,
    sortOrder: row.sortOrder,
    published: row.published,
    updatedBy: row.updatedBy,
    label: row.name,
  };
}

export async function getSpmbClassById(kelasId, schoolId) {
  const id = Number(kelasId);
  const sid = Number(schoolId);
  if (!id || !sid) return null;
  const row = await SpmbClass.findOne({
    where: { id, schoolId: sid, published: true },
  });
  return row ? toPublic(row) : null;
}

export async function listPublishedBySchool(req, res) {
  try {
    const schoolId = Number(req.params.schoolId);
    if (!schoolId) return res.json({ classes: [] });
    const rows = await SpmbClass.findAll({
      where: { schoolId, published: true },
      order: [
        ["sortOrder", "ASC"],
        ["name", "ASC"],
      ],
    });
    return res.json({ classes: rows.map(toPublic) });
  } catch (error) {
    return res.status(500).json({ message: error.message, classes: [] });
  }
}

function staffSchoolId(req) {
  return Number(req.staff?.schoolId) || null;
}

export async function listAll(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    const where = schoolId ? { schoolId } : {};
    const rows = await SpmbClass.findAll({
      where,
      order: [
        ["sortOrder", "ASC"],
        ["name", "ASC"],
      ],
    });
    return res.json({ classes: rows.map(toPublic) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function createClass(req, res) {
  try {
    const name = String(req.body.name || "").trim();
    const schoolId = staffSchoolId(req);
    if (!name) {
      return res.status(400).json({ message: "Nama kelas wajib diisi." });
    }
    if (!schoolId) {
      return res.status(400).json({ message: "Akun TU belum terhubung ke lembaga di Amanah." });
    }
    const school = await getAmanahSchoolById(schoolId);
    if (!school) {
      return res.status(400).json({ message: "Lembaga akun TU tidak ditemukan di Amanah." });
    }
    const row = await SpmbClass.create({
      schoolId: school.id,
      name,
      sortOrder: Number(req.body.sortOrder) || 0,
      published: req.body.published !== false,
      updatedBy: req.staff.name,
    });
    return res.status(201).json({ message: "Kelas SPMB disimpan.", class: toPublic(row) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function updateClass(req, res) {
  try {
    const row = await SpmbClass.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Kelas tidak ditemukan." });
    const schoolId = staffSchoolId(req);
    if (schoolId && row.schoolId !== schoolId) {
      return res.status(403).json({ message: "Kelas ini bukan milik lembaga Anda." });
    }

    const name = req.body.name != null ? String(req.body.name).trim() : row.name;
    if (!name) {
      return res.status(400).json({ message: "Nama kelas wajib diisi." });
    }

    await row.update({
      name,
      sortOrder: req.body.sortOrder != null ? Number(req.body.sortOrder) || 0 : row.sortOrder,
      published: req.body.published ?? row.published,
      updatedBy: req.staff.name,
    });
    return res.json({ message: "Kelas SPMB diperbarui.", class: toPublic(row) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function deleteClass(req, res) {
  try {
    const row = await SpmbClass.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Kelas tidak ditemukan." });
    const schoolId = staffSchoolId(req);
    if (schoolId && row.schoolId !== schoolId) {
      return res.status(403).json({ message: "Kelas ini bukan milik lembaga Anda." });
    }
    await row.destroy();
    return res.json({ message: "Kelas SPMB dihapus." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
