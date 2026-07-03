import { ReactNode } from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
      {title && <h3 className="text-sm font-medium text-slate-500 mb-2">{title}</h3>}
      {children}
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

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "warning" | "danger" | "success" }) {
  const toneClass = {
    default: "bg-slate-100 text-slate-700",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-700",
    success: "bg-emerald-100 text-emerald-700",
  }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}>{children}</span>;
}
