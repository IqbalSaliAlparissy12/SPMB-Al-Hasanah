import { Requirement } from "../models/index.js";

export async function listPublished(_req, res) {
  try {
    const rows = await Requirement.findAll({
      where: { published: true },
      order: [["updatedAt", "DESC"]],
    });
    return res.json({ requirements: rows });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function listAll(_req, res) {
  try {
    const rows = await Requirement.findAll({ order: [["updatedAt", "DESC"]] });
    return res.json({ requirements: rows });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function createRequirement(req, res) {
  try {
    const { title, body, published } = req.body;
    if (!title || !body) {
      return res.status(400).json({ message: "Judul dan isi persyaratan wajib diisi." });
    }
    const row = await Requirement.create({
      title,
      body,
      published: published !== false,
      updatedBy: req.staff.name,
    });
    return res.status(201).json({ message: "Persyaratan disimpan.", requirement: row });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function updateRequirement(req, res) {
  try {
    const row = await Requirement.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Persyaratan tidak ditemukan." });
    await row.update({
      title: req.body.title ?? row.title,
      body: req.body.body ?? row.body,
      published: req.body.published ?? row.published,
      updatedBy: req.staff.name,
    });
    return res.json({ message: "Persyaratan diperbarui.", requirement: row });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function deleteRequirement(req, res) {
  try {
    const row = await Requirement.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Persyaratan tidak ditemukan." });
    await row.destroy();
    return res.json({ message: "Persyaratan dihapus." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
