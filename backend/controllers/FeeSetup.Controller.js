import { Op } from "sequelize";
import {
  AnnualFeeAmount,
  AnnualFeeSetup,
  AdmissionPayment,
  Applicant,
  ExamResult,
  FeeGroup,
  FeeGroupItem,
  FeeItem,
  FeePackage,
  SpmbClass,
  db,
} from "../models/index.js";

function staffSchoolId(req) {
  return Number(req.staff?.schoolId) || null;
}

function validAcademicYear(value) {
  const match = /^(\d{4})-(\d{4})$/.exec(String(value || ""));
  return Boolean(match && Number(match[2]) === Number(match[1]) + 1);
}

async function loadFeeSetup(schoolId, academicYear) {
  const [items, groups, packages, setup, classes] = await Promise.all([
    FeeItem.findAll({ where: { schoolId }, order: [["name", "ASC"]] }),
    FeeGroup.findAll({ where: { schoolId }, order: [["name", "ASC"]] }),
    FeePackage.findAll({ where: { schoolId }, order: [["name", "ASC"]] }),
    AnnualFeeSetup.findOne({ where: { schoolId, academicYear } }),
    SpmbClass.findAll({ where: { schoolId, published: true }, order: [["sortOrder", "ASC"], ["name", "ASC"]] }),
  ]);
  const groupLinks = groups.length
    ? await FeeGroupItem.findAll({ where: { schoolId, groupId: groups.map((group) => group.id) } })
    : [];
  const amounts = setup
    ? await AnnualFeeAmount.findAll({ where: { setupId: setup.id }, order: [["packageName", "ASC"], ["groupName", "ASC"]] })
    : [];

  return {
    items: items.map((item) => item.toJSON()),
    groups: groups.map((group) => ({
      ...group.toJSON(),
      itemIds: groupLinks.filter((link) => link.groupId === group.id).map((link) => link.itemId),
    })),
    packages: packages.map((item) => item.toJSON()),
    classes: classes.map((item) => ({ id: item.id, name: item.name })),
    setup: setup
      ? {
          id: setup.id,
          academicYear: setup.academicYear,
          updatedBy: setup.updatedBy,
          amounts: amounts.map((row) => row.toJSON()),
        }
      : null,
  };
}

