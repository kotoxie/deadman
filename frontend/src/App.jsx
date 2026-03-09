import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import ChangePasswordModal from './components/features/ChangePasswordModal.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import VaultListPage from './pages/VaultListPage.jsx';
import VaultItemFormPage from './pages/VaultItemFormPage.jsx';
import VaultItemDetailPage from './pages/VaultItemDetailPage.jsx';
import RecipientListPage from './pages/RecipientListPage.jsx';
import RecipientFormPage from './pages/RecipientFormPage.jsx';
import RecipientDetailPage from './pages/RecipientDetailPage.jsx';
import DeliveryLogsPage from './pages/DeliveryLogsPage.jsx';
import AuditLogPage from './pages/AuditLogPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

function ProtectedRoute({ children }) {
  const { authenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  if (!authenticated) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { authenticated, loading } = useAuth();
  if (loading) return null;
  if (authenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

function FirstLoginPasswordPrompt() {
  const { authenticated, passwordChangeRequired, clearPasswordChangeRequired } = useAuth();
  if (!authenticated || !passwordChangeRequired) return null;
  return (
    <ChangePasswordModal
      open={true}
      onClose={clearPasswordChangeRequired}
      isFirstLogin={true}
    />
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="vault" element={<VaultListPage />} />
        <Route path="vault/new" element={<VaultItemFormPage />} />
        <Route path="vault/:id" element={<VaultItemDetailPage />} />
        <Route path="vault/:id/edit" element={<VaultItemFormPage />} />
        <Route path="recipients" element={<RecipientListPage />} />
        <Route path="recipients/new" element={<RecipientFormPage />} />
        <Route path="recipients/:id" element={<RecipientDetailPage />} />
        <Route path="recipients/:id/edit" element={<RecipientFormPage />} />
        <Route path="logs" element={<DeliveryLogsPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <FirstLoginPasswordPrompt />
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1f2937', color: '#f3f4f6', border: '1px solid #374151' },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
