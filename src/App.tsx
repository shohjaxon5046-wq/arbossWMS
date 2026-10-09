import { useState, useEffect } from 'react';
import { AppProvider } from '@/contexts/AppContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LoginPage } from '@/pages/LoginPage';
import { Layout, type PageId } from '@/components/Layout';
import type { SearchTarget } from '@/components/GlobalSearch';
import { DashboardPage } from '@/pages/DashboardPage';
import { CatalogPage } from '@/pages/CatalogPage';
import { InboundPage } from '@/pages/InboundPage';
import { LocationsPage } from '@/pages/LocationsPage';
import { CrmPage } from '@/pages/CrmPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { PartnersPage } from '@/pages/PartnersPage';
import { FinancePage } from '@/pages/FinancePage';
import { StaffPage } from '@/pages/StaffPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AiCopilotPage } from '@/pages/AiCopilotPage';
import { MyOrdersPage } from '@/pages/MyOrdersPage';
import { LoadingSpinner } from '@/components/ui/States';

function AppContent() {
  const { session, staff, loading } = useAuth();
  
  // Set default page based on role
  const defaultPage = staff?.role === 'seller' ? 'catalog' : 'dashboard';
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard'); // we will sync this in useEffect

  const [seed, setSeed] = useState<SearchTarget & { nonce: number } | null>(null);

  useEffect(() => {
    if (staff) {
      setCurrentPage(staff.role === 'seller' ? 'my-orders' : 'dashboard');
    }
  }, [staff]);

  const goToPage = (page: PageId) => {
    setSeed(null);
    setCurrentPage(page);
  };

  const handleSearchSelect = (target: SearchTarget) => {
    setSeed({ ...target, nonce: Date.now() });
    setCurrentPage(target.page);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!session) {
    return <LoginPage />;
  }

  const initialSearch = seed?.page === currentPage ? seed.query : undefined;

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage onPageChange={goToPage} />;
      case 'catalog':
        return <CatalogPage initialSearch={initialSearch} />;
      case 'inbound':
        return <InboundPage key={seed?.nonce} initialSearch={initialSearch} initialTab={seed?.page === 'inbound' ? seed.tab : undefined} />;
      case 'locations':
        return <LocationsPage />;
      case 'crm':
        return <CrmPage initialSearch={initialSearch} />;
      case 'orders':
        return <OrdersPage initialSearch={initialSearch} />;
      case 'partners':
        return <PartnersPage initialSearch={initialSearch} />;
      case 'finance':
        return <FinancePage />;
      case 'staff':
        return <StaffPage />;
      case 'settings':
        return <SettingsPage />;
      case 'ai':
        return <AiCopilotPage />;
      case 'my-orders':
        return <MyOrdersPage />;
      default:
        return <DashboardPage onPageChange={goToPage} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={goToPage} onSearchSelect={handleSearchSelect}>
      <div key={`${currentPage}-${seed?.nonce ?? 0}`}>{renderPage()}</div>
    </Layout>
  );
}

function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </AppProvider>
  );
}

export default App;
