import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  INITIAL_STAFF, INITIAL_CATEGORIES, INITIAL_LOCATIONS, INITIAL_MODELS,
  INITIAL_ITEMS, INITIAL_SUPPLIERS, INITIAL_CUSTOMERS, INITIAL_ORDERS,
  INITIAL_ORDER_ITEMS, INITIAL_CASH_REGISTERS, INITIAL_EXPENSES,
  INITIAL_PAYMENTS, INITIAL_PARTNERS, INITIAL_SERVICE_ORDERS,
  INITIAL_PURCHASE_ORDERS, INITIAL_CARGO_ITEMS, INITIAL_FLOOR_PRICING,
  INITIAL_LIFT_TYPES, INITIAL_LOADER_SETTINGS, INITIAL_EQUIPMENT,
  INITIAL_EQUIPMENT_SETTINGS, INITIAL_WASTE_VEHICLES, INITIAL_WASTE_TYPES,
  INITIAL_WASTE_SETTINGS, INITIAL_LOGISTICS_ORDERS, INITIAL_SETTINGS_MAP
} from './mockData';

// Local storage storage keys
const DB_PREFIX = 'arboss_db_';

function getStoredTable<T>(key: string, defaultData: T[]): T[] {
  try {
    const raw = localStorage.getItem(DB_PREFIX + key);
    if (!raw) return defaultData;
    return JSON.parse(raw);
  } catch {
    return defaultData;
  }
}

