import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function StaffLogin({ showToast }) {
  const { staffLogin } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");

  const inputClass =
    "w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:border-sky-500";

  const handleLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await staffLogin(log);
      showToast("Selamat datang", `Masuk sebagai ${data.user?.role}.`);
      navigate("/panel");
    } catch (err) {
      setError(err.response?.data?.message || "Login gagal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl" />

      <div className="relative z-10 bg-white/95 backdrop-blur-md p-8 sm:p-10 rounded-3xl shadow-2xl max-w-md w-full border border-slate-100">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-gradient-to-tr from-indigo-600 to-sky-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg">
            <i className="fas fa-user-tie" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-800 tracking-wider uppercase">PPDB Al-Hasanah</h2>
            <p className="text-xs text-slate-500 mt-1">Login TU, Guru, dan Kepala Sekolah (akun Amanah)</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Username Amanah</label>
            <input
              required
              className={inputClass}
              value={log.identifier}
              onChange={(e) => setLog({ ...log, identifier: e.target.value })}
              placeholder="Username rapor / Amanah"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <input
              required
              type="password"
              className={inputClass}
              value={log.password}
              onChange={(e) => setLog({ ...log, password: e.target.value })}
              placeholder="Password Amanah"
            />
          </div>
          {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
          <button
            disabled={busy}
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-sm shadow-md"
          >
            {busy ? "Memproses..." : "Masuk"}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-500 mt-5">
          Orang tua / wali masuk di{" "}
          <Link to="/wali" className="text-sky-700 font-bold">
            /wali
          </Link>
        </p>
      </div>
    </div>
  );
}
