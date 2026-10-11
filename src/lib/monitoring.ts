/**
 * Centralized Error Logging, Monitoring and Diagnostics Engine for Arboss WMS
 * Sentry & LogRocket compatible architectural pattern.
 */

export type SeverityLevel = 'fatal' | 'error' | 'warning' | 'info';

export interface Breadcrumb {
  timestamp: string;
  category: 'ui' | 'navigation' | 'network' | 'auth' | 'db' | 'custom';
  message: string;
  data?: Record<string, unknown>;
  level?: SeverityLevel;
}

export interface MonitoredError {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  level: SeverityLevel;
  source: 'uncaught_exception' | 'unhandled_rejection' | 'react_boundary' | 'api' | 'user_report' | 'manual';
  user?: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
  };
  context?: Record<string, unknown>;
  breadcrumbs: Breadcrumb[];
  performanceMetrics?: {
    memoryUsageMB?: number;
    url: string;
    userAgent: string;
    online: boolean;
  };
}

export interface PerformanceEvent {
  id: string;
  name: string;
  durationMs: number;
  timestamp: string;
  success: boolean;
  details?: Record<string, unknown>;
}

const STORAGE_ERRORS_KEY = 'arboss_monitored_errors';
const STORAGE_CONFIG_KEY = 'arboss_monitoring_config';
const MAX_STORED_ERRORS = 150;
const MAX_BREADCRUMBS = 40;

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) return (globalThis as any).localStorage;
  } catch {
    // ignore
  }
  return null;
}

class MonitoringService {
  private breadcrumbs: Breadcrumb[] = [];
  private userContext?: { id?: string; email?: string; name?: string; role?: string };
  private listeners: Array<() => void> = [];
  private performanceEvents: PerformanceEvent[] = [];
  private webhookUrl: string = '';
  private initialized: boolean = false;
  private inMemoryErrors: MonitoredError[] = [];

  constructor() {
    this.loadConfig();
  }

  public init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    // 1. Uncaught Javascript errors
    window.addEventListener('error', (event: ErrorEvent) => {
      this.captureException(event.error || new Error(event.message || 'Script error'), {
        source: 'uncaught_exception',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // 2. Unhandled Promise Rejections
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const error = reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));
      this.captureException(error, {
        source: 'unhandled_rejection',
      });
    });

    // 3. Navigation tracking breadcrumbs
    window.addEventListener('popstate', () => {
      this.addBreadcrumb({
        category: 'navigation',
        message: `Navigated to ${window.location.pathname}`,
      });
    });

    this.addBreadcrumb({
      category: 'custom',
      message: 'Monitoring service initialized',
      level: 'info',
    });
  }

  private loadConfig() {
    try {
      const storage = getStorage();
      const raw = storage ? storage.getItem(STORAGE_CONFIG_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        this.webhookUrl = parsed.webhookUrl || '';
      }
    } catch {
      // ignore
    }
  }

  public setWebhookUrl(url: string) {
    this.webhookUrl = url;
    try {
      const storage = getStorage();
      if (storage) {
        storage.setItem(STORAGE_CONFIG_KEY, JSON.stringify({ webhookUrl: url }));
      }
    } catch {
      // ignore
    }
  }

  public getWebhookUrl(): string {
    return this.webhookUrl;
  }

  public setUser(user: { id?: string; email?: string; name?: string; role?: string } | null) {
    this.userContext = user || undefined;
    if (user) {
      this.addBreadcrumb({
        category: 'auth',
        message: `User context set: ${user.name || user.email} (${user.role})`,
      });
    }
  }

  public addBreadcrumb(crumb: Omit<Breadcrumb, 'timestamp'>) {
    const fullCrumb: Breadcrumb = {
      ...crumb,
      timestamp: new Date().toISOString(),
    };
    this.breadcrumbs.push(fullCrumb);
    if (this.breadcrumbs.length > MAX_BREADCRUMBS) {
      this.breadcrumbs.shift();
    }
  }

  public captureException(error: Error | unknown, context?: {
    source?: MonitoredError['source'];
    level?: SeverityLevel;
    [key: string]: unknown;
  }): MonitoredError {
    const errObj = error instanceof Error ? error : new Error(String(error));
    const level: SeverityLevel = context?.level || 'error';
    const source = context?.source || 'manual';

    const memoryUsage = (performance as any)?.memory?.usedJSHeapSize
      ? Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024))
      : undefined;

    const monitoredError: MonitoredError = {
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      message: errObj.message || 'Unknown error',
      stack: errObj.stack,
      level,
      source,
      user: this.userContext,
      context,
      breadcrumbs: [...this.breadcrumbs],
      performanceMetrics: {
        memoryUsageMB: memoryUsage,
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/SSR',
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      },
    };

    this.saveError(monitoredError);
    this.notifyListeners();
    this.dispatchAlert(monitoredError);

    return monitoredError;
  }

  public captureMessage(message: string, level: SeverityLevel = 'info', context?: Record<string, unknown>) {
    return this.captureException(new Error(message), {
      ...context,
      level,
      source: 'manual',
    });
  }

  private saveError(err: MonitoredError) {
    this.inMemoryErrors.unshift(err);
    if (this.inMemoryErrors.length > MAX_STORED_ERRORS) {
      this.inMemoryErrors.pop();
    }
    try {
      const storage = getStorage();
      if (storage) {
        storage.setItem(STORAGE_ERRORS_KEY, JSON.stringify(this.inMemoryErrors));
      }
    } catch {
      // ignore quota limits
    }
  }

  public getErrors(): MonitoredError[] {
    try {
      const storage = getStorage();
      if (storage) {
        const raw = storage.getItem(STORAGE_ERRORS_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch {
      // fallback
    }
    return [...this.inMemoryErrors];
  }

  public clearErrors() {
    this.inMemoryErrors = [];
    try {
      const storage = getStorage();
      if (storage) {
        storage.removeItem(STORAGE_ERRORS_KEY);
      }
      this.notifyListeners();
    } catch {
      // ignore
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => {
      try {
        l();
      } catch {
        // ignore
      }
    });
  }

  private async dispatchAlert(err: MonitoredError) {
    if (!this.webhookUrl || err.level !== 'fatal' && err.level !== 'error') return;
    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert: 'Arboss WMS Critical Error',
          errorId: err.id,
          message: err.message,
          level: err.level,
          user: err.user,
          timestamp: err.timestamp,
        }),
      });
    } catch (e) {
      console.warn('Failed to dispatch webhook alert:', e);
    }
  }

  /**
   * Performance monitoring utility: measures execution time of async functions.
   */
  public async trackPerformance<T>(name: string, fn: () => Promise<T>, details?: Record<string, unknown>): Promise<T> {
    const start = performance.now();
    let success = true;
    try {
      const result = await fn();
      return result;
    } catch (e) {
      success = false;
      throw e;
    } finally {
      const durationMs = Math.round(performance.now() - start);
      const perfEvent: PerformanceEvent = {
        id: `perf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        durationMs,
        timestamp: new Date().toISOString(),
        success,
        details,
      };
      this.performanceEvents.unshift(perfEvent);
      if (this.performanceEvents.length > 50) this.performanceEvents.pop();

      if (durationMs > 1500) {
        this.addBreadcrumb({
          category: 'network',
          message: `Slow operation detected: ${name} took ${durationMs}ms`,
          level: 'warning',
        });
      }
    }
  }

  public getPerformanceEvents(): PerformanceEvent[] {
    return [...this.performanceEvents];
  }
}

export const monitoring = new MonitoringService();
monitoring.init();
