import { useEffect, useRef } from "react";

const SIZES = ["12px", "14px", "16px", "18px", "20px", "24px"];

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function plainToEditorHtml(value) {
  const raw = String(value || "");
  if (!raw.trim()) return "";
  if (/<\/?[a-z][\s\S]*>/i.test(raw)) return sanitizeRichHtml(raw);
  return raw
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function isRichEmpty(html) {
  const text = String(html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return !text;
}

export function sanitizeRichHtml(html) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  const allowed = new Set([
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "strike",
    "ul",
    "ol",
    "li",
    "h2",
    "h3",
    "blockquote",
    "div",
    "span",
    "font",
  ]);

  const cleanStyle = (style) => {
    const parts = [];
    const align = String(style || "").match(/text-align\s*:\s*(left|center|right|justify)/i);
    const size = String(style || "").match(/font-size\s*:\s*(12|14|16|18|20|24)px/i);
    if (align) parts.push(`text-align:${align[1].toLowerCase()}`);
    if (size) parts.push(`font-size:${size[1]}px`);
    return parts.join(";");
  };

  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) return;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        return;
      }
      const tag = child.tagName.toLowerCase();
      if (tag === "script" || tag === "style") {
        child.remove();
        return;
      }
      if (!allowed.has(tag)) {
        const parent = child.parentNode;
        while (child.firstChild) parent.insertBefore(child.firstChild, child);
        child.remove();
        walk(parent);
        return;
      }
      const style = cleanStyle(child.getAttribute("style"));
      [...child.attributes].forEach((attr) => child.removeAttribute(attr.name));
      if (style) child.setAttribute("style", style);
      walk(child);
    });
  };

  walk(doc.body);
  return doc.body.innerHTML;
}

function ToolButton({ title, icon, onClick, active }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`w-8 h-8 rounded-md text-slate-600 hover:bg-slate-100 ${active ? "bg-sky-100 text-sky-800" : ""}`}
    >
      <i className={`fas ${icon} text-[12px]`} />
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder }) {
  const ref = useRef(null);
  const skipSync = useRef(null);
  const savedRange = useRef(null);

  const rememberSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) return;
    const range = sel.getRangeAt(0);
    if (ref.current.contains(range.commonAncestorContainer)) {
      savedRange.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const range = savedRange.current;
    if (!range) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el || skipSync.current === value) return;
    skipSync.current = value;
    el.innerHTML = plainToEditorHtml(value);
  }, [value]);

  const emit = () => {
    const html = sanitizeRichHtml(ref.current?.innerHTML || "");
    const next = isRichEmpty(html) ? "" : html;
    skipSync.current = next;
    onChange(next);
  };

  const run = (command, arg = null) => {
    ref.current?.focus();
    restoreSelection();
    document.execCommand(command, false, arg);
    if (command === "formatBlock" && arg && !document.queryCommandValue("formatBlock")) {
      document.execCommand("formatBlock", false, `<${arg}>`);
    }
    rememberSelection();
    emit();
  };

  const setSize = (px) => {
    if (!px) return;
    ref.current?.focus();
    restoreSelection();
    document.execCommand("fontSize", false, "7");
    ref.current?.querySelectorAll('font[size="7"]').forEach((node) => {
      node.removeAttribute("size");
      node.style.fontSize = px;
    });
    rememberSelection();
    emit();
  };

  return (
    <div className="border border-slate-300 rounded-xl overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-slate-50">
        <ToolButton title="Urungkan" icon="fa-rotate-left" onClick={() => run("undo")} />
        <ToolButton title="Ulangi" icon="fa-rotate-right" onClick={() => run("redo")} />
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <select
          title="Gaya teks"
          className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs text-slate-700"
          defaultValue="p"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            run("formatBlock", e.target.value);
            e.target.value = "p";
          }}
        >
          <option value="p">Paragraf</option>
          <option value="h2">Judul</option>
          <option value="h3">Subjudul</option>
        </select>
        <select
          title="Ukuran huruf"
          className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs text-slate-700"
          defaultValue=""
          onChange={(e) => {
            setSize(e.target.value);
            e.target.value = "";
          }}
        >
          <option value="">Ukuran</option>
          {SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <ToolButton title="Tebal" icon="fa-bold" onClick={() => run("bold")} />
        <ToolButton title="Miring" icon="fa-italic" onClick={() => run("italic")} />
        <ToolButton title="Garis bawah" icon="fa-underline" onClick={() => run("underline")} />
        <ToolButton title="Coret" icon="fa-strikethrough" onClick={() => run("strikeThrough")} />
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <ToolButton title="Rata kiri" icon="fa-align-left" onClick={() => run("justifyLeft")} />
        <ToolButton title="Rata tengah" icon="fa-align-center" onClick={() => run("justifyCenter")} />
        <ToolButton title="Rata kanan" icon="fa-align-right" onClick={() => run("justifyRight")} />
        <ToolButton title="Rata kiri-kanan" icon="fa-align-justify" onClick={() => run("justifyFull")} />
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <ToolButton title="Daftar berpoin" icon="fa-list-ul" onClick={() => run("insertUnorderedList")} />
        <ToolButton title="Daftar bernomor" icon="fa-list-ol" onClick={() => run("insertOrderedList")} />
        <ToolButton title="Hapus format" icon="fa-eraser" onClick={() => run("removeFormat")} />
      </div>
      <div className="relative">
        {isRichEmpty(value) ? (
          <p className="pointer-events-none absolute left-3 top-2 text-xs text-slate-400">{placeholder}</p>
        ) : null}
        <div
          ref={ref}
          contentEditable
          role="textbox"
          aria-multiline="true"
          className="rich-editor min-h-64 max-h-[28rem] overflow-auto px-3 py-2 text-sm text-slate-800 outline-none"
          onInput={emit}
          onMouseUp={rememberSelection}
          onKeyUp={rememberSelection}
          onBlur={() => {
            rememberSelection();
            emit();
          }}
        />
      </div>
    </div>
  );
}
