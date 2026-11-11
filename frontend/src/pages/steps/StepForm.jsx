import { useEffect, useState } from "react";
import api from "../../api/client";
import FilePickButton from "../../components/FilePickButton";

const TABS = [
  { id: "siswa", icon: "fa-user-graduate", label: "1. Calon Siswa" },
  { id: "jenjang", icon: "fa-graduation-cap", label: "2. Jenjang & Sekolah" },
  { id: "ayah", icon: "fa-user-tie", label: "3. Data Ayah" },
  { id: "ibu", icon: "fa-user-nurse", label: "4. Data Ibu" },
  { id: "domisili", icon: "fa-map-marked-alt", label: "5. Domisili" },
];

const inputClass = "w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:border-sky-500";

export default function StepForm({ applicant, applyPayload, showToast }) {
  const [tab, setTab] = useState("siswa");
  const [busy, setBusy] = useState(false);
  const [lookupMsg, setLookupMsg] = useState("");
  const [form, setForm] = useState({
    studentName: applicant?.studentName || "",
    nik: applicant?.nik || "",
    nisn: applicant?.nisn || "",
    gender: applicant?.gender || "Laki-Laki",
    type: applicant?.type || "BARU",
    schoolId: applicant?.schoolId || "",
    schoolTarget: applicant?.schoolTarget || "",
    kelasId: applicant?.kelasId || "",
    isAlumni: applicant?.isAlumni ? "true" : "false",
    previousSchool: applicant?.previousSchool || "",
    fatherName: applicant?.fatherName || "",
    fatherJob: applicant?.fatherJob || "",
    fatherNik: applicant?.fatherNik || "",
    motherName: applicant?.motherName || "",
    motherJob: applicant?.motherJob || "",
    motherNik: applicant?.motherNik || "",
    address: applicant?.address || "",
    village: applicant?.village || "",
    district: applicant?.district || "",
    city: applicant?.city || "",
    province: applicant?.province || "",
  });

  const [schools, setSchools] = useState([]);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    api
      .get("/schools")
      .then(({ data }) => setSchools(data.schools || []))
      .catch(() => setSchools([]));
  }, []);

  useEffect(() => {
    if (!form.schoolId) {
      setClasses([]);
      return;
    }
    api
      .get(`/schools/${form.schoolId}/classes`)
      .then(({ data }) => setClasses(data.classes || []))
      .catch(() => setClasses([]));
  }, [form.schoolId]);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const lookup = async () => {
    if (!form.nisn) {
      setLookupMsg("Isi NISN terlebih dahulu.");
      return;
    }
    setLookupMsg("Mencari di Amanah...");
    try {
      const { data } = await api.get("/applicants/lookup-nisn", { params: { nisn: form.nisn } });
      const s = data.siswa;
      setForm((prev) => ({
        ...prev,
        type: "MURID_LAMA",
        studentName: s.studentName || prev.studentName,
        gender: s.gender || prev.gender,
        previousSchool: s.previousSchool || prev.previousSchool,
        address: s.address || prev.address,
        village: s.village || prev.village,
        district: s.district || prev.district,
        city: s.city || prev.city,
        province: s.province || prev.province,
        fatherName: s.fatherName || prev.fatherName,
        fatherJob: s.fatherJob || prev.fatherJob,
        fatherNik: s.fatherNik || prev.fatherNik,
        motherName: s.motherName || prev.motherName,
        motherJob: s.motherJob || prev.motherJob,
        motherNik: s.motherNik || prev.motherNik,
      }));
      setLookupMsg("Data murid lama ditemukan dan diisi otomatis.");
      showToast("Ditemukan", "Data Amanah berhasil diimpor.");
    } catch (err) {
      setLookupMsg(err.response?.data?.message || "Tidak dapat menghubungi Amanah.");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.patch("/applicants/me", form);
      applyPayload(data);
      showToast("Data tersimpan", "Seluruh data berhasil disimpan. Lanjut ke ujian dan wawancara.");
    } catch (err) {
      showToast("Gagal", err.response?.data?.message || "Data belum lengkap.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-r from-sky-700 to-indigo-700 p-6 text-white">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <i className="fas fa-file-pen" /> Tahap 3: Formulir Data Pendaftaran
        </h2>
        <p className="text-sky-100 text-xs mt-1">Pilih tab di bawah untuk mengisi data tanpa harus melihat halaman yang terlalu panjang.</p>
      </div>

      <div className="border-b border-slate-200 bg-slate-50 px-6 pt-3 flex gap-2 overflow-x-auto custom-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`tab-btn px-4 py-2.5 font-semibold text-xs rounded-t-xl border-t border-x border-slate-200 transition-all flex items-center gap-2 ${tab === t.id ? "active" : "text-slate-500"}`}
          >
            <i className={`fas ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="p-6">
        {tab === "siswa" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Jenis pendaftar *</label>
              <select className={inputClass} value={form.type} onChange={set("type")}>
                <option value="BARU">Siswa baru</option>
                <option value="MURID_LAMA">Murid lama (impor dari Amanah)</option>
              </select>
            </div>
            {form.type === "MURID_LAMA" && (
              <div className="md:col-span-2 flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block font-semibold text-slate-700 mb-1">NISN murid lama</label>
                  <input className={inputClass} value={form.nisn} onChange={set("nisn")} placeholder="10 digit NISN" />
                </div>
                <button type="button" onClick={lookup} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold">
                  Cari di Amanah
                </button>
              </div>
            )}
            {lookupMsg ? <p className="md:col-span-2 text-sky-700">{lookupMsg}</p> : null}
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Siswa *</label>
              <input required className={inputClass} value={form.studentName} onChange={set("studentName")} />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">NIK Siswa *</label>
              <input required maxLength={16} className={inputClass} value={form.nik} onChange={set("nik")} />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Jenis Kelamin *</label>
              <select className={inputClass} value={form.gender} onChange={set("gender")}>
                <option>Laki-Laki</option>
                <option>Perempuan</option>
              </select>
            </div>
            {form.type === "BARU" && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">NISN (jika ada)</label>
                <input className={inputClass} value={form.nisn} onChange={set("nisn")} />
              </div>
            )}
          </div>
        )}

        {tab === "jenjang" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Lembaga / Unit yang Dituju *</label>
              <select
                required
                className={inputClass}
                value={form.schoolId}
                onChange={(e) => {
                  const id = e.target.value;
                  const school = schools.find((s) => String(s.id) === String(id));
                  setForm((prev) => ({
                    ...prev,
                    schoolId: id,
                    schoolTarget: school?.name || "",
                    kelasId: "",
                  }));
                }}
              >
                <option value="">Pilih Lembaga</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kelas *</label>
              <select required className={inputClass} value={form.kelasId} onChange={set("kelasId")} disabled={!form.schoolId}>
                <option value="">{form.schoolId ? "Pilih kelas" : "Pilih lembaga dulu"}</option>
                {classes.map((kelas) => (
                  <option key={kelas.id} value={kelas.id}>
                    {kelas.label}
                  </option>
                ))}
              </select>
              {form.schoolId && classes.length === 0 ? (
                <p className="text-[10px] text-amber-700 mt-1">Belum ada kelas SPMB untuk lembaga ini.</p>
              ) : null}
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alumni Al-Hasanah *</label>
              <select
                required
                className={inputClass}
                value={form.isAlumni}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    isAlumni: e.target.value,
                    type: e.target.value === "true" ? "MURID_LAMA" : "BARU",
                  }))
                }
              >
                <option value="false">Tidak, siswa baru</option>
                <option value="true">Ya, alumni Al Hasanah</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Sekolah Asal *</label>
              <input required className={inputClass} value={form.previousSchool} onChange={set("previousSchool")} />
            </div>
          </div>
        )}

        {tab === "ayah" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Ayah *</label>
              <input required className={inputClass} value={form.fatherName} onChange={set("fatherName")} />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pekerjaan *</label>
              <input required className={inputClass} value={form.fatherJob} onChange={set("fatherJob")} />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">NIK Ayah</label>
              <input className={inputClass} value={form.fatherNik} onChange={set("fatherNik")} />
            </div>
          </div>
        )}

        {tab === "ibu" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Ibu *</label>
              <input required className={inputClass} value={form.motherName} onChange={set("motherName")} />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pekerjaan *</label>
              <input required className={inputClass} value={form.motherJob} onChange={set("motherJob")} />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">NIK Ibu</label>
              <input className={inputClass} value={form.motherNik} onChange={set("motherNik")} />
            </div>
          </div>
        )}

        {tab === "domisili" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap *</label>
              <textarea required rows={2} className={inputClass} value={form.address} onChange={set("address")} />
            </div>
            <input className={inputClass} placeholder="Kelurahan" value={form.village} onChange={set("village")} />
            <input className={inputClass} placeholder="Kecamatan" value={form.district} onChange={set("district")} />
            <input className={inputClass} placeholder="Kabupaten/Kota" value={form.city} onChange={set("city")} />
            <input className={inputClass} placeholder="Provinsi" value={form.province} onChange={set("province")} />
          </div>
        )}

        <div className="pt-6 mt-6 border-t flex justify-end">
          <button disabled={busy} type="submit" className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow flex items-center gap-2">
            <i className="fas fa-check-circle" /> {busy ? "Menyimpan..." : "Simpan Seluruh Data & Lanjut Ujian"}
          </button>
        </div>
      </form>
    </div>
  );
}
