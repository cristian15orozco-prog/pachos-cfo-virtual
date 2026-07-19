import { ReactNode, ComponentType } from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
      {title && <h3 className="text-sm font-medium text-slate-500 mb-2">{title}</h3>}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

interface IconProps {
  size?: number | string;
  strokeWidth?: number | string;
}

export function Metric({
  label,
  value,
  tone = "default",
  size = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "success" | "warning";
  size?: "default" | "lg";
  icon?: ComponentType<IconProps>;
}) {
  const toneClass =
    tone === "danger" ? "text-status-danger" : tone === "success" ? "text-status-success" : tone === "warning" ? "text-status-warning" : "text-slate-900";
  const chipClass =
    tone === "danger"
      ? "bg-status-dangerSoft text-status-danger"
      : tone === "success"
        ? "bg-status-successSoft text-status-success"
        : tone === "warning"
          ? "bg-status-warningSoft text-status-warning"
          : "bg-brand-grayLight text-slate-500";
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{label}</p>
          <p className={`font-bold ${size === "lg" ? "text-4xl" : "text-2xl"} ${toneClass}`}>{value}</p>
        </div>
        {Icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${chipClass}`}>
            <Icon size={18} strokeWidth={2} />
          </span>
        )}
      </div>
    </Card>
  );
}

export function PageHeading({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: ComponentType<IconProps>;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-greenDark text-white">
          <Icon size={20} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-slate-900 truncate">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
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

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "warning" | "danger" | "success" | "info" }) {
  const toneClass = {
    default: "bg-slate-100 text-slate-700",
    warning: "bg-status-warningSoft text-status-warning",
    danger: "bg-status-dangerSoft text-status-danger",
    success: "bg-status-successSoft text-status-success",
    info: "bg-status-infoSoft text-status-info",
  }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}>{children}</span>;
}
