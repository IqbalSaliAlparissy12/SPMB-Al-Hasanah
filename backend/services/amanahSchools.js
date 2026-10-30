import { QueryTypes } from "sequelize";
import { createAmanahSequelize } from "../config/amanahDatabase.js";

const LEVEL_LABEL = {
  "Early Childhood": "PAUD / TK",
  Elementary: "SD",
  Middle: "SMP / MTs",
  High: "SMA / MA",
};

export function formatSchoolLabel(name, level) {
  const levelLabel = LEVEL_LABEL[level] || level;
  return levelLabel ? `${name} (${levelLabel})` : name;
}

const SCHOOL_SELECT = `
  SELECT s.id, s.uuid, s.strLevel, s.strType,
         s.strNamaSekolah AS unitName,
         i.strNamaSekolah AS identitasNama
  FROM tblSchools s
  LEFT JOIN tblIdentitasSekolah i ON i.schoolId = s.id
`;

function mapSchool(row) {
  const name = String(row.identitasNama || row.unitName || "").trim();
  return {
    id: row.id,
    uuid: row.uuid,
    name,
    unitName: row.unitName,
    level: row.strLevel,
    levelLabel: LEVEL_LABEL[row.strLevel] || row.strLevel,
    type: row.strType,
    label: name,
  };
}

export async function listAmanahSchools() {
  const amanah = createAmanahSequelize();
  try {
    await amanah.authenticate();
    const rows = await amanah.query(
      `${SCHOOL_SELECT}
       ORDER BY FIELD(s.strLevel, 'Early Childhood', 'Elementary', 'Middle', 'High'),
                COALESCE(i.strNamaSekolah, s.strNamaSekolah)`,
      { type: QueryTypes.SELECT }
    );
    return rows.map(mapSchool);
  } finally {
    await amanah.close();
  }
}

export async function getAmanahSchoolById(id) {
  const schoolId = Number(id);
  if (!schoolId) return null;
  const amanah = createAmanahSequelize();
  try {
    await amanah.authenticate();
    const rows = await amanah.query(
      `${SCHOOL_SELECT}
       WHERE s.id = :id
       LIMIT 1`,
      { replacements: { id: schoolId }, type: QueryTypes.SELECT }
    );
    return rows[0] ? mapSchool(rows[0]) : null;
  } finally {
    await amanah.close();
  }
}
