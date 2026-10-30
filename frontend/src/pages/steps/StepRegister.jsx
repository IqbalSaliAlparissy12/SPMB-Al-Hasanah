import { useEffect, useState } from "react";
import api from "../../api/client";
import { sanitizeRichHtml } from "../../components/RichTextEditor";

export default function StepRegister({ applicant, onNext }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api
      .get("/requirements/published")
      .then(({ data }) => setItems(data.requirements || []))
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-sky-700 p-6 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <i className="fas fa-user-check" /> Tahap 1: Registrasi Akun Wali Murid
          </h2>
        </div>
        <div className="p-6 space-y-4 text-xs">
          <div className="bg-sky-50 border border-sky-200 p-4 rounded-xl space-y-2">
            <p className="font-bold text-sky-900 text-sm">Status Registrasi: AKTIF</p>
            <p className="text-slate-600">
              Akun pendaftaran atas nama calon siswa <strong>{applicant?.studentName}</strong> telah berhasil dibuat.
            </p>
            {applicant?.schoolTarget ? (
              <p className="text-slate-600">
                Lembaga tujuan: <strong>{applicant.schoolTarget}</strong>
                {applicant?.kelasName ? <> · Kelas <strong>{applicant.kelasName}</strong></> : null}
              </p>
            ) : null}
            <p className="text-slate-600">
              Status: <strong>{applicant?.isAlumni ? "Alumni Al-Hasanah" : "Siswa baru"}</strong>
            </p>
          </div>
        </div>
      </div>

      {items.map((item) => (
        <article key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-sky-800">
          <h3 className="font-bold text-sm mb-3">{item.title}</h3>
          {/<\/?[a-z][\s\S]*>/i.test(item.body || "") ? (
            <div
              className="rich-body text-xs leading-6"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(item.body) }}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-xs leading-6">{item.body}</pre>
          )}
        </article>
      ))}

      <button type="button" onClick={onNext} className="px-6 py-2.5 bg-sky-600 text-white font-bold rounded-lg shadow">
        Lanjut Ke Tahap 2: Pembayaran <i className="fas fa-arrow-right ml-1" />
      </button>
    </div>
  );
}
