import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import {
  Applicant,
  AnnualFeeAmount,
  AnnualFeeSetup,
  AdmissionPayment,
  Bill,
  ApplicantFeeAmount,
  db,
  DocRequirement,
  DocumentFile,
  ExamAnnouncement,
  ExamResult,
  ExamSchedule,
  FeePackage,
  SpmbWave,
  StudentValidation,
  User,
} from "../models/index.js";
import { ensureDocRequirements } from "./DocRequirement.Controller.js";
import { currentAcademicYear, registrationFeeFor } from "./FeeSetup.Controller.js";
import { bniConfig, bniEnabled, createCloseBilling } from "../services/bniEcollection.js";
import { generateVirtualAccounts } from "../utils/va.js";
import { publicUser, serializeDashboard } from "../utils/payload.js";
import { loginAmanahStaff } from "../services/amanahStaff.js";
import {
  amanahParentUsernameExists,
  findAmanahParentByStudentName,
  suggestAmanahStudentNames,
} from "../services/amanahSync.js";
import { getAmanahSchoolById } from "../services/amanahSchools.js";
import { getSpmbClassById } from "./SpmbClass.Controller.js";
import { createRegistrationNumber } from "./SpmbSchoolConfig.Controller.js";
import { sanitizeStudentValidation, studentValidationErrors } from "../utils/studentValidation.js";

async function uniqueVirtualAccounts() {
  const prefix = bniEnabled() ? bniConfig().prefix : "";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const vas = generateVirtualAccounts(prefix);
    const existing = await Bill.findOne({
      where: { [Op.or]: [{ vaBni: vas.vaBni }, { vaBca: vas.vaBca }, { vaMandiri: vas.vaMandiri }] },
    });
    if (!existing) return vas;
  }
  throw new Error("Tidak dapat membuat nomor VA unik.");
}

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
  const dashboard = serializeDashboard({ user, applicant, bill, documents });
  if (applicant) {
    const [waveSchedule, legacySchedule, selectedWave, admissionPackage, announcement] = await Promise.all([
      applicant.waveId
        ? ExamSchedule.findOne({ where: { schoolId: applicant.schoolId, waveId: applicant.waveId } })
        : Promise.resolve(null),
      ExamSchedule.findOne({ where: { schoolId: applicant.schoolId, waveId: null } }),
      applicant.waveId
        ? SpmbWave.findOne({ where: { id: applicant.waveId, schoolId: applicant.schoolId }, attributes: ["name"] })
        : Promise.resolve(null),
      loadAdmissionPackage(applicant),
      ExamAnnouncement.findOne({ where: { applicantId: applicant.id }, attributes: ["announcementDate", "publishedAt"] }),
    ]);
    const schedule = waveSchedule || legacySchedule;
    dashboard.applicant = {
      ...(typeof applicant.toJSON === "function" ? applicant.toJSON() : applicant),
      examDate: schedule?.examDate || "",
      examLocation: schedule?.examLocation || "",
      waveName: selectedWave?.name || "",
      admissionPackage,
      announcementDate: announcement?.publishedAt ? announcement.announcementDate : null,
    };
  }
  if (dashboard.bill) {
    const plain = typeof dashboard.bill.toJSON === "function" ? dashboard.bill.toJSON() : dashboard.bill;
    dashboard.bill = { ...plain, bniLive: bniEnabled() };
  }
  return dashboard;
}

async function loadAdmissionPackage(applicant) {
  if (!applicant.paymentPackageId || !applicant.schoolId) return null;
  await AdmissionPayment.update(
    { status: "EXPIRED" },
    {
      where: {
        applicantId: applicant.id,
        status: "PENDING",
        expiresAt: { [Op.lte]: new Date() },
      },
    }
  );
  const paymentPackage = await FeePackage.findOne({
    where: { id: applicant.paymentPackageId, schoolId: applicant.schoolId },
    attributes: ["id", "name"],
  });
  if (!paymentPackage) return null;

  const examResult = await ExamResult.findOne({ where: { applicantId: applicant.id } });
  const academicYear = examResult?.academicYear || currentAcademicYear();
  const setup = await AnnualFeeSetup.findOne({
    where: { schoolId: applicant.schoolId, academicYear },
  });
  if (!setup) {
    const payments = await AdmissionPayment.findAll({
      where: { applicantId: applicant.id },
      order: [["createdAt", "DESC"]],
    });
    return {
      packageName: paymentPackage.name,
      academicYear,
      totalAmount: 0,
      configured: false,
      paidAmount: payments.filter((item) => item.status === "PAID").reduce((sum, item) => sum + Number(item.amount), 0),
      pendingAmount: payments.filter((item) => item.status === "PENDING").reduce((sum, item) => sum + Number(item.amount), 0),
      remainingAmount: 0,
      payments: payments.map(serializeAdmissionPayment),
      onlinePaymentEnabled: bniEnabled(),
    };
  }
  const amounts = await AnnualFeeAmount.findAll({
    where: { setupId: setup.id, packageId: paymentPackage.id },
    order: [["groupName", "ASC"]],
  });
  const admissionAmounts = amounts.filter((item) => {
    const groupName = String(item.groupName || "").trim().toLocaleLowerCase("id-ID");
    return !["biaya pendaftaran", "bayar uang pendaftaran"].includes(groupName);
  });
  const overrides = await ApplicantFeeAmount.findAll({
    where: {
      applicantId: applicant.id,
      setupId: setup.id,
      packageId: paymentPackage.id,
    },
  });
  const overrideByGroup = new Map(overrides.map((item) => [item.groupId, item]));
  const items = admissionAmounts.map((item) => {
    const globalAmount = Number(item.amount) || 0;
    const override = overrideByGroup.get(item.groupId);
    const deductionAmount = !override
      ? 0
      : override.deductionAmount == null
        ? Math.max(0, globalAmount - (Number(override.amount) || globalAmount))
        : Number(override.deductionAmount) || 0;
    const oasisAmount = Number(override?.oasisAmount) || 0;
    return {
      name: item.groupName,
      globalAmount,
      deductionAmount,
      oasisAmount,
      amount: Math.max(0, globalAmount - deductionAmount) + oasisAmount,
      description: override?.description || "",
    };
  });
  const totalAmount = items.reduce((total, item) => total + item.amount, 0);
  const payments = await AdmissionPayment.findAll({
    where: { applicantId: applicant.id },
    order: [["createdAt", "DESC"]],
  });
  const paidAmount = payments
    .filter((item) => item.status === "PAID")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const pendingAmount = payments
    .filter((item) => item.status === "PENDING")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  return {
    packageName: paymentPackage.name,
    academicYear,
    items,
    totalAmount,
    configured: items.length > 0,
    paidAmount,
    pendingAmount,
    remainingAmount: Math.max(0, totalAmount - paidAmount),
    payments: payments.map(serializeAdmissionPayment),
    onlinePaymentEnabled: bniEnabled(),
  };
}

