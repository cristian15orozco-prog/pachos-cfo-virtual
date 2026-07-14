import { useRef } from "react";

interface Props {
  pages: File[];
  onChange: (pages: File[]) => void;
  disabled?: boolean;
}

/** Deja tomar/subir varias fotos en secuencia (una por página) antes de guardar. */
export function InvoicePhotoPicker({ pages, onChange, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onChange([...pages, file]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePage(index: number) {
    onChange(pages.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label
        className={`inline-block bg-pachos-green text-white text-sm rounded-md px-4 py-2 ${disabled ? "opacity-50" : "cursor-pointer"}`}
      >
        {pages.length > 0 ? `📷 Agregar otra página (${pages.length})` : "📷 Tomar / Subir Foto"}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          disabled={disabled}
          onChange={handleFileChange}
        />
      </label>

      {pages.length > 0 && (
        <ul className="text-xs text-slate-500 mt-2 space-y-1">
          {pages.map((f, i) => (
            <li key={i} className="flex items-center justify-between bg-slate-50 rounded px-2 py-1">
              <span>
                Página {i + 1}: {f.name}
              </span>
              <button
                type="button"
                onClick={() => removePage(i)}
                disabled={disabled}
                className="text-red-600 disabled:opacity-50"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
