import { Navigate, Route, Routes } from "react-router-dom";
import { AuthPage } from "../features/auth/AuthPage";
import { DashboardPage } from "../features/documents/DashboardPage";
import { useSession } from "../stores/session";

function ProtectedRoute() {
  const accessToken = useSession((state) => state.accessToken);
  return accessToken ? <DashboardPage /> : <Navigate to="/auth" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/" element={<ProtectedRoute />} />
    </Routes>
  );
}
