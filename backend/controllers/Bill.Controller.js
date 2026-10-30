import { Applicant, Bill, Payment } from "../models/index.js";
import { loadDashboard } from "./Auth.Controller.js";

const METHODS = ["QRIS", "VA_BNI", "VA_BCA", "VA_MANDIRI"];

export async function selectMethod(req, res) {
  try {
    const method = req.body.method;
    if (!METHODS.includes(method)) {
      return res.status(400).json({ message: "Metode pembayaran tidak valid." });
    }
    const applicant = await Applicant.findOne({ where: { userId: req.user.id } });
    const bill = await Bill.findOne({ where: { applicantId: applicant.id } });
    if (bill.status === "PAID") {
      return res.json(await loadDashboard(req.user));
    }
    if (new Date(bill.expiresAt) < new Date()) {
      await bill.update({ status: "EXPIRED" });
      return res.status(410).json({ message: "Tagihan kedaluwarsa. Hubungi panitia." });
    }
    await bill.update({ selectedMethod: method });
    return res.json(await loadDashboard(req.user));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function simulatePay(req, res) {
  try {
    const applicant = await Applicant.findOne({ where: { userId: req.user.id } });
    const bill = await Bill.findOne({ where: { applicantId: applicant.id } });
    if (!bill) return res.status(404).json({ message: "Tagihan tidak ditemukan." });
    if (bill.status === "PAID") {
      return res.json({ message: "Tagihan sudah lunas.", ...(await loadDashboard(req.user)) });
    }
    if (new Date(bill.expiresAt) < new Date()) {
      await bill.update({ status: "EXPIRED" });
      return res.status(410).json({ message: "Tagihan kedaluwarsa." });
    }

    const method = req.body.method || bill.selectedMethod || "QRIS";
    await Payment.create({
      billId: bill.id,
      method,
      amount: bill.amount,
      status: "PAID",
      simulated: true,
    });
    await bill.update({
      status: "PAID",
      selectedMethod: method,
      paidAt: new Date(),
    });
    await applicant.update({
      maxUnlockedStep: Math.max(applicant.maxUnlockedStep, 3),
    });

    return res.json({
      message: "Pembayaran formulir berhasil dikonfirmasi (simulasi).",
      ...(await loadDashboard(req.user)),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
