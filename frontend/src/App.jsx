import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Toast from "./components/Toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import StaffLogin from "./pages/StaffLogin";
import StaffPanel from "./pages/StaffPanel";

function Loading() {
  return <div className="min-h-screen grid place-items-center text-slate-500 text-sm">Memuat...</div>;
}

function homeFor(user) {
  return user?.role === "ORTU" ? "/wali/app" : "/panel";
}

function Guard({ children, allow }) {
  const { token, user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!token) return <Navigate to={allow === "ORTU" ? "/wali" : "/"} replace />;
  if (allow === "ORTU" && user?.role !== "ORTU") return <Navigate to="/panel" replace />;
  if (allow === "STAFF" && user?.role === "ORTU") return <Navigate to="/wali/app" replace />;
  return children;
}

function PublicOnly({ children, portal }) {
  const { token, user, raporUrl, loading } = useAuth();
  if (loading) return <Loading />;
  if (token && portal === "wali" && user?.role === "ORTU" && raporUrl) {
    window.location.replace(raporUrl);
    return <Loading />;
  }
  if (token) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function AppRoutes() {
  const [toast, setToast] = useState(null);
  const showToast = (title, msg) => setToast({ title, msg });

  return (
    <>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Routes>
        <Route
          path="/"
          element={
            <PublicOnly portal="staff">
              <StaffLogin showToast={showToast} />
            </PublicOnly>
          }
        />
        <Route
          path="/wali"
          element={
            <PublicOnly portal="wali">
              <Landing showToast={showToast} />
            </PublicOnly>
          }
        />
        <Route
          path="/wali/app"
          element={
            <Guard allow="ORTU">
              <Dashboard showToast={showToast} />
            </Guard>
          }
        />
        <Route
          path="/panel"
          element={
            <Guard allow="STAFF">
              <StaffPanel showToast={showToast} />
            </Guard>
          }
        />
        <Route path="/app" element={<Navigate to="/wali/app" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
