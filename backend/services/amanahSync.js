import { QueryTypes } from "sequelize";
import { createAmanahSequelize, isAmanahConfigured } from "../config/amanahDatabase.js";
import { Applicant, SyncLog } from "../models/index.js";

const SCHOOL_MAP = {
  PAUD: "Early Childhood",
  SDIT: "Elementary",
  SMPIT: "Middle",
  SMAIT: "High",
};

export function amanahStatus() {
  return {
    enabled: isAmanahConfigured(),
    host: process.env.AMANAH_DB_HOST || "localhost",
    database: process.env.AMANAH_DB_NAME || "rapor",
  };
}

async function withAmanah(fn) {
  if (!isAmanahConfigured()) {
    return { ok: false, code: "DISABLED", message: "Sinkronisasi Amanah belum diaktifkan (AMANAH_SYNC_ENABLED=false)." };
  }

  const amanah = createAmanahSequelize();
  try {
    await amanah.authenticate();
    return await fn(amanah);
  } catch (error) {
    return { ok: false, code: "CONNECTION", message: error.message };
  } finally {
    await amanah?.close();
  }
}

export async function pullByNisn(nisn) {
  const result = await withAmanah(async (amanah) => {
    const rows = await amanah.query(
      `SELECT id, uuid, strNamaSiswa, strNoWA, strNIS, strNISN, strJenisKelamin,
              strPendidikanSebelumnya, strAlamatSiswa, strNamaAyah, strNamaIbu,
              strPekerjaanAyah, strPekerjaanIbu, strNikAyah, strNikIbu,
              strJalan, strKelurahan, strKecamatan, strKabupaten, strProvinsi,
              schoolId, ortuId, status, deleted
       FROM tblSiswas
       WHERE strNISN = :nisn AND deleted = 0
       LIMIT 1`,
      { replacements: { nisn }, type: QueryTypes.SELECT }
    );

    if (!rows.length) {
      return { ok: false, code: "NOT_FOUND", message: "NISN tidak ditemukan di Amanah." };
    }

    const siswa = rows[0];
    let ortu = null;
    if (siswa.ortuId) {
      const ortuRows = await amanah.query(
        `SELECT id, strNamaOrtu, strUserName, strNoWA FROM tblOrtus WHERE id = :id AND deleted = 0 LIMIT 1`,
        { replacements: { id: siswa.ortuId }, type: QueryTypes.SELECT }
      );
      ortu = ortuRows[0] || null;
    }

    return {
      ok: true,
      siswa: {
        amanahSiswaId: siswa.id,
        amanahOrtuId: siswa.ortuId || null,
        studentName: siswa.strNamaSiswa,
        nisn: siswa.strNISN,
        gender: siswa.strJenisKelamin,
        previousSchool: siswa.strPendidikanSebelumnya,
        address: siswa.strAlamatSiswa || siswa.strJalan,
        village: siswa.strKelurahan,
        district: siswa.strKecamatan,
        city: siswa.strKabupaten,
        province: siswa.strProvinsi,
        fatherName: siswa.strNamaAyah,
        fatherJob: siswa.strPekerjaanAyah,
        fatherNik: siswa.strNikAyah,
        motherName: siswa.strNamaIbu,
        motherJob: siswa.strPekerjaanIbu,
        motherNik: siswa.strNikIbu,
        wa: siswa.strNoWA || ortu?.strNoWA,
        parentName: ortu?.strNamaOrtu,
        status: siswa.status,
      },
    };
  });

  await SyncLog.create({
    applicantId: null,
    direction: "PULL",
    status: result.ok ? "OK" : result.code,
    message: result.message || "Lookup NISN",
    payload: { nisn },
  });

  return result;
}

function guessSchoolId(schoolTarget) {
  const key = Object.keys(SCHOOL_MAP).find((k) =>
    String(schoolTarget || "").toUpperCase().includes(k)
  );
  return key || null;
}