function serializeAdmissionPayment(payment) {
  return {
    id: payment.id,
    amount: payment.amount,
    method: payment.method,
    status: payment.status,
    virtualAccount: payment.virtualAccount || null,
    expiresAt: payment.expiresAt || null,
    paidAt: payment.paidAt || null,
    createdAt: payment.createdAt,
  };
}

export async function raporUrlFor(user) {
  const target = String(process.env.RAPOR_APP_URL || "").trim();
  if (!target || user?.role !== "ORTU") return null;
  const applicant = await Applicant.findOne({ where: { userId: user.id } });
  if (!applicant) return null;
  const validation = await StudentValidation.findOne({ where: { applicantId: applicant.id } });
  if (!validation || studentValidationErrors(sanitizeStudentValidation(JSON.parse(validation.data))).length) return null;
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
    const fee = await registrationFeeFor(school.id, kelas.id, isAlumni);
    if (!fee) {
      return res.status(400).json({
        message: "Biaya formulir belum tersedia. TU perlu mengatur grup Bayar Uang Pendaftaran dan Setup Tahunan untuk kelas/status siswa ini.",
      });
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

    const amanahUsername = await amanahParentUsernameExists(uname);
    if (!amanahUsername.ok) {
      const status = amanahUsername.code === "DISABLED" ? 503 : 502;
      return res.status(status).json({ message: amanahUsername.message });
    }
    if (amanahUsername.exists) {
      return res.status(409).json({
        message: "Username sudah digunakan oleh akun wali Amanah. Gunakan username SPMB lain.",
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
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const vas = await uniqueVirtualAccounts();
    const transaction = await db.transaction();
    let user;
    try {
      user = await User.create(
        {
          name,
          wa: waNorm,
          username: uname,
          email: null,
          password: hash,
          role: "ORTU",
        },
        { transaction }
      );

      const examNumber = await createRegistrationNumber(school.id, transaction);
      const applicant = await Applicant.create(
        {
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
          examNumber,
        },
        { transaction }
      );

      let vaBni = vas.vaBni;
      let bniTrxId = null;
      if (bniEnabled()) {
        bniTrxId = `PPDB${applicant.id}`;
        const created = await createCloseBilling({
          trxId: bniTrxId,
          amount: fee.amount,
          customerName: studentName,
          customerPhone: waNorm,
          virtualAccount: vaBni,
          expiresAt,
        });
        if (created?.virtual_account) vaBni = String(created.virtual_account);
      }

      await Bill.create(
        {
          applicantId: applicant.id,
          amount: fee.amount,
          status: "UNPAID",
          ...vas,
          vaBni,
          bniTrxId,
          expiresAt,
        },
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    const accessToken = signAccess(user);
    const dashboard = await loadDashboard(user);
    return res.status(201).json({
      message: "Registrasi berhasil.",
      accessToken,
      ...dashboard,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
}

export async function suggestAmanahStudents(req, res) {
  try {
    const prefix = String(req.query.query || "").trim();
    if (req.query.isAlumni !== "true") return res.status(400).json({ message: "Saran nama Amanah hanya untuk alumni." });
    if (prefix.length < 3) return res.json({ names: [] });

    const result = await suggestAmanahStudentNames(prefix);
    if (!result.ok) {
      const status = result.code === "DISABLED" ? 503 : 502;
      return res.status(status).json({ message: result.message });
    }
    return res.json({ names: result.names });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function lookupAmanahParent(req, res) {
  try {
    if (req.body.isAlumni !== true) {
      return res.status(400).json({ message: "Pencarian data wali Amanah hanya untuk alumni." });
    }
    const result = await findAmanahParentByStudentName(req.body.studentName);
    if (!result.ok) {
      const status = result.code === "INVALID" ? 400 : result.code === "NOT_FOUND" ? 404
        : result.code === "AMBIGUOUS" ? 409 : result.code === "DISABLED" ? 503 : 502;
      return res.status(status).json({ message: result.message });
    }
    res.set("Cache-Control", "no-store");
    return res.json({ parent: result.parent });
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
