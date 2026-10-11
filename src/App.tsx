import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { AppProvider } from '@/contexts/AppContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LoginPage } from '@/pages/LoginPage';
import { Layout, type PageId } from '@/components/Layout';
import type { SearchTarget } from '@/components/GlobalSearch';
import { LoadingSpinner } from '@/components/ui/States';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { canAccessPage } from '@/lib/permissions';
import { ShieldAlert } from 'lucide-react';

// Code-split pages for high performance and reduced initial bundle
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const CatalogPage = lazy(() => import('@/pages/CatalogPage').then(m => ({ default: m.CatalogPage })));
const InboundPage = lazy(() => import('@/pages/InboundPage').then(m => ({ default: m.InboundPage })));
const LocationsPage = lazy(() => import('@/pages/LocationsPage').then(m => ({ default: m.LocationsPage })));
const CrmPage = lazy(() => import('@/pages/CrmPage').then(m => ({ default: m.CrmPage })));
const OrdersPage = lazy(() => import('@/pages/OrdersPage').then(m => ({ default: m.OrdersPage })));
const PartnersPage = lazy(() => import('@/pages/PartnersPage').then(m => ({ default: m.PartnersPage })));
const FinancePage = lazy(() => import('@/pages/FinancePage').then(m => ({ default: m.FinancePage })));
const StaffPage = lazy(() => import('@/pages/StaffPage').then(m => ({ default: m.StaffPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const MyOrdersPage = lazy(() => import('@/pages/MyOrdersPage').then(m => ({ default: m.MyOrdersPage })));

function PageLoadingFallback() {
  return (
    <div className="flex h-96 items-center justify-center">
      <LoadingSpinner text="Yuklanmoqda..." />
    </div>
  );
}

function AccessDeniedView() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50/50 p-6 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Ruxsat cheklangan</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Ushbu bo'limga kirish uchun sizning lavozimingizda yetarli huquq mavjud emas.
      </p>
    </div>
  );
}

function AppContent() {
  const { session, staff, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [seed, setSeed] = useState<SearchTarget & { nonce: number } | null>(null);
  const prevRoleRef = useRef<string | undefined>(undefined);

  // Sync default starting page on role change or initial load
  useEffect(() => {
    if (staff) {
      if (prevRoleRef.current === undefined) {
        setCurrentPage(staff.role === 'seller' ? 'my-orders' : 'dashboard');
      } else if (prevRoleRef.current !== staff.role) {
        if (!canAccessPage(staff.role, currentPage)) {
          setCurrentPage(staff.role === 'seller' ? 'my-orders' : 'dashboard');
        }
      }
      prevRoleRef.current = staff.role;
    }
  }, [staff, currentPage]);

  // Reset scroll container position when switching pages
  useEffect(() => {
    const main = document.querySelector('main');
    if (main) {
      main.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [currentPage]);

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

  // RBAC route protection
  if (!canAccessPage(staff?.role, currentPage)) {
    return (
      <Layout currentPage={currentPage} onPageChange={goToPage} onSearchSelect={handleSearchSelect}>
        <AccessDeniedView />
      </Layout>
    );
  }

  const initialSearch = seed?.page === currentPage ? seed.query : undefined;

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage onPageChange={goToPage} />;
      case 'catalog':
        return <CatalogPage initialSearch={initialSearch} />;
      case 'inbound':
        return (
          <InboundPage
            key={seed?.nonce}
            initialSearch={initialSearch}
            initialTab={seed?.page === 'inbound' ? seed.tab : undefined}
          />
        );
      case 'locations':
        return <LocationsPage />;
      case 'crm':
        return <CrmPage initialSearch={initialSearch} />;
      case 'orders':
        return <OrdersPage initialSearch={initialSearch} />;
      case 'new-order':
        return <OrdersPage initialSearch={initialSearch} />;
      case 'partners':
        return <PartnersPage initialSearch={initialSearch} />;
      case 'finance':
        return <FinancePage />;
      case 'staff':
        return <StaffPage />;
      case 'settings':
        return <SettingsPage />;
      case 'my-orders':
        return <MyOrdersPage />;
      default:
        return <DashboardPage onPageChange={goToPage} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={goToPage} onSearchSelect={handleSearchSelect}>
      <ErrorBoundary
        key={currentPage}
        resetKey={currentPage}
        fallbackTitle="Sahifani ko'rsatishda xatolik yuz berdi"
      >
        <Suspense fallback={<PageLoadingFallback />}>
          <div
            key={`${currentPage}-${seed?.nonce ?? 0}`}
            className="w-full min-h-full"
            data-page={currentPage}
          >
            {renderPage()}
          </div>
        </Suspense>
      </ErrorBoundary>
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </AppProvider>
  );
}
