import { describe, it, expect, beforeEach } from 'vitest';
import { monitoring } from '@/lib/monitoring';

describe('Centralized Monitoring & Error Tracking Service', () => {
  beforeEach(() => {
    monitoring.clearErrors();
  });

  it('captures an exception with stack trace, level, and breadcrumbs', () => {
    monitoring.addBreadcrumb({ category: 'ui', message: 'User clicked Rent Button' });
    monitoring.addBreadcrumb({ category: 'network', message: 'POST /api/orders request started' });

    const err = new Error('Database transaction lock timeout');
    const logged = monitoring.captureException(err, {
      source: 'api',
      level: 'error',
      component: 'OrderService',
    });

    expect(logged).toBeDefined();
    expect(logged.message).toBe('Database transaction lock timeout');
    expect(logged.level).toBe('error');
    expect(logged.source).toBe('api');
    expect(logged.breadcrumbs.length).toBeGreaterThanOrEqual(2);
    expect(logged.breadcrumbs.some(b => b.message.includes('User clicked Rent Button'))).toBe(true);

    const stored = monitoring.getErrors();
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe(logged.id);
  });

  it('records user context on captured errors', () => {
    monitoring.setUser({
      id: 'staff-77',
      name: 'Bobur Mirzayev',
      email: 'bobur@arboss.uz',
      role: 'manager',
    });

    const logged = monitoring.captureException(new Error('Auth permission check failed'), {
      level: 'warning',
    });

    expect(logged.user).toBeDefined();
    expect(logged.user?.name).toBe('Bobur Mirzayev');
    expect(logged.user?.role).toBe('manager');
  });

  it('measures async function execution time with trackPerformance', async () => {
    const result = await monitoring.trackPerformance('Fetch Catalog Items', async () => {
      await new Promise(r => setTimeout(r, 50));
      return { count: 42 };
    });

    expect(result.count).toBe(42);

    const perf = monitoring.getPerformanceEvents();
    expect(perf.length).toBeGreaterThan(0);
    expect(perf[0].name).toBe('Fetch Catalog Items');
    expect(perf[0].durationMs).toBeGreaterThanOrEqual(40);
    expect(perf[0].success).toBe(true);
  });
});
