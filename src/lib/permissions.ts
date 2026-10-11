import type { UserRole } from '@/types';
import type { PageId } from '@/components/Layout';

export type AppPermission =
  | 'catalog:view'
  | 'catalog:edit'
  | 'catalog:edit_pricing'
  | 'orders:view_all'
  | 'orders:view_own'
  | 'orders:create'
  | 'orders:edit'
  | 'orders:delete'
  | 'inbound:view'
  | 'inbound:manage'
  | 'locations:view'
  | 'locations:manage'
  | 'crm:view'
  | 'crm:manage'
  | 'partners:view'
  | 'partners:manage'
  | 'finance:view'
  | 'finance:manage'
  | 'staff:view'
  | 'staff:manage'
  | 'settings:view'
  | 'settings:manage'
  | 'logistics:view'
  | 'logistics:create'
  | 'logistics:manage_tariffs'
  | 'ai:access';

const ROLE_PERMISSIONS: Record<UserRole, readonly AppPermission[]> = {
  admin: [
    'catalog:view', 'catalog:edit', 'catalog:edit_pricing',
    'orders:view_all', 'orders:view_own', 'orders:create', 'orders:edit', 'orders:delete',
    'inbound:view', 'inbound:manage',
    'locations:view', 'locations:manage',
    'crm:view', 'crm:manage',
    'partners:view', 'partners:manage',
    'finance:view', 'finance:manage',
    'staff:view', 'staff:manage',
    'settings:view', 'settings:manage',
    'logistics:view', 'logistics:create', 'logistics:manage_tariffs',
    'ai:access',
  ],
  manager: [
    'catalog:view', 'catalog:edit', 'catalog:edit_pricing',
    'orders:view_all', 'orders:view_own', 'orders:create', 'orders:edit',
    'inbound:view', 'inbound:manage',
    'locations:view', 'locations:manage',
    'crm:view', 'crm:manage',
    'partners:view', 'partners:manage',
    'finance:view',
    'staff:view',
    'settings:view',
    'logistics:view', 'logistics:create',
    'ai:access',
  ],
  seller: [
    'catalog:view',
    'orders:view_own', 'orders:create',
    'crm:view',
    'logistics:view', 'logistics:create',
    'ai:access',
  ],
  cashier: [
    'orders:view_all', 'orders:view_own',
    'finance:view', 'finance:manage',
    'crm:view',
    'catalog:view',
  ],
  warehouse: [
    'catalog:view', 'catalog:edit',
    'inbound:view', 'inbound:manage',
    'locations:view', 'locations:manage',
    'orders:view_all',
  ],
};

const PAGE_REQUIRED_PERMISSIONS: Partial<Record<PageId, AppPermission>> = {
  dashboard: 'orders:view_all',
  catalog: 'catalog:view',
  inbound: 'inbound:view',
  locations: 'locations:view',
  orders: 'orders:view_all',
  'my-orders': 'orders:view_own',
  crm: 'crm:view',
  partners: 'partners:view',
  finance: 'finance:view',
  staff: 'staff:manage',
  settings: 'settings:view',
};

/**
 * Checks if a role has the specified permission
 */
export function hasPermission(role: UserRole | undefined, permission: AppPermission): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  return perms ? perms.includes(permission) : false;
}

/**
 * Checks if a role can access a specific page
 */
export function canAccessPage(role: UserRole | undefined, pageId: PageId): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  const required = PAGE_REQUIRED_PERMISSIONS[pageId];
  if (!required) return true;
  return hasPermission(role, required);
}
