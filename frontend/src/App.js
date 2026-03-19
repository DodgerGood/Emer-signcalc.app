import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from './components/ui/sonner';
import '@/App.css';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MaterialsPage from './pages/MaterialsPage';
import InkProfilesPage from './pages/InkProfilesPage';
import LabourTypesPage from './pages/LabourTypesPage';
import InstallTypesPage from './pages/InstallTypesPage';
import RecipesPage from './pages/RecipesPage';
import QuotesPage from './pages/QuotesPage';
import QuoteDetailPage from './pages/QuoteDetailPage';
import ApprovalsPage from './pages/ApprovalsPage';
import SettingsPage from './pages/SettingsPage';
import EstimationDashboard from './pages/EstimationDashboard';
import AdminSupportPage from './pages/AdminSupportPage';
import AdminCompaniesPage from './pages/AdminCompaniesPage';
import AdminCommissioningPage from './pages/AdminCommissioningPage';
import AdminSeatManagementPage from './pages/AdminSeatManagementPage';
import AdminCompanyDetailPage from './pages/AdminCompanyDetailPage';
import PlatformAdminLoginPage from './pages/PlatformAdminLoginPage';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      
      <Route path="/platform-admin/login" element={<PlatformAdminLoginPage />} />

      <Route
        path="/materials"
        element={
          <ProtectedRoute>
            <MaterialsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ink-profiles"
        element={
          <ProtectedRoute>
            <InkProfilesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/labour-types"
        element={
          <ProtectedRoute>
            <LabourTypesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/install-types"
        element={
          <ProtectedRoute>
            <InstallTypesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recipes"
        element={
          <ProtectedRoute>
            <RecipesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quotes"
        element={
          <ProtectedRoute>
            <QuotesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quotes/:id"
        element={
          <ProtectedRoute>
            <QuoteDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/approvals"
        element={
          <ProtectedRoute>
            <ApprovalsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/estimation/:id"
        element={
          <ProtectedRoute>
            <EstimationDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/platform-admin/support"
        element={
          <ProtectedRoute>
            <AdminSupportPage /> 
          </ProtectedRoute>
          }
        /> 
      <Route
        path="/platform-admin/companies"
        element={
          <ProtectedRoute>
            <AdminCompaniesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/platform-admin/companies/:companyId"
        element={
          <ProtectedRoute>
            <AdminCompanyDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/platform-admin/commissioning"
        element={
          <ProtectedRoute>
            <AdminCommissioningPage />
        </ProtectedRoute>
        }
      />

      <Route
        path="/platform-admin/seats"
        element={
          <ProtectedRoute>
            <AdminSeatManagementPage />
          </ProtectedRoute>
        }
      />
      </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="App paper-grain">
          <AppRoutes />
          <Toaster position="top-right" />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
