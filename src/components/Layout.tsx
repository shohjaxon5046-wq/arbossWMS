import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard, PackageCheck, QrCode, Package, Users, Truck, ShoppingCart,
  UserCircle, Wallet, Bot, Settings as SettingsIcon, Building2, ClipboardList, PackageOpen,
  Moon, Sun, Languages, LogOut, Menu, X,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { GlobalSearch, type SearchTarget } from '@/components/GlobalSearch';
import type { UserRole } from '@/types';
import type { TranslationKey } from '@/lib/i18n';

export type PageId =
  | 'dashboard' | 'inbound' | 'locations' | 'catalog' | 'staff' | 'partners'
  | 'orders' | 'crm' | 'finance' | 'ai' | 'settings'
  | 'new-order' | 'my-orders' | 'logistics';

interface NavItem {
  id: PageId;
  labelKey: TranslationKey;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { id: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'seller', 'cashier', 'warehouse'] },
  { id: 'inbound', labelKey: 'inbound', icon: PackageCheck, roles: ['admin', 'manager', 'warehouse'] },
  { id: 'locations', labelKey: 'locations', icon: QrCode, roles: ['admin', 'manager', 'warehouse'] },
  { id: 'catalog', labelKey: 'catalog', icon: Package, roles: ['admin', 'manager', 'seller', 'warehouse'] },
  { id: 'orders', labelKey: 'orders', icon: ShoppingCart, roles: ['admin', 'manager', 'seller', 'cashier'] },
  { id: 'crm', labelKey: 'crm', icon: UserCircle, roles: ['admin', 'manager', 'seller'] },
  { id: 'partners', labelKey: 'partners', icon: Truck, roles: ['admin', 'manager', 'seller'] },
  { id: 'finance', labelKey: 'finance', icon: Wallet, roles: ['admin', 'manager', 'cashier'] },
  { id: 'staff', labelKey: 'staff', icon: Users, roles: ['admin'] },
  { id: 'ai', labelKey: 'aiCopilot', icon: Bot, roles: ['admin', 'manager', 'seller'] },
  { id: 'new-order', labelKey: 'newOrder', icon: ClipboardList, roles: ['admin', 'manager', 'seller'] },
  { id: 'my-orders', labelKey: 'myOrders', icon: PackageOpen, roles: ['seller'] },
  { id: 'logistics', labelKey: 'loOrders', icon: Truck, roles: ['admin', 'manager'] },
  { id: 'settings', labelKey: 'settings', icon: SettingsIcon, roles: ['admin', 'manager'] },
];

interface LayoutProps {
  currentPage: PageId;
  onPageChange: (page: PageId) => void;
  onSearchSelect: (target: SearchTarget) => void;
  children: ReactNode;
}

export function Layout({ currentPage, onPageChange, onSearchSelect, children }: LayoutProps) {
  const { t, lang, setLang, theme, toggleTheme } = useApp();
  const { staff, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userRole = staff?.role || 'seller';
  const visibleItems = navItems.filter(item => item.roles.includes(userRole));

  const handleNavClick = (page: PageId) => {
    onPageChange(page);
    setSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-slate-200 bg-white transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0 lg:static lg:z-auto ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow-md shadow-blue-600/30">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">WMS Arenda</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">ERP System</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800">
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
                className={`sidebar-link w-full ${isActive ? 'sidebar-link-active' : ''}`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {staff?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{staff?.full_name || 'User'}</p>
              <p className="truncate text-xs text-slate-400 dark:text-slate-500">{t(staff?.role as TranslationKey || 'seller')}</p>
            </div>
            <button onClick={signOut} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800">
              <Menu className="h-5 w-5" />
            </button>
            <GlobalSearch allowedPages={visibleItems.map(i => i.id)} onSelect={onSearchSelect} />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === 'uz' ? 'ru' : 'uz')}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Languages className="h-4 w-4" />
              <span className="hidden sm:inline">{lang === 'uz' ? 'UZ' : 'RU'}</span>
            </button>
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {staff?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
