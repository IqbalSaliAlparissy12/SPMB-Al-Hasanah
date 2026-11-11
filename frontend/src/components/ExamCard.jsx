function academicYear() {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  return `${start}-${start + 1}`;
}

function jenjangLabel(schoolTarget) {
  if (!schoolTarget) return "-";
  const short = String(schoolTarget)
    .replace(/\s*Al-Hasanah/i, "")
    .trim();
  return short || schoolTarget;
}

export default function ExamCard({ applicant }) {
  const year = academicYear();
  const photo = applicant?.photoPath;

  return (
    <article id="exam-card" className="exam-card relative mx-auto overflow-hidden bg-white text-slate-900">
      <div className="exam-deco exam-deco-tl" />
      <div className="exam-deco exam-deco-br" />

      <div className="relative z-10 px-6 pt-5 pb-4 flex flex-col items-center">
        <img src="/logo-alhasanah.png" alt="Al-Hasanah" className="h-12 object-contain" />
        <h2 className="mt-2 text-center font-extrabold text-[15px] leading-tight tracking-wide uppercase">
          Kartu Seleksi
          <br />
          Siswa Baru {year}
        </h2>

        <div className="exam-photo-slot mt-4 bg-white overflow-hidden">
          {photo ? (
            <img src={photo} alt="Foto calon siswa" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[11px] text-slate-400 text-center px-2">
              Foto 3x4
            </div>
          )}
        </div>

        <table className="mt-4 w-full text-[11px] border border-slate-800 border-collapse">
          <tbody>
            <Row label="Nama" value={applicant?.studentName} />
            <Row label="ID Registrasi" value={applicant?.examNumber} />
            <Row label="Jenjang Pendidikan" value={jenjangLabel(applicant?.schoolTarget)} />
            <Row label="Gelombang" value={applicant?.waveName} />
            <Row label="Tanggal Ujian" value={applicant?.examDate || "(Belum di Input)"} />
            <Row label="Lokasi Ujian" value={applicant?.examLocation || ""} last />
          </tbody>
        </table>

        <div className="mt-3 text-center text-[10px] leading-5">
          <p>
            <i className="fas fa-globe mr-1" />
            alhasanah.or.id
          </p>
          <p>
            <i className="fab fa-instagram mr-1" />
            alhasanahbengkulu_
            <i className="fab fa-facebook ml-2 mr-1" />
            alhasanahbengkulu
          </p>
        </div>
      </div>
    </article>
  );
}

function Row({ label, value, last }) {
  return (
    <tr>
      <td className={`w-[42%] px-2 py-1 border-slate-800 ${last ? "" : "border-b"}`}>{label}</td>
      <td className={`px-2 py-1 border-l border-slate-800 font-semibold ${last ? "" : "border-b"}`}>
        <span className="mr-1">:</span>
        {value || "\u00a0"}
      </td>
    </tr>
  );
}
