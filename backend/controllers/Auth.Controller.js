import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { Applicant, Bill, DocRequirement, DocumentFile, User } from "../models/index.js";
import { ensureDocRequirements } from "./DocRequirement.Controller.js";
import { generateVirtualAccounts } from "../utils/va.js";
import { publicUser, serializeDashboard } from "../utils/payload.js";
import { loginAmanahStaff } from "../services/amanahStaff.js";
import { getAmanahSchoolById } from "../services/amanahSchools.js";
import { getSpmbClassById } from "./SpmbClass.Controller.js";

function parseAlumni(value) {
  if (value === true || value === "true" || value === "YA" || value === "ya") return true;
  if (value === false || value === "false" || value === "TIDAK" || value === "tidak") return false;
  return null;
}

function signAccess(user) {
  return jwt.sign(
    { uuid: user.uuid, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );
}

async function loadDashboard(user) {
  const applicant = await Applicant.findOne({ where: { userId: user.id } });
  const bill = applicant
    ? await Bill.findOne({ where: { applicantId: applicant.id } })
    : null;
  const documents = applicant
    ? await DocumentFile.findAll({ where: { applicantId: applicant.id } })
    : [];
  return serializeDashboard({ user, applicant, bill, documents });
}

export async function raporUrlFor(user) {
  const target = String(process.env.RAPOR_APP_URL || "").trim();
  if (!target || user?.role !== "ORTU") return null;
  const applicant = await Applicant.findOne({ where: { userId: user.id } });
  if (!applicant) return null;
  await ensureDocRequirements();
  const required = await DocRequirement.findAll({ where: { published: true } });
  if (!required.length) return null;
  const docs = await DocumentFile.findAll({ where: { applicantId: applicant.id } });
  const kinds = new Set(docs.map((item) => item.kind));
  const complete = required.every((item) => kinds.has(item.code));
  return complete ? target : null;
}

export async function register(req, res) {
  try {
    const { name, studentName, wa, username, password, schoolId, kelasId } = req.body;
    const isAlumni = parseAlumni(req.body.isAlumni);
    if (!name || !studentName || !wa || !username || !password || !schoolId || !kelasId || isAlumni === null) {
      return res.status(400).json({
        message: "Lembaga, kelas, status alumni, nama wali, nama siswa, WA, username, dan password wajib diisi.",
      });
    }
    const school = await getAmanahSchoolById(schoolId);
    if (!school) {
      return res.status(400).json({ message: "Lembaga/unit tidak ditemukan di Amanah. Pilih ulang dari daftar." });
    }
    const kelas = await getSpmbClassById(kelasId, school.id);
    if (!kelas) {
      return res.status(400).json({ message: "Kelas SPMB tidak ditemukan untuk lembaga itu. Pilih ulang dari daftar." });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password minimal 6 karakter." });
    }
    const waNorm = String(wa).replace(/\s/g, "");
    if (!/^08\d{8,11}$/.test(waNorm)) {
      return res.status(400).json({ message: "Nomor WhatsApp harus diawali 08 dan 10-13 digit." });
    }

    const uname = String(username).trim().toLowerCase();
    if (!/^[a-z0-9._]{4,30}$/.test(uname)) {
      return res.status(400).json({
        message: "Username 4–30 karakter, hanya huruf, angka, titik, atau underscore.",
      });
    }

    const exists = await User.findOne({
      where: { [Op.or]: [{ wa: waNorm }, { username: uname }] },
    });
    if (exists) {
      return res.status(409).json({
        message: exists.wa === waNorm
          ? "Nomor WhatsApp sudah terdaftar. Silakan login."
          : "Username sudah dipakai. Pilih username lain.",
      });
    }

    const hash = await argon2.hash(password);
    const user = await User.create({
      name,
      wa: waNorm,
      username: uname,
      email: null,
      password: hash,
      role: "ORTU",
    });

    const applicant = await Applicant.create({
      userId: user.id,
      studentName,
      schoolId: school.id,
      schoolTarget: school.name,
      schoolCode: school.uuid,
      kelasId: kelas.id,
      kelasName: kelas.name,
      isAlumni,
      type: isAlumni ? "MURID_LAMA" : "BARU",
      currentStep: 1,
      maxUnlockedStep: 2,
    });

    const vas = generateVirtualAccounts(user.id);
    await Bill.create({
      applicantId: applicant.id,
      amount: 350000,
      status: "UNPAID",
      ...vas,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const accessToken = signAccess(user);
    const dashboard = await loadDashboard(user);
    return res.status(201).json({
      message: "Registrasi berhasil.",
      accessToken,
      ...dashboard,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function login(req, res) {
  try {
    const { identifier, password, portal } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: "Username dan password wajib diisi." });
    }

    const key = String(identifier).trim();
    const user = await User.findOne({
      where: {
        deleted: false,
        [Op.or]: [{ wa: key }, { username: key.toLowerCase() }],
      },
    });

    if (!user || !(await argon2.verify(user.password, password))) {
      return res.status(401).json({ message: "Akun atau password tidak sesuai." });
    }

    const isOrtu = user.role === "ORTU";
    if (portal === "wali" && !isOrtu) {
      return res.status(403).json({ message: "Akun ini login di halaman utama, bukan /wali." });
    }
    if (portal === "staff" && isOrtu) {
      return res.status(403).json({ message: "Akun orang tua login di /wali." });
    }

    const accessToken = signAccess(user);
    const dashboard = await loadDashboard(user);
    const raporUrl = isOrtu ? await raporUrlFor(user) : null;
    return res.json({
      message: "Login berhasil.",
      accessToken,
      raporUrl,
      ...dashboard,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function staffLogin(req, res) {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: "Username dan password wajib diisi." });
    }
    const result = await loginAmanahStaff(String(identifier).trim(), password);
    if (!result.ok) {
      return res.status(result.code || 401).json({ message: result.message });
    }

    const accessToken = jwt.sign(result.staff, process.env.JWT_SECRET, { expiresIn: "12h" });
    return res.json({
      message: "Login berhasil.",
      accessToken,
      user: {
        uuid: result.staff.uuid,
        name: result.staff.name,
        username: result.staff.username,
        role: result.staff.role,
        roles: result.staff.roles,
        schoolId: result.staff.schoolId,
        schoolName: result.staff.schoolName,
        source: "amanah",
      },
      applicant: null,
      bill: null,
      documents: [],
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function me(req, res) {
  try {
    if (req.staff) {
      let schoolId = req.staff.schoolId || null;
      let schoolName = req.staff.schoolName || null;
      if (schoolId) {
        const school = await getAmanahSchoolById(schoolId);
        if (school) {
          schoolId = school.id;
          schoolName = school.label;
        }
      }
      return res.json({
        user: {
          uuid: req.staff.uuid,
          name: req.staff.name,
          username: req.staff.username,
          role: req.staff.role,
          roles: req.staff.roles,
          schoolId,
          schoolName,
          source: "amanah",
        },
        applicant: null,
        bill: null,
        documents: [],
      });
    }
    const dashboard = await loadDashboard(req.user);
    const raporUrl = await raporUrlFor(req.user);
    return res.json({ ...dashboard, raporUrl });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function logout(_req, res) {
  return res.json({ message: "Logout berhasil." });
}

export { loadDashboard, publicUser };
