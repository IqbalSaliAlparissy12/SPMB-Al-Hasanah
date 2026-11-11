import { randomUUID } from "crypto";
import { Op } from "sequelize";
import {
  AdmissionPayment,
  Applicant,
  Bill,
  db,
} from "../models/index.js";
import { loadDashboard } from "./Auth.Controller.js";
import { bniConfig, bniEnabled, createCloseBilling, inquireBilling } from "../services/bniEcollection.js";
import { generateVirtualAccounts } from "../utils/va.js";

async function uniqueVirtualAccount() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const virtualAccount = generateVirtualAccounts(bniConfig().prefix).vaBni;
    const [existingBill, existingPayment] = await Promise.all([
      Bill.findOne({ where: { vaBni: virtualAccount } }),
      AdmissionPayment.findOne({ where: { virtualAccount } }),
    ]);
    if (!existingBill && !existingPayment) return virtualAccount;
  }
  throw new Error("Tidak dapat membuat nomor VA unik.");
}

export async function startAdmissionPayment(req, res) {
  let payment;
  try {
    if (!bniEnabled()) {
      return res.status(503).json({ message: "Pembayaran online biaya masuk belum tersedia. Silakan hubungi TU untuk pembayaran manual." });
    }

    const amount = Number(req.body?.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647) {
      return res.status(400).json({ message: "Nominal pembayaran harus berupa bilangan bulat lebih dari Rp0." });
    }
    const dashboard = await loadDashboard(req.user);
    const applicant = dashboard.applicant;
    const admissionPackage = applicant?.admissionPackage;
    if (!applicant || applicant.announcementStatus !== "LULUS") {
      return res.status(409).json({ message: "Pembayaran biaya masuk tersedia setelah calon siswa dinyatakan lulus." });
    }
    if (!admissionPackage?.configured) {
      return res.status(409).json({ message: "Paket dan rincian biaya masuk belum tersedia." });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const virtualAccount = await uniqueVirtualAccount();
    const trxId = `ADM${applicant.id}${randomUUID().replace(/-/g, "").slice(0, 20)}`;

    await db.transaction(async (transaction) => {
      await Applicant.findByPk(applicant.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const currentDashboard = await loadDashboard(req.user);
      const currentPackage = currentDashboard.applicant?.admissionPackage;
      if (currentDashboard.applicant?.announcementStatus !== "LULUS" || !currentPackage?.configured) {
        const error = new Error("Paket biaya masuk tidak lagi tersedia untuk pembayaran.");
        error.status = 409;
        throw error;
      }
      const payments = await AdmissionPayment.findAll({
        where: { applicantId: applicant.id, status: { [Op.in]: ["PAID", "PENDING"] } },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const pending = payments.find((item) => item.status === "PENDING");
      if (pending && pending.expiresAt && new Date(pending.expiresAt) <= new Date()) {
        await pending.update({ status: "EXPIRED" }, { transaction });
        payments.splice(payments.indexOf(pending), 1);
      } else if (pending) {
        const error = new Error("Masih ada tagihan online yang menunggu pembayaran. Selesaikan atau tunggu kedaluwarsa terlebih dahulu.");
        error.status = 409;
        throw error;
      }

      const paidAmount = payments
        .filter((item) => item.status === "PAID")
        .reduce((sum, item) => sum + Number(item.amount), 0);
      const balance = Math.max(0, Number(currentPackage.totalAmount) - paidAmount);
      if (amount > balance) {
        const error = new Error(`Nominal melebihi sisa tagihan ${balance.toLocaleString("id-ID")}.`);
        error.status = 400;
        throw error;
      }
      payment = await AdmissionPayment.create({
        applicantId: applicant.id,
        amount,
        method: "VA_BNI",
        status: "PENDING",
        bniTrxId: trxId,
        virtualAccount,
        expiresAt,
      }, { transaction });
    });

    const created = await createCloseBilling({
      trxId,
      amount,
      customerName: applicant.studentName,
      customerPhone: req.user.wa,
      virtualAccount,
      expiresAt,
      description: "Biaya masuk SPMB",
    });
    if (created?.virtual_account && String(created.virtual_account) !== payment.virtualAccount) {
      await payment.update({ virtualAccount: String(created.virtual_account) });
    }

    return res.status(201).json({
      message: "Tagihan pembayaran biaya masuk berhasil dibuat.",
      payment: {
        id: payment.id,
        amount: payment.amount,
        virtualAccount: payment.virtualAccount,
        expiresAt: payment.expiresAt,
        status: payment.status,
      },
    });
  } catch (error) {
    const pendingPaymentCreated = payment?.status === "PENDING";
    const message = pendingPaymentCreated
      ? `${error.message || "Tidak dapat memastikan pembuatan tagihan."} Tagihan sedang ditelusuri; perbarui status sebelum mencoba lagi.`
      : error.message || "Tidak dapat membuat tagihan pembayaran biaya masuk.";
    return res.status(error.status || 502).json({ message, pendingPaymentCreated });
  }
}

export async function checkAdmissionPayment(req, res) {
  try {
    const applicant = await Applicant.findOne({ where: { userId: req.user.id } });
    if (!applicant) return res.status(404).json({ message: "Data calon siswa tidak ditemukan." });
    const payment = await AdmissionPayment.findOne({
      where: { applicantId: applicant.id, status: "PENDING" },
      order: [["createdAt", "DESC"]],
    });
    if (!payment) return res.json({ message: "Tidak ada pembayaran online yang menunggu konfirmasi." });
    if (payment.expiresAt && new Date(payment.expiresAt) <= new Date()) {
      await payment.update({ status: "EXPIRED" });
      return res.json({ message: "Tagihan pembayaran biaya masuk telah kedaluwarsa." });
    }
    if (!bniEnabled()) {
      return res.status(503).json({ message: "Pengecekan pembayaran online belum tersedia." });
    }

    const result = await inquireBilling(payment.bniTrxId);
    const paidAmount = Number(result?.payment_amount || result?.cumulative_payment_amount || 0);
    if (paidAmount === Number(payment.amount)) {
      await payment.update({ status: "PAID", paidAt: new Date() });
      return res.json({ message: "Pembayaran biaya masuk berhasil dikonfirmasi." });
    }
    return res.json({ message: "Pembayaran belum dikonfirmasi oleh bank." });
  } catch (error) {
    return res.status(502).json({ message: error.message || "Tidak dapat memeriksa pembayaran." });
  }
}

export async function confirmAdmissionPaymentFromBni(data) {
  if (!data?.trx_id) return false;
  const payment = await AdmissionPayment.findOne({
    where: {
      [Op.or]: [
        { bniTrxId: data.trx_id },
        { virtualAccount: String(data.virtual_account || "") },
      ],
    },
  });
  if (!payment) return false;
  if (payment.status !== "PAID") {
    const paidAmount = Number(data.payment_amount || data.cumulative_payment_amount || 0);
    if (paidAmount !== Number(payment.amount)) {
      const error = new Error("Nominal pembayaran BNI tidak sesuai dengan tagihan.");
      error.status = 400;
      throw error;
    }
    await payment.update({ status: "PAID", paidAt: new Date() });
  }
  return true;
}
