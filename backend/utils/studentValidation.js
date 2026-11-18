const field = (key, label, options = {}) => ({ key, label, ...options });
const required = { required: true };
const nik = { required: true, pattern: "^\\d{16}$", maxLength: 16, inputMode: "numeric" };
const phone = { required: true, pattern: "^\\d{8,13}$", maxLength: 13, inputMode: "numeric" };

export const studentValidationSections = [
  {
    title: "Calon Siswa",
    fields: [
      field("nisn", "Nomor Induk Siswa Nasional (NISN)", { pattern: "^\\d{10}$", maxLength: 10, inputMode: "numeric" }),
      field("npsn", "Nomor Pokok Sekolah Nasional (NPSN)"),
      field("nss", "Nomor Statistik Sekolah / Madrasah"),
      field("diplomaNumber", "Nomor Ijazah"),
      field("studentName", "Nama Lengkap", required),
      field("nik", "NIK Siswa", nik),
      field("gender", "Jenis Kelamin", { ...required, options: ["Laki-Laki", "Perempuan"] }),
      field("birthPlace", "Tempat Lahir", required),
      field("birthDate", "Tanggal Lahir", { ...required, type: "date" }),
      field("childOrder", "Anak ke", { ...required, type: "number", min: 1 }),
      field("siblingsCount", "Dari jumlah anak", { ...required, type: "number", min: 1 }),
      field("studentPhone", "Telepon", phone),
      field("illness", "Penyakit yang pernah diderita"),
      field("weight", "Berat Badan (kg)", { ...required, type: "number", min: 1 }),
      field("height", "Tinggi Badan (cm)", { ...required, type: "number", min: 1 }),
      field("bloodType", "Golongan Darah"),
      field("hobby", "Hobi"),
      field("clothingSize", "Ukuran Baju", required),
      field("email", "E-mail", { type: "email" }),
      field("schoolSiblings", "Saudara kandung yang masih aktif di Al-Hasanah", { type: "textarea" }),
      field("schoolInfoSource", "Informasi Sekolah Didapatkan Dari", required),
      field("registrationInfoSource", "Informasi Pendaftaran Siswa Baru Dari", required),
      field("previousSchool", "Nama Sekolah Asal", required),
    ],
  },
  {
    title: "Data Ayah",
    fields: [
      field("familyCardNumber", "Nomor Kartu Keluarga", nik),
      field("fatherName", "Nama Ayah", required),
      field("fatherNik", "NIK Ayah", nik),
      field("fatherRelationship", "Status Ayah", required),
      field("fatherBirthPlace", "Tempat Lahir Ayah", required),
      field("fatherBirthDate", "Tanggal Lahir Ayah", { ...required, type: "date" }),
      field("fatherDegree", "Gelar Akademik Ayah"),
      field("fatherLifeStatus", "Status Ayah (hidup / meninggal)", required),
      field("fatherEducation", "Pendidikan Terakhir Ayah", required),
      field("fatherJob", "Pekerjaan Ayah", required),
      field("fatherIncome", "Penghasilan Bulanan Ayah", required),
      field("fatherWhatsapp", "Telepon WhatsApp Ayah", phone),
      field("fatherPhone", "Telepon Ayah", phone),
      field("fatherAddress", "Alamat Ayah", { ...required, type: "textarea" }),
    ],
  },
  {
    title: "Data Ibu",
    fields: [
      field("motherName", "Nama Ibu", required),
      field("motherNik", "NIK Ibu", nik),
      field("motherRelationship", "Status Ibu", required),
      field("motherBirthPlace", "Tempat Lahir Ibu", required),
      field("motherBirthDate", "Tanggal Lahir Ibu", { ...required, type: "date" }),
      field("motherDegree", "Gelar Akademik Ibu"),
      field("motherLifeStatus", "Status Ibu (hidup / meninggal)", required),
      field("motherEducation", "Pendidikan Terakhir Ibu", required),
      field("motherJob", "Pekerjaan Ibu", required),
      field("motherIncome", "Penghasilan Bulanan Ibu", required),
      field("motherWhatsapp", "Telepon WhatsApp Ibu", phone),
      field("motherPhone", "Telepon Ibu", phone),
      field("motherAddress", "Alamat Ibu", { ...required, type: "textarea" }),
    ],
  },
  {
    title: "Penanggung Biaya",
    fields: [
      field("payerType", "Yang Menanggung Biaya", required),
      field("payerName", "Nama Penanggung Biaya", required),
      field("payerRelationship", "Hubungan Keluarga", required),
      field("payerPhone", "Telepon Penanggung Biaya", phone),
      field("payerJob", "Pekerjaan Penanggung Biaya", required),
      field("payerAddress", "Alamat Penanggung Biaya", { ...required, type: "textarea" }),
    ],
  },
  {
    title: "Alamat Sesuai Domisili",
    fields: [
      field("address", "Alamat", { ...required, type: "textarea" }),
      field("rt", "RT", required),
      field("rw", "RW", required),
      field("province", "Provinsi", required),
      field("city", "Kota / Kabupaten", required),
      field("district", "Kecamatan", required),
      field("village", "Desa / Kelurahan", required),
    ],
  },
];

const fields = studentValidationSections.flatMap((section) => section.fields);

export function sanitizeStudentValidation(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Data siswa tidak valid.");
  const result = {};
  for (const item of fields) {
    const value = input[item.key];
    if (value !== undefined && value !== null && typeof value !== "string") {
      throw new Error(`${item.label} tidak valid.`);
    }
    const text = (value || "").trim();
    if (text.length > (item.maxLength || 2000)) throw new Error(`${item.label} terlalu panjang.`);
    result[item.key] = text;
  }
  return result;
}

export function studentValidationErrors(values) {
  const errors = [];
  for (const item of fields) {
    const value = values[item.key] || "";
    if (item.required && !value) errors.push(`${item.label} wajib diisi`);
    else if (value && item.pattern && !new RegExp(item.pattern).test(value)) errors.push(`${item.label} tidak valid`);
    else if (value && item.options && !item.options.includes(value)) errors.push(`${item.label} tidak valid`);
    else if (value && item.type === "number" && (!Number.isFinite(Number(value)) || Number(value) < item.min)) errors.push(`${item.label} tidak valid`);
    else if (value && item.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)) errors.push(`${item.label} tidak valid`);
    else if (value && item.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push(`${item.label} tidak valid`);
  }
  return errors;
}