export async function getFeeSetup(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    if (!schoolId) return res.status(400).json({ message: "Akun TU belum terhubung ke lembaga." });
    const academicYear = String(req.query.academicYear || "").trim();
    if (!validAcademicYear(academicYear)) {
      return res.status(400).json({ message: "Tahun ajaran tidak valid." });
    }
    return res.json(await loadFeeSetup(schoolId, academicYear));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export function currentAcademicYear() {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

function isRegistrationFeeGroup(name) {
  const normalized = String(name || "").trim().toLocaleLowerCase("id-ID");
  return ["biaya pendaftaran", "bayar uang pendaftaran"].includes(normalized);
}

async function lookupRegistrationFee(schoolId, kelasId, isAlumni) {
  const academicYear = currentAcademicYear();
  const [allGroups, packages] = await Promise.all([
    FeeGroup.findAll({ where: { schoolId } }),
    FeePackage.findAll({
      where: {
        schoolId,
        kelasId,
        studentType: isAlumni ? "ALUMNI" : "UMUM",
      },
    }),
  ]);
  const groups = allGroups.filter((group) => isRegistrationFeeGroup(group.name));
  if (!groups.length) {
    return { fee: null, reason: "Grup Biaya Pendaftaran belum dibuat." };
  }
  if (groups.length > 1) {
    return { fee: null, reason: "Ada lebih dari satu grup Biaya Pendaftaran. Sisakan satu grup saja." };
  }
  if (!packages.length) {
    return { fee: null, reason: "Paket pembayaran belum dipetakan ke kelas dan jenis siswa ini." };
  }
  if (packages.length > 1) {
    return { fee: null, reason: "Ada lebih dari satu paket untuk kelas dan jenis siswa ini." };
  }
  const setup = await AnnualFeeSetup.findOne({ where: { schoolId, academicYear } });
  if (!setup) {
    return { fee: null, reason: `Setup Tahunan ${academicYear} belum digenerate.` };
  }
  const row = await AnnualFeeAmount.findOne({
    where: { setupId: setup.id, packageId: packages[0].id, groupId: groups[0].id },
  });
  if (!row) {
    return { fee: null, reason: `Baris grup biaya belum digenerate untuk paket ${packages[0].name}.` };
  }
  if (row.amount < 1) {
    return { fee: null, reason: `Nominal Biaya Pendaftaran untuk paket ${packages[0].name} masih Rp0.` };
  }
  return { fee: { amount: row.amount, academicYear }, reason: null };
}

export async function registrationFeeFor(schoolId, kelasId, isAlumni) {
  const result = await lookupRegistrationFee(schoolId, kelasId, isAlumni);
  return result.fee;
}

export async function publicRegistrationFee(req, res) {
  try {
    const schoolId = Number(req.params.schoolId);
    const kelasId = Number(req.query.kelasId);
    const isAlumni = req.query.isAlumni === "true";
    if (!schoolId || !kelasId || !["true", "false"].includes(String(req.query.isAlumni))) {
      return res.json({ amount: null, configured: false });
    }

    const result = await lookupRegistrationFee(schoolId, kelasId, isAlumni);
    const fee = result.fee;
    return res.json({
      amount: fee?.amount || null,
      configured: Boolean(fee),
      academicYear: fee?.academicYear || currentAcademicYear(),
      reason: result.reason,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message, amount: null, configured: false });
  }
}

export async function createFeeItem(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    const name = String(req.body.name || "").trim();
    if (!schoolId) return res.status(400).json({ message: "Akun TU belum terhubung ke lembaga." });
    if (!name) return res.status(400).json({ message: "Nama item biaya wajib diisi." });
    const item = await FeeItem.create({
      schoolId,
      name,
      accountNumber: String(req.body.accountNumber || "").trim() || null,
    });
    return res.status(201).json({ message: "Item biaya ditambahkan.", item });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function updateFeeItem(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    const item = await FeeItem.findOne({ where: { id: req.params.id, schoolId } });
    if (!item) return res.status(404).json({ message: "Item biaya tidak ditemukan." });
    const name = String(req.body.name ?? item.name).trim();
    if (!name) return res.status(400).json({ message: "Nama item biaya wajib diisi." });
    await item.update({
      name,
      accountNumber: req.body.accountNumber != null
        ? String(req.body.accountNumber).trim() || null
        : item.accountNumber,
    });
    return res.json({ message: "Item biaya diperbarui.", item });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function deleteFeeItem(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    const item = await FeeItem.findOne({ where: { id: req.params.id, schoolId } });
    if (!item) return res.status(404).json({ message: "Item biaya tidak ditemukan." });
    const used = await FeeGroupItem.findOne({ where: { itemId: item.id, schoolId } });
    if (used) return res.status(409).json({ message: "Keluarkan item dari grup biaya sebelum menghapusnya." });
    await item.destroy();
    return res.json({ message: "Item biaya dihapus." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

function parseItemIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

export async function createFeeGroup(req, res) {
  return saveFeeGroup(req, res);
}

export async function updateFeeGroup(req, res) {
  return saveFeeGroup(req, res);
}

async function saveFeeGroup(req, res) {
  let transaction;
  try {
    transaction = await db.transaction();
    const schoolId = staffSchoolId(req);
    const name = String(req.body.name || "").trim();
    const itemIds = parseItemIds(req.body.itemIds);
    if (!schoolId) {
      await transaction.rollback();
      return res.status(400).json({ message: "Akun TU belum terhubung ke lembaga." });
    }
    if (!name) {
      await transaction.rollback();
      return res.status(400).json({ message: "Nama grup biaya wajib diisi." });
    }
    if (isRegistrationFeeGroup(name)) {
      const existingRegistrationGroups = (await FeeGroup.findAll({
        where: { schoolId },
        transaction,
      })).filter((group) => isRegistrationFeeGroup(group.name));
      const currentGroupId = req.params.id ? Number(req.params.id) : null;
      if (existingRegistrationGroups.some((group) => group.id !== currentGroupId)) {
        await transaction.rollback();
        return res.status(409).json({ message: "Grup Biaya Pendaftaran (atau Bayar Uang Pendaftaran) hanya boleh satu untuk setiap lembaga." });
      }
    }
    if (!itemIds.length) {
      await transaction.rollback();
      return res.status(400).json({ message: "Pilih minimal satu item biaya untuk grup ini." });
    }
    const items = await FeeItem.findAll({ where: { schoolId, id: itemIds }, transaction });
    if (items.length !== itemIds.length) {
      await transaction.rollback();
      return res.status(400).json({ message: "Item biaya tidak valid untuk lembaga ini." });
    }

    let group;
    if (req.params.id) {
      group = await FeeGroup.findOne({ where: { id: req.params.id, schoolId }, transaction });
      if (!group) {
        await transaction.rollback();
        return res.status(404).json({ message: "Grup biaya tidak ditemukan." });
      }
      await group.update({
        name,
        accountNumber: String(req.body.accountNumber || "").trim() || null,
      }, { transaction });
      await FeeGroupItem.destroy({ where: { groupId: group.id, schoolId }, transaction });
    } else {
      group = await FeeGroup.create({
        schoolId,
        name,
        accountNumber: String(req.body.accountNumber || "").trim() || null,
      }, { transaction });
    }
    await FeeGroupItem.bulkCreate(
      itemIds.map((itemId) => ({ schoolId, groupId: group.id, itemId })),
      { transaction }
    );
    await transaction.commit();
    return res.status(req.params.id ? 200 : 201).json({
      message: req.params.id ? "Grup biaya diperbarui." : "Grup biaya ditambahkan.",
      group: { ...group.toJSON(), itemIds },
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(500).json({ message: error.message });
  }
}

export async function deleteFeeGroup(req, res) {
  let transaction;
  try {
    transaction = await db.transaction();
    const schoolId = staffSchoolId(req);
    const group = await FeeGroup.findOne({ where: { id: req.params.id, schoolId }, transaction });
    if (!group) {
      await transaction.rollback();
      return res.status(404).json({ message: "Grup biaya tidak ditemukan." });
    }
    const used = await AnnualFeeAmount.findOne({ where: { groupId: group.id }, transaction });
    if (used) {
      await transaction.rollback();
      return res.status(409).json({ message: "Grup biaya sudah digunakan pada setup tahunan dan tidak dapat dihapus." });
    }
    await FeeGroupItem.destroy({ where: { groupId: group.id, schoolId }, transaction });
    await group.destroy({ transaction });
    await transaction.commit();
    return res.json({ message: "Grup biaya dihapus." });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(500).json({ message: error.message });
  }
}

export async function createFeePackage(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    const name = String(req.body.name || "").trim();
    if (!schoolId) return res.status(400).json({ message: "Akun TU belum terhubung ke lembaga." });
    if (!name) return res.status(400).json({ message: "Nama paket pembayaran wajib diisi." });
    const kelasId = Number(req.body.kelasId);
    const studentType = req.body.studentType;
    if (!kelasId || !["UMUM", "ALUMNI"].includes(studentType)) {
      return res.status(400).json({ message: "Pilih kelas dan jenis siswa untuk paket pembayaran." });
    }
    const kelas = await SpmbClass.findOne({ where: { id: kelasId, schoolId, published: true } });
    if (!kelas) return res.status(400).json({ message: "Kelas paket tidak valid untuk lembaga ini." });
    const duplicate = await FeePackage.findOne({ where: { schoolId, kelasId, studentType } });
    if (duplicate) return res.status(409).json({ message: "Paket untuk kelas dan jenis siswa ini sudah ada." });
    const item = await FeePackage.create({ schoolId, name, kelasId, studentType });
    return res.status(201).json({ message: "Paket pembayaran ditambahkan.", package: item });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function updateFeePackage(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    const item = await FeePackage.findOne({ where: { id: req.params.id, schoolId } });
    if (!item) return res.status(404).json({ message: "Paket pembayaran tidak ditemukan." });
    const name = String(req.body.name ?? item.name).trim();
    if (!name) return res.status(400).json({ message: "Nama paket pembayaran wajib diisi." });
    const kelasId = Number(req.body.kelasId ?? item.kelasId);
    const studentType = req.body.studentType ?? item.studentType;
    if (!kelasId || !["UMUM", "ALUMNI"].includes(studentType)) {
      return res.status(400).json({ message: "Pilih kelas dan jenis siswa untuk paket pembayaran." });
    }
    const kelas = await SpmbClass.findOne({ where: { id: kelasId, schoolId, published: true } });
    if (!kelas) return res.status(400).json({ message: "Kelas paket tidak valid untuk lembaga ini." });
    const assigned = await Applicant.findOne({
      where: { schoolId, paymentPackageId: item.id },
    });
    if (assigned && (kelasId !== item.kelasId || studentType !== item.studentType)) {
      return res.status(409).json({ message: "Kelas atau jenis siswa tidak dapat diubah karena paket sudah ditetapkan ke calon siswa." });
    }
    const duplicate = await FeePackage.findOne({
      where: { schoolId, kelasId, studentType, id: { [Op.ne]: item.id } },
    });
    if (duplicate) return res.status(409).json({ message: "Paket untuk kelas dan jenis siswa ini sudah ada." });
    await item.update({ name, kelasId, studentType });
    return res.json({ message: "Paket pembayaran diperbarui.", package: item });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function deleteFeePackage(req, res) {
  try {
    const schoolId = staffSchoolId(req);
    const item = await FeePackage.findOne({ where: { id: req.params.id, schoolId } });
    if (!item) return res.status(404).json({ message: "Paket pembayaran tidak ditemukan." });
    const used = await AnnualFeeAmount.findOne({ where: { packageId: item.id } });
    if (used) return res.status(409).json({ message: "Paket sudah digunakan pada setup tahunan dan tidak dapat dihapus." });
    const assigned = await Applicant.findOne({ where: { schoolId, paymentPackageId: item.id } });
    if (assigned) return res.status(409).json({ message: "Paket sudah ditetapkan ke calon siswa dan tidak dapat dihapus." });
    await item.destroy();
    return res.json({ message: "Paket pembayaran dihapus." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function generateAnnualFeeSetup(req, res) {
  let transaction;
  try {
    transaction = await db.transaction();
    const schoolId = staffSchoolId(req);
    const academicYear = String(req.body.academicYear || "").trim();
    if (!schoolId) {
      await transaction.rollback();
      return res.status(400).json({ message: "Akun TU belum terhubung ke lembaga." });
    }
    if (!validAcademicYear(academicYear)) {
      await transaction.rollback();
      return res.status(400).json({ message: "Tahun ajaran tidak valid." });
    }
    const [groups, packages] = await Promise.all([
      FeeGroup.findAll({ where: { schoolId }, transaction }),
      FeePackage.findAll({ where: { schoolId }, transaction }),
    ]);
    if (!groups.length || !packages.length) {
      await transaction.rollback();
      return res.status(400).json({ message: "Tambahkan minimal satu grup biaya dan satu paket pembayaran sebelum generate." });
    }
    const packageKeys = new Set();
    for (const paymentPackage of packages) {
      if (!paymentPackage.kelasId || !["UMUM", "ALUMNI"].includes(paymentPackage.studentType)) {
        await transaction.rollback();
        return res.status(400).json({ message: `Lengkapi pemetaan kelas dan jenis siswa untuk paket "${paymentPackage.name}".` });
      }
      const key = `${paymentPackage.kelasId}:${paymentPackage.studentType}`;
      if (packageKeys.has(key)) {
        await transaction.rollback();
        return res.status(409).json({ message: "Hanya boleh ada satu paket untuk setiap kombinasi kelas dan jenis siswa." });
      }
      packageKeys.add(key);
    }
    const [setup] = await AnnualFeeSetup.findOrCreate({
      where: { schoolId, academicYear },
      defaults: { schoolId, academicYear, updatedBy: req.staff.name },
      transaction,
    });
    const existing = await AnnualFeeAmount.findAll({
      where: { setupId: setup.id },
      attributes: ["packageId", "groupId"],
      transaction,
    });
    const existingPairs = new Set(existing.map((row) => `${row.packageId}:${row.groupId}`));
    const missing = [];
    for (const paymentPackage of packages) {
      for (const group of groups) {
        const key = `${paymentPackage.id}:${group.id}`;
        if (existingPairs.has(key)) continue;
        missing.push({
          setupId: setup.id,
          packageId: paymentPackage.id,
          groupId: group.id,
          packageName: paymentPackage.name,
          groupName: group.name,
          amount: 0,
        });
      }
    }
    if (missing.length) await AnnualFeeAmount.bulkCreate(missing, { transaction });
    await setup.update({ updatedBy: req.staff.name }, { transaction });
    await transaction.commit();
    return res.json({
      message: existing.length ? "Setup tahunan diperbarui tanpa mengubah nominal yang sudah diisi." : "Setup tahunan berhasil dibuat.",
      ...(await loadFeeSetup(schoolId, academicYear)),
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(500).json({ message: error.message });
  }
}

export async function saveAnnualFeeAmounts(req, res) {
  let transaction;
  try {
    transaction = await db.transaction();
    const schoolId = staffSchoolId(req);
    const setup = await AnnualFeeSetup.findOne({
      where: { id: req.params.id, schoolId },
      transaction,
    });
    if (!setup) {
      await transaction.rollback();
      return res.status(404).json({ message: "Setup tahunan tidak ditemukan." });
    }
    if (!Array.isArray(req.body.amounts)) {
      await transaction.rollback();
      return res.status(400).json({ message: "Data nominal biaya tidak valid." });
    }
    const allowed = await AnnualFeeAmount.findAll({
      where: { setupId: setup.id },
      attributes: ["id", "packageId", "amount"],
      transaction,
    });
    const allowedById = new Map(allowed.map((row) => [row.id, row]));
    const seenIds = new Set();
    const updates = [];
    const changedPackageIds = new Set();
    for (const entry of req.body.amounts) {
      const id = Number(entry.id);
      const amount = Number(entry.amount);
      const current = allowedById.get(id);
      if (
        !current
        || seenIds.has(id)
        || String(entry.amount ?? "").trim() === ""
        || !Number.isSafeInteger(amount)
        || amount > 2147483647
        || amount < 0
      ) {
        await transaction.rollback();
        return res.status(400).json({ message: "Nominal harus berupa bilangan bulat dari Rp0 sampai Rp2.147.483.647 dan baris biaya harus berasal dari setup ini." });
      }
      seenIds.add(id);
      updates.push({ id, amount, packageId: current.packageId });
      if (amount !== Number(current.amount)) changedPackageIds.add(current.packageId);
    }
    if (seenIds.size !== allowedById.size) {
      await transaction.rollback();
      return res.status(400).json({ message: "Semua nominal pada setup tahunan wajib dikirim." });
    }
    if (changedPackageIds.size) {
      const applicants = await Applicant.findAll({
        where: { schoolId, paymentPackageId: { [Op.in]: [...changedPackageIds] } },
        attributes: ["id"],
        include: [{
          model: ExamResult,
          as: "examResult",
          attributes: ["applicantId"],
          where: { academicYear: setup.academicYear },
          required: true,
        }],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const applicantIds = applicants.map((item) => item.id);
      if (applicantIds.length) {
        const existingPayment = await AdmissionPayment.findOne({
          where: {
            applicantId: { [Op.in]: applicantIds },
            status: { [Op.in]: ["PENDING", "PAID"] },
          },
          transaction,
        });
        if (existingPayment) {
          await transaction.rollback();
          return res.status(409).json({ message: "Nominal setup tidak dapat diubah setelah pembayaran biaya masuk dimulai atau diterima." });
        }
      }
    }
    for (const entry of updates) {
      await AnnualFeeAmount.update({ amount: entry.amount }, {
        where: { id: entry.id, setupId: setup.id },
        transaction,
      });
    }
    await setup.update({ updatedBy: req.staff.name }, { transaction });
    await transaction.commit();
    return res.json({
      message: "Nominal setup tahunan disimpan.",
      ...(await loadFeeSetup(schoolId, setup.academicYear)),
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(500).json({ message: error.message });
  }
}
