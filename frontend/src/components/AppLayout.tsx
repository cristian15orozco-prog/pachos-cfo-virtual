import { useEffect, useState } from "react";
import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", roles: ["OWNER", "ADMIN", "ACCOUNTANT"] },
  { to: "/facturas", label: "Facturas", roles: ["OWNER", "ADMIN", "ACCOUNTANT"] },
  { to: "/registrar-factura", label: "Registrar Factura", roles: ["OWNER", "ADMIN", "EMPLOYEE"] },
  { to: "/registrar-venta", label: "Registrar Venta", roles: ["OWNER", "ADMIN", "EMPLOYEE"] },
  { to: "/comprobantes", label: "Comprobantes", roles: ["OWNER", "ADMIN", "ACCOUNTANT", "EMPLOYEE"] },
  { to: "/cheques", label: "Cheques", roles: ["OWNER", "ADMIN", "ACCOUNTANT"] },
  { to: "/proveedores", label: "Proveedores", roles: ["OWNER", "ADMIN", "ACCOUNTANT"] },
  { to: "/banco", label: "Banco TD Bank", roles: ["OWNER", "ACCOUNTANT"] },
  { to: "/conciliacion", label: "Conciliación", roles: ["OWNER", "ADMIN", "ACCOUNTANT"] },
  { to: "/flujo-de-caja", label: "Flujo de Caja", roles: ["OWNER", "ADMIN", "ACCOUNTANT"] },
  { to: "/alertas", label: "Alertas", roles: ["OWNER", "ADMIN", "ACCOUNTANT"] },
  { to: "/reportes", label: "Reportes", roles: ["OWNER", "ADMIN", "ACCOUNTANT"] },
  { to: "/configuracion", label: "Configuración", roles: ["OWNER"] },
];

export function AppLayout() {
  const { user, loading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Cierra el menú móvil automáticamente al navegar a otra pantalla.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <div className="flex min-h-screen">
      {/* Barra superior — solo en pantallas angostas (celular) */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-pachos-green text-white flex items-center px-4">
        <button
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Abrir menú"
          className="text-2xl leading-none w-8"
        >
          ☰
        </button>
        <span className="flex-1 text-center font-bold text-sm pr-8">CFO Virtual</span>
      </div>

      {/* Fondo oscuro detrás del menú móvil abierto */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`w-64 shrink-0 bg-pachos-green text-white flex flex-col fixed md:static inset-y-0 left-0 z-50 transition-transform duration-200 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="px-5 py-6 border-b border-white/10">
          <h1 className="text-lg font-bold leading-tight">CFO Virtual</h1>
          <p className="text-xs text-white/70">Pachos Supermarket</p>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-white/15" : "hover:bg-white/10"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10 text-sm">
          <p className="font-medium">{user.fullName}</p>
          <p className="text-white/60 text-xs mb-3">{user.role}</p>
          <button onClick={logout} className="text-xs underline text-white/70 hover:text-white">
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
