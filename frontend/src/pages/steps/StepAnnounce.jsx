import { useEffect, useState } from "react";
import api from "../../api/client";
import { sanitizeRichHtml } from "../../components/RichTextEditor";

function StatementBody({ body }) {
  if (/<\/?[a-z][\s\S]*>/i.test(body || "")) {
    return <div className="rich-body text-xs leading-6 text-left" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(body) }} />;
  }
  return <pre className="whitespace-pre-wrap font-sans text-xs leading-6 text-left">{body}</pre>;
}

export default function StepAnnounce({ applicant, onNext }) {
  const lulus = applicant?.announcementStatus === "LULUS";
  const [items, setItems] = useState([]);

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
            <h3 className="text-lg font-bold text-emerald-900 mt-1">SUDAH LULUS</h3>
            {applicant?.amanahSiswaId ? (
              <p className="mt-2 text-emerald-700">Sudah dikirim ke Amanah (ID siswa {applicant.amanahSiswaId}).</p>
            ) : null}
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center">
            <h3 className="text-lg font-bold text-amber-900">BELUM LULUS</h3>
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
          <div className="text-center">
            <button type="button" onClick={onNext} className="px-6 py-2.5 bg-sky-600 text-white font-bold rounded-lg shadow">
              Lanjut Unggah Dokumen <i className="fas fa-arrow-right ml-1" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
