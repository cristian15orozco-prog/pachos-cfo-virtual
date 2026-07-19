import { Link } from "react-router-dom";
import { ShoppingCart, FilePlus, Camera } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const OPTIONS = [
  {
    to: "/registrar-venta",
    icon: ShoppingCart,
    title: "Registrar Venta",
    description: "Agrega lo vendido hoy en tarjeta o en efectivo.",
  },
  {
    to: "/registrar-factura",
    icon: FilePlus,
    title: "Registrar Factura",
    description: "Agrega una factura nueva de un proveedor.",
  },
  {
    to: "/comprobantes",
    icon: Camera,
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
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <Link
              key={opt.to}
              to={opt.to}
              className="flex flex-col items-center text-center gap-3 bg-white border border-slate-200 rounded-lg shadow-sm p-8 hover:border-brand-orange hover:shadow-md transition"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-greenDark text-white">
                <Icon size={26} strokeWidth={2} />
              </span>
              <span className="text-lg font-semibold text-slate-900">{opt.title}</span>
              <span className="text-sm text-slate-500">{opt.description}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
