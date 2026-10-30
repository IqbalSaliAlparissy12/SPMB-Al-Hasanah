import { useId, useState } from "react";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export default function FilePickButton({
  accept,
  disabled,
  onFile,
  icon = "fa-cloud-upload-alt",
  label = "Pilih file",
  fileName,
  variant = "sky",
}) {
  const id = useId();
  const [error, setError] = useState("");
  const colors =
    variant === "emerald"
      ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
      : "bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-200";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && file.size > MAX_FILE_BYTES) {
            setError("Maksimal 2 MB per dokumen.");
          } else {
            setError("");
            if (file) onFile(file);
          }
          e.target.value = "";
        }}
      />
      <label
        htmlFor={id}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-bold cursor-pointer select-none ${colors} ${
          disabled ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <i className={`fas ${icon}`} />
        {label}
      </label>
      {fileName ? <span className="text-emerald-700 font-semibold">{fileName}</span> : null}
      {error ? <span className="text-red-600 font-semibold">{error}</span> : null}
    </div>
  );
}
