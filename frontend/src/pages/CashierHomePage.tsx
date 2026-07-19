import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const OPTIONS = [
  {
    to: "/registrar-venta",
    icon: "💰",
    title: "Registrar Venta",
    description: "Agrega lo vendido hoy en tarjeta o en efectivo.",
  },
  {
    to: "/registrar-factura",
    icon: "🧾",
    title: "Registrar Factura",
    description: "Agrega una factura nueva de un proveedor.",
  },
  {
    to: "/comprobantes",
    icon: "📷",
    title: "Comprobantes",
    description: "Sube la foto de una factura o recibo.",
  },
];

export function CashierHomePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Hola{user?.fullName ? `, ${user.fullName}` : ""}</h2>
        <p className="text-sm text-slate-500">¿Qué quieres hacer?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {OPTIONS.map((opt) => (
          <Link
            key={opt.to}
            to={opt.to}
            className="flex flex-col items-center text-center gap-2 bg-white border border-slate-200 rounded-lg shadow-sm p-8 hover:border-pachos-green hover:shadow-md transition"
          >
            <span className="text-5xl">{opt.icon}</span>
            <span className="text-lg font-semibold text-slate-900">{opt.title}</span>
            <span className="text-sm text-slate-500">{opt.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
