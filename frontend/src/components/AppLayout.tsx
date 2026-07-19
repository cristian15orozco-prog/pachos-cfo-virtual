import { useEffect, useState } from "react";
import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Home,
  FileText,
  FilePlus,
  ShoppingCart,
  Camera,
  Banknote,
  Truck,
  Landmark,
  Scale,
  TrendingUp,
  Bell,
  BarChart3,
  Settings,
  Menu,
  LogOut,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/apiClient";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["OWNER", "ADMIN", "ACCOUNTANT"] },
  { to: "/inicio", label: "Inicio", icon: Home, roles: ["EMPLOYEE"] },
  { to: "/facturas", label: "Facturas", icon: FileText, roles: ["OWNER", "ADMIN", "ACCOUNTANT"] },
  { to: "/registrar-factura", label: "Registrar Factura", icon: FilePlus, roles: ["OWNER", "ADMIN", "EMPLOYEE"] },
  { to: "/registrar-venta", label: "Registrar Venta", icon: ShoppingCart, roles: ["OWNER", "ADMIN", "EMPLOYEE"] },
  { to: "/comprobantes", label: "Comprobantes", icon: Camera, roles: ["OWNER", "ADMIN", "ACCOUNTANT", "EMPLOYEE"] },
  { to: "/cheques", label: "Cheques", icon: Banknote, roles: ["OWNER", "ADMIN", "ACCOUNTANT"] },
  { to: "/proveedores", label: "Proveedores", icon: Truck, roles: ["OWNER", "ADMIN", "ACCOUNTANT"] },
  { to: "/banco", label: "Banco TD Bank", icon: Landmark, roles: ["OWNER", "ACCOUNTANT"] },
  { to: "/conciliacion", label: "Conciliación", icon: Scale, roles: ["OWNER", "ADMIN", "ACCOUNTANT"] },
  { to: "/flujo-de-caja", label: "Flujo de Caja", icon: TrendingUp, roles: ["OWNER", "ADMIN", "ACCOUNTANT"] },
  { to: "/alertas", label: "Alertas", icon: Bell, roles: ["OWNER", "ADMIN", "ACCOUNTANT"] },
  { to: "/reportes", label: "Reportes", icon: BarChart3, roles: ["OWNER", "ADMIN", "ACCOUNTANT"] },
  { to: "/configuracion", label: "Configuración", icon: Settings, roles: ["OWNER"] },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/inicio": "Inicio",
  "/facturas": "Facturas de Proveedores",
  "/registrar-factura": "Registrar Factura",
  "/registrar-venta": "Registrar Venta",
  "/comprobantes": "Comprobantes",
  "/cheques": "Cheques",
  "/proveedores": "Proveedores",
  "/banco": "Banco TD Bank",
  "/conciliacion": "Conciliación Bancaria",
  "/flujo-de-caja": "Flujo de Caja",
  "/alertas": "Alertas",
  "/reportes": "Reportes",
  "/configuracion": "Configuración",
};

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AppLayout() {
  const { user, loading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const canSeeAlerts = !!user && ["OWNER", "ADMIN", "ACCOUNTANT"].includes(user.role);
  const openAlerts = useQuery({
    queryKey: ["alerts-count"],
    queryFn: () => api.get<{ data: unknown[] }>("/alerts?status=OPEN").then((r) => r.data.length),
    enabled: canSeeAlerts,
  });

  // Cierra el menú móvil automáticamente al navegar a otra pantalla.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const pageTitle = PAGE_TITLES[location.pathname] ?? "CFO Virtual";

  return (
    <div className="flex min-h-screen bg-brand-grayLight">
      {/* Fondo oscuro detrás del menú móvil abierto */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
      )}

      <aside
        className={`w-64 shrink-0 bg-brand-greenDark text-white flex flex-col fixed md:static inset-y-0 left-0 z-50 transition-transform duration-200 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <img src="/pachos-logo.png" alt="Pachos Minimarket" className="h-9 w-9 object-contain shrink-0" />
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold leading-tight truncate">CFO Virtual</h1>
            <p className="text-[11px] text-white/60 truncate">Pachos Minimarket</p>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition ${
                    isActive ? "bg-brand-orange text-white" : "text-white/85 hover:bg-white/10"
                  }`
                }
              >
                <Icon size={17} strokeWidth={2} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <button onClick={logout} className="flex items-center gap-2 text-xs text-white/70 hover:text-white">
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Barra superior */}
        <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú"
              className="md:hidden text-slate-500 hover:text-slate-700"
            >
              <Menu size={22} />
            </button>
            <img src="/pachos-logo.png" alt="" className="h-7 w-7 object-contain shrink-0 md:hidden" />
            <h2 className="text-base font-semibold text-brand-text truncate">{pageTitle}</h2>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {canSeeAlerts && (
              <NavLink to="/alertas" aria-label="Alertas" className="relative text-slate-500 hover:text-slate-700">
                <Bell size={20} />
                {!!openAlerts.data && openAlerts.data > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-bold text-white">
                    {openAlerts.data}
                  </span>
                )}
              </NavLink>
            )}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-greenDark text-xs font-bold text-white shrink-0">
                {initials(user.fullName)}
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-sm font-medium text-brand-text">{user.fullName}</p>
                <p className="text-xs text-slate-400">{user.role}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
