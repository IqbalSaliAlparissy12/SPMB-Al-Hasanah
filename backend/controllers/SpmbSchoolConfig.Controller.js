import { randomInt } from "crypto";
import { Applicant, SpmbSchoolConfig } from "../models/index.js";

function staffSchoolId(req) {
  return Number(req.staff?.schoolId) || null;
}

export async function getRegistrationPrefix(req, res) {
  const schoolId = staffSchoolId(req);
  if (!schoolId) {
    return res.status(400).json({ message: "Akun TU belum terhubung ke lembaga." });
  }
  try {
    const config = await SpmbSchoolConfig.findOne({ where: { schoolId } });
    return res.json({
      schoolId,
      schoolName: req.staff.schoolName || "",
      registrationPrefix: config?.registrationPrefix || "",
      configured: Boolean(config),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function saveRegistrationPrefix(req, res) {
  const schoolId = staffSchoolId(req);
  if (!schoolId) {
    return res.status(400).json({ message: "Akun TU belum terhubung ke lembaga." });
  }
  const registrationPrefix = String(req.body?.registrationPrefix || "").trim();
  if (!/^\d{4}$/.test(registrationPrefix)) {
    return res.status(400).json({ message: "ID lembaga harus tepat 4 digit angka." });
  }

  try {
    const config = await SpmbSchoolConfig.findOne({ where: { schoolId } });
    if (config) {
      if (config.registrationPrefix !== registrationPrefix) {
        return res.status(409).json({
          message: "ID lembaga tidak dapat diubah setelah ditetapkan agar ID registrasi yang sudah terbit tetap konsisten.",
        });
      }
      return res.json({ message: "ID lembaga sudah tersimpan.", registrationPrefix, configured: true });
    }

    await SpmbSchoolConfig.create({ schoolId, registrationPrefix });
    return res.status(201).json({
      message: "ID lembaga berhasil disimpan.",
      registrationPrefix,
      configured: true,
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      try {
        const current = await SpmbSchoolConfig.findOne({ where: { schoolId } });
        if (current?.registrationPrefix === registrationPrefix) {
          return res.json({ message: "ID lembaga sudah tersimpan.", registrationPrefix, configured: true });
        }
      } catch (lookupError) {
        return res.status(500).json({ message: lookupError.message });
      }
      return res.status(409).json({ message: "ID lembaga ini sudah digunakan oleh lembaga lain." });
    }
    return res.status(500).json({ message: error.message });
  }
}

export async function createRegistrationNumber(schoolId, transaction) {
  const config = await SpmbSchoolConfig.findOne({
    where: { schoolId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!config) {
    const error = new Error("ID lembaga belum diatur oleh TU. Hubungi lembaga sebelum mendaftar.");
    error.status = 409;
    throw error;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const number = `${config.registrationPrefix}${String(randomInt(0, 100000000)).padStart(8, "0")}`;
    const existing = await Applicant.findOne({ where: { examNumber: number }, transaction });
    if (!existing) return number;
  }
  const error = new Error("Tidak dapat membuat ID registrasi yang unik. Silakan coba kembali.");
  error.status = 503;
  throw error;
}
