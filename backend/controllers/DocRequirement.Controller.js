import { DocRequirement } from "../models/index.js";

const DEFAULTS = [
  { code: "KK", name: "Scan Kartu Keluarga (KK)", sortOrder: 1 },
  { code: "AKTA", name: "Scan Akta Kelahiran", sortOrder: 2 },
];

export async function ensureDocRequirements() {
  const count = await DocRequirement.count();
  if (count > 0) return;
  await DocRequirement.bulkCreate(DEFAULTS);
}

function serialize(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sortOrder: row.sortOrder,
    published: row.published,
    updatedBy: row.updatedBy,
  };
}

export async function listPublishedDocRequirements(_req, res) {
  try {
    await ensureDocRequirements();
    const rows = await DocRequirement.findAll({
      where: { published: true },
      order: [["sortOrder", "ASC"], ["id", "ASC"]],
    });
    return res.json({ documents: rows.map(serialize) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function listDocRequirements(_req, res) {
  try {
    await ensureDocRequirements();
    const rows = await DocRequirement.findAll({ order: [["sortOrder", "ASC"], ["id", "ASC"]] });
    return res.json({ documents: rows.map(serialize) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function createDocRequirement(req, res) {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Nama dokumen wajib diisi." });
    const last = await DocRequirement.max("sortOrder");
    const row = await DocRequirement.create({
      code: `TMP${Date.now()}`,
      name,
      sortOrder: (Number(last) || 0) + 1,
      published: req.body.published !== false,
      updatedBy: req.staff.name,
    });
    await row.update({ code: `DOC${row.id}` });
    return res.status(201).json({ message: "Dokumen ditambahkan.", document: serialize(row) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function updateDocRequirement(req, res) {
  try {
    const row = await DocRequirement.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Dokumen tidak ditemukan." });
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Nama dokumen wajib diisi." });
    await row.update({
      name,
      published: req.body.published ?? row.published,
      updatedBy: req.staff.name,
    });
    return res.json({ message: "Dokumen diperbarui.", document: serialize(row) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function deleteDocRequirement(req, res) {
  try {
    const row = await DocRequirement.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Dokumen tidak ditemukan." });
    await row.destroy();
    return res.json({ message: "Dokumen dihapus." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
