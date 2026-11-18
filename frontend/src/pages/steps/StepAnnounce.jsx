import { useEffect, useState } from "react";
import api from "../../api/client";
import { sanitizeRichHtml } from "../../components/RichTextEditor";

function StatementBody({ body }) {
  if (/<\/?[a-z][\s\S]*>/i.test(body || "")) {
    return <div className="rich-body text-xs leading-6 text-left" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(body) }} />;
  }
  return <pre className="whitespace-pre-wrap font-sans text-xs leading-6 text-left">{body}</pre>;
}

export default function StepAnnounce({ applicant, applyPayload, showToast, onNext }) {
  const lulus = applicant?.announcementStatus === "LULUS";
  const statusLabels = {
    LULUS: "LULUS",
    TIDAK_LULUS: "TIDAK LULUS",
    LULUS_CADANGAN: "LULUS CADANGAN",
    MENGUNDURKAN_DIRI: "MENGUNDURKAN DIRI",
  };
  const statusLabel = statusLabels[applicant?.announcementStatus] || "MENUNGGU HASIL TES";
  const announcementDate = applicant?.announcementDate
    ? new Date(`${applicant.announcementDate}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : "";
  const admissionPackage = applicant?.admissionPackage;
  const formatRp = (amount) => `Rp${Number(amount || 0).toLocaleString("id-ID")}`;
  const [items, setItems] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);

  const refreshAdmissionStatus = async () => {
    try {
      const { data } = await api.get("/me");
      applyPayload(data);
    } catch (error) {
      showToast?.("Gagal", error.response?.data?.message || "Tidak dapat memperbarui status pembayaran.");
    }
  };

  const createOnlinePayment = async () => {
    setPaymentBusy(true);
    try {
      const { data } = await api.post("/admission-payments/me", { amount: Number(paymentAmount) });
      setPaymentAmount("");
      await refreshAdmissionStatus();
      showToast?.("Tagihan dibuat", `${data.message} VA BNI: ${data.payment.virtualAccount}`);
    } catch (error) {
      if (error.response?.data?.pendingPaymentCreated) await refreshAdmissionStatus();
      showToast?.("Gagal", error.response?.data?.message || "Tidak dapat membuat tagihan pembayaran.");
    } finally {
      setPaymentBusy(false);
    }
  };

  const checkPaymentStatus = async () => {
    setPaymentBusy(true);
    try {
      const { data } = await api.post("/admission-payments/me/check");
      await refreshAdmissionStatus();
      showToast?.("Status pembayaran", data.message);
    } catch (error) {
      showToast?.("Gagal", error.response?.data?.message || "Tidak dapat memeriksa pembayaran.");
    } finally {
      setPaymentBusy(false);
    }
  };

  useEffect(() => {
    if (!lulus) return;
    api
      .get("/statements/published")
      .then(({ data }) => setItems(data.statements || []))
      .catch(() => setItems([]));
  }, [lulus]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className={`${lulus ? "bg-emerald-600" : "bg-slate-700"} p-6 text-white`}>
        <h2 className="text-xl font-bold">
          <i className="fas fa-file-signature mr-2" /> Tahap 5: Surat Keputusan dan Biaya Masuk
        </h2>
      </div>
      <div className="p-6 space-y-4 text-xs">
        {lulus ? (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
            <span className="text-xs font-bold text-emerald-800 uppercase">Status</span>
            <h3 className="text-lg font-bold text-emerald-900 mt-1">{statusLabel}</h3>
            {announcementDate ? <p className="mt-1 text-emerald-700">Tanggal pengumuman: {announcementDate}</p> : null}
            {applicant?.amanahSiswaId ? (
              <p className="mt-2 text-emerald-700">Sudah dikirim ke Amanah (ID siswa {applicant.amanahSiswaId}).</p>
            ) : null}
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center">
            <h3 className="text-lg font-bold text-amber-900">{statusLabel}</h3>
            <p className="text-slate-600 mt-1">Tahap ini terbuka setelah Guru atau TU menyimpan hasil tes dengan status lulus.</p>
          </div>
        )}

        {lulus
          ? items.map((item) => (
              <article key={item.id} className="border border-slate-200 rounded-xl p-4 text-sky-900">
                <h3 className="font-bold text-sm mb-3">{item.title}</h3>
                <StatementBody body={item.body} />
              </article>
            ))
          : null}

        {lulus ? (
          <section className="border border-sky-200 rounded-xl overflow-hidden">
            <div className="bg-sky-50 px-4 py-3">
              <h3 className="font-bold text-sm text-sky-900">Paket dan rincian biaya masuk</h3>
              <p className="text-slate-600 mt-1">
                Paket pembayaran: <strong>{admissionPackage?.packageName || "Belum ditetapkan oleh Guru"}</strong>
                {admissionPackage?.academicYear ? ` · Tahun ajaran ${admissionPackage.academicYear}` : ""}
              </p>
            </div>
            {admissionPackage?.configured ? (
              <div className="p-4">
                <div className="divide-y">
                  {admissionPackage.items.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="text-slate-700">
                        <span className="font-semibold">{item.name}</span>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {formatRp(item.globalAmount)} − {formatRp(item.deductionAmount)} + {formatRp(item.oasisAmount)}
                        </div>
                        {item.description ? (
                          <div className="mt-1 text-[11px] text-slate-600">
                            <span className="font-semibold">Keterangan:</span> {item.description}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <span className="block text-[10px] uppercase text-slate-500">Nominal biaya</span>
                        <span className="font-semibold text-slate-800">{formatRp(item.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between gap-4 border-t border-slate-300 pt-3 mt-2 font-bold text-slate-900">
                  <span>Total biaya masuk</span>
                  <span>{formatRp(admissionPackage.totalAmount)}</span>
                </div>
                <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
                  <p><span className="block text-[10px] uppercase text-slate-500">Dibayar orang tua</span><strong>{formatRp(admissionPackage.paidAmount)}</strong></p>
                  <p><span className="block text-[10px] uppercase text-slate-500">Menunggu konfirmasi</span><strong>{formatRp(admissionPackage.pendingAmount)}</strong></p>
                  <p><span className="block text-[10px] uppercase text-slate-500">Sisa tagihan</span><strong className="text-rose-700">{formatRp(admissionPackage.remainingAmount)}</strong></p>
                </div>
                {admissionPackage.remainingAmount > 0 && admissionPackage.onlinePaymentEnabled ? (
                  <div className="mt-4 space-y-3 rounded-xl border border-sky-200 p-4">
                    <h4 className="font-bold text-sky-900">Bayar biaya masuk</h4>
                    <p className="text-slate-600">Pembayaran dapat dicicil. Pembayaran online menggunakan Virtual Account BNI dan akan tercatat setelah dikonfirmasi bank.</p>
                    {admissionPackage.pendingAmount > 0 ? (
                      <p className="rounded-lg bg-amber-50 p-3 text-amber-800">
                        Ada tagihan online {formatRp(admissionPackage.pendingAmount)} yang menunggu pembayaran. Selesaikan pembayaran tersebut atau tunggu kedaluwarsa sebelum membuat tagihan berikutnya.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="number"
                          min="1"
                          max={admissionPackage.remainingAmount}
                          step="1"
                          inputMode="numeric"
                          aria-label="Nominal pembayaran biaya masuk"
                          placeholder={`Nominal (maks. ${formatRp(admissionPackage.remainingAmount)})`}
                          className="min-w-0 flex-1 rounded-lg border px-3 py-2"
                          value={paymentAmount}
                          onChange={(event) => setPaymentAmount(event.target.value)}
                          disabled={paymentBusy}
                        />
                        <button
                          type="button"
                          onClick={createOnlinePayment}
                          disabled={paymentBusy || !paymentAmount}
                          className="rounded-lg bg-sky-600 px-4 py-2 font-bold text-white disabled:opacity-50"
                        >
                          {paymentBusy ? "Memproses..." : "Buat tagihan VA"}
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={checkPaymentStatus}
                      disabled={paymentBusy}
                      className="text-sky-700 font-semibold underline disabled:opacity-50"
                    >
                      Perbarui status pembayaran
                    </button>
                  </div>
                ) : null}
                {admissionPackage.remainingAmount > 0 && !admissionPackage.onlinePaymentEnabled ? (
                  <p className="mt-4 rounded-lg bg-amber-50 p-3 text-amber-800">
                    Pembayaran online belum tersedia. Silakan hubungi TU untuk membayar dan mencatat pembayaran secara manual.
                  </p>
                ) : null}
                {admissionPackage.payments?.length ? (
                  <div className="mt-4 overflow-x-auto rounded-xl border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Tanggal</th>
                          <th className="px-3 py-2">Metode</th>
                          <th className="px-3 py-2">Nominal</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admissionPackage.payments.map((payment) => (
                          <tr key={payment.id} className="border-t">
                            <td className="px-3 py-2">{new Date(payment.paidAt || payment.createdAt).toLocaleString("id-ID")}</td>
                            <td className="px-3 py-2">
                              {payment.method === "MANUAL" ? "Transfer / tunai dicatat TU" : "Virtual Account BNI"}
                              {payment.virtualAccount && payment.status === "PENDING" ? (
                                <span className="block font-mono font-semibold text-slate-700">VA: {payment.virtualAccount}</span>
                              ) : null}
                              {payment.expiresAt && payment.status === "PENDING" ? (
                                <span className="block text-[10px] text-slate-500">Berlaku sampai {new Date(payment.expiresAt).toLocaleString("id-ID")}</span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">{formatRp(payment.amount)}</td>
                            <td className="px-3 py-2">{payment.status === "PAID" ? "Terkonfirmasi" : payment.status === "PENDING" ? "Menunggu pembayaran" : payment.status === "EXPIRED" ? "Kedaluwarsa" : "Gagal"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="px-4 py-3 text-amber-700">
                {admissionPackage
                  ? `Rincian biaya tahun ajaran ${admissionPackage.academicYear} belum diatur pada Setup Tahunan.`
                  : "Paket pembayaran belum ditetapkan oleh Guru pada form hasil tes."}
              </div>
            )}
          </section>
        ) : null}

        {lulus ? (
          <div className="text-center">
            <button type="button" onClick={onNext} className="px-6 py-2.5 bg-sky-600 text-white font-bold rounded-lg shadow">
              Lanjut Dokumen dan Validasi Data <i className="fas fa-arrow-right ml-1" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
