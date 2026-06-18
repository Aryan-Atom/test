import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import LoginLoader from "./pages/LoginLoader.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import { isStaticDataMode } from "./utils/staticDataMode.js";

function ProtectedDashboard({ isUserAuthenticated }) {
  const location = useLocation();

  if (!isUserAuthenticated) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <Dashboard />;
}

export default function App() {
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(() => isStaticDataMode);
  const [ssoLoginFailed, setSSOloginFailed] = useState(false);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            isUserAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginLoader
                setIsUserAuthenticated={setIsUserAuthenticated}
                setSSOloginFailed={setSSOloginFailed}
                ssoLoginFailed={ssoLoginFailed}
              />
            )
          }
        />
        <Route
          path="/dashboard/*"
          element={<ProtectedDashboard isUserAuthenticated={isUserAuthenticated} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
