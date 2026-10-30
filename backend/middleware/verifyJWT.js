import jwt from "jsonwebtoken";
import { User } from "../models/index.js";

export default async function verifyJWT(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: "Token tidak ada. Silakan login." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.source === "amanah") {
      req.staff = decoded;
      req.user = null;
      return next();
    }

    const user = await User.findOne({
      where: { uuid: decoded.uuid, deleted: false },
    });
    if (!user) {
      return res.status(401).json({ message: "Akun tidak ditemukan." });
    }
    req.user = user;
    next();
  } catch {
    return res.status(403).json({ message: "Token tidak valid atau kedaluwarsa." });
  }
}

export function requireParent(req, res, next) {
  if (!req.user) {
    return res.status(403).json({ message: "Khusus akun orang tua." });
  }
  next();
}

export function requireStaff(req, res, next) {
  if (!req.staff) {
    return res.status(403).json({ message: "Khusus akun TU / Guru / Kepala Sekolah." });
  }
  next();
}

export function requireTu(req, res, next) {
  if (!req.staff || req.staff.role !== "TU") {
    return res.status(403).json({ message: "Hanya TU yang dapat mengatur persyaratan." });
  }
  next();
}

export function requireGuruOrTu(req, res, next) {
  if (!req.staff || !["TU", "GURU"].includes(req.staff.role)) {
    return res.status(403).json({ message: "Hanya Guru atau TU yang dapat mengisi hasil tes." });
  }
  next();
}
