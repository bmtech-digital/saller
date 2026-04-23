import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ToastProvider } from './components/ui/Toast';
import { Loading } from './components/ui/Loading';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { NewProposalPage } from './pages/NewProposalPage';
import { ProposalEditorPage } from './pages/ProposalEditorPage';
import { CustomersPage } from './pages/CustomersPage';
import { ClientSignPage } from './pages/ClientSignPage';
import { CoordinatesToolPage } from './pages/CoordinatesToolPage';
import { ErrorLogsPage } from './pages/ErrorLogsPage';

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" text="מתחבר..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function App() {
  const { checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" text="טוען..." />
      </div>
    );
  }

  return (
    <ToastProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/sign/:token" element={<ClientSignPage />} />
        <Route path="/coordinates" element={<CoordinatesToolPage />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/proposals/new"
          element={
            <ProtectedRoute>
              <NewProposalPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/proposals/:id"
          element={
            <ProtectedRoute>
              <ProposalEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <CustomersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <ProtectedRoute>
              <ErrorLogsPage />
            </ProtectedRoute>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}

export default App;
