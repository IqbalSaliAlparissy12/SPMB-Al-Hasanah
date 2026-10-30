import { useEffect, useState } from "react";
import api from "../../api/client";
import ExamCard from "../../components/ExamCard";
import FilePickButton from "../../components/FilePickButton";

export default function StepExam({ applicant, applyPayload, showToast, onNext }) {
  const [busy, setBusy] = useState(false);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    api
      .get("/statements/published")
      .then(({ data }) => setDocuments((data.statements || []).filter((item) => item.filePath)))
      .catch(() => setDocuments([]));
  }, []);

  const uploadPhoto = async (file) => {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    setBusy(true);
    try {
      const { data } = await api.post("/applicants/me/photo", body);
      applyPayload(data);
      showToast("Foto tersimpan", data.message);
    } catch (err) {
      showToast("Gagal", err.response?.data?.message || "Unggah foto gagal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-sky-700 p-6 text-white no-print">
        <h2 className="text-xl font-bold">
          <i className="fas fa-comments mr-2" /> Tahap 4: Ujian dan Wawancara
        </h2>
      </div>
      <div className="p-6 space-y-5 text-xs">
        <p className="no-print text-slate-600">
          Tahap ini meliputi ujian seleksi dan wawancara. Unduh atau cetak kartu di bawah, lalu hadir sesuai jadwal yang ditentukan sekolah.
        </p>
        {documents.length ? (
          <div className="no-print border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-2">
            <p className="font-bold text-amber-900">Dokumen wajib diunduh</p>
            <p className="text-slate-600">Unduh surat pernyataan berikut sebelum mengikuti ujian dan wawancara.</p>
            <div className="space-y-2">
              {documents.map((item) => (
                <a
                  key={item.id}
                  href={item.filePath}
                  download={item.originalName || item.title}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-amber-300 text-amber-900 font-bold rounded-lg"
                >
                  <i className="fas fa-download" />
                  Unduh {item.title}
                </a>
              ))}
            </div>
          </div>
        ) : null}
        <div className="no-print grid md:grid-cols-[1fr_220px] gap-4 items-start">
          <div className="border border-slate-200 rounded-xl p-4 space-y-2">
            <p className="font-bold text-slate-800">Foto calon siswa (3x4)</p>
            <p className="text-slate-500">Unggah foto rapi berlatar polos. Foto akan tampil di kartu seleksi.</p>
            <FilePickButton
              accept="image/*"
              disabled={busy}
              icon="fa-camera"
              label={applicant?.photoPath ? "Ganti foto" : "Unggah foto"}
              fileName={applicant?.photoPath ? "Foto sudah terpasang" : ""}
              onFile={uploadPhoto}
            />
          </div>
        </div>

        <div className="print-stage bg-slate-500 py-8 px-4 rounded-xl">
          <ExamCard applicant={applicant} />
        </div>

        <div className="no-print flex flex-wrap gap-2 justify-center">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-6 py-2.5 bg-sky-600 text-white font-bold rounded-lg shadow"
          >
            Cetak Kartu Ujian
          </button>
          {applicant?.announcementStatus === "LULUS" ? (
            <button type="button" onClick={onNext} className="px-6 py-2.5 bg-slate-800 text-white font-bold rounded-lg shadow">
              Lanjut ke Surat Keputusan dan Biaya Masuk <i className="fas fa-arrow-right ml-1" />
            </button>
          ) : (
            <p className="text-slate-600 self-center">
              Menunggu hasil tes dari Guru atau TU. Tahap berikutnya terbuka setelah dinyatakan lulus.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
