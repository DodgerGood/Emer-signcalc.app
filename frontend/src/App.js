import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from './components/ui/sonner';
import '@/App.css';
import ErrorBoundary from './components/ErrorBoundary';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MaterialsPage from './pages/MaterialsPage';
import StockPage from './pages/StockPage';
import InkProfilesPage from './pages/InkProfilesPage';
import LabourTypesPage from './pages/LabourTypesPage';
import InstallTypesPage from './pages/InstallTypesPage';
import RecipesPage from './pages/RecipesPage';
import QuotesPage from './pages/QuotesPage';
import ClientsPage from './pages/ClientsPage';
import QuoteDetailPage from './pages/QuoteDetailPage';
import ApprovalsPage from './pages/ApprovalsPage';
import ProductionPage from './pages/ProductionPage';
import SettingsPage from './pages/SettingsPage';
import CompanyDetailsPage from './pages/CompanyDetailsPage';
import EstimationDashboard from './pages/EstimationDashboard';
import AdminSupportPage from './pages/AdminSupportPage';
import AdminCompaniesPage from './pages/AdminCompaniesPage';
import AdminCommissioningPage from './pages/AdminCommissioningPage';
import AdminSeatManagementPage from './pages/AdminSeatManagementPage';
import AdminCompanyDetailPage from './pages/AdminCompanyDetailPage';
import PlatformAdminLoginPage from './pages/PlatformAdminLoginPage';
import ContactSupportPage from './pages/ContactSupportPage';
import AdminBillingTrackingPage from './pages/AdminBillingTrackingPage';


function ScrollToTop() {
  const location = useLocation();

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    const scrollableElements = document.querySelectorAll(
      'main, [role="main"], .overflow-y-auto, .overflow-auto'
    );

    scrollableElements.forEach((element) => {
      if (element && typeof element.scrollTo === 'function') {
        element.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    });
  }, [location.pathname]);

  return null;
}


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

const PlatformAdminProtectedRoute = ({ children }) => {
  const isPlatformAdminAuthenticated =
    localStorage.getItem('platform_admin_auth') === 'true';

  if (!isPlatformAdminAuthenticated) {
    return <Navigate to="/platform-admin/login" replace />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/platform-admin/login" element={<PlatformAdminLoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/materials"
        element={
          <ProtectedRoute>
            <MaterialsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock"
        element={
          <ProtectedRoute>
            <StockPage />
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
        path="/clients"
        element={
          <ProtectedRoute>
            <ClientsPage />
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
        path="/estimations"
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
        path="/production"
        element={
          <ProtectedRoute>
            <ProductionPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/company-details"
        element={
          <ProtectedRoute>
            <CompanyDetailsPage />
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
        path="/contact-support"
        element={
          <ProtectedRoute>
            <ContactSupportPage />
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
          <PlatformAdminProtectedRoute>
            <AdminSupportPage />
          </PlatformAdminProtectedRoute>
        }
      />

      <Route
        path="/platform-admin/companies"
        element={
          <PlatformAdminProtectedRoute>
            <AdminCompaniesPage />
          </PlatformAdminProtectedRoute>
        }
      />

      <Route
        path="/platform-admin/companies/:companyId"
        element={
          <PlatformAdminProtectedRoute>
            <AdminCompanyDetailPage />
          </PlatformAdminProtectedRoute>
        }
      />

      <Route
        path="/platform-admin/commissioning"
        element={
          <PlatformAdminProtectedRoute>
            <AdminCommissioningPage />
          </PlatformAdminProtectedRoute>
        }
      />

      <Route
        path="/platform-admin/billing-tracking"
        element={
          <PlatformAdminProtectedRoute>
            <AdminBillingTrackingPage />
          </PlatformAdminProtectedRoute>
        }
      />

      <Route
        path="/platform-admin/seats"
        element={
          <PlatformAdminProtectedRoute>
            <AdminSeatManagementPage />
          </PlatformAdminProtectedRoute>
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
      <ScrollToTop />
        <div className="App paper-grain">
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
          <Toaster position="top-right" />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
