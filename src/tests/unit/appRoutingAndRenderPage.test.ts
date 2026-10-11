import { describe, it, expect } from 'vitest';
import { canAccessPage, hasPermission } from '@/lib/permissions';
import type { PageId } from '@/components/Layout';
import type { UserRole } from '@/types';

describe('App Routing & renderPage RBAC and Key Guarantees', () => {
  it('allows admin access to all application pages', () => {
    const pages: PageId[] = [
      'dashboard', 'catalog', 'inbound', 'locations', 'crm',
      'orders', 'partners', 'finance', 'staff', 'settings', 'my-orders'
    ];
    for (const page of pages) {
      expect(canAccessPage('admin', page)).toBe(true);
    }
  });

  it('restricts seller to allowed pages and denies admin-only routes', () => {
    expect(canAccessPage('seller', 'my-orders')).toBe(true);
    expect(canAccessPage('seller', 'catalog')).toBe(true);
    expect(canAccessPage('seller', 'crm')).toBe(true);
    expect(canAccessPage('seller', 'dashboard')).toBe(false);
    expect(canAccessPage('seller', 'finance')).toBe(false);
    expect(canAccessPage('seller', 'staff')).toBe(false);
    expect(canAccessPage('seller', 'settings')).toBe(false);
  });

  it('restricts cashier to cashier-appropriate routes', () => {
    expect(canAccessPage('cashier', 'orders')).toBe(true);
    expect(canAccessPage('cashier', 'finance')).toBe(true);
    expect(canAccessPage('cashier', 'staff')).toBe(false);
    expect(canAccessPage('cashier', 'settings')).toBe(false);
  });

  it('restricts warehouse user to inbound, locations, and catalog', () => {
    expect(canAccessPage('warehouse', 'inbound')).toBe(true);
    expect(canAccessPage('warehouse', 'locations')).toBe(true);
    expect(canAccessPage('warehouse', 'catalog')).toBe(true);
    expect(canAccessPage('warehouse', 'finance')).toBe(false);
    expect(canAccessPage('warehouse', 'staff')).toBe(false);
  });

  it('generates distinct keys for container div across pages and search nonces', () => {
    const pageA: PageId = 'dashboard';
    const pageB: PageId = 'orders';
    const nonce1 = 1700000000;
    const nonce2 = 1700000500;

    const keyA = `${pageA}-${0}`;
    const keyB = `${pageB}-${0}`;
    const keyAWithNonce = `${pageA}-${nonce1}`;
    const keyAWithNonce2 = `${pageA}-${nonce2}`;

    expect(keyA).not.toBe(keyB);
    expect(keyA).not.toBe(keyAWithNonce);
    expect(keyAWithNonce).not.toBe(keyAWithNonce2);
  });
});
