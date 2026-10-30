import { useEffect } from "react";

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(onClose, 2800);
    return () => clearTimeout(id);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="fixed top-5 right-5 z-50 max-w-sm w-full bg-white border-l-4 border-emerald-500 rounded-r-xl shadow-xl p-4 flex items-start space-x-3">
      <div className="text-emerald-500 text-xl">
        <i className="fas fa-check-circle" />
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-slate-800 text-sm">{toast.title}</h4>
        <p className="text-xs text-slate-600 mt-0.5">{toast.msg}</p>
      </div>
    </div>
  );
}
