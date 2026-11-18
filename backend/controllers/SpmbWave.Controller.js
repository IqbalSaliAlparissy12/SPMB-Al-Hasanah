import { Op } from "sequelize";
import { Applicant, db, ExamAnnouncement, SpmbWave } from "../models/index.js";

function staffSchoolId(req) {
  return Number(req.staff?.schoolId) || null;
}

function serializeWave(row) {
  return {
    id: row.id,
    schoolId: row.schoolId,
    name: row.name,
    sortOrder: row.sortOrder,
    updatedBy: row.updatedBy,
  };
}

export async function listWaves(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ message: "Akun belum terhubung ke lembaga." });
    }
    const rows = await SpmbWave.findAll({
      where: { schoolId },
      order: [["sortOrder", "ASC"], ["name", "ASC"]],
    });
    return res.json({ waves: rows.map(serializeWave) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function createWave(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    const name = String(req.body.name || "").trim();
    if (!schoolId) {
      return res.status(400).json({ message: "Akun TU belum terhubung ke lembaga." });
    }
    if (!name) return res.status(400).json({ message: "Nama gelombang wajib diisi." });
    const duplicate = await SpmbWave.findOne({ where: { schoolId, name } });
    if (duplicate) return res.status(409).json({ message: "Nama gelombang sudah digunakan." });
    const row = await SpmbWave.create({
      schoolId,
      name,
      sortOrder: Number(req.body.sortOrder) || 0,
      updatedBy: req.staff.name,
    });
    return res.status(201).json({ message: "Gelombang ditambahkan.", wave: serializeWave(row) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function updateWave(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    const row = await SpmbWave.findOne({ where: { id: req.params.id, schoolId } });
    if (!row) return res.status(404).json({ message: "Gelombang tidak ditemukan." });
    const name = req.body.name != null ? String(req.body.name).trim() : row.name;
    if (!name) return res.status(400).json({ message: "Nama gelombang wajib diisi." });
    const duplicate = await SpmbWave.findOne({
      where: { schoolId, name, id: { [Op.ne]: row.id } },
    });
    if (duplicate) return res.status(409).json({ message: "Nama gelombang sudah digunakan." });
    await row.update({
      name,
      sortOrder: req.body.sortOrder != null ? Number(req.body.sortOrder) || 0 : row.sortOrder,
      updatedBy: req.staff.name,
    });
    return res.json({ message: "Gelombang diperbarui.", wave: serializeWave(row) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function deleteWave(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    await db.transaction(async (transaction) => {
      const row = await SpmbWave.findOne({
        where: { id: req.params.id, schoolId }, transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!row) {
        const error = new Error("Gelombang tidak ditemukan.");
        error.status = 404;
        throw error;
      }
      const assigned = await Applicant.findOne({ where: { schoolId, waveId: row.id }, transaction });
      const drafts = await ExamAnnouncement.findAll({ where: { schoolId, draft: { [Op.ne]: null } }, transaction });
      if (assigned || drafts.some((item) => Number(JSON.parse(item.draft).waveId) === Number(row.id))) {
        const error = new Error("Gelombang sudah ditetapkan ke calon siswa atau draf hasil tes dan tidak dapat dihapus.");
        error.status = 409;
        throw error;
      }
      await row.destroy({ transaction });
    });
    return res.json({ message: "Gelombang dihapus." });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
}
