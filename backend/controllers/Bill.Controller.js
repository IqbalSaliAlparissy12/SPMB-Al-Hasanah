import { Op } from "sequelize";
import { Applicant, Bill, Payment } from "../models/index.js";
import { loadDashboard } from "./Auth.Controller.js";
import { bniEnabled, decryptNotification, inquireBilling } from "../services/bniEcollection.js";
import { confirmAdmissionPaymentFromBni } from "./AdmissionPayment.Controller.js";

const METHODS = ["QRIS", "VA_BNI", "VA_BCA", "VA_MANDIRI"];

async function settleBill(bill, { method, simulated }) {
  if (bill.status === "PAID") return;
  await Payment.create({
    billId: bill.id,
    method,
    amount: bill.amount,
    status: "PAID",
    simulated,
  });
  await bill.update({
    status: "PAID",
    selectedMethod: method,
    paidAt: new Date(),
  });
  const applicant = await Applicant.findByPk(bill.applicantId);
  if (applicant) {
    await applicant.update({
      maxUnlockedStep: Math.max(applicant.maxUnlockedStep, 3),
    });
  }
}

function paidAmountMatches(data, bill) {
  const paid = Number(data?.payment_amount || data?.cumulative_payment_amount || 0);
  return paid === Number(bill.amount);
}

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
    if (bniEnabled() && method === "VA_BNI") {
      return res.status(400).json({ message: "Pembayaran BNI dikonfirmasi oleh bank." });
    }
    await settleBill(bill, { method, simulated: true });

    return res.json({
      message: "Pembayaran formulir berhasil dikonfirmasi (simulasi).",
      ...(await loadDashboard(req.user)),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function checkBniStatus(req, res) {
  try {
    if (!bniEnabled()) {
      return res.status(400).json({ message: "VA BNI masih simulasi." });
    }
    const applicant = await Applicant.findOne({ where: { userId: req.user.id } });
    const bill = await Bill.findOne({ where: { applicantId: applicant?.id } });
    if (!bill?.bniTrxId) return res.status(404).json({ message: "Tagihan BNI tidak ditemukan." });
    if (bill.status !== "PAID") {
      const data = await inquireBilling(bill.bniTrxId);
      if (paidAmountMatches(data, bill)) {
        await settleBill(bill, { method: "VA_BNI", simulated: false });
      } else {
        return res.json({ message: "Pembayaran belum masuk.", ...(await loadDashboard(req.user)) });
      }
    }
    return res.json({
      message: "Pembayaran formulir sudah lunas.",
      ...(await loadDashboard(req.user)),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function bniNotify(req, res) {
  try {
    if (!bniEnabled()) return res.status(400).json({ status: "001" });
    const data = decryptNotification(req.body?.data);
    if (!data?.trx_id) return res.status(400).json({ status: "001" });
    if (await confirmAdmissionPaymentFromBni(data)) {
      return res.json({ status: "000" });
    }
    const bill = await Bill.findOne({
      where: {
        [Op.or]: [{ bniTrxId: data.trx_id }, { vaBni: String(data.virtual_account || "") }],
      },
    });
    if (!bill) return res.status(404).json({ status: "007" });
    if (bill.status !== "PAID") {
      if (!paidAmountMatches(data, bill)) return res.status(400).json({ status: "001" });
      await settleBill(bill, { method: "VA_BNI", simulated: false });
    }
    return res.json({ status: "000" });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ status: "001" });
    return res.status(500).json({ status: "008" });
  }
}
