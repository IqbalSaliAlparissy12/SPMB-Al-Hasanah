import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import StepRegister from "./steps/StepRegister";
import StepPayment from "./steps/StepPayment";
import StepForm from "./steps/StepForm";
import StepExam from "./steps/StepExam";
import StepAnnounce from "./steps/StepAnnounce";
import StepDocs from "./steps/StepDocs";

const STEPS = [
  { n: 1, label: "1. Registrasi" },
  { n: 2, label: "2. Pembayaran" },
  { n: 3, label: "3. Isi Data" },
  { n: 4, label: "4. Ujian dan Wawancara" },
  { n: 5, label: "5. Surat Keputusan dan Biaya Masuk" },
  { n: 6, label: "6. Dokumen" },
];

export default function Dashboard({ showToast }) {
  const navigate = useNavigate();
  const { user, applicant, bill, documents, logout, applyPayload } = useAuth();
  const [error, setError] = useState("");
  const [stageOpen, setStageOpen] = useState({ 1: true, 2: true, 3: true, 4: true, 5: true, 6: true });
  const current = applicant?.currentStep || 1;
  const max = applicant?.maxUnlockedStep || 2;

  useEffect(() => {
    if (!applicant?.schoolId) return;
    api
      .get(`/schools/${applicant.schoolId}/stages`)
      .then(({ data }) => {
        const next = { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true };
        (data.stages || []).forEach((s) => {
          next[s.step] = s.enabled !== false;
        });
        setStageOpen(next);
      })
      .catch(() => {});
  }, [applicant?.schoolId]);

  useEffect(() => {
    if (current !== 5 || applicant?.announcementStatus !== "LULUS") return undefined;
    let active = true;
    const refreshAdmissionDetails = () => {
      api
        .get("/me")
        .then(({ data }) => {
          if (active) applyPayload(data);
        })
        .catch((err) => {
          if (active) {
            showToast?.("Gagal memuat paket", err.response?.data?.message || "Tidak dapat memperbarui detail biaya masuk.");
          }
        });
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshAdmissionDetails();
    };

    refreshAdmissionDetails();
    window.addEventListener("focus", refreshAdmissionDetails);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshAdmissionDetails);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [current, applicant?.announcementStatus, applyPayload, showToast]);

  const goToStep = async (step) => {
    const openingDocs = step === 6 && applicant?.announcementStatus === "LULUS" && max >= 5;
    if (step > max && !openingDocs) {
      setError("Tahap ini masih terkunci. Selesaikan tahap sebelumnya.");
      showToast("Terkunci", "Selesaikan tahap sebelumnya terlebih dahulu.");
      return;
    }
    if (stageOpen[step] === false) {
      setError("Tahap ini belum dibuka oleh TU.");
      showToast("Ditutup TU", "TU belum membuka tahap ini.");
      return;
    }
    setError("");
    try {
      const { data } = await api.post("/applicants/me/step", { step });
      applyPayload(data);
    } catch (err) {
      showToast("Gagal", err.response?.data?.message || "Tidak dapat pindah tahap.");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/wali");
  };

  const progressWidth = `${((Math.min(current, 6) - 1) / 5) * 100}%`;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-100">
      <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
              <i className="fas fa-graduation-cap" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-base">SPMB Online Terpadu</h1>
              <p className="text-xs text-slate-500">Al-Hasanah Bengkulu</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs font-semibold bg-sky-50 text-sky-800 px-3 py-1 rounded-full border border-sky-200">
              {user?.name || "Orang Tua / Wali"}
            </span>
            <button onClick={handleLogout} className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-xs font-bold rounded-full">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 flex-1 w-full">
        <div className="no-print mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="overflow-x-auto md:overflow-visible custom-scrollbar pb-2 md:pb-0">
            <div className="min-w-[650px] flex items-center justify-between relative isolate px-4">
              <div className="absolute left-10 right-10 top-5 h-1 bg-slate-200 -z-10" />
              <div className="absolute left-10 top-5 h-1 bg-sky-600 transition-all duration-500 -z-10" style={{ width: progressWidth }} />
              {STEPS.map((s) => {
                const active = s.n <= current;
                const openingDocs = s.n === 6 && applicant?.announcementStatus === "LULUS" && max >= 5;
                const locked = (s.n > max && !openingDocs) || stageOpen[s.n] === false;
                return (
                  <button
                    key={s.n}
                    type="button"
                    onClick={() => goToStep(s.n)}
                    className={`relative z-10 flex flex-col items-center ${locked ? "opacity-70" : "cursor-pointer"}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full font-bold flex items-center justify-center transition-all ${
                        active ? "bg-sky-600 text-white shadow" : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {locked ? <i className="fas fa-lock text-[10px]" /> : s.n}
                    </div>
                    <span className={`text-[11px] mt-2 text-center max-w-[8.5rem] leading-tight ${active ? "font-bold text-sky-600" : "font-medium text-slate-400"}`}>
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error ? <p className="no-print mb-4 text-xs text-red-600">{error}</p> : null}
        {stageOpen[current] === false ? (
          <p className="no-print mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Tahap ini ditutup sementara oleh TU. Silakan cek lagi nanti.
          </p>
        ) : null}

        {stageOpen[current] !== false && current === 1 && <StepRegister applicant={applicant} onNext={() => goToStep(2)} />}
        {stageOpen[current] !== false && current === 2 && (
          <StepPayment applicant={applicant} bill={bill} applyPayload={applyPayload} showToast={showToast} onPaidNext={() => goToStep(3)} />
        )}
        {stageOpen[current] !== false && current === 3 && <StepForm applicant={applicant} applyPayload={applyPayload} showToast={showToast} />}
        {stageOpen[current] !== false && current === 4 && (
          <StepExam applicant={applicant} applyPayload={applyPayload} showToast={showToast} onNext={() => goToStep(5)} />
        )}
        {stageOpen[current] !== false && current === 5 && (
          <StepAnnounce applicant={applicant} applyPayload={applyPayload} showToast={showToast} onNext={() => goToStep(6)} />
        )}
        {stageOpen[current] !== false && current === 6 && <StepDocs documents={documents} applyPayload={applyPayload} showToast={showToast} />}
      </main>
    </div>
  );
}
