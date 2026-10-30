import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      {children}
      {error ? <p className="text-[11px] text-red-600 mt-1">{error}</p> : null}
    </div>
  );
}

export default function Landing({ showToast }) {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reg, setReg] = useState({
    schoolId: "",
    kelasId: "",
    isAlumni: "",
    name: "",
    studentName: "",
    wa: "",
    username: "",
    password: "",
    confirm: "",
  });
  const [log, setLog] = useState({ identifier: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [schools, setSchools] = useState([]);
  const [classes, setClasses] = useState([]);
  const [schoolError, setSchoolError] = useState("");

  useEffect(() => {
    api
      .get("/schools")
      .then(({ data }) => {
        setSchools(data.schools || []);
        setSchoolError("");
      })
      .catch((err) => {
        setSchools([]);
        setSchoolError(err.response?.data?.message || "Tidak dapat memuat daftar lembaga dari Amanah.");
      });
  }, []);

  useEffect(() => {
    if (!reg.schoolId) {
      setClasses([]);
      return;
    }
    api
      .get(`/schools/${reg.schoolId}/classes`)
      .then(({ data }) => setClasses(data.classes || []))
      .catch(() => setClasses([]));
  }, [reg.schoolId]);

  const errors = useMemo(() => {
    const next = {};
    if (reg.wa && !/^08\d{8,11}$/.test(reg.wa.replace(/\s/g, ""))) {
      next.wa = "Nomor WA harus diawali 08 dan 10–13 digit.";
    }
    if (reg.password && reg.password.length < 6) {
      next.password = "Password minimal 6 karakter.";
    }
    if (reg.confirm && reg.confirm !== reg.password) {
      next.confirm = "Konfirmasi password tidak sama.";
    }
    if (reg.username && !/^[a-z0-9._]{4,30}$/.test(reg.username.trim().toLowerCase())) {
      next.username = "Username 4–30 karakter (huruf, angka, titik, underscore).";
    }
    return next;
  }, [reg]);

  const canSubmitReg =
    reg.schoolId &&
    reg.kelasId &&
    (reg.isAlumni === "true" || reg.isAlumni === "false") &&
    reg.name &&
    reg.studentName &&
    reg.wa &&
    reg.username &&
    reg.password &&
    reg.confirm &&
    Object.keys(errors).length === 0;

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!canSubmitReg) return;
    setBusy(true);
    try {
      await register({
        schoolId: Number(reg.schoolId),
        kelasId: Number(reg.kelasId),
        isAlumni: reg.isAlumni === "true",
        name: reg.name,
        studentName: reg.studentName,
        wa: reg.wa.replace(/\s/g, ""),
        username: reg.username.trim().toLowerCase(),
        password: reg.password,
      });
      showToast("Registrasi berhasil", "Akun wali murid aktif. Lanjutkan ke pembayaran.");
      navigate("/wali/app");
    } catch (err) {
      showToast("Gagal daftar", err.response?.data?.message || "Tidak dapat mendaftar.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    setLoginError("");
    try {
      const data = await login({ ...log, portal: "wali" });
      if (data.user?.role && data.user.role !== "ORTU") {
        showToast("Akun TU / Guru / Kepsek", "Silakan masuk di halaman utama (localhost:3000).");
        navigate("/");
        return;
      }
      if (data.raporUrl) {
        window.location.href = data.raporUrl;
        return;
      }
      showToast("Selamat datang", "Login berhasil.");
      navigate("/wali/app");
    } catch (err) {
      setLoginError(err.response?.data?.message || "Login gagal.");
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:border-sky-500";

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />

      <div className="relative z-10 bg-white/95 backdrop-blur-md p-8 sm:p-10 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-6 border border-slate-100">
        <div className="mx-auto w-20 h-20 bg-gradient-to-tr from-sky-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg shadow-sky-500/30">
          <i className="fas fa-graduation-cap" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-wider uppercase">SPMB Al Hasanah Bengkulu</h2>
          {/* <p className="text-xs text-slate-500 mt-1">Sistem Penerimaan Murid Baru Modern</p> */}
        </div>
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={() => setModal("register")}
            className="w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
          >
            <i className="fas fa-user-plus" /> DAFTAR SISWA BARU
          </button>
          <button
            type="button"
            onClick={() => setModal("login")}
            className="w-full py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl border border-slate-300 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <i className="fas fa-sign-in-alt" /> LOGIN AKUN
          </button>
        </div>
      </div>

      <Modal open={modal === "register"} title="Registrasi Akun Wali Murid" icon="fa-user-plus" onClose={() => setModal(null)}>
        <form onSubmit={handleRegister} className="p-6 space-y-4">
          <Field label="Lembaga / Unit *" error={schoolError}>
            <select
              required
              className={inputClass}
              value={reg.schoolId}
              onChange={(e) => setReg({ ...reg, schoolId: e.target.value, kelasId: "" })}
            >
              <option value="">Pilih Lembaga Sekolah</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kelas *">
            <select
              required
              className={inputClass}
              value={reg.kelasId}
              onChange={(e) => setReg({ ...reg, kelasId: e.target.value })}
              disabled={!reg.schoolId}
            >
              <option value="">{reg.schoolId ? "Pilih kelas" : "Pilih lembaga dulu"}</option>
              {classes.map((kelas) => (
                <option key={kelas.id} value={kelas.id}>
                  {kelas.label}
                </option>
              ))}
            </select>
            {reg.schoolId && classes.length === 0 ? (
              <p className="text-[10px] text-amber-700 mt-1">Belum ada kelas SPMB untuk lembaga ini. TU perlu menambahkannya di panel.</p>
            ) : null}
          </Field>
          <Field label="Alumni Al-Hasanah *">
            <select
              required
              className={inputClass}
              value={reg.isAlumni}
              onChange={(e) => setReg({ ...reg, isAlumni: e.target.value })}
            >
              <option value="">Pilih</option>
              <option value="false">Tidak, siswa baru</option>
              <option value="true">Ya, alumni Al Hasanah</option>
            </select>
          </Field>
          <Field label="Nama Orang Tua / Wali *">
            <input required className={inputClass} value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} placeholder="Nama lengkap wali" />
          </Field>
          <Field label="Nama Calon Siswa *">
            <input required className={inputClass} value={reg.studentName} onChange={(e) => setReg({ ...reg, studentName: e.target.value })} placeholder="Nama sesuai akta" />
          </Field>
          <Field label="No. WhatsApp *" error={errors.wa}>
            <input
              required
              type="tel"
              className={inputClass}
              value={reg.wa}
              onChange={(e) => setReg({ ...reg, wa: e.target.value })}
              placeholder="08xxxxxxxxxx"
            />
          </Field>
          <Field label="Username *" error={errors.username}>
            <input
              required
              className={inputClass}
              value={reg.username}
              onChange={(e) => setReg({ ...reg, username: e.target.value.trim().toLowerCase() })}
              placeholder="Buat username sendiri"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Username dan password ini untuk login PPDB dan aplikasi rapor/wali setelah anak lulus.
            </p>
          </Field>
          <Field label="Password *" error={errors.password}>
            <input required type="password" minLength={6} className={inputClass} value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} placeholder="Minimal 6 karakter" />
          </Field>
          <Field label="Konfirmasi Password *" error={errors.confirm}>
            <input required type="password" className={inputClass} value={reg.confirm} onChange={(e) => setReg({ ...reg, confirm: e.target.value })} placeholder="Ulangi password" />
          </Field>
          <div className="pt-3 border-t flex justify-end space-x-2">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 border rounded-lg text-xs">Batal</button>
            <button disabled={!canSubmitReg || busy} type="submit" className="px-5 py-2 bg-sky-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow">
              {busy ? "Memproses..." : "Daftar & Masuk"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === "login"} title="Login Pendaftaran" icon="fa-sign-in-alt" onClose={() => setModal(null)} maxWidth="max-w-sm">
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          <Field label="Username">
            <input required className={inputClass} value={log.identifier} onChange={(e) => setLog({ ...log, identifier: e.target.value })} placeholder="Masukkan username" />
          </Field>
          <Field label="Password">
            <input required type="password" className={inputClass} value={log.password} onChange={(e) => setLog({ ...log, password: e.target.value })} placeholder="Password" />
          </Field>
          {loginError ? <p className="text-[11px] text-red-600">{loginError}</p> : null}
          <button disabled={busy} type="submit" className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-xs shadow-md">
            {busy ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