export async function pushAccepted(applicant, parentUser) {
  if (applicant.amanahSiswaId) {
    return {
      ok: true,
      skipped: true,
      message: "Sudah tersinkron ke Amanah.",
      amanahSiswaId: applicant.amanahSiswaId,
      amanahOrtuId: applicant.amanahOrtuId,
    };
  }

  const result = await withAmanah(async (amanah) => {
    const t = await amanah.transaction();
    try {
      let schoolId = applicant.schoolId || null;
      if (!schoolId) {
        const levelHint = guessSchoolId(applicant.schoolTarget);
        if (levelHint) {
          const schools = await amanah.query(
            `SELECT id FROM tblSchools WHERE strLevel = :level LIMIT 1`,
            { replacements: { level: SCHOOL_MAP[levelHint] }, type: QueryTypes.SELECT, transaction: t }
          );
          schoolId = schools[0]?.id || null;
        }
      }

      let ortuId = applicant.amanahOrtuId;
      const waliUsername = String(parentUser.username || "").trim().toLowerCase();
      if (!waliUsername) {
        throw new Error("Username wali belum diisi. Tidak dapat membuat akun rapor.");
      }
      const waliPasswordHash = parentUser.password;
      if (!ortuId) {
        const existingOrtu = await amanah.query(
          `SELECT id FROM tblOrtus WHERE deleted = 0 AND strUserName = :username LIMIT 1`,
          {
            replacements: { username: waliUsername },
            type: QueryTypes.SELECT,
            transaction: t,
          }
        );
        if (existingOrtu[0]) {
          ortuId = existingOrtu[0].id;
          await amanah.query(
            `UPDATE tblOrtus
             SET strUserName = :username, strPassword = :password, strNoWA = :wa, strNamaOrtu = :name, updatedAt = NOW()
             WHERE id = :id`,
            {
              replacements: {
                id: ortuId,
                username: waliUsername,
                password: waliPasswordHash,
                wa: parentUser.wa,
                name: parentUser.name,
              },
              transaction: t,
            }
          );
        } else {
          await amanah.query(
            `INSERT INTO tblOrtus (uuid, strNamaOrtu, strUserName, strPassword, strNoWA, deleted, createdAt, updatedAt)
             VALUES (UUID(), :name, :username, :password, :wa, 0, NOW(), NOW())`,
            {
              replacements: {
                name: parentUser.name,
                username: waliUsername,
                password: waliPasswordHash,
                wa: parentUser.wa,
              },
              transaction: t,
            }
          );
          const created = await amanah.query(
            `SELECT id FROM tblOrtus WHERE strUserName = :username ORDER BY id DESC LIMIT 1`,
            { replacements: { username: waliUsername }, type: QueryTypes.SELECT, transaction: t }
          );
          ortuId = created[0]?.id || null;
        }
      }

      const nisPlaceholder = `PPDB-${applicant.id}`;
      await amanah.query(
        `INSERT INTO tblSiswas
          (uuid, strNamaSiswa, strNoWA, strNIS, strNISN, strJenisKelamin, strPendidikanSebelumnya,
           strAlamatSiswa, strNamaAyah, strNamaIbu, strPekerjaanAyah, strPekerjaanIbu, strNikAyah, strNikIbu,
           strJalan, strKelurahan, strKecamatan, strKabupaten, strProvinsi, status, deleted, schoolId, kelasId, ortuId, createdAt, updatedAt)
         VALUES
          (UUID(), :studentName, :wa, :nis, :nisn, :gender, :previousSchool,
           :address, :fatherName, :motherName, :fatherJob, :motherJob, :fatherNik, :motherNik,
           :address, :village, :district, :city, :province, 'AKTIF', 0, :schoolId, NULL, :ortuId, NOW(), NOW())`,
        {
          replacements: {
            studentName: applicant.studentName,
            wa: parentUser.wa,
            nis: nisPlaceholder,
            nisn: applicant.nisn || nisPlaceholder,
            gender: applicant.gender || "-",
            previousSchool: applicant.previousSchool || "-",
            address: applicant.address || "-",
            fatherName: applicant.fatherName || "-",
            motherName: applicant.motherName || "-",
            fatherJob: applicant.fatherJob || "-",
            motherJob: applicant.motherJob || "-",
            fatherNik: applicant.fatherNik || "-",
            motherNik: applicant.motherNik || "-",
            village: applicant.village || "-",
            district: applicant.district || "-",
            city: applicant.city || "-",
            province: applicant.province || "-",
            schoolId,
            ortuId,
          },
          transaction: t,
        }
      );

      const createdSiswa = await amanah.query(
        `SELECT id FROM tblSiswas WHERE strNIS = :nis ORDER BY id DESC LIMIT 1`,
        { replacements: { nis: nisPlaceholder }, type: QueryTypes.SELECT, transaction: t }
      );

      await t.commit();
      return {
        ok: true,
        amanahSiswaId: createdSiswa[0]?.id || null,
        amanahOrtuId: ortuId,
      };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  });

  if (result.ok && result.amanahSiswaId) {
    await applicant.update({
      amanahSiswaId: result.amanahSiswaId,
      amanahOrtuId: result.amanahOrtuId,
      amanahSyncedAt: new Date(),
    });
  }

  await SyncLog.create({
    applicantId: applicant.id,
    direction: "PUSH",
    status: result.ok ? "OK" : result.code,
    message: result.message || (result.ok ? "Push siswa & orang tua ke Amanah" : "Gagal push Amanah"),
    payload: {
      amanahSiswaId: result.amanahSiswaId,
      amanahOrtuId: result.amanahOrtuId,
    },
  });

  return result;
}

export async function tryPushIfAccepted(applicant, parentUser) {
  if (applicant.announcementStatus !== "LULUS") {
    return { ok: false, code: "NOT_ACCEPTED", message: "Hanya siswa yang diterima yang dikirim ke Amanah." };
  }
  return pushAccepted(applicant, parentUser);
}
