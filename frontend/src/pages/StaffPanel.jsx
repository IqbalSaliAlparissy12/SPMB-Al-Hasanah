import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import FilePickButton from "../components/FilePickButton";
import Modal from "../components/Modal";
import RichTextEditor, { isRichEmpty, sanitizeRichHtml } from "../components/RichTextEditor";

const MENUS = [
  { id: "home", label: "Beranda", icon: "fa-house" },
  { id: "persyaratan", label: "Persyaratan", icon: "fa-file-lines", tuOnly: true },
  { id: "pernyataan", label: "Surat Pernyataan", icon: "fa-file-signature", tuOnly: true },
  { id: "dokumen", label: "Dokumen", icon: "fa-folder-open", tuOnly: true },
  { id: "kelas", label: "Kelas SPMB", icon: "fa-chalkboard", tuOnly: true },
  { id: "tahapan", label: "Tahapan", icon: "fa-list-ol", tuOnly: true },
  { id: "mapel", label: "Mapel Tes", icon: "fa-book", tuOnly: true },
  { id: "tes", label: "Tes", icon: "fa-clipboard-check", roles: ["TU", "GURU"] },
];

function academicYears() {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return [0, 1].map((offset) => {
    const year = start + offset;
    return `${year}-${year + 1}`;
  });
}

