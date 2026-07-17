import { ReactNode } from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
      {title && <h3 className="text-sm font-medium text-slate-500 mb-2">{title}</h3>}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" | "success" | "warning" }) {
  const toneClass =
    tone === "danger" ? "text-red-600" : tone === "success" ? "text-pachos-green" : tone === "warning" ? "text-amber-600" : "text-slate-900";
  return (
    <Card>
      <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
    </Card>
  );
}

export function money(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Formatea un campo de solo-fecha (@db.Date, ej. dueDate, issueDate,
 * snapshotDate) sin convertir zona horaria. Esos campos llegan del backend
 * como medianoche UTC ("2026-07-14T00:00:00.000Z"); usar `new Date(...).
 * toLocaleDateString()` directamente los corre un día atrás en cualquier
 * zona horaria detrás de UTC (ej. Miami). Aquí se leen los componentes en
 * UTC y se reconstruyen como medianoche local, para que se muestren tal
 * cual se guardaron.
 */
export function formatDateOnly(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return local.toLocaleDateString();
}

/** Fecha de hoy en la zona horaria del navegador, como "YYYY-MM-DD" (para precargar <input type="date">). */
export function todayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "warning" | "danger" | "success" }) {
  const toneClass = {
    default: "bg-slate-100 text-slate-700",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-700",
    success: "bg-emerald-100 text-emerald-700",
  }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}>{children}</span>;
}
