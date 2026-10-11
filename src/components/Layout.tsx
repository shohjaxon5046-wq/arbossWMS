import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard, PackageCheck, QrCode, Package, Users, ShoppingCart,
  UserCircle, Wallet, Settings as SettingsIcon, Building2,
  Languages, LogOut, Menu, X
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { GlobalSearch, type SearchTarget } from '@/components/GlobalSearch';
import { FloatingAiChat } from '@/components/FloatingAiChat';
import type { UserRole } from '@/types';
import type { TranslationKey } from '@/lib/i18n';

export type PageId =
  | 'dashboard' | 'inbound' | 'locations' | 'catalog' | 'staff' | 'partners'
  | 'orders' | 'crm' | 'finance' | 'settings'
  | 'new-order' | 'my-orders';

interface NavItem {
  id: PageId;
  labelKey: TranslationKey;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

// Strictly pure WMS & Arenda navigation (without separate logistics or full-page AI)
const navItems: NavItem[] = [
  { id: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'cashier', 'warehouse'] },
  { id: 'inbound', labelKey: 'inbound', icon: PackageCheck, roles: ['admin', 'manager', 'warehouse'] },
  { id: 'locations', labelKey: 'locations', icon: QrCode, roles: ['admin', 'manager', 'warehouse'] },
  { id: 'catalog', labelKey: 'catalog', icon: Package, roles: ['admin', 'manager', 'seller', 'warehouse'] },
  { id: 'orders', labelKey: 'orders', icon: ShoppingCart, roles: ['admin', 'manager', 'seller', 'cashier'] },
  { id: 'crm', labelKey: 'crm', icon: UserCircle, roles: ['admin', 'manager', 'seller'] },
  { id: 'partners', labelKey: 'partners', icon: Users, roles: ['admin', 'manager'] },
  { id: 'finance', labelKey: 'finance', icon: Wallet, roles: ['admin', 'manager', 'cashier'] },
  { id: 'staff', labelKey: 'staff', icon: Users, roles: ['admin'] },
  { id: 'my-orders', labelKey: 'myOrders', icon: UserCircle, roles: ['seller'] },
  { id: 'settings', labelKey: 'settings', icon: SettingsIcon, roles: ['admin', 'manager'] },
];

interface LayoutProps {
  currentPage: PageId;
  onPageChange: (page: PageId) => void;
  onSearchSelect: (target: SearchTarget) => void;
  children: ReactNode;
}

export function Layout({ currentPage, onPageChange, onSearchSelect, children }: LayoutProps) {
  const { t, lang, setLang } = useApp();
  const { staff, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userRole = staff?.role || 'admin';
  const visibleItems = navItems.filter(item => item.roles.includes(userRole));

  const handleNavClick = (page: PageId) => {
    onPageChange(page);
    setSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Clean White & Slate-50) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-md shadow-blue-600/30">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-slate-900">Arboss WMS</p>
              <p className="text-[10px] font-medium text-slate-400">Arenda & Ombor ERP</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-50 font-semibold text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        {/* User profile & Role switcher */}
        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-sm">
              {staff?.full_name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-900">{staff?.full_name || 'Admin'}</p>
              <span className="inline-block rounded px-1.5 py-0.2 text-[10px] font-medium bg-blue-100 text-blue-800">
                {t(staff?.role as TranslationKey || 'admin')}
              </span>
            </div>
            <button
              onClick={signOut}
              title={lang === 'uz' ? 'Chiqish' : 'Выход'}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <GlobalSearch allowedPages={visibleItems.map(i => i.id)} onSelect={onSearchSelect} />
          </div>

          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === 'uz' ? 'ru' : 'uz')}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Languages className="h-3.5 w-3.5" />
              <span>{lang === 'uz' ? 'RU' : 'UZ'}</span>
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Floating AI Chat Window in the Bottom Right */}
      <FloatingAiChat />
    </div>
  );
}
