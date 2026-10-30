import { QueryTypes } from "sequelize";
import argon2 from "argon2";
import { createAmanahSequelize } from "../config/amanahDatabase.js";
import { getAmanahSchoolById } from "./amanahSchools.js";

const ROLE_MAP = {
  1: "GURU",
  2: "GURU",
  4: "KEPSEK",
  6: "TU",
};

const ALLOWED_ROLE_IDS = [1, 2, 4, 6];

function pickPrimary(roleIds) {
  if (roleIds.includes(4)) return "KEPSEK";
  if (roleIds.includes(6)) return "TU";
  if (roleIds.includes(1) || roleIds.includes(2)) return "GURU";
  return null;
}

export async function loginAmanahStaff(username, password) {
  const amanah = createAmanahSequelize();
  try {
    await amanah.authenticate();
    const users = await amanah.query(
      `SELECT id, uuid, strNama, strUserName, strPassword, schoolId, deleted
       FROM tblUsers
       WHERE LOWER(strUserName) = LOWER(:username) AND deleted = 0
       LIMIT 1`,
      { replacements: { username }, type: QueryTypes.SELECT }
    );
    const row = users[0];
    if (!row) {
      return { ok: false, code: 401, message: "Username atau password Amanah tidak sesuai." };
    }

    const match = await argon2.verify(row.strPassword, password);
    if (!match) {
      return { ok: false, code: 401, message: "Username atau password Amanah tidak sesuai." };
    }

    const roleRows = await amanah.query(
      `SELECT roleId FROM tblRolesDetail WHERE userId = :userId`,
      { replacements: { userId: row.id }, type: QueryTypes.SELECT }
    );
    const roleIds = roleRows.map((r) => Number(r.roleId)).filter((id) => ALLOWED_ROLE_IDS.includes(id));
    const role = pickPrimary(roleIds);
    if (!role) {
      return {
        ok: false,
        code: 403,
        message: "Akun Amanah ini bukan TU, Guru, atau Kepala Sekolah.",
      };
    }

    let schoolName = null;
    if (row.schoolId) {
      const school = await getAmanahSchoolById(row.schoolId);
      schoolName = school?.label || school?.name || null;
    }

    return {
      ok: true,
      staff: {
        source: "amanah",
        uuid: row.uuid,
        amanahUserId: row.id,
        name: row.strNama,
        username: row.strUserName,
        role,
        roles: [...new Set(roleIds.map((id) => ROLE_MAP[id]))],
        schoolId: row.schoolId,
        schoolName,
      },
    };
  } catch (error) {
    return {
      ok: false,
      code: 502,
      message: `Tidak dapat terhubung ke database Amanah: ${error.message}`,
    };
  } finally {
    await amanah.close();
  }
}
