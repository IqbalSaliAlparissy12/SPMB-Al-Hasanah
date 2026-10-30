import { Statement } from "../models/index.js";

export async function listPublishedStatements(_req, res) {
  try {
    const rows = await Statement.findAll({
      where: { published: true },
      order: [["updatedAt", "DESC"]],
    });
    return res.json({ statements: rows });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function listStatements(_req, res) {
  try {
    const rows = await Statement.findAll({ order: [["updatedAt", "DESC"]] });
    return res.json({ statements: rows });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function createStatement(req, res) {
  try {
    const { title, body, published } = req.body;
    if (!title || !body) {
      return res.status(400).json({ message: "Judul dan isi surat pernyataan wajib diisi." });
    }
    const row = await Statement.create({
      title,
      body,
      published: published !== false,
      updatedBy: req.staff.name,
    });
    return res.status(201).json({ message: "Surat pernyataan disimpan.", statement: row });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function updateStatement(req, res) {
  try {
    const row = await Statement.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Surat pernyataan tidak ditemukan." });
    await row.update({
      title: req.body.title ?? row.title,
      body: req.body.body ?? row.body,
      published: req.body.published ?? row.published,
      updatedBy: req.staff.name,
    });
    return res.json({ message: "Surat pernyataan diperbarui.", statement: row });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function uploadStatementFile(req, res) {
  try {
    const row = await Statement.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Surat pernyataan tidak ditemukan." });
    if (!req.file) return res.status(400).json({ message: "Pilih dokumen terlebih dahulu." });
    await row.update({
      filePath: `/uploads/${req.file.filename}`,
      originalName: req.file.originalname,
      updatedBy: req.staff.name,
    });
    return res.json({ message: "Dokumen surat pernyataan diunggah.", statement: row });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function deleteStatement(req, res) {
  try {
    const row = await Statement.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Surat pernyataan tidak ditemukan." });
    await row.destroy();
    return res.json({ message: "Surat pernyataan dihapus." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
