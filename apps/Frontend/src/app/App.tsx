import { Navigate, Route, Routes } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { AuthPage } from "../features/auth/AuthPage";
import { DashboardPage } from "../features/documents/DashboardPage";
import { EditorPage } from "../features/editor/EditorPage";
import { LandingPage } from "../features/landing/LandingPage";
import { useSession } from "../stores/session";

function HomeRoute() {
  const accessToken = useSession((state) => state.accessToken);
  return accessToken ? <DashboardPage /> : <LandingPage />;
}

function ProtectedEditorRoute() {
  const accessToken = useSession((state) => state.accessToken);
  return accessToken ? <EditorPage /> : <Navigate to="/auth" replace />;
}

export function App() {
  const location = useLocation();

  return (
    <div key={location.pathname} className="route-transition">
      <Routes location={location}>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/documents/:documentId" element={<ProtectedEditorRoute />} />
        <Route path="/" element={<HomeRoute />} />
      </Routes>
    </div>
  );
}
