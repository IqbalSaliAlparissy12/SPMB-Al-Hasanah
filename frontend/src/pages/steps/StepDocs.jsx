import { useEffect, useState } from "react";
import api from "../../api/client";
import FilePickButton from "../../components/FilePickButton";
import { PAYER_TYPES, updateValidationValue } from "./payerData";

const SECTION_ICONS = ["fa-user-graduate", "fa-user-tie", "fa-user-nurse", "fa-hand-holding-dollar", "fa-map-marked-alt"];

export default function StepDocs({ documents, applyPayload, showToast }) {
  const [busy, setBusy] = useState(false);
  const [required, setRequired] = useState([]);
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState(0);
  const [values, setValues] = useState({});
  const [isAlumni, setIsAlumni] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");
  const [importWarning, setImportWarning] = useState("");
  const [validationErrors, setValidationErrors] = useState([]);

  useEffect(() => {
    api
      .get("/doc-requirements/published")
      .then(({ data }) => setRequired(data.documents || []))
      .catch(() => setRequired([]));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    api.get("/applicants/me/student-validation", { signal: controller.signal })
      .then(({ data }) => {
        setSections(data.sections);
        setValues(data.values);
        setIsAlumni(data.isAlumni);
        setImportWarning(data.importWarning || "");
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setDataError(err.response?.data?.message || "Data validasi tidak dapat dimuat. Muat ulang halaman untuk mencoba kembali.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingData(false);
      });
    return () => controller.abort();
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
      const saved = await api.put("/applicants/me/student-validation", { values });
      setValidationErrors(saved.data.errors);
      if (saved.data.errors.length) {
        showToast("Data belum lengkap", "Periksa daftar data wajib di bawah formulir.");
        return;
      }
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

  const saveData = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/applicants/me/student-validation", { values });
      setValidationErrors(data.errors);
      showToast("Data tersimpan", data.message);
    } catch (err) {
      showToast("Gagal menyimpan", err.response?.data?.message || "Data siswa tidak dapat disimpan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-sky-700 p-6 text-white">
        <h2 className="text-xl font-bold">
          <i className="fas fa-folder-open mr-2" /> Tahap 6: Dokumen dan Validasi Data Siswa
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
        <div className="border rounded-xl p-4 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Validasi Data Siswa</h3>
            <p className="text-slate-500 mt-1">Pilih tab untuk mengisi data. Lengkapi seluruh kolom bertanda * sebelum menyelesaikan pendaftaran.</p>
          </div>
          {loadingData ? <p className="text-slate-500">Memuat data siswa...</p> : null}
          {dataError ? <p role="alert" className="text-red-600">{dataError}</p> : null}
          {!loadingData && !dataError && isAlumni ? (
            <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 space-y-2">
              <p className="text-slate-700">Data alumni yang tersedia di Amanah diisi otomatis. Isian yang sudah ada tidak ditimpa.</p>
              {importWarning ? <p role="alert" className="text-amber-700">{importWarning}</p> : null}
              <p className="text-slate-500">Kolom yang tidak tersedia di Amanah tetap perlu dilengkapi.</p>
            </div>
          ) : null}
          {!loadingData && !dataError ? (
            <nav aria-label="Bagian validasi data siswa" className="border-b border-slate-200 bg-slate-50 px-3 pt-3 flex gap-2 overflow-x-auto custom-scrollbar">
              {sections.map((section, index) => (
                <button
                  key={section.title}
                  type="button"
                  aria-pressed={activeSection === index}
                  onClick={() => setActiveSection(index)}
                  className={`tab-btn shrink-0 px-4 py-2.5 font-semibold text-xs rounded-t-xl border-t border-x border-slate-200 transition-all flex items-center gap-2 ${activeSection === index ? "active" : "text-slate-500"}`}
                >
                  <i className={`fas ${SECTION_ICONS[index] || "fa-user"}`} aria-hidden="true" /> {index + 1}. {section.title}
                </button>
              ))}
            </nav>
          ) : null}
          {!loadingData && !dataError && sections.map((section, index) => index === activeSection ? (
            <section key={section.title} className="space-y-3">
              <h4 className="font-bold text-slate-700 border-b pb-2">{section.title}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {section.fields.map((item) => {
                  const props = {
                    id: `validation-${item.key}`,
                    className: "w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:border-sky-500",
                    value: values[item.key] || "",
                    disabled: busy,
                    onChange: (e) => {
                      const value = e.target.value;
                      setValues((prev) => updateValidationValue(prev, item.key, value));
                    },
                    maxLength: item.maxLength,
                    inputMode: item.inputMode,
                  };
                  return (
                    <div key={item.key}>
                      <label htmlFor={props.id} className="block font-semibold text-slate-700 mb-1">{item.label}{item.required ? " *" : ""}</label>
                      {item.key === "payerType" ? (
                        <select {...props}>
                          <option value="">Pilih</option>
                          {props.value && !PAYER_TYPES.includes(props.value) ? <option value={props.value}>{props.value}</option> : null}
                          {PAYER_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      ) : item.options ? (
                        <select {...props}><option value="">Pilih</option>{item.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
                      ) : item.type === "textarea" ? (
                        <textarea {...props} rows={2} />
                      ) : (
                        <input {...props} type={item.type || "text"} min={item.min} />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null)}
          {validationErrors.length > 0 ? (
            <div role="alert" className="text-red-700 bg-red-50 rounded-lg p-3">
              <p className="font-semibold">Periksa data berikut:</p>
              <ul className="list-disc ml-4 mt-1">{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>
            </div>
          ) : null}
          {!loadingData && !dataError ? (
            <button type="button" disabled={busy} onClick={saveData} className="px-4 py-2 bg-sky-600 disabled:opacity-50 text-white rounded-lg font-semibold">Simpan Data Siswa</button>
          ) : null}
        </div>
        <button disabled={busy || loadingData || Boolean(dataError) || required.length === 0} type="button" onClick={finish} className="w-full py-3 bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-xl shadow">
          Selesaikan Pendaftaran
        </button>
      </div>
    </div>
  );
}
