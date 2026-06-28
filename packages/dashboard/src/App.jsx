import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ModalProvider } from './contexts/ModalContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import NewCustomersPage from './pages/NewCustomersPage';
import MembersPage from './pages/MembersPage';
import MemberDetailPage from './pages/MemberDetailPage';
import CreateMemberPage from './pages/CreateMemberPage';
import SettingsPage from './pages/SettingsPage';
import ScannerPage from './pages/ScannerPage';
import PaymentsPage from './pages/PaymentsPage';
import ExpensesPage from './pages/ExpensesPage';
import DashboardHomePage from './pages/DashboardHomePage';
import ReportsPage from './pages/ReportsPage';
import ActivityLogPage from './pages/ActivityLogPage';
import BackupsPage from './pages/BackupsPage';
import AttendanceHistoryPage from './pages/AttendanceHistoryPage';
import './design-system.css';

// Placeholder pages for Phase 1 routing structure
const PlaceholderPage = ({ title }) => (
  <div style={{ padding: '2rem' }}>
    <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>{title}</h1>
    <p style={{ color: 'var(--text-secondary)' }}>This module will be built in a future phase.</p>
  </div>
);

function App() {
  return (
    <LanguageProvider>
      <ModalProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Scanner — full-screen kiosk, outside the dashboard layout */}
              <Route path="/scanner" element={<ProtectedRoute><ScannerPage /></ProtectedRoute>} />

              {/* Protected Routes inside Layout */}
              <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                {/* Common Routes */}
                <Route index element={<DashboardHomePage />} />
                <Route path="new-customers" element={<NewCustomersPage />} />
                <Route path="members" element={<MembersPage />} />
                <Route path="members/new" element={<ProtectedRoute adminOnly><CreateMemberPage /></ProtectedRoute>} />
                <Route path="members/:id" element={<MemberDetailPage />} />
                <Route path="subscriptions" element={<SubscriptionsPage />} />
                <Route path="attendance" element={<AttendanceHistoryPage />} />
                <Route path="payments" element={<PaymentsPage />} />

                {/* Admin-Only Routes */}
                <Route path="expenses" element={<ProtectedRoute adminOnly><ExpensesPage /></ProtectedRoute>} />
                <Route path="reports" element={<ProtectedRoute adminOnly><ReportsPage /></ProtectedRoute>} />
                <Route path="settings" element={<ProtectedRoute adminOnly><SettingsPage /></ProtectedRoute>} />
                <Route path="activity-log" element={<ProtectedRoute adminOnly><ActivityLogPage /></ProtectedRoute>} />
                <Route path="backups" element={<ProtectedRoute adminOnly><BackupsPage /></ProtectedRoute>} />
              </Route>

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ModalProvider>
    </LanguageProvider>
  );
}

export default App;
