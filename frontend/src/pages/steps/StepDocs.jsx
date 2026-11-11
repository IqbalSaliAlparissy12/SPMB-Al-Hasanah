import { useEffect, useState } from "react";
import api from "../../api/client";
import FilePickButton from "../../components/FilePickButton";

export default function StepDocs({ documents, applyPayload, showToast }) {
  const [busy, setBusy] = useState(false);
  const [required, setRequired] = useState([]);

  useEffect(() => {
    api
      .get("/doc-requirements/published")
      .then(({ data }) => setRequired(data.documents || []))
      .catch(() => setRequired([]));
  }, []);

  const fileOf = (code) => documents?.find((d) => d.kind === code);

  const upload = async (item, file) => {
    if (!file) return;
    const body = new FormData();
    body.append("kind", item.code);
    body.append("file", file);
    setBusy(true);
    try {
      const { data } = await api.post("/documents", body);
      applyPayload(data);
      showToast("Unggah", data.message);
    } catch (err) {
      showToast("Gagal", err.response?.data?.message || "Unggah gagal.");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/documents/finish");
      applyPayload(data);
      if (data.raporUrl) {
        window.location.href = data.raporUrl;
        return;
      }
      showToast("Selesai", data.message);
    } catch (err) {
      showToast("Belum lengkap", err.response?.data?.message || "Lengkapi dokumen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-sky-700 p-6 text-white">
        <h2 className="text-xl font-bold">
          <i className="fas fa-folder-open mr-2" /> Tahap 6: Unggah Dokumen Fisik
        </h2>
      </div>
      <div className="p-6 space-y-4 text-xs">
        <p className="text-slate-500">Setiap dokumen maksimal 2 MB.</p>
        <div className="border rounded-xl p-4 space-y-3">
          {required.length === 0 ? (
            <p className="text-slate-500">Belum ada dokumen yang diminta TU.</p>
          ) : null}
          {required.map((item) => (
            <div key={item.code} className="flex justify-between items-center gap-3">
              <span>{item.name}</span>
              <FilePickButton
                accept="image/*,.pdf"
                disabled={busy}
                icon={fileOf(item.code) ? "fa-check-circle" : "fa-file-upload"}
                label={fileOf(item.code) ? "Ganti file" : "Pilih file"}
                fileName={fileOf(item.code)?.originalName}
                variant={fileOf(item.code) ? "emerald" : "sky"}
                onFile={(file) => upload(item, file)}
              />
            </div>
          ))}
        </div>
        <button disabled={busy || required.length === 0} type="button" onClick={finish} className="w-full py-3 bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-xl shadow">
          Selesaikan Pendaftaran
        </button>
      </div>
    </div>
  );
}