function formatWhen(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function StaffPanel({ showToast }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isTu = user?.role === "TU";
  const canTes = user?.role === "TU" || user?.role === "GURU";
  const [menu, setMenu] = useState("home");

  const visibleMenus = MENUS.filter((item) => {
    if (item.tuOnly && !isTu) return false;
    if (item.roles && !item.roles.includes(user?.role)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-60 shrink-0 bg-sky-800 text-white flex flex-col">
        <div className="px-5 py-5 border-b border-sky-700">
          <p className="text-[10px] uppercase tracking-wider text-sky-200">Panel SPMB</p>
          <h1 className="font-bold text-sm mt-1">Al-Hasanah</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {visibleMenus.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMenu(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                menu === item.id ? "bg-white text-sky-800" : "text-sky-100 hover:bg-sky-700"
              }`}
            >
              <i className={`fas ${item.icon} w-4 text-center`} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-sky-700 text-[11px] text-sky-200">
          <p className="font-semibold text-white">{user?.name}</p>
          <p>
            {user?.role}
            {user?.schoolName ? ` · ${user.schoolName}` : ""}
          </p>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="mt-3 w-full py-2 bg-red-500/90 hover:bg-red-500 text-white font-bold rounded-lg text-xs"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">
        {menu === "home" ? <HomeView user={user} isTu={isTu} canTes={canTes} onOpen={setMenu} /> : null}
        {menu === "persyaratan" && isTu ? <PersyaratanView showToast={showToast} /> : null}
        {menu === "pernyataan" && isTu ? <PernyataanView showToast={showToast} /> : null}
        {menu === "kelas" && isTu ? <KelasView showToast={showToast} user={user} /> : null}
        {menu === "tahapan" && isTu ? <TahapanView showToast={showToast} /> : null}
        {menu === "mapel" && isTu ? <MapelView showToast={showToast} /> : null}
        {menu === "tes" && canTes ? <TesView showToast={showToast} user={user} /> : null}
      </main>
    </div>
  );
}

function HomeView({ user, isTu, canTes, onOpen }) {
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Selamat datang, {user?.name}</h2>
        <p className="text-sm text-slate-500 mt-1">
          Anda masuk sebagai <strong>{user?.role}</strong>
          {user?.schoolName ? ` · ${user.schoolName}` : ""}.
        </p>
      </div>
      {isTu || canTes ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {canTes ? (
            <button
              type="button"
              onClick={() => onOpen("tes")}
              className="text-left bg-white border rounded-2xl p-5 hover:border-sky-400"
            >
              <p className="font-bold text-slate-800 text-sm">
                <i className="fas fa-clipboard-check mr-2 text-sky-700" /> Tes
              </p>
              <p className="text-xs text-slate-500 mt-1">Isi nilai sesuai mata pelajaran yang diatur TU. Lulus membuka tahap 5.</p>
            </button>
          ) : null}
          {isTu ? (
          <>
          <button
            type="button"
            onClick={() => onOpen("mapel")}
            className="text-left bg-white border rounded-2xl p-5 hover:border-sky-400"
          >
            <p className="font-bold text-slate-800 text-sm">
              <i className="fas fa-book mr-2 text-sky-700" /> Mapel Tes
            </p>
            <p className="text-xs text-slate-500 mt-1">Atur mata pelajaran yang dinilai pada hasil tes.</p>
          </button>
          <button
            type="button"
            onClick={() => onOpen("persyaratan")}
            className="text-left bg-white border rounded-2xl p-5 hover:border-sky-400"
          >
            <p className="font-bold text-slate-800 text-sm">
              <i className="fas fa-file-lines mr-2 text-sky-700" /> Persyaratan
            </p>
            <p className="text-xs text-slate-500 mt-1">Tulis persyaratan yang tampil di tahap 1 orang tua.</p>
          </button>
          <button
            type="button"
            onClick={() => onOpen("pernyataan")}
            className="text-left bg-white border rounded-2xl p-5 hover:border-sky-400"
          >
            <p className="font-bold text-slate-800 text-sm">
              <i className="fas fa-file-signature mr-2 text-sky-700" /> Surat Pernyataan
            </p>
            <p className="text-xs text-slate-500 mt-1">Teks yang tampil di tahap 5, di bawah status sudah lulus.</p>
          </button>
          <button
            type="button"
            onClick={() => onOpen("kelas")}
            className="text-left bg-white border rounded-2xl p-5 hover:border-sky-400"
          >
            <p className="font-bold text-slate-800 text-sm">
              <i className="fas fa-chalkboard mr-2 text-sky-700" /> Kelas SPMB
            </p>
            <p className="text-xs text-slate-500 mt-1">Atur kelas sederhana per lembaga (1, 2, 3).</p>
          </button>
          <button
            type="button"
            onClick={() => onOpen("tahapan")}
            className="text-left bg-white border rounded-2xl p-5 hover:border-sky-400"
          >
            <p className="font-bold text-slate-800 text-sm">
              <i className="fas fa-list-ol mr-2 text-sky-700" /> Tahapan
            </p>
            <p className="text-xs text-slate-500 mt-1">Buka/tutup 6 tahap dan kendalikan pendaftar.</p>
          </button>
          </>
          ) : null}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border p-6 text-sm text-slate-600">
          Menu persyaratan, kelas, dan tes tersedia untuk TU atau Guru.
        </div>
      )}
    </div>
  );
}

function MapelView({ showToast }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await api.get("/exam-subjects");
    setItems(data.subjects || []);
  };

  useEffect(() => {
    load().catch((err) => showToast?.("Gagal", err.response?.data?.message || "Tidak dapat memuat mata pelajaran."));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (editingId) {
        await api.patch(`/exam-subjects/${editingId}`, { name: name.trim() });
        showToast?.("Tersimpan", "Mata pelajaran diperbarui.");
      } else {
        await api.post("/exam-subjects", { name: name.trim() });
        showToast?.("Tersimpan", "Mata pelajaran ditambahkan.");
      }
      setName("");
      setEditingId(null);
      await load();
    } catch (err) {
      showToast?.("Gagal", err.response?.data?.message || "Tidak dapat menyimpan mata pelajaran.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus mata pelajaran ini dari form tes?")) return;
    await api.delete(`/exam-subjects/${id}`);
    await load();
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Mata pelajaran tes</h2>
        <p className="text-xs text-slate-500 mt-1">Daftar ini yang tampil saat Guru atau TU mengisi hasil tes.</p>
      </div>
      <form onSubmit={save} className="bg-white rounded-2xl border border-slate-200 p-5 flex gap-2">
        <input
          required
          className="flex-1 px-3 py-2 border rounded-lg text-xs"
          placeholder="Nama mata pelajaran, contoh: Observasi Siswa"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button disabled={busy} className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold">
          {busy ? "Menyimpan..." : editingId ? "Simpan" : "Tambah"}
        </button>
        {editingId ? (
          <button
            type="button"
            className="px-4 py-2 border rounded-lg text-xs"
            onClick={() => {
              setEditingId(null);
              setName("");
            }}
          >
            Batal
          </button>
        ) : null}
      </form>
      <div className="bg-white border rounded-2xl overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-emerald-600 text-white">
            <tr>
              <th className="px-3 py-2 font-semibold w-12">No</th>
              <th className="px-3 py-2 font-semibold">Mata Pelajaran</th>
              <th className="px-3 py-2 font-semibold w-28" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                  Belum ada mata pelajaran.
                </td>
              </tr>
            ) : null}
            {items.map((item, index) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2 font-semibold text-slate-800">{item.name}</td>
                <td className="px-3 py-2 text-right space-x-3">
                  <button
                    type="button"
                    className="text-sky-700 font-bold"
                    onClick={() => {
                      setEditingId(item.id);
                      setName(item.name);
                    }}
                  >
                    Ubah
                  </button>
                  <button type="button" className="text-red-600 font-bold" onClick={() => remove(item.id)}>
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function scoreRows(subjects, saved) {
  return (subjects || []).map((subject) => {
    const found = (saved || []).find((item) => Number(item.subjectId) === Number(subject.id));
    return {
      subjectId: subject.id,
      name: subject.name,
      score: found?.score || "",
      note: found?.note || "",
    };
  });
}

const EMPTY_EXAM = {
  applicantId: "",
  academicYear: academicYears()[0],
  status: "LULUS",
  scores: [],
  note: "",
};

function TesView({ showToast, user }) {
  const [rows, setRows] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [schoolName, setSchoolName] = useState(user?.schoolName || "");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_EXAM);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await api.get("/exam-results");
    setRows(data.applicants || []);
    setSubjects(data.subjects || []);
    setSchoolName(data.schoolName || user?.schoolName || "");
  };

  useEffect(() => {
    load().catch((err) => showToast?.("Gagal", err.response?.data?.message || "Tidak dapat memuat daftar tes."));
  }, []);

  const openCreate = () => {
    setForm({ ...EMPTY_EXAM, academicYear: academicYears()[0], scores: scoreRows(subjects, []) });
    setOpen(true);
  };

  const openEdit = (row) => {
    const exam = row.exam;
    setForm({
      applicantId: String(row.id),
      academicYear: exam?.academicYear || academicYears()[0],
      status: exam?.status || "LULUS",
      scores: scoreRows(subjects, exam?.scores),
      note: exam?.note || "",
    });
    setOpen(true);
  };

  const setScore = (subjectId, field, value) => {
    setForm((current) => ({
      ...current,
      scores: current.scores.map((item) => (item.subjectId === subjectId ? { ...item, [field]: value } : item)),
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.applicantId) {
      showToast?.("Gagal", "Pilih nama calon siswa.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/exam-results", form);
      showToast?.("Tersimpan", data.message);
      setOpen(false);
      await load();
    } catch (err) {
      showToast?.("Gagal", err.response?.data?.message || "Tidak dapat menyimpan hasil tes.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Hasil tes</h2>
          <p className="text-xs text-slate-500 mt-1">
            Daftar calon siswa yang sudah mengirim formulir. Status lulus membuka tahap Surat Keputusan dan Biaya Masuk.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold shrink-0">
          Tambah hasil tes
        </button>
      </div>

      <div className="bg-white border rounded-2xl overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Calon siswa</th>
              <th className="px-3 py-2 font-semibold">Kelas</th>
              <th className="px-3 py-2 font-semibold">Penguji</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Tanggal</th>
              <th className="px-3 py-2 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Belum ada calon siswa yang mengirim formulir di unit ini.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2 font-bold text-slate-800">{row.studentName}</td>
                <td className="px-3 py-2">{row.kelasName || "-"}</td>
                <td className="px-3 py-2">{row.exam?.examinerName || "-"}</td>
                <td className={`px-3 py-2 font-semibold ${row.exam?.status === "LULUS" ? "text-emerald-700" : "text-amber-700"}`}>
                  {!row.exam ? "Belum diisi" : row.exam.status === "LULUS" ? "Lulus" : "Tidak lulus"}
                </td>
                <td className="px-3 py-2">{formatWhen(row.exam?.updatedAt)}</td>
                <td className="px-3 py-2 text-right">
                  <button type="button" className="text-sky-700 font-bold" onClick={() => openEdit(row)}>
                    {row.exam ? "Ubah" : "Isi"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} title="Form hasil tes" icon="fa-clipboard-check" onClose={() => setOpen(false)} maxWidth="max-w-2xl">
        <form onSubmit={save} className="p-5 space-y-3 text-xs">
          <label className="block space-y-1">
            <span className="font-semibold text-slate-600">Tahun pelajaran</span>
            <select
              className="w-full px-3 py-2 border rounded-lg"
              value={form.academicYear}
              onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
            >
              {academicYears().map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="font-semibold text-slate-600">Nama</span>
            <select
              required
              className="w-full px-3 py-2 border rounded-lg"
              value={form.applicantId}
              onChange={(e) => setForm({ ...form, applicantId: e.target.value })}
            >
              <option value="">Pilih calon siswa</option>
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.studentName}
                  {row.kelasName ? ` · Kelas ${row.kelasName}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="font-semibold text-slate-600">Penguji</span>
              <input className="w-full px-3 py-2 border rounded-lg bg-slate-50" value={user?.name || ""} readOnly />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold text-slate-600">Status kelulusan</span>
              <select
                className="w-full px-3 py-2 border rounded-lg"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="LULUS">Lulus</option>
                <option value="TIDAK_LULUS">Tidak lulus</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="font-semibold text-slate-600">Lembaga</span>
            <input className="w-full px-3 py-2 border rounded-lg bg-slate-50" value={schoolName || "Unit akun ini"} readOnly />
          </label>

          <div className="border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[2rem_1fr_5rem_1fr] bg-emerald-600 text-white font-bold">
              <span className="px-2 py-2">No</span>
              <span className="px-2 py-2">Penilaian</span>
              <span className="px-2 py-2">Nilai</span>
              <span className="px-2 py-2">Keterangan</span>
            </div>
            {form.scores.length === 0 ? (
              <p className="px-3 py-4 text-slate-500">TU belum menambahkan mata pelajaran tes.</p>
            ) : null}
            {form.scores.map((item, index) => (
              <div key={item.subjectId} className="grid grid-cols-[2rem_1fr_5rem_1fr] border-t items-center">
                <span className="px-2 py-2">{index + 1}</span>
                <span className="px-2 py-2 font-semibold">{item.name}</span>
                <input
                  className="m-1 px-2 py-1.5 border rounded"
                  value={item.score}
                  onChange={(e) => setScore(item.subjectId, "score", e.target.value)}
                />
                <input
                  className="m-1 px-2 py-1.5 border rounded"
                  value={item.note}
                  onChange={(e) => setScore(item.subjectId, "note", e.target.value)}
                />
              </div>
            ))}
          </div>

          <label className="block space-y-1">
            <span className="font-semibold text-slate-600">Catatan penguji</span>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border rounded-lg"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="px-4 py-2 border rounded-lg font-bold" onClick={() => setOpen(false)}>
              Tutup
            </button>
            <button disabled={busy} className="px-4 py-2 bg-sky-600 text-white rounded-lg font-bold">
              {busy ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function PernyataanView({ showToast }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: "", body: "", published: true });
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await api.get("/statements");
    setItems(data.statements || []);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const body = sanitizeRichHtml(form.body);
    if (!form.title.trim() || isRichEmpty(body)) {
      showToast?.("Gagal", "Judul dan isi surat pernyataan wajib diisi.");
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, title: form.title.trim(), body };
      if (editingId) {
        await api.patch(`/statements/${editingId}`, payload);
        showToast?.("Tersimpan", "Surat pernyataan diperbarui.");
      } else {
        await api.post("/statements", payload);
        showToast?.("Tersimpan", "Surat pernyataan ditambahkan.");
      }
      setForm({ title: "", body: "", published: true });
      setEditingId(null);
      await load();
    } catch (err) {
      showToast?.("Gagal", err.response?.data?.message || "Tidak dapat menyimpan.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus surat pernyataan ini?")) return;
    await api.delete(`/statements/${id}`);
    await load();
  };

  const uploadFile = async (id, file) => {
    const body = new FormData();
    body.append("file", file);
    setBusy(true);
    try {
      const { data } = await api.post(`/statements/${id}/file`, body);
      showToast?.("Tersimpan", data.message);
      await load();
    } catch (err) {
      showToast?.("Gagal", err.response?.data?.message || "Tidak dapat mengunggah dokumen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-4">
      <h2 className="text-lg font-bold text-slate-800">Surat pernyataan</h2>
      <form onSubmit={save} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 text-sm">
        <p className="text-xs text-slate-500">
          Teks tampil di tahap 5, di bawah status sudah lulus. Dokumen yang diunggah wajib diunduh orang tua di tahap ujian dan wawancara.
        </p>
        <input
          required
          className="w-full px-3 py-2 border rounded-lg text-xs"
          placeholder="Judul, contoh: Surat Keputusan Penerimaan Siswa Baru"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <RichTextEditor
          value={form.body}
          onChange={(body) => setForm({ ...form, body })}
          placeholder="Tulis surat pernyataan di sini. Pilih teks lalu pakai tebal, daftar, atau perataan seperti di Word."
        />
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
          />
          Tampilkan ke orang tua
        </label>
        <div className="flex gap-2">
          <button disabled={busy} className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold">
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="px-4 py-2 border rounded-lg text-xs"
              onClick={() => {
                setEditingId(null);
                setForm({ title: "", body: "", published: true });
              }}
            >
              Batal
            </button>
          ) : null}
        </div>
      </form>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-xl border p-4 text-xs">
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-bold text-sky-800">{item.title}</p>
                <p className="text-slate-400 mt-1">
                  {item.published ? "Ditampilkan" : "Disembunyikan"} · {item.updatedBy}
                </p>
                <div className="mt-2">
                  <FilePickButton
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    disabled={busy}
                    icon="fa-file-arrow-up"
                    label={item.filePath ? "Ganti dokumen" : "Unggah dokumen"}
                    fileName={item.originalName || ""}
                    onFile={(file) => uploadFile(item.id, file)}
                  />
                </div>
                {/<\/?[a-z][\s\S]*>/i.test(item.body || "") ? (
                  <div
                    className="rich-body mt-2 text-slate-700 leading-6 line-clamp-4"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(item.body) }}
                  />
                ) : (
                  <p className="mt-2 text-slate-700 whitespace-pre-wrap line-clamp-4">{item.body}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  className="text-sky-700 font-bold"
                  onClick={() => {
                    setEditingId(item.id);
                    setForm({ title: item.title, body: item.body, published: item.published });
                  }}
                >
                  Ubah
                </button>
                <button type="button" className="text-red-600 font-bold" onClick={() => remove(item.id)}>
                  Hapus
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PersyaratanView({ showToast }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: "", body: "", published: true });
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await api.get("/requirements");
    setItems(data.requirements || []);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const body = sanitizeRichHtml(form.body);
    if (!form.title.trim() || isRichEmpty(body)) {
      showToast?.("Gagal", "Judul dan isi persyaratan wajib diisi.");
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, title: form.title.trim(), body };
      if (editingId) {
        await api.patch(`/requirements/${editingId}`, payload);
        showToast?.("Tersimpan", "Persyaratan diperbarui.");
      } else {
        await api.post("/requirements", payload);
        showToast?.("Tersimpan", "Persyaratan ditambahkan.");
      }
      setForm({ title: "", body: "", published: true });
      setEditingId(null);
      await load();
    } catch (err) {
      showToast?.("Gagal", err.response?.data?.message || "Tidak dapat menyimpan.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus persyaratan ini?")) return;
    await api.delete(`/requirements/${id}`);
    await load();
  };

  return (
    <div className="max-w-4xl space-y-4">
      <h2 className="text-lg font-bold text-slate-800">Persyaratan pendaftaran</h2>
      <form onSubmit={save} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 text-sm">
        <p className="text-xs text-slate-500">Teks ini tampil di tahap 1 portal orang tua, di bawah status registrasi.</p>
        <input
          required
          className="w-full px-3 py-2 border rounded-lg text-xs"
          placeholder="Judul, contoh: Persyaratan menjadi Siswa SDIT Al Hasanah..."
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <RichTextEditor
          value={form.body}
          onChange={(body) => setForm({ ...form, body })}
          placeholder="Tulis persyaratan di sini. Pilih teks lalu pakai tebal, daftar, atau perataan seperti di Word."
        />
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
          />
          Tampilkan ke orang tua
        </label>
        <div className="flex gap-2">
          <button disabled={busy} className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold">
            {busy ? "Menyimpan..." : "Simpan"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="px-4 py-2 border rounded-lg text-xs"
              onClick={() => {
                setEditingId(null);
                setForm({ title: "", body: "", published: true });
              }}
            >
              Batal
            </button>
          ) : null}
        </div>
      </form>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-xl border p-4 text-xs">
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-bold text-sky-800">{item.title}</p>
                <p className="text-slate-400 mt-1">
                  {item.published ? "Ditampilkan" : "Disembunyikan"} · {item.updatedBy}
                </p>
                {/<\/?[a-z][\s\S]*>/i.test(item.body || "") ? (
                  <div
                    className="rich-body mt-2 text-slate-700 leading-6 line-clamp-4"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(item.body) }}
                  />
                ) : (
                  <p className="mt-2 text-slate-700 whitespace-pre-wrap line-clamp-4">{item.body}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  className="text-sky-700 font-bold"
                  onClick={() => {
                    setEditingId(item.id);
                    setForm({ title: item.title, body: item.body, published: item.published });
                  }}
                >
                  Ubah
                </button>
                <button type="button" className="text-red-600 font-bold" onClick={() => remove(item.id)}>
                  Hapus
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KelasView({ showToast, user }) {
  const [classes, setClasses] = useState([]);
  const [classForm, setClassForm] = useState({ name: "", sortOrder: 0, published: true });
  const [editingClassId, setEditingClassId] = useState(null);
  const [classBusy, setClassBusy] = useState(false);

  const loadClasses = async () => {
    const { data: classData } = await api.get("/spmb-classes");
    setClasses(classData.classes || []);
  };

  useEffect(() => {
    loadClasses().catch(() => {});
  }, []);

  const saveClass = async (e) => {
    e.preventDefault();
    setClassBusy(true);
    try {
      const payload = {
        name: classForm.name.trim(),
        sortOrder: Number(classForm.sortOrder) || 0,
        published: classForm.published,
      };
      if (editingClassId) {
        await api.patch(`/spmb-classes/${editingClassId}`, payload);
        showToast?.("Tersimpan", "Kelas SPMB diperbarui.");
      } else {
        await api.post("/spmb-classes", payload);
        showToast?.("Tersimpan", "Kelas SPMB ditambahkan.");
      }
      setClassForm({ name: "", sortOrder: 0, published: true });
      setEditingClassId(null);
      await loadClasses();
    } catch (err) {
      showToast?.("Gagal", err.response?.data?.message || "Tidak dapat menyimpan kelas.");
    } finally {
      setClassBusy(false);
    }
  };

  const removeClass = async (id) => {
    if (!window.confirm("Hapus kelas SPMB ini?")) return;
    await api.delete(`/spmb-classes/${id}`);
    await loadClasses();
  };

  return (
    <div className="max-w-4xl space-y-4">
      <h2 className="text-lg font-bold text-slate-800">Kelas SPMB</h2>
      <form onSubmit={saveClass} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 text-sm">
        <p className="text-xs text-slate-500">
          Kelas ini khusus unit Anda. Tidak perlu pilih lembaga.
        </p>
        <div className="px-3 py-2 bg-sky-50 border border-sky-200 rounded-lg text-xs font-semibold text-sky-900">
          Lembaga: {user?.schoolName || "Belum terhubung ke unit Amanah"}
        </div>
        {!user?.schoolId ? (
          <p className="text-xs text-amber-700">Akun TU belum punya schoolId di rapor. Logout lalu login ulang, atau hubungi admin.</p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <input
            required
            className="w-full px-3 py-2 border rounded-lg text-xs"
            placeholder="Nama kelas, contoh: 1"
            value={classForm.name}
            onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
          />
          <input
            type="number"
            className="w-full px-3 py-2 border rounded-lg text-xs"
            placeholder="Urutan"
            value={classForm.sortOrder}
            onChange={(e) => setClassForm({ ...classForm, sortOrder: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={classForm.published}
            onChange={(e) => setClassForm({ ...classForm, published: e.target.checked })}
          />
          Tampilkan ke orang tua
        </label>
        <div className="flex gap-2">
          <button
            disabled={classBusy || !user?.schoolId}
            className="px-4 py-2 bg-sky-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold"
          >
            {classBusy ? "Menyimpan..." : "Simpan kelas"}
          </button>
          {editingClassId ? (
            <button
              type="button"
              className="px-4 py-2 border rounded-lg text-xs"
              onClick={() => {
                setEditingClassId(null);
                    setClassForm({ name: "", sortOrder: 0, published: true });
              }}
            >
              Batal
            </button>
          ) : null}
        </div>
      </form>
      <div className="space-y-3">
        {classes.map((item) => (
          <div key={item.id} className="bg-white rounded-xl border p-4 text-xs">
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-bold text-sky-800">Kelas {item.name}</p>
                <p className="text-slate-400 mt-1">
                  {item.published ? "Ditampilkan" : "Disembunyikan"} · urutan {item.sortOrder} · {item.updatedBy}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  className="text-sky-700 font-bold"
                  onClick={() => {
                    setEditingClassId(item.id);
                    setClassForm({
                      name: item.name,
                      sortOrder: item.sortOrder,
                      published: item.published,
                    });
                  }}
                >
                  Ubah
                </button>
                <button type="button" className="text-red-600 font-bold" onClick={() => removeClass(item.id)}>
                  Hapus
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TahapanView({ showToast }) {
  const [stages, setStages] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [q, setQ] = useState("");

  const load = async (search = q) => {
    const [{ data: stageData }, { data: appData }] = await Promise.all([
      api.get("/spmb-stages"),
      api.get("/tu/applicants", { params: search ? { q: search } : {} }),
    ]);
    setStages(stageData.stages || []);
    setApplicants(appData.applicants || []);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const toggleStage = async (step, enabled) => {
    try {
      const { data } = await api.patch(`/spmb-stages/${step}`, { enabled });
      setStages(data.stages || []);
      showToast?.("Tersimpan", enabled ? `Tahap ${step} dibuka.` : `Tahap ${step} ditutup.`);
    } catch (err) {
      showToast?.("Gagal", err.response?.data?.message || "Tidak dapat mengubah tahap.");
    }
  };

  const patchApplicant = async (id, body, okMsg) => {
    try {
      await api.patch(`/tu/applicants/${id}`, body);
      showToast?.("Tersimpan", okMsg);
      await load();
    } catch (err) {
      showToast?.("Gagal", err.response?.data?.message || "Tidak dapat mengubah pendaftar.");
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Pengontrolan 6 tahap</h2>
        <p className="text-xs text-slate-500 mt-1">
          Tutup atau buka tahap untuk unit Anda. Di daftar pendaftar, pilih tahap (Registrasi, Pembayaran, dst.) lalu tersimpan otomatis. Orang tua langsung masuk ke tahap itu.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stages.map((stage) => (
          <div key={stage.step} className="bg-white border rounded-2xl p-4 text-xs">
            <p className="font-bold text-slate-800">
              {stage.step}. {stage.name}
            </p>
            <p className={`mt-1 ${stage.enabled ? "text-emerald-700" : "text-amber-700"}`}>
              {stage.enabled ? "Dibuka untuk orang tua" : "Ditutup oleh TU"}
            </p>
            <button
              type="button"
              className={`mt-3 px-3 py-1.5 rounded-lg font-bold ${
                stage.enabled ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-sky-600 text-white"
              }`}
              onClick={() => toggleStage(stage.step, !stage.enabled)}
            >
              {stage.enabled ? "Tutup tahap" : "Buka tahap"}
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-800 text-sm">Pendaftar unit ini</h3>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load(q).catch(() => {});
          }}
        >
          <input
            className="px-3 py-1.5 border rounded-lg text-xs"
            placeholder="Cari nama / kelas"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold">Cari</button>
        </form>
      </div>

      <div className="bg-white border rounded-2xl overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Calon siswa</th>
              <th className="px-3 py-2 font-semibold">Wali</th>
              <th className="px-3 py-2 font-semibold">Kelas</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Bayar</th>
              <th className="px-3 py-2 font-semibold">Kelulusan</th>
              <th className="px-3 py-2 font-semibold">Tahap</th>
            </tr>
          </thead>
          <tbody>
            {applicants.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  Belum ada pendaftar di unit ini.
                </td>
              </tr>
            ) : null}
            {applicants.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2 font-bold text-slate-800">{row.studentName}</td>
                <td className="px-3 py-2 text-slate-600">
                  {row.parentName}
                  <div className="text-slate-400">{row.parentUsername}</div>
                </td>
                <td className="px-3 py-2">{row.kelasName || "-"}</td>
                <td className="px-3 py-2">{row.isAlumni ? "Alumni" : "Siswa baru"}</td>
                <td className="px-3 py-2">{row.billStatus}</td>
                <td className={`px-3 py-2 font-semibold ${row.announcementStatus === "LULUS" ? "text-emerald-700" : "text-amber-700"}`}>
                  {row.announcementLabel || "Belum lulus"}
                </td>
                <td className="px-3 py-2">
                  <select
                    className="px-2 py-1.5 border rounded-lg text-xs font-semibold bg-white min-w-[150px]"
                    value={row.currentStep}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      patchApplicant(
                        row.id,
                        { currentStep: n, maxUnlockedStep: n, markPaid: n >= 3 },
                        `Dipindah ke tahap ${n}.`
                      );
                    }}
                  >
                    {(stages.length
                      ? stages
                      : [
                          { step: 1, name: "Registrasi" },
                          { step: 2, name: "Pembayaran" },
                          { step: 3, name: "Isi Data" },
                          { step: 4, name: "Ujian dan Wawancara" },
                          { step: 5, name: "Surat Keputusan dan Biaya Masuk" },
                          { step: 6, name: "Dokumen" },
                        ]
                    ).map((stage) => (
                      <option key={stage.step} value={stage.step}>
                        {stage.step}. {stage.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
