import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";

const METHODS = [
  { id: "QRIS", label: "QRIS", icon: "fa-qrcode", bank: null },
  { id: "VA_BNI", label: "Virtual Account BNI", icon: "fa-university", vaKey: "vaBni" },
  { id: "VA_BCA", label: "Virtual Account BCA", icon: "fa-university", vaKey: "vaBca" },
  { id: "VA_MANDIRI", label: "Virtual Account Mandiri", icon: "fa-university", vaKey: "vaMandiri" },
];

function formatRp(n) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
}

function useCountdown(expiresAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!expiresAt) return { label: "-", expired: false };
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return { label: "00:00:00", expired: true };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (v) => String(v).padStart(2, "0");
  return { label: `${pad(h)}:${pad(m)}:${pad(s)}`, expired: false };
}

export default function StepPayment({ bill, applyPayload, showToast, onPaidNext }) {
  const [method, setMethod] = useState(bill?.selectedMethod || "QRIS");
  const [busy, setBusy] = useState(false);
  const countdown = useCountdown(bill?.expiresAt);
  const paid = bill?.status === "PAID";

  useEffect(() => {
    if (bill?.selectedMethod) setMethod(bill.selectedMethod);
  }, [bill?.selectedMethod]);

  const selected = METHODS.find((m) => m.id === method) || METHODS[0];
  const vaNumber = selected.vaKey ? bill?.[selected.vaKey] : null;

  const qrisCells = useMemo(() => {
    return Array.from({ length: 21 * 21 }, (_, i) => ((i * 17 + (bill?.id || 3) * 13) % 5 > 1));
  }, [bill?.id]);

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(String(text));
      showToast("Disalin", `${label} berhasil disalin.`);
    } catch {
      showToast("Gagal", "Tidak dapat menyalin.");
    }
  };

  const chooseMethod = async (id) => {
    setMethod(id);
    try {
      const { data } = await api.post("/bills/me/method", { method: id });
      applyPayload(data);
    } catch {
      /* tetap ganti di UI */
    }
  };

  const simulate = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/bills/me/simulate-pay", { method });
      applyPayload(data);
      showToast("Pembayaran berhasil", data.message);
    } catch (err) {
      showToast("Gagal", err.response?.data?.message || "Pembayaran gagal.");
    } finally {
      setBusy(false);
    }
  };

  if (paid) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-sky-700 p-6 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <i className="fas fa-receipt" /> Tahap 2: Pembayaran Formulir Pendaftaran
          </h2>
        </div>
        <div className="p-6 space-y-4 text-xs">
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <i className="fas fa-check-circle text-emerald-600 text-2xl" />
              <div>
                <p className="font-bold text-emerald-900 text-sm">
                  Pembayaran Formulir Sebesar {formatRp(bill.amount)} Berhasil Dikonfirmasi
                </p>
                <p className="text-emerald-700">Status: LUNAS (Terverifikasi Simulasi)</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={onPaidNext} className="px-6 py-2.5 bg-sky-600 text-white font-bold rounded-lg shadow">
            Lanjut Ke Tahap 3: Isi Data Pendaftaran <i className="fas fa-arrow-right ml-1" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-sky-700 p-6 text-white">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <i className="fas fa-receipt" /> Tahap 2: Pembayaran Formulir Pendaftaran
        </h2>
      </div>
      <div className="p-6 grid md:grid-cols-2 gap-6 text-xs">
        <div className="space-y-4">
          <div className="border border-slate-200 rounded-2xl p-4">
            <p className="text-slate-500 font-semibold">Rincian tagihan</p>
            <div className="flex justify-between mt-3">
              <span>Formulir PPDB</span>
              <span className="font-bold">{formatRp(bill?.amount)}</span>
            </div>
            <div className="flex justify-between mt-2 pt-2 border-t">
              <span className="font-bold">Total</span>
              <span className="font-extrabold text-sky-700 text-base">{formatRp(bill?.amount)}</span>
            </div>
            <button
              type="button"
              onClick={() => copy(bill?.amount, "Nominal")}
              className="mt-3 w-full py-2 border border-sky-200 text-sky-700 rounded-lg font-bold"
            >
              <i className="fas fa-copy mr-1" /> Salin Nominal
            </button>
          </div>
          <div className={`rounded-2xl p-4 border ${countdown.expired ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
            <p className="font-semibold">Masa berlaku tagihan</p>
            <p className="text-2xl font-extrabold font-mono mt-1">{countdown.label}</p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="font-bold text-slate-700">Pilih metode pembayaran</p>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => chooseMethod(m.id)}
                className={`p-3 rounded-xl border text-left ${method === m.id ? "border-sky-600 bg-sky-50 text-sky-800" : "border-slate-200"}`}
              >
                <i className={`fas ${m.icon} mr-1`} /> {m.label}
              </button>
            ))}
          </div>

          {method === "QRIS" ? (
            <div className="border rounded-2xl p-4 flex flex-col items-center">
              <p className="font-semibold mb-3">Scan QRIS (simulasi)</p>
              <div className="grid grid-cols-[repeat(21,8px)] gap-[1px] bg-white p-3 border rounded-xl">
                {qrisCells.map((on, i) => (
                  <div key={i} className={on ? "w-2 h-2 bg-slate-900" : "w-2 h-2 bg-white"} />
                ))}
              </div>
            </div>
          ) : (
            <div className="border rounded-2xl p-4 space-y-2">
              <p className="font-semibold">{selected.label}</p>
              <p className="font-mono text-lg font-bold tracking-wide">{vaNumber}</p>
              <button type="button" onClick={() => copy(vaNumber, "Nomor VA")} className="w-full py-2 bg-slate-800 text-white rounded-lg font-bold">
                <i className="fas fa-copy mr-1" /> Salin Nomor VA
              </button>
            </div>
          )}

          <button
            type="button"
            disabled={busy || countdown.expired}
            onClick={simulate}
            className="w-full py-3 bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-xl shadow"
          >
            {busy ? "Memproses..." : "Simulasi: Saya Sudah Bayar"}
          </button>
        </div>
      </div>
    </div>
  );
}
