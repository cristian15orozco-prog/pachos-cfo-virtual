import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { ChecksPage } from "./pages/ChecksPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { BankPage } from "./pages/BankPage";
import { ReconciliationPage } from "./pages/ReconciliationPage";
import { CashFlowPage } from "./pages/CashFlowPage";
import { AlertsPage } from "./pages/AlertsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/facturas" element={<InvoicesPage />} />
          <Route path="/cheques" element={<ChecksPage />} />
          <Route path="/proveedores" element={<ProvidersPage />} />
          <Route path="/banco" element={<BankPage />} />
          <Route path="/conciliacion" element={<ReconciliationPage />} />
          <Route path="/flujo-de-caja" element={<CashFlowPage />} />
          <Route path="/alertas" element={<AlertsPage />} />
          <Route path="/reportes" element={<ReportsPage />} />
          <Route path="/configuracion" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