function setStoredTable<T>(key: string, data: T[]) {
  try {
    localStorage.setItem(DB_PREFIX + key, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

export function resetDatabaseToDefaults() {
  localStorage.removeItem(DB_PREFIX + 'erp_staff');
  localStorage.removeItem(DB_PREFIX + 'erp_categories');
  localStorage.removeItem(DB_PREFIX + 'erp_warehouse_locations');
  localStorage.removeItem(DB_PREFIX + 'erp_product_models');
  localStorage.removeItem(DB_PREFIX + 'erp_product_items');
  localStorage.removeItem(DB_PREFIX + 'erp_suppliers');
  localStorage.removeItem(DB_PREFIX + 'erp_customers');
  localStorage.removeItem(DB_PREFIX + 'erp_orders');
  localStorage.removeItem(DB_PREFIX + 'erp_order_items');
  localStorage.removeItem(DB_PREFIX + 'erp_cash_registers');
  localStorage.removeItem(DB_PREFIX + 'erp_expenses');
  localStorage.removeItem(DB_PREFIX + 'erp_order_payments');
  localStorage.removeItem(DB_PREFIX + 'erp_service_partners');
  localStorage.removeItem(DB_PREFIX + 'erp_service_orders');
  localStorage.removeItem(DB_PREFIX + 'erp_purchase_orders');
  localStorage.removeItem(DB_PREFIX + 'cargo_items');
  localStorage.removeItem(DB_PREFIX + 'floor_pricing');
  localStorage.removeItem(DB_PREFIX + 'lift_types');
  localStorage.removeItem(DB_PREFIX + 'loader_settings');
  localStorage.removeItem(DB_PREFIX + 'equipment');
  localStorage.removeItem(DB_PREFIX + 'equipment_settings');
  localStorage.removeItem(DB_PREFIX + 'waste_vehicles');
  localStorage.removeItem(DB_PREFIX + 'waste_types');
  localStorage.removeItem(DB_PREFIX + 'waste_settings');
  localStorage.removeItem(DB_PREFIX + 'logistics_orders');
  localStorage.removeItem(DB_PREFIX + 'erp_settings');
  window.location.reload();
}

export function exportDatabaseBackup(): string {
  const tables = [
    'erp_staff', 'erp_categories', 'erp_warehouse_locations', 'erp_product_models',
    'erp_product_items', 'erp_suppliers', 'erp_customers', 'erp_orders',
    'erp_order_items', 'erp_cash_registers', 'erp_expenses', 'erp_order_payments',
    'erp_service_partners', 'erp_service_orders', 'erp_purchase_orders',
    'cargo_items', 'floor_pricing', 'lift_types', 'equipment', 'waste_vehicles',
    'logistics_orders', 'erp_settings'
  ];
  const dump: Record<string, unknown> = {};
  for (const t of tables) {
    const raw = localStorage.getItem(DB_PREFIX + t);
    dump[t] = raw ? JSON.parse(raw) : null;
  }
  return JSON.stringify(dump, null, 2);
}

export function importDatabaseBackup(jsonStr: string): boolean {
  try {
    const data = JSON.parse(jsonStr);
    for (const [key, val] of Object.entries(data)) {
      if (val !== null && val !== undefined) {
        localStorage.setItem(DB_PREFIX + key, JSON.stringify(val));
      }
    }
    return true;
  } catch {
    return false;
  }
}

// In-memory / localStorage DB state
class LocalStore {
  getTable(name: string): any[] {
    switch (name) {
      case 'erp_staff': return getStoredTable('erp_staff', INITIAL_STAFF);
      case 'erp_categories': return getStoredTable('erp_categories', INITIAL_CATEGORIES);
      case 'erp_warehouse_locations': return getStoredTable('erp_warehouse_locations', INITIAL_LOCATIONS);
      case 'erp_product_models': return getStoredTable('erp_product_models', INITIAL_MODELS);
      case 'erp_product_items': return getStoredTable('erp_product_items', INITIAL_ITEMS);
      case 'erp_suppliers': return getStoredTable('erp_suppliers', INITIAL_SUPPLIERS);
      case 'erp_customers': return getStoredTable('erp_customers', INITIAL_CUSTOMERS);
      case 'erp_orders': return getStoredTable('erp_orders', INITIAL_ORDERS);
      case 'erp_order_items': return getStoredTable('erp_order_items', INITIAL_ORDER_ITEMS);
      case 'erp_cash_registers': return getStoredTable('erp_cash_registers', INITIAL_CASH_REGISTERS);
      case 'erp_expenses': return getStoredTable('erp_expenses', INITIAL_EXPENSES);
      case 'erp_order_payments': return getStoredTable('erp_order_payments', INITIAL_PAYMENTS);
      case 'erp_service_partners': return getStoredTable('erp_service_partners', INITIAL_PARTNERS);
      case 'erp_service_orders': return getStoredTable('erp_service_orders', INITIAL_SERVICE_ORDERS);
      case 'erp_purchase_orders': return getStoredTable('erp_purchase_orders', INITIAL_PURCHASE_ORDERS);
      case 'cargo_items': return getStoredTable('cargo_items', INITIAL_CARGO_ITEMS);
      case 'floor_pricing': return getStoredTable('floor_pricing', INITIAL_FLOOR_PRICING);
      case 'lift_types': return getStoredTable('lift_types', INITIAL_LIFT_TYPES);
      case 'loader_settings': {
        const s = getStoredTable('loader_settings', Object.entries(INITIAL_LOADER_SETTINGS).map(([k, v]) => ({ key: k, value: v })));
        return s;
      }
      case 'equipment': return getStoredTable('equipment', INITIAL_EQUIPMENT);
      case 'equipment_settings': {
        return getStoredTable('equipment_settings', Object.entries(INITIAL_EQUIPMENT_SETTINGS).map(([k, v]) => ({ key: k, value: v })));
      }
      case 'waste_vehicles': return getStoredTable('waste_vehicles', INITIAL_WASTE_VEHICLES);
      case 'waste_types': return getStoredTable('waste_types', INITIAL_WASTE_TYPES);
      case 'waste_settings': {
        return getStoredTable('waste_settings', Object.entries(INITIAL_WASTE_SETTINGS).map(([k, v]) => ({ key: k, value: v })));
      }
      case 'logistics_orders': return getStoredTable('logistics_orders', INITIAL_LOGISTICS_ORDERS);
      case 'logistics_order_history': return getStoredTable('logistics_order_history', []);
      case 'erp_supplier_returns': return getStoredTable('erp_supplier_returns', []);
      case 'erp_supplier_transactions': return getStoredTable('erp_supplier_transactions', []);
      case 'erp_maintenance_logs': return getStoredTable('erp_maintenance_logs', []);
      case 'erp_ai_conversations': return getStoredTable('erp_ai_conversations', []);
      case 'erp_settings': {
        const entries = Object.entries(INITIAL_SETTINGS_MAP).map(([key, value]) => ({ key, value }));
        return getStoredTable('erp_settings', entries);
      }
      default:
        return getStoredTable(name, []);
    }
  }

  saveTable(name: string, data: any[]) {
    setStoredTable(name, data);
  }
}

const localStore = new LocalStore();

// Query Builder Mock that supports chained calls
class MockQueryBuilder {
  private table: string;
  private filters: Array<(row: any) => boolean> = [];
  private orderField?: string;
  private orderAsc: boolean = true;
  private limitCount?: number;
  private singleResult: boolean = false;
  private fieldsToSelect: string = '*';

  constructor(table: string) {
    this.table = table;
  }

  select(fields = '*') {
    this.fieldsToSelect = fields;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push(row => row[column] === value);
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push(row => row[column] !== value);
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push(row => values.includes(row[column]));
    return this;
  }

  ilike(column: string, pattern: string) {
    const cleanPattern = pattern.replace(/%/g, '').toLowerCase();
    this.filters.push(row => {
      const val = String(row[column] ?? '').toLowerCase();
      return val.includes(cleanPattern);
    });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAsc = options?.ascending ?? true;
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  single() {
    this.singleResult = true;
    return this.execute();
  }

  maybeSingle() {
    this.singleResult = true;
    return this.execute();
  }

  then(onfulfilled?: (res: any) => any, onrejected?: (err: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<{ data: any; error: any }> {
    const all = [...localStore.getTable(this.table)];
    let result = all.filter(row => this.filters.every(f => f(row)));

    if (this.orderField) {
      result.sort((a, b) => {
        const valA = a[this.orderField!];
        const valB = b[this.orderField!];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        const res = valA > valB ? 1 : -1;
        return this.orderAsc ? res : -res;
      });
    }

    if (this.limitCount !== undefined) {
      result = result.slice(0, this.limitCount);
    }

    if (this.singleResult) {
      return { data: result[0] ?? null, error: null };
    }

    return { data: result, error: null };
  }

  async insert(values: any | any[]) {
    const items = Array.isArray(values) ? values : [values];
    const current = localStore.getTable(this.table);
    const stamped = items.map(item => ({
      id: item.id || `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: item.created_at || new Date().toISOString(),
      updated_at: item.updated_at || new Date().toISOString(),
      ...item,
    }));
    const updated = [...current, ...stamped];
    localStore.saveTable(this.table, updated);

    return {
      data: Array.isArray(values) ? stamped : stamped[0],
      error: null,
      select: () => ({
        single: async () => ({ data: stamped[0], error: null }),
        then: (fn: any) => Promise.resolve({ data: stamped, error: null }).then(fn),
      }),
    };
  }

  async update(values: any) {
    return {
      eq: (column: string, targetVal: any) => {
        const current = localStore.getTable(this.table);
        let updatedCount = 0;
        const updated = current.map(row => {
          if (row[column] === targetVal) {
            updatedCount++;
            return { ...row, ...values, updated_at: new Date().toISOString() };
          }
          return row;
        });
        localStore.saveTable(this.table, updated);
        return Promise.resolve({ data: updatedCount, error: null });
      },
    };
  }

  async delete() {
    return {
      eq: (column: string, targetVal: any) => {
        const current = localStore.getTable(this.table);
        const updated = current.filter(row => row[column] !== targetVal);
        localStore.saveTable(this.table, updated);
        return Promise.resolve({ data: true, error: null });
      },
    };
  }

  async upsert(values: any | any[]) {
    const items = Array.isArray(values) ? values : [values];
    const current = localStore.getTable(this.table);
    for (const item of items) {
      const keyCol = item.key ? 'key' : 'id';
      const idx = current.findIndex(r => r[keyCol] === item[keyCol]);
      if (idx >= 0) {
        current[idx] = { ...current[idx], ...item, updated_at: new Date().toISOString() };
      } else {
        current.push({
          id: item.id || `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          created_at: new Date().toISOString(),
          ...item,
        });
      }
    }
    localStore.saveTable(this.table, current);
    return { data: values, error: null };
  }
}

// Full Hybrid Mock Client
function createMockClient() {
  return {
    from: (table: string) => new MockQueryBuilder(table),

    rpc: async (funcName: string, args: any = {}) => {
      try {
        switch (funcName) {
          case 'erp_putaway_batch': {
            const { p_entries } = args;
            const items = localStore.getTable('erp_product_items');
            if (Array.isArray(p_entries)) {
              for (const entry of p_entries) {
                const item = items.find(i => i.id === entry.product_item_id);
                if (item) {
                  item.warehouse_location_id = entry.warehouse_location_id;
                  item.warehouse_location_shelf = entry.shelf_code || '';
                  item.status = 'omborda_bosh';
                  item.updated_at = new Date().toISOString();
                }
              }
              localStore.saveTable('erp_product_items', items);
            }
            return { data: true, error: null };
          }

          case 'erp_receive_purchase': {
            const { p_po_id, p_lines } = args;
            const pos = localStore.getTable('erp_purchase_orders');
            const items = localStore.getTable('erp_product_items');
            const po = pos.find(p => p.id === p_po_id);
            if (po && Array.isArray(p_lines)) {
              for (const line of p_lines) {
                const pol = po.erp_purchase_order_lines?.find((l: any) => l.model_id === line.model_id);
                if (pol) {
                  pol.quantity_received = (pol.quantity_received || 0) + (line.quantity || 1);
                }
                const serials = Array.isArray(line.serials) ? line.serials : [`SN-${Date.now().toString().slice(-4)}`];
                for (const sn of serials) {
                  items.push({
                    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    model_id: line.model_id,
                    serial_number: sn,
                    barcode: `ARB-${sn}`,
                    status: 'joylashtirish_kutilmoqda',
                    warehouse_location_id: null,
                    warehouse_location_shelf: '',
                    current_order_id: null,
                    purchase_date: new Date().toISOString().split('T')[0],
                    purchase_price: line.unit_price || 0,
                    supplier_id: po.supplier_id,
                    purchase_order_id: po.id,
                    defect_reason: '',
                    depreciation_pct: 0,
                    rental_count: 0,
                    rental_days_total: 0,
                    revenue_total: 0,
                    depreciation_total: 0,
                    notes: 'Yangi qabul qilindi',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  });
                }
              }
              po.status = 'qabul_qilindi';
              localStore.saveTable('erp_purchase_orders', pos);
              localStore.saveTable('erp_product_items', items);
            }
            return { data: true, error: null };
          }

          case 'erp_set_order_status': {
            const { p_order_id, p_status } = args;
            const orders = localStore.getTable('erp_orders');
            const items = localStore.getTable('erp_product_items');
            const ord = orders.find(o => o.id === p_order_id);
            if (ord) {
              ord.status = p_status;
              ord.updated_at = new Date().toISOString();
              if (p_status === 'yakunlandi') {
                ord.actual_return_date = new Date().toISOString();
                items.filter(i => i.current_order_id === p_order_id).forEach(i => {
                  i.status = 'omborda_bosh';
                  i.current_order_id = null;
                });
              } else if (p_status === 'bekor') {
                items.filter(i => i.current_order_id === p_order_id).forEach(i => {
                  i.status = 'omborda_bosh';
                  i.current_order_id = null;
                });
              }
              localStore.saveTable('erp_orders', orders);
              localStore.saveTable('erp_product_items', items);
            }
            return { data: true, error: null };
          }

          case 'erp_add_order_payment': {
            const { p_order_id, p_amount, p_payment_type, p_cash_register_id, p_notes } = args;
            const orders = localStore.getTable('erp_orders');
            const payments = localStore.getTable('erp_order_payments');
            const registers = localStore.getTable('erp_cash_registers');
            const ord = orders.find(o => o.id === p_order_id);
            if (ord) {
              ord.paid_amount = (Number(ord.paid_amount) || 0) + Number(p_amount);
              ord.debt_amount = Math.max(0, (Number(ord.debt_amount) || 0) - Number(p_amount));
              localStore.saveTable('erp_orders', orders);
            }
            payments.push({
              id: `pay-${Date.now()}`,
              order_id: p_order_id,
              amount: Number(p_amount),
              payment_type: p_payment_type || 'naqd',
              cash_register_id: p_cash_register_id || null,
              date: new Date().toISOString(),
              notes: p_notes || '',
              created_by: 'Kassir',
              created_at: new Date().toISOString(),
            });
            localStore.saveTable('erp_order_payments', payments);
            if (p_cash_register_id) {
              const reg = registers.find(r => r.id === p_cash_register_id);
              if (reg) {
                reg.current_balance = (Number(reg.current_balance) || 0) + Number(p_amount);
                localStore.saveTable('erp_cash_registers', registers);
              }
            }
            return { data: true, error: null };
          }

          case 'logistics_set_status': {
            const { p_order_id, p_new_status } = args;
            const orders = localStore.getTable('logistics_orders');
            const history = localStore.getTable('logistics_order_history');
            const ord = orders.find(o => o.id === p_order_id);
            if (ord) {
              const old = ord.status;
              ord.status = p_new_status;
              ord.updated_at = new Date().toISOString();
              localStore.saveTable('logistics_orders', orders);
              history.push({
                id: `hist-${Date.now()}`,
                order_id: p_order_id,
                changed_by: 'Admin',
                old_status: old,
                new_status: p_new_status,
                changed_at: new Date().toISOString(),
                changer_name: 'Admin',
              });
              localStore.saveTable('logistics_order_history', history);
            }
            return { data: true, error: null };
          }

          case 'erp_set_service_status': {
            const { p_service_id, p_status } = args;
            const services = localStore.getTable('erp_service_orders');
            const srv = services.find(s => s.id === p_service_id);
            if (srv) {
              srv.order_status = p_status;
              if (p_status === 'bajarildi') srv.completed_at = new Date().toISOString();
              localStore.saveTable('erp_service_orders', services);
            }
            return { data: true, error: null };
          }

          default:
            return { data: true, error: null };
        }
      } catch (err: any) {
        return { data: null, error: { message: err?.message || 'RPC execution error' } };
      }
    },

    storage: {
      from: (bucket: string) => ({
        upload: async (_path: string, _file: any) => ({
          data: { path: `mock/${Date.now()}.png` },
          error: null,
        }),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&q=80` },
        }),
      }),
    },

    auth: {
      getSession: async () => {
        const stored = localStorage.getItem('arboss_auth_session');
        if (stored) {
          try {
            return { data: { session: JSON.parse(stored) }, error: null };
          } catch {}
        }
        // Default demo session as admin
        const adminStaff = INITIAL_STAFF[0];
        const defaultSession = {
          access_token: 'demo-token-arboss',
          token_type: 'bearer',
          expires_in: 3600,
          user: {
            id: adminStaff.user_id || 'user-admin',
            email: adminStaff.email,
            user_metadata: { full_name: adminStaff.full_name, role: adminStaff.role },
          },
        };
        localStorage.setItem('arboss_auth_session', JSON.stringify(defaultSession));
        return { data: { session: defaultSession }, error: null };
      },

      signInWithPassword: async ({ email }: { email: string; password?: string }) => {
        const staffList = localStore.getTable('erp_staff');
        const found = staffList.find(s => s.email.toLowerCase() === email.toLowerCase());
        if (!found) {
          return { data: null, error: { message: 'Foydalanuvchi topilmadi' } };
        }
        const session = {
          access_token: 'demo-token-' + found.id,
          token_type: 'bearer',
          expires_in: 3600,
          user: {
            id: found.user_id || `user-${found.id}`,
            email: found.email,
            user_metadata: { full_name: found.full_name, role: found.role },
          },
        };
        localStorage.setItem('arboss_auth_session', JSON.stringify(session));
        return { data: { session, user: session.user }, error: null };
      },

      signOut: async () => {
        localStorage.removeItem('arboss_auth_session');
        return { error: null };
      },

      onAuthStateChange: (callback: (event: string, session: any) => void) => {
        const handleStorage = (e: StorageEvent) => {
          if (e.key === 'arboss_auth_session') {
            const sess = e.newValue ? JSON.parse(e.newValue) : null;
            callback('SIGNED_IN', sess);
          }
        };
        window.addEventListener('storage', handleStorage);
        return {
          data: {
            subscription: {
              unsubscribe: () => window.removeEventListener('storage', handleStorage),
            },
          },
        };
      },
    },
  };
}

// Initialization
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let clientInstance: any = null;

if (envUrl && envKey && !envUrl.includes('placeholder')) {
  try {
    clientInstance = createClient(envUrl, envKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.warn('Supabase initialization failed, falling back to local database engine:', err);
    clientInstance = createMockClient();
  }
} else {
  clientInstance = createMockClient();
}

export const supabase = clientInstance;
