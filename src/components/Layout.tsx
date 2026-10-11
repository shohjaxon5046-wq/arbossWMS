import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard, PackageCheck, QrCode, Package, Users, Truck, ShoppingCart,
  UserCircle, Wallet, Bot, Settings as SettingsIcon, Building2,
  Moon, Sun, Languages, LogOut, Menu, X, ChevronDown, Check, Shield, UserCheck, ShoppingBag, Receipt, Warehouse
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
  { id: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'cashier', 'warehouse'] },
  { id: 'inbound', labelKey: 'inbound', icon: PackageCheck, roles: ['admin', 'manager', 'warehouse'] },
  { id: 'locations', labelKey: 'locations', icon: QrCode, roles: ['admin', 'manager', 'warehouse'] },
  { id: 'catalog', labelKey: 'catalog', icon: Package, roles: ['admin', 'manager', 'seller', 'warehouse'] },
  { id: 'orders', labelKey: 'orders', icon: ShoppingCart, roles: ['admin', 'manager', 'seller', 'cashier'] },
  { id: 'logistics', labelKey: 'logisticsCalc' as any, icon: Truck, roles: ['admin', 'manager', 'seller'] },
  { id: 'crm', labelKey: 'crm', icon: UserCircle, roles: ['admin', 'manager', 'seller'] },
  { id: 'partners', labelKey: 'partners', icon: Users, roles: ['admin', 'manager'] },
  { id: 'finance', labelKey: 'finance', icon: Wallet, roles: ['admin', 'manager', 'cashier'] },
  { id: 'staff', labelKey: 'staff', icon: Users, roles: ['admin'] },
  { id: 'ai', labelKey: 'aiCopilot', icon: Bot, roles: ['admin', 'manager', 'seller'] },
  { id: 'my-orders', labelKey: 'myOrders', icon: UserCircle, roles: ['seller'] },
  { id: 'settings', labelKey: 'settings', icon: SettingsIcon, roles: ['admin', 'manager'] },
];

const ROLES_LIST: { role: UserRole; labelUz: string; labelRu: string; icon: any; color: string }[] = [
  { role: 'admin', labelUz: 'Admin (Shohjaxon)', labelRu: 'Админ', icon: Shield, color: 'text-red-600 bg-red-50 border-red-200' },
  { role: 'manager', labelUz: 'Menejer (Bobur)', labelRu: 'Менеджер', icon: UserCheck, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { role: 'seller', labelUz: 'Sotuvchi (Jasur)', labelRu: 'Продавец', icon: ShoppingBag, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { role: 'cashier', labelUz: 'Kassir (Nilufar)', labelRu: 'Кассир', icon: Receipt, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { role: 'warehouse', labelUz: 'Omborchi (Sherzod)', labelRu: 'Склад', icon: Warehouse, color: 'text-purple-600 bg-purple-50 border-purple-200' },
];

interface LayoutProps {
  currentPage: PageId;
  onPageChange: (page: PageId) => void;
  onSearchSelect: (target: SearchTarget) => void;
  children: ReactNode;
}

export function Layout({ currentPage, onPageChange, onSearchSelect, children }: LayoutProps) {
  const { t, lang, setLang, theme, toggleTheme } = useApp();
  const { staff, switchRole, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const userRole = staff?.role || 'admin';
  const visibleItems = navItems.filter(item => item.roles.includes(userRole));

  const handleNavClick = (page: PageId) => {
    onPageChange(page);
    setSidebarOpen(false);
  };

  const currentRoleInfo = ROLES_LIST.find(r => r.role === userRole) || ROLES_LIST[0];

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900 lg:static lg:z-auto lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-md shadow-blue-600/30">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">Arboss WMS</p>
              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Arenda & Logistika ERP</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
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
                    ? 'bg-blue-50 font-semibold text-blue-700 shadow-sm dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 flex-shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                <span>{item.id === 'logistics' ? (lang === 'uz' ? 'Logistika kalkulyator' : 'Логистика') : t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        {/* User profile & Role switcher */}
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-sm">
              {staff?.full_name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{staff?.full_name || 'Admin'}</p>
              <span className="inline-block rounded px-1.5 py-0.2 text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                {t(staff?.role as TranslationKey || 'admin')}
              </span>
            </div>
            <button
              onClick={signOut}
              title={lang === 'uz' ? 'Chiqish' : 'Выход'}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <GlobalSearch allowedPages={visibleItems.map(i => i.id)} onSelect={onSearchSelect} />
          </div>

          <div className="flex items-center gap-2">
            {/* Role Switcher Pill */}
            <div className="relative">
              <button
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                title={lang === 'uz' ? 'Rolni tezkor almashtirish' : 'Быстро переключить роль'}
              >
                <currentRoleInfo.icon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span className="hidden md:inline font-semibold">
                  {lang === 'uz' ? currentRoleInfo.labelUz : currentRoleInfo.labelRu}
                </span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {roleMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setRoleMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                    <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {lang === 'uz' ? 'Rolni sinash (Demo):' : 'Переключить роль:'}
                    </div>
                    {ROLES_LIST.map(r => {
                      const Icon = r.icon;
                      const isSelected = userRole === r.role;
                      return (
                        <button
                          key={r.role}
                          onClick={() => {
                            switchRole(r.role);
                            setRoleMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                            isSelected
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/60'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5" />
                            <span>{lang === 'uz' ? r.labelUz : r.labelRu}</span>
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === 'uz' ? 'ru' : 'uz')}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Languages className="h-3.5 w-3.5" />
              <span>{lang === 'uz' ? 'RU' : 'UZ'}</span>
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
