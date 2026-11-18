import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import FilePickButton from "../components/FilePickButton";
import Modal from "../components/Modal";
import RichTextEditor, { isRichEmpty, sanitizeRichHtml } from "../components/RichTextEditor";
import FeeSetupView from "./FeeSetupView";

const MENUS = [
  { id: "home", label: "Beranda", icon: "fa-house" },
  { id: "list-siswa-baru", label: "List Siswa Baru", icon: "fa-user-graduate", tuOnly: true, section: "spmb" },
  { id: "mapel", label: "Mapel Tes", icon: "fa-book", tuOnly: true, section: "spmb", submenu: "setup" },
  { id: "tahapan", label: "Tahapan", icon: "fa-list-ol", tuOnly: true, section: "spmb", submenu: "setup" },
  { id: "pernyataan", label: "Surat Pernyataan", icon: "fa-file-signature", tuOnly: true, section: "spmb", submenu: "content" },
  { id: "persyaratan", label: "Persyaratan", icon: "fa-file-lines", tuOnly: true, section: "spmb", submenu: "content" },
  { id: "dokumen", label: "Dokumen", icon: "fa-folder-open", tuOnly: true, section: "spmb", submenu: "setup" },
  { id: "id-registrasi", label: "ID Registrasi", icon: "fa-id-card", tuOnly: true, section: "spmb", submenu: "setup" },
  { id: "kelas", label: "Kelas SPMB", icon: "fa-chalkboard", tuOnly: true, section: "spmb", submenu: "setup" },
  { id: "gelombang", label: "Gelombang", icon: "fa-water", tuOnly: true, section: "spmb", submenu: "setup" },
  { id: "jadwal-ujian", label: "Jadwal Ujian", icon: "fa-calendar-days", tuOnly: true, section: "spmb", submenu: "setup" },
  { id: "generate-biaya", label: "Generate Biaya", icon: "fa-coins", tuOnly: true, section: "keuangan" },
  { id: "detail-tagihan", label: "Detail Tagihan per Anak", icon: "fa-file-invoice-dollar", tuOnly: true, section: "keuangan" },
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

function formatRp(amount) {
  return `Rp${Number(amount || 0).toLocaleString("id-ID")}`;
}

export default function StaffPanel({ showToast }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isTu = user?.role === "TU";
  const canTes = user?.role === "TU" || user?.role === "GURU";
  const [menu, setMenu] = useState("home");
  const [spmbExpanded, setSpmbExpanded] = useState(true);
  const [contentExpanded, setContentExpanded] = useState(true);
  const [setupExpanded, setSetupExpanded] = useState(true);
  const [keuanganExpanded, setKeuanganExpanded] = useState(true);

  const visibleMenus = MENUS.filter((item) => {
    if (item.tuOnly && !isTu) return false;
    if (item.roles && !item.roles.includes(user?.role)) return false;
    return true;
  });
  const spmbMenus = visibleMenus.filter((item) => item.section === "spmb");
  const spmbDirectMenus = spmbMenus.filter((item) => !item.submenu);
  const contentMenus = spmbMenus.filter((item) => item.submenu === "content");
  const setupMenus = spmbMenus.filter((item) => item.submenu === "setup");
  const keuanganMenus = visibleMenus.filter((item) => item.section === "keuangan");
  const otherMenus = visibleMenus.filter((item) => item.id === "home" || !item.section);
  const isSpmbMenuActive = spmbMenus.some((item) => item.id === menu);
  const isContentMenuActive = contentMenus.some((item) => item.id === menu);
  const isSetupMenuActive = setupMenus.some((item) => item.id === menu);
  const isKeuanganMenuActive = keuanganMenus.some((item) => item.id === menu);
  const openMenu = (id) => {
    setMenu(id);
    if (spmbMenus.some((item) => item.id === id)) setSpmbExpanded(true);
    if (contentMenus.some((item) => item.id === id)) setContentExpanded(true);
    if (setupMenus.some((item) => item.id === id)) setSetupExpanded(true);
    if (keuanganMenus.some((item) => item.id === id)) setKeuanganExpanded(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-60 shrink-0 bg-sky-800 text-white flex flex-col">
        <div className="px-5 py-5 border-b border-sky-700">
          <p className="text-[10px] uppercase tracking-wider text-sky-200">Panel SPMB</p>
          <h1 className="font-bold text-sm mt-1">Al-Hasanah</h1>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {otherMenus.filter((item) => item.id === "home").map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openMenu(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                menu === item.id ? "bg-white text-sky-800" : "text-sky-100 hover:bg-sky-700"
              }`}
            >
              <i className={`fas ${item.icon} w-4 text-center`} />
              {item.label}
            </button>
          ))}
          {spmbMenus.length > 0 ? (
            <div>
              <button
                type="button"
                aria-expanded={spmbExpanded}
                onClick={() => setSpmbExpanded((expanded) => !expanded)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                  isSpmbMenuActive ? "bg-white text-sky-800" : "text-sky-100 hover:bg-sky-700"
                }`}
              >
                <i className="fas fa-layer-group w-4 text-center" />
                <span className="flex-1">SPMB</span>
                <i className={`fas ${spmbExpanded ? "fa-chevron-down" : "fa-chevron-right"} text-[10px]`} />
              </button>
              {spmbExpanded ? (
                <div className="mt-1 ml-3 pl-2 border-l border-sky-600 space-y-1">
                  {spmbDirectMenus.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openMenu(item.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                        menu === item.id ? "bg-white text-sky-800" : "text-sky-100 hover:bg-sky-700"
                      }`}
                    >
                      <i className={`fas ${item.icon} w-4 text-center`} />
                      {item.label}
                    </button>
                  ))}
                  {setupMenus.length > 0 ? (
                    <div>
                      <button
                        type="button"
                        aria-expanded={setupExpanded}
                        onClick={() => setSetupExpanded((expanded) => !expanded)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                          isSetupMenuActive ? "bg-white text-sky-800" : "text-sky-100 hover:bg-sky-700"
                        }`}
                      >
                        <i className="fas fa-gear w-4 text-center" />
                        <span className="flex-1">Setup</span>
                        <i className={`fas ${setupExpanded ? "fa-chevron-down" : "fa-chevron-right"} text-[10px]`} />
                      </button>
                      {setupExpanded ? (
                        <div className="mt-1 ml-3 pl-2 border-l border-sky-600 space-y-1">
                          {setupMenus.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => openMenu(item.id)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                                menu === item.id ? "bg-white text-sky-800" : "text-sky-100 hover:bg-sky-700"
                              }`}
                            >
                              <i className={`fas ${item.icon} w-4 text-center`} />
                              {item.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {contentMenus.length > 0 ? (
                    <div>
                      <button
                        type="button"
                        aria-expanded={contentExpanded}
                        onClick={() => setContentExpanded((expanded) => !expanded)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                          isContentMenuActive ? "bg-white text-sky-800" : "text-sky-100 hover:bg-sky-700"
                        }`}
                      >
                        <i className="fas fa-folder-open w-4 text-center" />
                        <span className="flex-1">Content</span>
                        <i className={`fas ${contentExpanded ? "fa-chevron-down" : "fa-chevron-right"} text-[10px]`} />
                      </button>
                      {contentExpanded ? (
                        <div className="mt-1 ml-3 pl-2 border-l border-sky-600 space-y-1">
                          {contentMenus.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => openMenu(item.id)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                                menu === item.id ? "bg-white text-sky-800" : "text-sky-100 hover:bg-sky-700"
                              }`}
                            >
                              <i className={`fas ${item.icon} w-4 text-center`} />
                              {item.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {keuanganMenus.length > 0 ? (
            <div>
              <button
                type="button"
                aria-expanded={keuanganExpanded}
                onClick={() => setKeuanganExpanded((expanded) => !expanded)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                  isKeuanganMenuActive ? "bg-white text-sky-800" : "text-sky-100 hover:bg-sky-700"
                }`}
              >
                <i className="fas fa-wallet w-4 text-center" />
                <span className="flex-1">Keuangan</span>
                <i className={`fas ${keuanganExpanded ? "fa-chevron-down" : "fa-chevron-right"} text-[10px]`} />
              </button>
              {keuanganExpanded ? (
                <div className="mt-1 ml-3 pl-2 border-l border-sky-600 space-y-1">
                  {keuanganMenus.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openMenu(item.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                        menu === item.id ? "bg-white text-sky-800" : "text-sky-100 hover:bg-sky-700"
                      }`}
                    >
                      <i className={`fas ${item.icon} w-4 text-center`} />
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {otherMenus.filter((item) => item.id !== "home").map((item) => (
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
        {menu === "home" ? <HomeView user={user} isTu={isTu} canTes={canTes} onOpen={openMenu} /> : null}
        {menu === "list-siswa-baru" && isTu ? <ListSiswaBaruView /> : null}
        {menu === "persyaratan" && isTu ? <PersyaratanView showToast={showToast} /> : null}
        {menu === "pernyataan" && isTu ? <PernyataanView showToast={showToast} /> : null}
        {menu === "dokumen" && isTu ? <DokumenView showToast={showToast} /> : null}
        {menu === "generate-biaya" && isTu ? <FeeSetupView showToast={showToast} /> : null}
        {menu === "detail-tagihan" && isTu ? <DetailTagihanView showToast={showToast} /> : null}
        {menu === "kelas" && isTu ? <KelasView showToast={showToast} user={user} /> : null}
        {menu === "gelombang" && isTu ? <GelombangView showToast={showToast} user={user} /> : null}
        {menu === "jadwal-ujian" && isTu ? <JadwalUjianView showToast={showToast} /> : null}
        {menu === "tahapan" && isTu ? <TahapanView showToast={showToast} /> : null}
        {menu === "mapel" && isTu ? <MapelView showToast={showToast} /> : null}
        {menu === "id-registrasi" && isTu ? <RegistrationPrefixView showToast={showToast} user={user} /> : null}
        {menu === "tes" && canTes ? <TesView showToast={showToast} user={user} /> : null}
      </main>
    </div>
  );
}

function RegistrationPrefixView({ showToast, user }) {
  const [registrationPrefix, setRegistrationPrefix] = useState("");
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;
    api.get("/tu/registration-prefix")
      .then(({ data }) => {
        if (!active) return;
        setRegistrationPrefix(data.registrationPrefix || "");
        setConfigured(Boolean(data.configured));
      })
      .catch((error) => {
        if (active) showToast?.("Gagal", error.response?.data?.message || "Tidak dapat memuat ID lembaga.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.put("/tu/registration-prefix", { registrationPrefix });
      setConfigured(true);
      showToast?.("Tersimpan", data.message);
    } catch (error) {
      showToast?.("Gagal", error.response?.data?.message || "Tidak dapat menyimpan ID lembaga.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">ID Registrasi Lembaga</h2>
        <p className="mt-1 text-xs text-slate-500">
          Atur kode 4 digit untuk {user?.schoolName || "lembaga ini"}. Setiap pendaftar mendapat ID berformat kode lembaga + 8 angka acak.
        </p>
      </div>
      <form onSubmit={save} className="space-y-4 rounded-2xl border bg-white p-5">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Kode lembaga (4 digit)</span>
          <input
            required
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            autoComplete="off"
            className="w-full max-w-xs rounded-lg border px-3 py-2 text-sm disabled:bg-slate-50"
            placeholder="Contoh: 9365"
            value={registrationPrefix}
            disabled={busy || configured}
            onChange={(event) => setRegistrationPrefix(event.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </label>
        <p className="text-xs text-slate-500">
          Contoh ID registrasi: <strong>{registrationPrefix || "9365"}12345678</strong>. Kode harus unik dan tidak dapat diubah setelah disimpan.
        </p>
        {!configured ? (
          <button
            type="submit"
            disabled={busy || registrationPrefix.length !== 4}
            className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy ? "Memuat..." : "Simpan kode lembaga"}
          </button>
        ) : (
          <p className="text-xs font-semibold text-emerald-700">Kode {registrationPrefix} sudah aktif untuk pendaftaran baru.</p>
        )}
      </form>
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
            onClick={() => onOpen("dokumen")}
            className="text-left bg-white border rounded-2xl p-5 hover:border-sky-400"
          >
            <p className="font-bold text-slate-800 text-sm">
              <i className="fas fa-folder-open mr-2 text-sky-700" /> Dokumen
            </p>
            <p className="text-xs text-slate-500 mt-1">Atur berkas yang wajib diunggah orang tua di tahap 6.</p>
          </button>
          <button
            type="button"
            onClick={() => onOpen("generate-biaya")}
            className="text-left bg-white border rounded-2xl p-5 hover:border-sky-400"
          >
            <p className="font-bold text-slate-800 text-sm">
              <i className="fas fa-coins mr-2 text-sky-700" /> Generate Biaya
            </p>
            <p className="text-xs text-slate-500 mt-1">Kelola item, grup, paket pembayaran, dan nominal per tahun ajaran.</p>
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

function DetailTagihanView({ showToast }) {
  const [applicants, setApplicants] = useState([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [feeModal, setFeeModal] = useState(null);
  const [feeItems, setFeeItems] = useState([]);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeSaving, setFeeSaving] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");

  const load = async (search = query) => {
    setBusy(true);
    try {
      const { data } = await api.get("/tu/applicants", {
        params: search.trim() ? { q: search.trim() } : {},
      });
      setApplicants(data.applicants || []);
    } catch (error) {
      showToast?.("Gagal", error.response?.data?.message || "Tidak dapat memuat detail tagihan.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    api.get("/tu/applicants")
      .then(({ data }) => {
        if (active) setApplicants(data.applicants || []);
      })
      .catch((error) => {
        if (active) showToast?.("Gagal", error.response?.data?.message || "Tidak dapat memuat detail tagihan.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  const formatAmount = (amount) =>
    amount == null ? "-" : `Rp${Number(amount).toLocaleString("id-ID")}`;
  const formatDate = (date) =>
    date ? new Date(date).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-";
  const billStatusLabel = (status) =>
    ({ PAID: "Lunas", UNPAID: "Belum lunas", EXPIRED: "Kedaluwarsa" })[status] || status;

  const openFeeDetails = async (row) => {
    setPaymentAmount("");
    setFeeModal({
      applicant: { studentName: row.studentName, kelasName: row.kelasName, parentName: row.parentName },
      packageName: row.paymentPackageName,
      academicYear: row.examAcademicYear,
    });
    setFeeLoading(true);
    try {
      const { data } = await api.get(`/tu/applicants/${row.id}/fee-details`);
      setFeeModal(data);
      setFeeItems(data.items.map((item) => ({
        ...item,
        deductionAmount: String(item.deductionAmount),
        oasisAmount: String(item.oasisAmount || 0),
        description: item.description || "",
      })));
    } catch (error) {
      setFeeModal(null);
      showToast?.("Gagal", error.response?.data?.message || "Tidak dapat memuat rincian tagihan siswa.");
    } finally {
      setFeeLoading(false);
    }
  };

  const saveFeeDetails = async (event) => {
    event.preventDefault();
    if (feeItems.some((item) =>
      (item.deductionAmount.trim() !== ""
        && (!Number.isSafeInteger(Number(item.deductionAmount))
          || Number(item.deductionAmount) < 0
          || Number(item.deductionAmount) > item.globalAmount))
      || (item.oasisAmount.trim() !== ""
        && (!Number.isSafeInteger(Number(item.oasisAmount))
          || Number(item.oasisAmount) < 0
          || Number(item.oasisAmount) > 2147483647 - (item.globalAmount - (Number(item.deductionAmount) || 0))))
    )) {
      showToast?.("Gagal", "Nominal pengurang harus antara Rp0 dan nominal global, serta tambahan Oasis berupa bilangan bulat nol atau lebih.");
      return;
    }
    setFeeSaving(true);
    try {
      const { data } = await api.put(`/tu/applicants/${feeModal.applicant.id}/fee-details`, {
        items: feeItems.map((item) => ({
          groupId: item.groupId,
          ...(item.deductionAmount.trim() !== "" ? { deductionAmount: Number(item.deductionAmount) } : {}),
          ...(item.oasisAmount.trim() !== "" ? { oasisAmount: Number(item.oasisAmount) } : {}),
          description: item.description,
        })),
      });
      setFeeModal(data);
      setFeeItems(data.items.map((item) => ({
        ...item,
        deductionAmount: String(item.deductionAmount),
        oasisAmount: String(item.oasisAmount || 0),
        description: item.description || "",
      })));
      showToast?.("Tersimpan", data.message);
    } catch (error) {
      showToast?.("Gagal", error.response?.data?.message || "Rincian tagihan tidak dapat disimpan.");
    } finally {
      setFeeSaving(false);
    }
  };

  const recordPayment = async () => {
    if (!feeModal?.applicant?.id) return;
    setFeeSaving(true);
    try {
      const { data } = await api.post(`/tu/applicants/${feeModal.applicant.id}/admission-payments`, {
        amount: Number(paymentAmount),
      });
      setFeeModal(data);
      setPaymentAmount("");
      showToast?.("Tersimpan", data.message);
      await load();
    } catch (error) {
      showToast?.("Gagal", error.response?.data?.message || "Pembayaran tidak dapat dicatat.");
    } finally {
      setFeeSaving(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Detail Tagihan per Anak</h2>
        <p className="text-xs text-slate-500 mt-1">
          Kelola rincian biaya masuk dan catat pembayaran orang tua berdasarkan paket yang dipilih pada form hasil tes.
        </p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          load(query);
        }}
      >
        <input
          className="w-full max-w-sm px-3 py-2 border rounded-lg text-xs"
          placeholder="Cari nama calon siswa atau kelas"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          disabled={busy}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold disabled:opacity-60"
        >
          {busy ? "Memuat..." : "Cari"}
        </button>
      </form>
      <div className="bg-white border rounded-2xl overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Calon siswa</th>
              <th className="px-3 py-2 font-semibold">Wali/Orang tua</th>
              <th className="px-3 py-2 font-semibold">Kelas</th>
              <th className="px-3 py-2 font-semibold">Paket pembayaran</th>
              <th className="px-3 py-2 font-semibold">Gelombang</th>
              <th className="px-3 py-2 font-semibold">Tagihan pendaftaran</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Metode</th>
              <th className="px-3 py-2 font-semibold">Waktu pembayaran</th>
              <th className="px-3 py-2 font-semibold">Kedaluwarsa</th>
              <th className="px-3 py-2 font-semibold">Biaya masuk</th>
            </tr>
          </thead>
          <tbody>
            {applicants.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-slate-500">
                  {busy ? "Memuat data tagihan..." : "Belum ada data tagihan."}
                </td>
              </tr>
            ) : null}
            {applicants.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2 font-bold text-slate-800">{row.studentName || "-"}</td>
                <td className="px-3 py-2">
                  {row.parentName || "-"}
                  <div className="text-slate-400">{row.parentUsername || ""}</div>
                </td>
                <td className="px-3 py-2">{row.kelasName || "-"}</td>
                <td className="px-3 py-2">{row.paymentPackageName || "-"}</td>
                <td className="px-3 py-2">{row.waveName || "-"}</td>
                <td className="px-3 py-2 font-semibold">{formatAmount(row.billAmount)}</td>
                <td className={`px-3 py-2 font-semibold ${row.billStatus === "PAID" ? "text-emerald-700" : "text-amber-700"}`}>
                  {billStatusLabel(row.billStatus)}
                </td>
                <td className="px-3 py-2">{row.billMethod || "-"}</td>
                <td className="px-3 py-2">{formatDate(row.billPaidAt)}</td>
                <td className="px-3 py-2">{formatDate(row.billExpiresAt)}</td>
                <td className="px-3 py-2">
                  {row.paymentPackageName && row.examAcademicYear ? (
                    <button
                      type="button"
                      onClick={() => openFeeDetails(row)}
                      className="rounded-lg bg-sky-50 px-3 py-1.5 font-bold text-sky-700 hover:bg-sky-100"
                    >
                      Rincian & pembayaran
                    </button>
                  ) : (
                    <span className="text-slate-400" title="Paket ditetapkan pada form hasil tes">Belum dipilih di Tes</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal
        open={Boolean(feeModal)}
        title="Rincian tagihan siswa"
        icon="fa-file-invoice-dollar"
        onClose={() => {
          if (!feeLoading && !feeSaving) setFeeModal(null);
        }}
        maxWidth="max-w-3xl"
      >
        {feeModal ? (
          <form onSubmit={saveFeeDetails} className="space-y-4 p-5 text-xs">
            <div className="rounded-xl border bg-slate-50 p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <p><span className="font-semibold text-slate-500">Nama siswa:</span> {feeModal.applicant?.studentName || "-"}</p>
                <p><span className="font-semibold text-slate-500">Kelas:</span> {feeModal.applicant?.kelasName || "-"}</p>
                <p><span className="font-semibold text-slate-500">Wali:</span> {feeModal.applicant?.parentName || "-"}</p>
                <p><span className="font-semibold text-slate-500">Tahun ajaran:</span> {feeModal.academicYear || "-"}</p>
                <p className="sm:col-span-2"><span className="font-semibold text-slate-500">Paket dari hasil tes:</span> {feeModal.packageName || "-"}</p>
              </div>
            </div>
            <p className="text-slate-500">
              Isi nominal pengurang dan tambahan Oasis. Sisa tagihan dihitung dari nominal global dikurangi pengurang, lalu ditambah Oasis; perubahan hanya berlaku untuk siswa ini.
              Tagihan pendaftaran tidak termasuk di rincian ini.
            </p>
            <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <p><span className="font-semibold text-slate-600">Total biaya masuk:</span> {formatAmount(feeModal.totalAmount)}</p>
                <p><span className="font-semibold text-slate-600">Sudah dibayar:</span> {formatAmount(feeModal.paidAmount)}</p>
                <p><span className="font-semibold text-slate-600">Sisa tagihan:</span> {formatAmount(feeModal.remainingAmount)}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="number"
                  min="1"
                  max={feeModal.remainingAmount || 0}
                  step="1"
                  inputMode="numeric"
                  aria-label="Nominal pembayaran biaya masuk"
                  placeholder="Nominal pembayaran orang tua"
                  className="min-w-0 flex-1 rounded-lg border px-3 py-2"
                  value={paymentAmount}
                  disabled={feeSaving || feeLoading || feeModal.pendingAmount > 0 || feeModal.remainingAmount <= 0}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                />
                <button
                  type="button"
                  onClick={recordPayment}
                  disabled={feeSaving || feeLoading || !paymentAmount || feeModal.pendingAmount > 0 || feeModal.remainingAmount <= 0}
                  className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-50"
                >
                  {feeSaving ? "Menyimpan..." : "Catat pembayaran"}
                </button>
              </div>
              {feeModal.pendingAmount > 0 ? (
                <p className="text-amber-800">Ada pembayaran online {formatAmount(feeModal.pendingAmount)} yang menunggu konfirmasi. Pencatatan manual ditunda agar tidak terjadi pembayaran ganda.</p>
              ) : null}
              {feeModal.payments?.length ? (
                <div className="overflow-x-auto rounded-lg border bg-white">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Tanggal</th>
                        <th className="px-3 py-2">Metode</th>
                        <th className="px-3 py-2">Nominal</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Dicatat oleh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeModal.payments.map((payment) => (
                        <tr key={payment.id} className="border-t">
                          <td className="px-3 py-2">{formatDate(payment.paidAt || payment.createdAt)}</td>
                          <td className="px-3 py-2">{payment.method === "MANUAL" ? "Manual TU" : "VA BNI"}</td>
                          <td className="px-3 py-2">{formatAmount(payment.amount)}</td>
                          <td className="px-3 py-2">{payment.status === "PAID" ? "Terkonfirmasi" : payment.status === "PENDING" ? "Menunggu" : payment.status === "EXPIRED" ? "Kedaluwarsa" : "Gagal"}</td>
                          <td className="px-3 py-2">{payment.recordedBy || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
            {feeLoading ? (
              <div className="py-8 text-center text-slate-500">Memuat rincian biaya...</div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Grup biaya</th>
                        <th className="px-3 py-2 text-right">Nominal global</th>
                        <th className="px-3 py-2">Nominal siswa / pengurang (Rp)</th>
                        <th className="px-3 py-2">Penambahan Oasis (Rp)</th>
                        <th className="px-3 py-2">Keterangan</th>
                        <th className="px-3 py-2">Sisa tagihan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeItems.map((item) => (
                        <tr key={item.groupId} className="border-t">
                          <td className="px-3 py-2 font-semibold text-slate-700">{item.name}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{formatAmount(item.globalAmount)}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max={item.globalAmount}
                              step="1"
                              inputMode="numeric"
                              aria-label={`Pengurang siswa ${item.name}`}
                              className="w-full min-w-36 rounded-lg border px-3 py-2 text-right"
                              value={item.deductionAmount}
                              disabled={feeSaving}
                              onChange={(event) => setFeeItems((current) => current.map((row) =>
                                row.groupId === item.groupId ? { ...row, deductionAmount: event.target.value } : row
                              ))}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max={2147483647 - (item.globalAmount - (Number(item.deductionAmount) || 0))}
                              step="1"
                              inputMode="numeric"
                              aria-label={`Penambahan Oasis ${item.name}`}
                              className="w-full min-w-36 rounded-lg border px-3 py-2 text-right"
                              value={item.oasisAmount}
                              disabled={feeSaving}
                              onChange={(event) => setFeeItems((current) => current.map((row) =>
                                row.groupId === item.groupId ? { ...row, oasisAmount: event.target.value } : row
                              ))}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              maxLength={2000}
                              aria-label={`Keterangan ${item.name}`}
                              placeholder="Tambahkan keterangan"
                              className="w-full min-w-40 rounded-lg border px-3 py-2"
                              value={item.description}
                              disabled={feeSaving}
                              onChange={(event) => setFeeItems((current) => current.map((row) =>
                                row.groupId === item.groupId ? { ...row, description: event.target.value } : row
                              ))}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-emerald-700">
                            {formatAmount(Math.max(0, item.globalAmount - (Number(item.deductionAmount) || 0)) + (Number(item.oasisAmount) || 0))}
                            <div className="mt-1 text-[10px] font-normal text-slate-500">
                              {formatAmount(item.globalAmount)} - {formatAmount(Number(item.deductionAmount) || 0)} + {formatAmount(Number(item.oasisAmount) || 0)}
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t bg-slate-50 font-bold">
                        <td className="px-3 py-3" colSpan={5}>Total biaya masuk</td>
                        <td className="px-3 py-3 text-right">
                          {formatAmount(feeItems.reduce((sum, item) =>
                            sum + Math.max(0, item.globalAmount - (Number(item.deductionAmount) || 0)) + (Number(item.oasisAmount) || 0), 0
                          ))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setFeeModal(null)}
                    disabled={feeLoading || feeSaving}
                    className="rounded-lg border px-4 py-2 font-bold text-slate-600 disabled:opacity-50"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    disabled={feeSaving || feeLoading || feeItems.length === 0}
                    className="rounded-lg bg-sky-600 px-4 py-2 font-bold text-white disabled:opacity-50"
                  >
                    {feeSaving ? "Menyimpan..." : "Simpan rincian"}
                  </button>
                </div>
              </>
            )}
          </form>
        ) : null}
      </Modal>
    </div>
  );
}

function JadwalUjianView({ showToast }) {
  const [waves, setWaves] = useState([]);
  const [waveId, setWaveId] = useState("");
  const [form, setForm] = useState({ examDate: "", examLocation: "" });
  const [wavesLoaded, setWavesLoaded] = useState(false);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.get("/spmb-waves")
      .then(({ data }) => {
        if (!active) return;
        const availableWaves = data.waves || [];
        setWaves(availableWaves);
        setWaveId((current) => current || String(availableWaves[0]?.id || ""));
      })
      .catch((error) => {
        if (active) showToast?.("Gagal", error.response?.data?.message || "Tidak dapat memuat jadwal ujian.");
      })
      .finally(() => {
        if (active) setWavesLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  useEffect(() => {
    if (!wavesLoaded) return undefined;
    if (!waveId) {
      setForm({ examDate: "", examLocation: "" });
      setBusy(false);
      return undefined;
    }
    let active = true;
    setBusy(true);
    api.get("/tu/exam-schedule", { params: { waveId } })
      .then(({ data }) => {
        if (active) setForm({
          examDate: data.examDate || "",
          examLocation: data.examLocation || "",
        });
      })
      .catch((error) => {
        if (active) showToast?.("Gagal", error.response?.data?.message || "Tidak dapat memuat jadwal ujian.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [waveId, wavesLoaded, showToast]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/tu/exam-schedule", { ...form, waveId: Number(waveId) });
      setForm({ examDate: data.examDate || "", examLocation: data.examLocation || "" });
      showToast?.("Tersimpan", data.message || "Jadwal ujian diperbarui.");
    } catch (error) {
      showToast?.("Gagal", error.response?.data?.message || "Tidak dapat menyimpan jadwal ujian.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Jadwal Ujian per Gelombang</h2>
        <p className="text-xs text-slate-500 mt-1">
          Atur tanggal dan lokasi ujian untuk setiap gelombang. Wali melihat jadwal sesuai gelombang yang dipilih pada hasil tes.
        </p>
      </div>
      <form onSubmit={save} className="bg-white border rounded-2xl p-5 space-y-4">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Gelombang</span>
          <select
            required
            className="w-full px-3 py-2 border rounded-lg text-sm"
            value={waveId}
            disabled={busy || saving || waves.length === 0}
            onChange={(event) => setWaveId(event.target.value)}
          >
            <option value="">Pilih gelombang</option>
            {waves.map((wave) => (
              <option key={wave.id} value={wave.id}>{wave.name}</option>
            ))}
          </select>
          {waves.length === 0 ? (
            <span className="text-xs text-amber-700">Buat gelombang terlebih dahulu di menu SPMB &gt; Gelombang.</span>
          ) : null}
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Tanggal ujian</span>
          <input
            type="date"
            className="w-full px-3 py-2 border rounded-lg text-sm"
            value={form.examDate}
            disabled={busy || saving}
            onChange={(event) => setForm((current) => ({ ...current, examDate: event.target.value }))}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Lokasi ujian</span>
          <input
            type="text"
            maxLength={255}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="Contoh: Aula Al-Hasanah"
            value={form.examLocation}
            disabled={busy || saving}
            onChange={(event) => setForm((current) => ({ ...current, examLocation: event.target.value }))}
          />
        </label>
        <button
          type="submit"
          disabled={busy || saving || !waveId}
          className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold disabled:opacity-60"
        >
          {busy ? "Memuat..." : saving ? "Menyimpan..." : "Simpan jadwal ujian"}
        </button>
      </form>
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

function DokumenView({ showToast }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [published, setPublished] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await api.get("/doc-requirements");
    setItems(data.documents || []);
  };

  useEffect(() => {
    load().catch((err) => showToast?.("Gagal", err.response?.data?.message || "Tidak dapat memuat dokumen."));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const payload = { name: name.trim(), published };
      if (editingId) {
        await api.patch(`/doc-requirements/${editingId}`, payload);
        showToast?.("Tersimpan", "Dokumen diperbarui.");
      } else {
        await api.post("/doc-requirements", payload);
        showToast?.("Tersimpan", "Dokumen ditambahkan.");
      }
      setName("");
      setPublished(true);
      setEditingId(null);
      await load();
    } catch (err) {
      showToast?.("Gagal", err.response?.data?.message || "Tidak dapat menyimpan dokumen.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus dokumen ini dari tahap unggah orang tua?")) return;
    await api.delete(`/doc-requirements/${id}`);
    await load();
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Dokumen fisik</h2>
        <p className="text-xs text-slate-500 mt-1">Daftar ini yang wajib diunggah orang tua di tahap 6. Setiap berkas maksimal 2 MB.</p>
      </div>
      <form onSubmit={save} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="flex gap-2">
          <input
            required
            className="flex-1 px-3 py-2 border rounded-lg text-xs"
            placeholder="Nama dokumen, contoh: Scan Kartu Keluarga"
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
                setPublished(true);
              }}
            >
              Batal
            </button>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Tampilkan ke orang tua
        </label>
      </form>
      <div className="bg-white border rounded-2xl overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-emerald-600 text-white">
            <tr>
              <th className="px-3 py-2 font-semibold w-12">No</th>
              <th className="px-3 py-2 font-semibold">Nama dokumen</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold w-28" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                  Belum ada dokumen.
                </td>
              </tr>
            ) : null}
            {items.map((item, index) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2 font-semibold text-slate-800">{item.name}</td>
                <td className="px-3 py-2 text-slate-500">{item.published ? "Ditampilkan" : "Disembunyikan"}</td>
                <td className="px-3 py-2 text-right space-x-3">
                  <button
                    type="button"
                    className="text-sky-700 font-bold"
                    onClick={() => {
                      setEditingId(item.id);
                      setName(item.name);
                      setPublished(item.published);
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
  paymentPackageId: "",
  waveId: "",
  academicYear: academicYears()[0],
  status: "",
  scores: [],
  note: "",
};

const EXAM_STATUS_LABELS = {
  LULUS: "Lulus",
  TIDAK_LULUS: "Tidak Lulus",
  LULUS_CADANGAN: "Lulus Cadangan",
  MENGUNDURKAN_DIRI: "Mengundurkan Diri",
};

function TesView({ showToast, user }) {
  const [rows, setRows] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [packages, setPackages] = useState([]);
  const [waves, setWaves] = useState([]);
  const [schoolName, setSchoolName] = useState(user?.schoolName || "");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_EXAM);
  const [busy, setBusy] = useState(false);
  const [announcementDate, setAnnouncementDate] = useState("");
  const [announcementWaveId, setAnnouncementWaveId] = useState("");
  const isAtExamStage = (row) => Number(row.currentStep) === 4;
  const stageFourApplicants = rows.filter(isAtExamStage);
  const selectedWave = waves.find((wave) => String(wave.id) === announcementWaveId);
  const pendingCount = selectedWave
    ? rows.filter((row) => row.announcementPending && String(row.waveId) === announcementWaveId).length
    : 0;
  const paymentStatusLabel = (status) =>
    ({ PAID: "Lunas", PARTIAL: "Dibayar sebagian", PENDING: "Menunggu konfirmasi", UNPAID: "Belum dibayar" })[status] || "Belum diatur";

  const load = async () => {
    const { data } = await api.get("/exam-results");
    setRows(data.applicants || []);
    setSubjects(data.subjects || []);
    setPackages(data.packages || []);
    setWaves(data.waves || []);
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
      paymentPackageId: row.paymentPackageId ? String(row.paymentPackageId) : "",
      waveId: row.waveId ? String(row.waveId) : "",
      academicYear: exam?.academicYear || academicYears()[0],
      status: exam?.status || "",
      scores: scoreRows(subjects, exam?.scores),
      note: exam?.note || "",
    });
    setOpen(true);
  };

  const selectedApplicant = stageFourApplicants.find((row) => String(row.id) === form.applicantId);
  const applicantPackages = packages;

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

  const publish = async (e) => {
    e.preventDefault();
    if (!window.confirm(`Umumkan ${pendingCount} hasil tes ${selectedWave.name} sekarang? Tanggal hanya sebagai informasi.`)) return;
    setBusy(true);
    try {
      const { data } = await api.post("/exam-results/publish", { announcementDate, waveId: Number(announcementWaveId) });
      showToast?.(data.syncFailures ? "Pengumuman diterbitkan, sinkronisasi bermasalah" : "Pengumuman diterbitkan", data.message);
      await load();
    } catch (err) {
      showToast?.("Gagal", err.response?.data?.message || "Tidak dapat mengumumkan hasil tes.");
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
            Hasil tes disimpan sebagai draf sampai TU mengumumkannya. Siswa yang lulus kemudian dapat masuk tahap Surat Keputusan dan Biaya Masuk.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold shrink-0">
          Tambah hasil tes
        </button>
      </div>

      {user?.role === "TU" ? (
        <form onSubmit={publish} className="bg-white border rounded-2xl p-4 flex flex-wrap items-end gap-3 text-xs">
          <label className="space-y-1">
            <span className="block font-semibold text-slate-700">Tanggal pengumuman</span>
            <input type="date" required value={announcementDate} onChange={(e) => setAnnouncementDate(e.target.value)} className="px-3 py-2 border rounded-lg" />
          </label>
          <label className="space-y-1">
            <span className="block font-semibold text-slate-700">Gelombang</span>
            <select required value={announcementWaveId} onChange={(e) => setAnnouncementWaveId(e.target.value)} className="px-3 py-2 border rounded-lg">
              <option value="">Pilih gelombang</option>
              {waves.map((wave) => <option key={wave.id} value={wave.id}>{wave.name}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy || !announcementDate || !selectedWave || pendingCount === 0} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold disabled:opacity-50">
            Umumkan hasil tes ({pendingCount})
          </button>
          <p className="w-full text-slate-500">Hanya draf pada gelombang yang dipilih langsung diumumkan saat tombol ditekan. Tanggal hanya informasi, bukan jadwal otomatis.</p>
          {selectedWave && pendingCount === 0 ? <p className="w-full text-amber-700">Tidak ada draf untuk gelombang ini. Hasil yang sudah diumumkan tidak dihitung; isi hasil tes untuk pendaftar yang belum diisi.</p> : null}
          {waves.length === 0 ? <p className="w-full text-amber-700">Belum ada gelombang SPMB di lembaga ini.</p> : null}
        </form>
      ) : null}

      <div className="bg-white border rounded-2xl overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Calon siswa</th>
              <th className="px-3 py-2 font-semibold">Kelas</th>
              <th className="px-3 py-2 font-semibold">Gelombang</th>
              <th className="px-3 py-2 font-semibold">Penguji</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Tanggal</th>
              <th className="px-3 py-2 font-semibold">Paket pembayaran</th>
              <th className="px-3 py-2 font-semibold">Total biaya masuk</th>
              <th className="px-3 py-2 font-semibold">Pembayaran orang tua</th>
              <th className="px-3 py-2 font-semibold">Sisa tagihan</th>
              <th className="px-3 py-2 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-slate-500">
                  Belum ada calon siswa yang mengirim formulir di unit ini.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2 font-bold text-slate-800">
                  {row.studentName}
                  {row.examNumber ? <span className="block text-[10px] font-normal text-slate-500">No. {row.examNumber}</span> : null}
                </td>
                <td className="px-3 py-2">{row.kelasName || "-"}</td>
                <td className="px-3 py-2">{waves.find((wave) => Number(wave.id) === Number(row.waveId))?.name || "-"}</td>
                <td className="px-3 py-2">{row.exam?.examinerName || "-"}</td>
                <td className={`px-3 py-2 font-semibold ${row.exam?.status === "LULUS" ? "text-emerald-700" : "text-amber-700"}`}>
                  {row.exam ? EXAM_STATUS_LABELS[row.exam.status] || "Belum diisi" : "Belum diisi"}
                  {row.announcementPending ? <span className="block text-[10px] text-amber-700">Draf, belum diumumkan</span> : row.exam ? <span className="block text-[10px] text-slate-500">Sudah diumumkan</span> : null}
                </td>
                <td className="px-3 py-2">{formatWhen(row.exam?.updatedAt)}</td>
                <td className="px-3 py-2">
                  {row.paymentPackageName || "-"}
                  {row.announcementPending && row.draftPaymentPackageName !== row.paymentPackageName ? <span className="block text-[10px] text-amber-700">Draf: {row.draftPaymentPackageName || "-"}</span> : null}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {row.paymentTotalAmount == null ? "Belum diatur" : formatRp(row.paymentTotalAmount)}
                  {row.paymentTotalAmount != null && row.paymentAcademicYear ? (
                    <span className="block text-[10px] text-slate-500">{row.paymentAcademicYear}</span>
                  ) : null}
                </td>
                <td className={`px-3 py-2 font-semibold ${row.paymentStatus === "PAID" ? "text-emerald-700" : "text-amber-700"}`}>
                  {row.paymentTotalAmount == null ? "Belum diatur" : (
                    <>
                      {formatRp(row.paymentPaidAmount)}
                      <span className="block text-[10px]">{paymentStatusLabel(row.paymentStatus)}</span>
                      {row.paymentPendingAmount > 0 ? <span className="block text-[10px] text-amber-700">Menunggu: {formatRp(row.paymentPendingAmount)}</span> : null}
                    </>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap font-semibold">
                  {row.paymentRemainingAmount == null ? "Belum diatur" : formatRp(row.paymentRemainingAmount)}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-sky-700 font-bold disabled:text-slate-400 disabled:cursor-not-allowed"
                    onClick={() => openEdit(row)}
                    disabled={!isAtExamStage(row)}
                    title={!isAtExamStage(row) ? "Hasil tes hanya dapat diisi saat pendaftar berada di tahap 4." : ""}
                  >
                    {!isAtExamStage(row) ? "Di luar tahap 4" : row.exam ? "Ubah" : "Isi"}
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
              onChange={(e) => {
                const applicant = stageFourApplicants.find((row) => String(row.id) === e.target.value);
                setForm({
                  ...form,
                  applicantId: e.target.value,
                  paymentPackageId: applicant?.paymentPackageId ? String(applicant.paymentPackageId) : "",
                  waveId: applicant?.waveId ? String(applicant.waveId) : "",
                });
              }}
            >
              <option value="">Pilih calon siswa</option>
              {stageFourApplicants.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.studentName}{row.examNumber ? ` (${row.examNumber})` : ""}
                </option>
              ))}
            </select>
            {stageFourApplicants.length === 0 ? (
              <span className="text-amber-700">Belum ada calon siswa yang berada di tahap 4.</span>
            ) : null}
          </label>
          <label className="block space-y-1">
            <span className="font-semibold text-slate-600">Paket Pembayaran</span>
            <select
              required
              disabled={!selectedApplicant || applicantPackages.length === 0}
              className="w-full px-3 py-2 border rounded-lg disabled:bg-slate-50"
              value={form.paymentPackageId}
              onChange={(e) => setForm({ ...form, paymentPackageId: e.target.value })}
            >
              <option value="">Pilih paket pembayaran</option>
              {applicantPackages.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {selectedApplicant && applicantPackages.length === 0 ? (
              <span className="text-amber-700">
                Belum ada paket pembayaran yang dibuat. Silakan buat paket terlebih dahulu di menu Keuangan.
              </span>
            ) : null}
          </label>
          <label className="block space-y-1">
            <span className="font-semibold text-slate-600">Gelombang</span>
            <select
              required
              className="w-full px-3 py-2 border rounded-lg"
              value={form.waveId}
              onChange={(e) => setForm({ ...form, waveId: e.target.value })}
            >
              <option value="">Pilih gelombang</option>
              {waves.map((wave) => (
                <option key={wave.id} value={wave.id}>
                  {wave.name}
                </option>
              ))}
            </select>
            {waves.length === 0 ? (
              <span className="text-amber-700">TU belum membuat gelombang SPMB.</span>
            ) : null}
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="font-semibold text-slate-600">Penguji</span>
              <input className="w-full px-3 py-2 border rounded-lg bg-slate-50" value={user?.name || ""} readOnly />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold text-slate-600">Status kelulusan</span>
              <select
                required
                className="w-full px-3 py-2 border rounded-lg"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="">Pilih hasil setelah penilaian</option>
                <option value="LULUS">Lulus</option>
                <option value="TIDAK_LULUS">Tidak Lulus</option>
                <option value="LULUS_CADANGAN">Lulus Cadangan</option>
                <option value="MENGUNDURKAN_DIRI">Mengundurkan Diri</option>
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
                  required
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

function GelombangView({ showToast, user }) {
  const [waves, setWaves] = useState([]);
  const [form, setForm] = useState({ name: "", sortOrder: 0 });
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await api.get("/spmb-waves");
    setWaves(data.waves || []);
  };

  useEffect(() => {
    load().catch((error) =>
      showToast?.("Gagal", error.response?.data?.message || "Tidak dapat memuat gelombang.")
    );
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editingId) {
        await api.patch(`/spmb-waves/${editingId}`, payload);
        showToast?.("Tersimpan", "Gelombang diperbarui.");
      } else {
        await api.post("/spmb-waves", payload);
        showToast?.("Tersimpan", "Gelombang ditambahkan.");
      }
      setForm({ name: "", sortOrder: 0 });
      setEditingId(null);
      await load();
    } catch (error) {
      showToast?.("Gagal", error.response?.data?.message || "Tidak dapat menyimpan gelombang.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (wave) => {
    if (!window.confirm(`Hapus ${wave.name}?`)) return;
    try {
      await api.delete(`/spmb-waves/${wave.id}`);
      showToast?.("Dihapus", "Gelombang dihapus.");
      await load();
    } catch (error) {
      showToast?.("Gagal", error.response?.data?.message || "Tidak dapat menghapus gelombang.");
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Gelombang SPMB</h2>
        <p className="text-xs text-slate-500 mt-1">
          Buat gelombang untuk dipilih saat Guru mengisi hasil tes.
        </p>
      </div>
      <form onSubmit={save} className="bg-white rounded-2xl border p-5 space-y-3">
        <div className="px-3 py-2 bg-sky-50 border border-sky-200 rounded-lg text-xs font-semibold text-sky-900">
          Lembaga: {user?.schoolName || "Akun TU"}
        </div>
        <div className="grid sm:grid-cols-[1fr_8rem] gap-2">
          <input
            required
            maxLength={100}
            className="w-full px-3 py-2 border rounded-lg text-xs"
            placeholder="Nama gelombang, contoh: Gelombang 1"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <input
            type="number"
            min="0"
            className="w-full px-3 py-2 border rounded-lg text-xs"
            placeholder="Urutan"
            value={form.sortOrder}
            onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <button
            disabled={busy}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold disabled:opacity-60"
          >
            {busy ? "Menyimpan..." : editingId ? "Simpan perubahan" : "Tambah gelombang"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="px-4 py-2 border rounded-lg text-xs font-bold"
              onClick={() => {
                setEditingId(null);
                setForm({ name: "", sortOrder: 0 });
              }}
            >
              Batal
            </button>
          ) : null}
        </div>
      </form>
      <div className="bg-white border rounded-2xl overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Nama Gelombang</th>
              <th className="px-3 py-2 font-semibold">Urutan</th>
              <th className="px-3 py-2 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {waves.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                  Belum ada gelombang. Tambahkan gelombang untuk menampilkannya di form hasil tes.
                </td>
              </tr>
            ) : null}
            {waves.map((wave) => (
              <tr key={wave.id} className="border-t">
                <td className="px-3 py-2 font-semibold text-slate-800">{wave.name}</td>
                <td className="px-3 py-2">{wave.sortOrder}</td>
                <td className="px-3 py-2 text-right space-x-3">
                  <button
                    type="button"
                    className="text-sky-700 font-bold"
                    onClick={() => {
                      setEditingId(wave.id);
                      setForm({ name: wave.name, sortOrder: wave.sortOrder });
                    }}
                  >
                    Ubah
                  </button>
                  <button type="button" className="text-red-600 font-bold" onClick={() => remove(wave)}>
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
                          { step: 6, name: "Dokumen dan Validasi Data Siswa" },
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

function ListSiswaBaruView() {
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [studentFilter, setStudentFilter] = useState("BARU");
  const [paymentFilter, setPaymentFilter] = useState("SEMUA");
  const [documentFilter, setDocumentFilter] = useState("SEMUA");

  const getApplicants = useCallback(async () => {
    const { data } = await api.get("/tu/applicants");
    return data.applicants || [];
  }, []);

  const loadApplicants = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setApplicants(await getApplicants());
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Daftar calon siswa tidak dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, [getApplicants]);

  useEffect(() => {
    let active = true;
    getApplicants()
      .then((rows) => {
        if (active) setApplicants(rows);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.message || "Daftar calon siswa tidak dapat dimuat.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [getApplicants]);

  const newApplicants = applicants.filter((applicant) => !applicant.isAlumni);
  const normalizedSearch = search.trim().toLocaleLowerCase("id-ID");
  const filteredApplicants = applicants.filter((applicant) => {
    const matchesType =
      studentFilter === "SEMUA" ||
      (studentFilter === "BARU" && !applicant.isAlumni) ||
      (studentFilter === "ALUMNI" && applicant.isAlumni);
    const matchesPayment = paymentFilter === "SEMUA" || applicant.billStatus === paymentFilter;
    const searchableText = [
      applicant.studentName,
      applicant.parentName,
      applicant.parentUsername,
      applicant.kelasName,
      applicant.waveName,
      ...(applicant.documents || []).flatMap((document) => [document.name, document.originalName]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("id-ID");
    const hasUploadedDocuments = (applicant.documents || []).length > 0;
    const matchesDocuments =
      documentFilter === "SEMUA" ||
      (documentFilter === "SUDAH" && hasUploadedDocuments) ||
      (documentFilter === "BELUM" && !hasUploadedDocuments);
    return matchesType && matchesPayment && matchesDocuments && searchableText.includes(normalizedSearch);
  });
  const paidNewApplicants = newApplicants.filter((applicant) => applicant.billStatus === "PAID").length;
  const documentUploadCount = newApplicants.filter((applicant) => (applicant.documents || []).length > 0).length;
  const waitingNewApplicants = newApplicants.filter(
    (applicant) => applicant.announcementStatus === "MENUNGGU"
  ).length;
  const passedNewApplicants = newApplicants.filter(
    (applicant) => applicant.announcementStatus === "LULUS"
  ).length;

  const cards = [
    { label: "Siswa baru", value: newApplicants.length, icon: "fa-user-group", color: "bg-sky-50 text-sky-700" },
    { label: "Pembayaran lunas", value: paidNewApplicants, icon: "fa-circle-check", color: "bg-emerald-50 text-emerald-700" },
    { label: "Sudah upload berkas", value: documentUploadCount, icon: "fa-file-arrow-up", color: "bg-cyan-50 text-cyan-700" },
    { label: "Menunggu hasil", value: waitingNewApplicants, icon: "fa-hourglass-half", color: "bg-amber-50 text-amber-700" },
    { label: "Dinyatakan lulus", value: passedNewApplicants, icon: "fa-award", color: "bg-violet-50 text-violet-700" },
  ];

  const paymentLabel = (status) => {
    if (status === "PAID") return "Lunas";
    if (status === "PENDING") return "Menunggu";
    if (status === "EXPIRED") return "Kedaluwarsa";
    return "Belum bayar";
  };
  const stageNames = {
    1: "Registrasi",
    2: "Pembayaran",
    3: "Isi data",
    4: "Ujian",
    5: "Pengumuman",
    6: "Dokumen dan Validasi Data Siswa",
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-900 via-sky-800 to-cyan-700 px-6 py-7 text-white shadow-lg sm:px-8">
        <div className="absolute -right-8 -top-16 h-56 w-56 rounded-full border-[28px] border-white/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">Data Penerimaan</p>
            <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">List Siswa Baru</h2>
            <p className="mt-2 max-w-xl text-sm text-sky-100">
              Pantau calon siswa, pembayaran, dan tahapan pendaftaran dalam satu tempat.
            </p>
          </div>
          <button
            type="button"
            onClick={loadApplicants}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/20 disabled:opacity-60"
          >
            <i className={`fas fa-rotate ${loading ? "animate-spin" : ""}`} />
            Perbarui data
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-extrabold text-slate-800">{card.value}</p>
              </div>
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${card.color}`}>
                <i className={`fas ${card.icon}`} />
              </span>
            </div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-bold text-slate-800">Data calon siswa</h3>
            <p className="mt-1 text-xs text-slate-500">
              Menampilkan {filteredApplicants.length} dari {applicants.length} pendaftar di lembaga Anda.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <label className="relative sm:col-span-1">
              <span className="sr-only">Cari siswa</span>
              <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama, wali, kelas..."
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label>
              <span className="sr-only">Filter jenis siswa</span>
              <select
                value={studentFilter}
                onChange={(event) => setStudentFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400"
              >
                <option value="BARU">Siswa baru</option>
                <option value="SEMUA">Semua pendaftar</option>
                <option value="ALUMNI">Alumni</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Filter pembayaran</span>
              <select
                value={paymentFilter}
                onChange={(event) => setPaymentFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400"
              >
                <option value="SEMUA">Semua pembayaran</option>
                <option value="PAID">Lunas</option>
                <option value="UNPAID">Belum bayar</option>
                <option value="PENDING">Menunggu</option>
                <option value="EXPIRED">Kedaluwarsa</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Filter berkas</span>
              <select
                value={documentFilter}
                onChange={(event) => setDocumentFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400"
              >
                <option value="SEMUA">Semua berkas</option>
                <option value="SUDAH">Sudah upload</option>
                <option value="BELUM">Belum upload</option>
              </select>
            </label>
          </div>
        </div>

        {error ? (
          <div className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            <span>{error}</span>
            <button type="button" onClick={loadApplicants} className="font-bold underline">
              Coba lagi
            </button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-bold">Calon siswa</th>
                <th className="px-4 py-3 font-bold">Kelas / Gelombang</th>
                <th className="px-4 py-3 font-bold">Pembayaran</th>
                <th className="px-4 py-3 font-bold">Berkas diunggah</th>
                <th className="px-4 py-3 font-bold">Progres pendaftaran</th>
                <th className="px-4 py-3 font-bold">Hasil tes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-slate-500">
                    <i className="fas fa-circle-notch mr-2 animate-spin" />
                    Memuat daftar calon siswa...
                  </td>
                </tr>
              ) : null}
              {!loading && !error && filteredApplicants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                      <i className="fas fa-user-slash" />
                    </span>
                    <p className="mt-3 font-bold text-slate-700">Data tidak ditemukan</p>
                    <p className="mt-1 text-slate-500">Coba ubah kata kunci atau filter pencarian.</p>
                  </td>
                </tr>
              ) : null}
              {!loading &&
                filteredApplicants.map((applicant) => {
                  const step = Math.min(Math.max(Number(applicant.currentStep) || 1, 1), 6);
                  const passed = applicant.announcementStatus === "LULUS";
                  const examResult = applicant.announcementLabel || "Menunggu hasil tes";
                  return (
                    <tr key={applicant.id} className="transition hover:bg-sky-50/50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-100 font-extrabold uppercase text-sky-700">
                            {(applicant.studentName || "?").slice(0, 1)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-800">{applicant.studentName}</p>
                            <p className="mt-1 truncate text-[11px] text-slate-500">
                              Wali: {applicant.parentName || applicant.parentUsername || "-"}
                            </p>
                          </div>
                          <span
                            className={`ml-auto rounded-full px-2 py-1 text-[9px] font-bold ${
                              applicant.isAlumni
                                ? "bg-violet-50 text-violet-700"
                                : "bg-cyan-50 text-cyan-700"
                            }`}
                          >
                            {applicant.isAlumni ? "ALUMNI" : "BARU"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-700">{applicant.kelasName || "Belum dipilih"}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{applicant.waveName || "Gelombang -"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-bold ${
                            applicant.billStatus === "PAID"
                              ? "bg-emerald-50 text-emerald-700"
                              : applicant.billStatus === "PENDING"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <i
                            className={`fas ${
                              applicant.billStatus === "PAID" ? "fa-circle-check" : "fa-circle-exclamation"
                            }`}
                          />
                          {paymentLabel(applicant.billStatus)}
                        </span>
                        {applicant.billAmount != null ? (
                          <p className="mt-1 text-[10px] text-slate-500">
                            Rp {new Intl.NumberFormat("id-ID").format(applicant.billAmount)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        {applicant.documents?.length ? (
                          <div className="flex max-w-[260px] flex-wrap gap-1.5">
                            {applicant.documents.map((document) => (
                              <a
                                key={document.id}
                                href={document.path}
                                target="_blank"
                                rel="noreferrer"
                                title={`${document.name}: ${document.originalName || "nama file tidak tersedia"}`}
                                className="inline-flex max-w-full items-start gap-1.5 rounded-lg border border-sky-100 bg-sky-50 px-2 py-1.5 text-left text-[10px] font-semibold text-sky-800 transition hover:border-sky-300 hover:bg-sky-100"
                              >
                                <i className="fas fa-file-lines mt-0.5" />
                                <span className="flex min-w-0 flex-col">
                                  <span className="truncate">{document.name}</span>
                                  <span className="max-w-[170px] truncate font-normal text-slate-500">
                                    {document.originalName || "File"}
                                  </span>
                                </span>
                                <i className="fas fa-arrow-up-right-from-square mt-0.5 text-[8px]" />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1.5 text-[10px] font-semibold text-slate-500">
                            <i className="fas fa-minus" />
                            Belum upload
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-600">
                          <span>{stageNames[step]}</span>
                          <span>{step}/6</span>
                        </div>
                        <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-sky-500 transition-all"
                            style={{ width: `${(step / 6) * 100}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`font-semibold ${passed ? "text-emerald-700" : "text-slate-600"}`}>
                          {examResult}
                        </span>
                        {applicant.examAcademicYear ? (
                          <p className="mt-1 text-[10px] text-slate-400">Tahun ajaran {applicant.examAcademicYear}</p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
          <span>Daftar dibatasi sesuai lembaga akun yang sedang digunakan.</span>
          <span>{filteredApplicants.length} siswa</span>
        </footer>
      </section>
    </div>
  );
}
