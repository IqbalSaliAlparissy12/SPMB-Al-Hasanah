import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/client";

const TABS = [
  { id: "items", label: "Item Biaya" },
  { id: "groups", label: "Grup Biaya" },
  { id: "packages", label: "Paket Pembayaran" },
  { id: "annual", label: "Setup Tahunan" },
];

function academicYearOptions() {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return [-1, 0, 1, 2, 3].map((offset) => {
    const year = start + offset;
    return `${year}-${year + 1}`;
  });
}

function formatRp(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

function inputClass() {
  return "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm";
}

function FeeSetupView({ showToast }) {
  const years = useMemo(() => academicYearOptions(), []);
  const [tab, setTab] = useState("items");
  const [academicYear, setAcademicYear] = useState(years[1]);
  const [data, setData] = useState({ items: [], groups: [], packages: [], classes: [], setup: null });
  const [amounts, setAmounts] = useState({});
  const [itemForm, setItemForm] = useState({ id: null, name: "", accountNumber: "" });
  const [groupForm, setGroupForm] = useState({ id: null, name: "", accountNumber: "", itemIds: [] });
  const [packageForm, setPackageForm] = useState({ id: null, name: "", kelasId: "", studentType: "UMUM" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (year = academicYear) => {
    try {
      const { data: response } = await api.get("/tu/fee-setup", { params: { academicYear: year } });
      setData(response);
      setAmounts(Object.fromEntries((response.setup?.amounts || []).map((row) => [row.id, String(row.amount)])));
    } catch (error) {
      setData({ items: [], groups: [], packages: [], classes: [], setup: null });
      setAmounts({});
      showToast?.("Gagal", error.response?.data?.message || "Tidak dapat memuat pengaturan biaya.");
    } finally {
      setLoading(false);
    }
  }, [academicYear, showToast]);

  useEffect(() => {
    let active = true;
    api.get("/tu/fee-setup", { params: { academicYear } })
      .then(({ data: response }) => {
        if (!active) return;
        setData(response);
        setAmounts(Object.fromEntries((response.setup?.amounts || []).map((row) => [row.id, String(row.amount)])));
      })
      .catch((error) => {
        if (!active) return;
        setData({ items: [], groups: [], packages: [], classes: [], setup: null });
        setAmounts({});
        showToast?.("Gagal", error.response?.data?.message || "Tidak dapat memuat pengaturan biaya.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [academicYear, showToast]);

  const run = async (action, successTitle = "Tersimpan") => {
    setBusy(true);
    setLoading(true);
    try {
      const { data: response } = await action();
      showToast?.(successTitle, response.message);
      await load();
      return true;
    } catch (error) {
      showToast?.("Gagal", error.response?.data?.message || "Perubahan tidak dapat disimpan.");
      return false;
    } finally {
      setLoading(false);
      setBusy(false);
    }
  };

  const submitItem = (event) => {
    event.preventDefault();
    const payload = { name: itemForm.name, accountNumber: itemForm.accountNumber };
    run(
      () => itemForm.id
        ? api.patch(`/tu/fee-items/${itemForm.id}`, payload)
        : api.post("/tu/fee-items", payload)
    ).then((saved) => {
      if (saved) setItemForm({ id: null, name: "", accountNumber: "" });
    });
  };

  const deleteItem = (item) => {
    if (!window.confirm(`Hapus item biaya "${item.name}"?`)) return;
    run(() => api.delete(`/tu/fee-items/${item.id}`), "Dihapus");
  };

  const toggleGroupItem = (itemId) => {
    setGroupForm((current) => ({
      ...current,
      itemIds: current.itemIds.includes(itemId)
        ? current.itemIds.filter((id) => id !== itemId)
        : [...current.itemIds, itemId],
    }));
  };

  const submitGroup = (event) => {
    event.preventDefault();
    const payload = {
      name: groupForm.name,
      accountNumber: groupForm.accountNumber,
      itemIds: groupForm.itemIds,
    };
    run(
      () => groupForm.id
        ? api.patch(`/tu/fee-groups/${groupForm.id}`, payload)
        : api.post("/tu/fee-groups", payload)
    ).then((saved) => {
      if (saved) setGroupForm({ id: null, name: "", accountNumber: "", itemIds: [] });
    });
  };

  const deleteGroup = (group) => {
    if (!window.confirm(`Hapus grup biaya "${group.name}"?`)) return;
    run(() => api.delete(`/tu/fee-groups/${group.id}`), "Dihapus");
  };

  const submitPackage = (event) => {
    event.preventDefault();
    const payload = {
      name: packageForm.name,
      kelasId: Number(packageForm.kelasId),
      studentType: packageForm.studentType,
    };
    run(
      () => packageForm.id
        ? api.patch(`/tu/fee-packages/${packageForm.id}`, payload)
        : api.post("/tu/fee-packages", payload)
    ).then((saved) => {
      if (saved) setPackageForm({ id: null, name: "", kelasId: "", studentType: "UMUM" });
    });
  };

  const deletePackage = (item) => {
    if (!window.confirm(`Hapus paket pembayaran "${item.name}"?`)) return;
    run(() => api.delete(`/tu/fee-packages/${item.id}`), "Dihapus");
  };

  const generate = () => run(
    () => api.post("/tu/annual-fees/generate", { academicYear }),
    "Setup tahunan"
  );

  const saveAnnualAmounts = () => {
    if (!data.setup) return;
    const payload = data.setup.amounts.map((row) => ({ id: row.id, amount: amounts[row.id] }));
    run(() => api.put(`/tu/annual-fees/${data.setup.id}`, { amounts: payload }));
  };

  const amountByPair = new Map(
    (data.setup?.amounts || []).map((row) => [`${row.packageId}:${row.groupId}`, row])
  );

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Generate biaya</h2>
        <p className="mt-1 text-xs text-slate-500">
          Kelola item, grup, paket pembayaran, dan nominal konfigurasi biaya tahunan. Setup ini belum membuat tagihan siswa.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-4 py-2 text-xs font-bold border-b-2 ${
              tab === item.id ? "border-sky-600 text-sky-700" : "border-transparent text-slate-500"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "items" ? (
        <section className="space-y-4">
          <form onSubmit={submitItem} className="grid md:grid-cols-[1fr_1fr_auto_auto] gap-2 bg-white p-4 border rounded-xl">
            <input
              required
              className={inputClass()}
              placeholder="Nama item biaya"
              value={itemForm.name}
              onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })}
            />
            <input
              className={inputClass()}
              placeholder="Nomor akun (opsional)"
              value={itemForm.accountNumber}
              onChange={(event) => setItemForm({ ...itemForm, accountNumber: event.target.value })}
            />
            <button disabled={busy} className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold">
              {itemForm.id ? "Simpan" : "Tambah item"}
            </button>
            {itemForm.id ? (
              <button type="button" className="px-4 py-2 border rounded-lg text-xs font-bold" onClick={() => setItemForm({ id: null, name: "", accountNumber: "" })}>
                Batal
              </button>
            ) : null}
          </form>
          <div className="overflow-x-auto bg-white border rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600">
                <tr><th className="p-3">Item biaya</th><th className="p-3">Nomor akun</th><th className="p-3 text-right">Aksi</th></tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3 font-semibold">{item.name}</td>
                    <td className="p-3">{item.accountNumber || "-"}</td>
                    <td className="p-3 text-right space-x-3">
                      <button type="button" className="text-sky-700 font-bold" onClick={() => setItemForm({ id: item.id, name: item.name, accountNumber: item.accountNumber || "" })}>Ubah</button>
                      <button type="button" className="text-red-600 font-bold" onClick={() => deleteItem(item)}>Hapus</button>
                    </td>
                  </tr>
                ))}
                {!loading && !data.items.length ? <tr><td colSpan={3} className="p-5 text-center text-slate-500">Belum ada item biaya.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "groups" ? (
        <section className="grid lg:grid-cols-[minmax(260px,1fr)_2fr] gap-4 items-start">
          <form onSubmit={submitGroup} className="bg-white p-4 border rounded-xl space-y-3">
            <h3 className="font-bold text-sm">{groupForm.id ? "Ubah grup biaya" : "Tambah grup biaya"}</h3>
            <input required className={inputClass()} placeholder="Nama grup biaya" value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} />
            <p className="text-[11px] text-slate-500">Untuk biaya formulir, namai grup “Biaya Pendaftaran” atau “Bayar Uang Pendaftaran”.</p>
            <input className={inputClass()} placeholder="Nomor akun (opsional)" value={groupForm.accountNumber} onChange={(event) => setGroupForm({ ...groupForm, accountNumber: event.target.value })} />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600">Item biaya dalam grup</p>
              {!data.items.length ? <p className="text-xs text-amber-700">Tambahkan item biaya terlebih dahulu.</p> : null}
              {data.items.map((item) => (
                <label key={item.id} className="flex gap-2 items-center text-xs">
                  <input type="checkbox" checked={groupForm.itemIds.includes(item.id)} onChange={() => toggleGroupItem(item.id)} />
                  {item.name}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button disabled={busy || !data.items.length} className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold">{groupForm.id ? "Simpan" : "Tambah grup"}</button>
              {groupForm.id ? <button type="button" className="px-4 py-2 border rounded-lg text-xs font-bold" onClick={() => setGroupForm({ id: null, name: "", accountNumber: "", itemIds: [] })}>Batal</button> : null}
            </div>
          </form>
          <div className="overflow-x-auto bg-white border rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Grup biaya</th><th className="p-3">Item</th><th className="p-3">Nomor akun</th><th className="p-3 text-right">Aksi</th></tr></thead>
              <tbody>
                {data.groups.map((group) => (
                  <tr key={group.id} className="border-t">
                    <td className="p-3 font-semibold">{group.name}</td>
                    <td className="p-3">{group.itemIds.map((id) => data.items.find((item) => item.id === id)?.name).filter(Boolean).join(", ")}</td>
                    <td className="p-3">{group.accountNumber || "-"}</td>
                    <td className="p-3 text-right whitespace-nowrap space-x-3">
                      <button type="button" className="text-sky-700 font-bold" onClick={() => setGroupForm({ id: group.id, name: group.name, accountNumber: group.accountNumber || "", itemIds: group.itemIds })}>Ubah</button>
                      <button type="button" className="text-red-600 font-bold" onClick={() => deleteGroup(group)}>Hapus</button>
                    </td>
                  </tr>
                ))}
                {!loading && !data.groups.length ? <tr><td colSpan={4} className="p-5 text-center text-slate-500">Belum ada grup biaya.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "packages" ? (
        <section className="space-y-4">
          <form onSubmit={submitPackage} className="grid md:grid-cols-[1.2fr_1fr_1fr_auto_auto] gap-2 bg-white p-4 border rounded-xl">
            <input required className={`${inputClass()} md:max-w-md`} placeholder="Nama paket pembayaran" value={packageForm.name} onChange={(event) => setPackageForm({ ...packageForm, name: event.target.value })} />
            <select required className={inputClass()} value={packageForm.kelasId} onChange={(event) => setPackageForm({ ...packageForm, kelasId: event.target.value })}>
              <option value="">Pilih kelas</option>
              {data.classes.map((kelas) => <option key={kelas.id} value={kelas.id}>{kelas.name}</option>)}
            </select>
            <select required className={inputClass()} value={packageForm.studentType} onChange={(event) => setPackageForm({ ...packageForm, studentType: event.target.value })}>
              <option value="UMUM">Umum / Siswa baru</option>
              <option value="ALUMNI">Alumni</option>
            </select>
            <button disabled={busy} className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold">{packageForm.id ? "Simpan" : "Tambah paket"}</button>
            {packageForm.id ? <button type="button" className="px-4 py-2 border rounded-lg text-xs font-bold" onClick={() => setPackageForm({ id: null, name: "", kelasId: "", studentType: "UMUM" })}>Batal</button> : null}
          </form>
          <div className="bg-white border rounded-xl overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Paket pembayaran</th><th className="p-3">Kelas</th><th className="p-3">Jenis siswa</th><th className="p-3 text-right">Aksi</th></tr></thead>
              <tbody>
                {data.packages.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3 font-semibold">{item.name}</td>
                    <td className="p-3">{data.classes.find((kelas) => kelas.id === item.kelasId)?.name || "Belum dipetakan"}</td>
                    <td className="p-3">{item.studentType === "ALUMNI" ? "Alumni" : item.studentType === "UMUM" ? "Umum / Siswa baru" : "Belum dipetakan"}</td>
                    <td className="p-3 text-right space-x-3">
                      <button type="button" className="text-sky-700 font-bold" onClick={() => setPackageForm({ id: item.id, name: item.name, kelasId: item.kelasId ? String(item.kelasId) : "", studentType: item.studentType || "UMUM" })}>Ubah</button>
                      <button type="button" className="text-red-600 font-bold" onClick={() => deletePackage(item)}>Hapus</button>
                    </td>
                  </tr>
                ))}
                {!loading && !data.packages.length ? <tr><td colSpan={4} className="p-5 text-center text-slate-500">Belum ada paket pembayaran.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "annual" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 bg-white p-4 border rounded-xl">
            <label className="space-y-1 text-xs font-semibold text-slate-600">
              <span>Tahun ajaran</span>
              <select className={inputClass()} value={academicYear} onChange={(event) => {
                setLoading(true);
                setAcademicYear(event.target.value);
              }}>
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <button type="button" disabled={busy || loading || !data.groups.length || !data.packages.length} onClick={generate} className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold disabled:opacity-50">
              {data.setup ? "Generate / Perbarui Struktur" : "Generate Setup Tahunan"}
            </button>
            {data.setup ? <button type="button" disabled={busy} onClick={saveAnnualAmounts} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold">Simpan Nominal</button> : null}
          </div>
          <p className="text-xs text-slate-500">
            Generate membuat baris nominal untuk setiap kombinasi paket dan grup. Nominal awal Rp0; generate ulang tidak mengubah nominal yang sudah diisi.
          </p>
          {!data.groups.length || !data.packages.length ? (
            <p className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">Tambahkan grup biaya dan paket pembayaran sebelum membuat setup tahunan.</p>
          ) : null}
          {data.setup ? (
            <div className="overflow-x-auto bg-white border rounded-xl">
              <table className="w-full text-xs text-right">
                <thead className="bg-sky-700 text-white">
                  <tr>
                    <th className="p-3 text-left">Paket pembayaran</th>
                    {data.groups.map((group) => <th key={group.id} className="p-3 min-w-36">{group.name}</th>)}
                    <th className="p-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.packages.map((paymentPackage) => {
                    const rowAmounts = data.groups.map((group) => amountByPair.get(`${paymentPackage.id}:${group.id}`));
                    const total = rowAmounts.reduce((sum, row) => sum + (Number(amounts[row?.id]) || 0), 0);
                    return (
                      <tr key={paymentPackage.id} className="border-t">
                        <th className="p-3 text-left font-semibold">{paymentPackage.name}</th>
                        {rowAmounts.map((row, index) => (
                          <td key={data.groups[index].id} className="p-2">
                            {row ? (
                              <input
                                type="number"
                                required
                                min="0"
                                step="1"
                                inputMode="numeric"
                                className="w-32 px-2 py-1.5 border rounded text-right"
                                value={amounts[row.id] ?? ""}
                                onChange={(event) => setAmounts((current) => ({ ...current, [row.id]: event.target.value }))}
                                aria-label={`${paymentPackage.name} - ${data.groups[index].name}`}
                              />
                            ) : <span className="text-slate-400">Belum digenerate</span>}
                          </td>
                        ))}
                        <td className="p-3 font-bold">{formatRp(total)}</td>
                      </tr>
                    );
                  })}
                  {!data.packages.length || !data.groups.length ? <tr><td colSpan={data.groups.length + 2} className="p-5 text-center text-slate-500">Belum ada grup atau paket untuk tahun ini.</td></tr> : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export default FeeSetupView;
