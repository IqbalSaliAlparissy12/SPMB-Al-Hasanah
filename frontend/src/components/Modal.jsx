export default function Modal({ open, title, icon, onClose, children, maxWidth = "max-w-lg" }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-2xl ${maxWidth} w-full overflow-hidden`}>
        <div className="bg-sky-700 text-white p-5 flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <i className={`fas ${icon}`} /> {title}
          </h3>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white">
            <i className="fas fa-times" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
