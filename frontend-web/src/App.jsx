import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import PatientDashboardPage from "./pages/PatientDashboardPage";
import DoctorDashboardPage from "./pages/DoctorDashboardPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import PharmacistDashboardPage from "./pages/PharmacistDashboardPage";

function ProtectedRoute({ session, role, children }) {
  if (!session) return <Navigate to="/login" replace />;
  if (role && session.user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function RoleRouter({ session }) {
  if (!session) return <Navigate to="/login" replace />;
  const role = session.user.role;
  if (role === "DOCTOR") return <Navigate to="/doctor" replace />;
  if (role === "ADMIN") return <Navigate to="/admin" replace />;
  if (role === "PHARMACIST") return <Navigate to="/pharmacy" replace />;
  return <Navigate to="/patient" replace />;
}

export default function App() {
  const { i18n } = useTranslation();
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("hms_session")); } catch { return null; }
  });

  const dir = useMemo(() => (i18n.language === "ar" ? "rtl" : "ltr"), [i18n.language]);

  const handleLogin = (payload) => {
    setSession(payload);
    sessionStorage.setItem("hms_session", JSON.stringify(payload));
  };

  const handleLogout = () => {
    setSession(null);
    sessionStorage.removeItem("hms_session");
  };

  return (
    <div dir={dir}>
      <div className="bg-orb-one" aria-hidden="true" />
      <div className="bg-orb-two" aria-hidden="true" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RoleRouter session={session} />} />
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route path="/register" element={<RegisterPage onLogin={handleLogin} />} />
          <Route
            path="/patient/*"
            element={
              <ProtectedRoute session={session} role="PATIENT">
                <PatientDashboardPage session={session} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/*"
            element={
              <ProtectedRoute session={session} role="DOCTOR">
                <DoctorDashboardPage session={session} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute session={session} role="ADMIN">
                <AdminDashboardPage session={session} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pharmacy/*"
            element={
              <ProtectedRoute session={session} role="PHARMACIST">
                <PharmacistDashboardPage session={session} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
