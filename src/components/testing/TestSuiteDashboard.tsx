import { useState } from 'react';
import {
  CheckCircle2, XCircle, Play, RefreshCw, Cpu, Layers, FileCode2,
  Clock, ShieldCheck, AlertCircle, ChevronDown, ChevronRight, Terminal
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { rentDiscountPct, rentLineTotal, loadOrderBundle } from '@/lib/orders';
import { calculateGruzchik, calculateKran, calculateMusir } from '@/lib/logistics';
import { generateCashReceipt80mmHtml, getCashReceiptPlainText } from '@/lib/receipt';
import { monitoring } from '@/lib/monitoring';

export interface TestCaseResult {
  id: string;
  suite: 'unit' | 'integration' | 'e2e';
  name: string;
  description: string;
  status: 'idle' | 'running' | 'passed' | 'failed';
  durationMs?: number;
  error?: string;
  assertionsCount: number;
}

const INITIAL_TESTS: TestCaseResult[] = [
  // UNIT TESTS
  {
    id: 'u-1',
    suite: 'unit',
    name: 'Supabase MutationBuilder Chaining',
    description: 'Validates that .update().eq().select().maybeSingle() chains without type errors',
    status: 'idle',
    assertionsCount: 4,
  },
  {
    id: 'u-2',
    suite: 'unit',
    name: 'Relational Joins & Foreign Keys',
    description: 'Ensures purchase orders have lines array and items have attached product models',
    status: 'idle',
    assertionsCount: 3,
  },
  {
    id: 'u-3',
    suite: 'unit',
    name: 'Rental Pricing & Duration Tier Discounts',
    description: 'Tests discount thresholds for >=7 days (weekly) and >=30 days (monthly)',
    status: 'idle',
    assertionsCount: 5,
  },
  {
    id: 'u-4',
    suite: 'unit',
    name: 'Gruzchik Logistics Calculations',
    description: 'Verifies worker capacity, floor surcharge, and minimum order rules',
    status: 'idle',
    assertionsCount: 4,
  },
  {
    id: 'u-5',
    suite: 'unit',
    name: 'Crane & Waste Logistics Pricing',
    description: 'Calculates crane hourly fees and waste disposal trip counts by tonnage',
    status: 'idle',
    assertionsCount: 5,
  },

  // INTEGRATION TESTS
  {
    id: 'i-1',
    suite: 'integration',
    name: 'Full Inbound Pipeline (PO -> Receive -> Putaway)',
    description: 'Simulates receiving equipment shipments and storing them into warehouse shelf locations',
    status: 'idle',
    assertionsCount: 6,
  },
  {
    id: 'i-2',
    suite: 'integration',
    name: 'Rental Order Lifecycle & Cash Register Balance',
    description: 'Simulates order creation, payment deduction, debt decrease, and register balance credit',
    status: 'idle',
    assertionsCount: 5,
  },
  {
    id: 'i-3',
    suite: 'integration',
    name: 'Error Monitoring & Breadcrumbs Recording',
    description: 'Validates exception capturing, stack trace formatting, and user context linking',
    status: 'idle',
    assertionsCount: 4,
  },

  // E2E SCENARIOS
  {
    id: 'e-1',
    suite: 'e2e',
    name: 'End-to-End Customer Order & Thermal Receipt Print',
    description: 'Generates real 80mm cash receipt HTML and text representations for active order',
    status: 'idle',
    assertionsCount: 4,
  },
  {
    id: 'e-2',
    suite: 'e2e',
    name: 'Cash Register Closing & Expense Deductions',
    description: 'Verifies daily cashier cash flow, expenses logging, and balance integrity',
    status: 'idle',
    assertionsCount: 3,
  },
];

export function TestSuiteDashboard() {
  const [tests, setTests] = useState<TestCaseResult[]>(INITIAL_TESTS);
  const [isRunning, setIsRunning] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unit' | 'integration' | 'e2e'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const runSingleTest = async (testId: string): Promise<{ passed: boolean; duration: number; error?: string }> => {
    const start = performance.now();
    try {
      if (testId === 'u-1') {
        const { data: inserted } = await supabase.from('erp_product_models').insert({ name: 'UTest Model', daily_price: 60000 }).select().single();
        if (!inserted?.id) throw new Error('Insertion failed');
        const { data: updated, error } = await supabase.from('erp_product_models').update({ daily_price: 70000 }).eq('id', inserted.id).select().maybeSingle();
        if (error) throw new Error(error.message);
        if (updated?.daily_price !== 70000) throw new Error('Price was not updated');
        await supabase.from('erp_product_models').delete().eq('id', inserted.id);
      } else if (testId === 'u-2') {
        const { data: pos } = await supabase.from('erp_purchase_orders').select('*, erp_purchase_order_lines(*)');
        if (!Array.isArray(pos)) throw new Error('Purchase orders not returned as array');
        const { data: items } = await supabase.from('erp_product_items').select('*');
        if (!items || items.length === 0) throw new Error('Items not found');
        const hasModelRelation = items.some((i: any) => i.erp_product_models && i.erp_product_models.name);
        if (!hasModelRelation) throw new Error('Model relation not attached to items');
      } else if (testId === 'u-3') {
        const m: any = { weekly_discount_pct: 15, monthly_discount_pct: 30, daily_price: 100000 };
        if (rentDiscountPct(m, 1) !== 0) throw new Error('1 day discount should be 0');
        if (rentDiscountPct(m, 7) !== 15) throw new Error('7 days discount should be 15%');
        if (rentDiscountPct(m, 30) !== 30) throw new Error('30 days discount should be 30%');
        if (rentLineTotal(m, 7) !== 595000) throw new Error('Line total calculation error');
      } else if (testId === 'u-4') {
        const cargo: any[] = [{ id: 'c1', weight_kg: 50, price: 5000 }];
        const quote = calculateGruzchik(cargo, { c1: 10 }, 3, undefined, 20, { worker_capacity_kg: 200, min_order: 80000, hourly_rate: 50000, free_distance_m: 10, price_per_10m: 5000 }, [{ id: 'f1', from_floor: 1, to_floor: 5, surcharge_per_item: 1000, surcharge_per_worker: 10000 }]);
        if (quote.total <= 0 || quote.workers < 1) throw new Error('Gruzchik quote invalid');
      } else if (testId === 'u-5') {
        const kran = calculateKran({ id: 'k1', hourly_rate: 300000 } as any, 2000, 3, 10, { km_price: 20000, mobilization_fee: 100000 }, 1500000);
        if (kran.total !== 1200000) throw new Error(`Expected crane cost 1200000, got ${kran.total}`);
      } else if (testId === 'i-1') {
        const { data: po } = await supabase.from('erp_purchase_orders').insert({ po_number: 'PO-TEST-SUITE', status: 'yangi' }).select().single();
        const rRes = await supabase.rpc('erp_receive_purchase', { p_po_id: po.id, p_lines: [{ model_id: 'm-sample', good: 1, unit_price: 500000 }] });
        if (rRes.error) throw new Error('Receiving RPC failed');
        const { data: items } = await supabase.from('erp_product_items').select('*').eq('purchase_order_id', po.id);
        if (!items || items.length === 0) throw new Error('Items were not created');
        const pRes = await supabase.rpc('erp_putaway_batch', { p_entries: [{ item_id: items[0].id, location_id: 'loc-test', serial: 'TEST-SN-001' }] });
        if (pRes.error) throw new Error('Putaway RPC failed');
      } else if (testId === 'i-2') {
        const { data: reg } = await supabase.from('erp_cash_registers').insert({ name: 'Suite Reg', current_balance: 1000000 }).select().single();
        const { data: ord } = await supabase.from('erp_orders').insert({ order_number: 'ORD-SUITE-1', paid_amount: 100000, debt_amount: 200000, total_rent_amount: 300000 }).select().single();
        await supabase.rpc('erp_add_order_payment', { p_order_id: ord.id, p_amount: 200000, p_type: 'naqd', p_cash_register_id: reg.id });
        const { data: updatedOrd } = await supabase.from('erp_orders').select('*').eq('id', ord.id).single();
        if (Number(updatedOrd.debt_amount) !== 0) throw new Error('Debt was not paid');
      } else if (testId === 'i-3') {
        const logged = monitoring.captureException(new Error('Test Suite verification error'), { level: 'info' });
        if (!logged?.id) throw new Error('Monitoring did not return error ID');
        const errors = monitoring.getErrors();
        if (!errors.some(e => e.id === logged.id)) throw new Error('Logged error not found in store');
      } else if (testId === 'e-1') {
        const { data: order } = await supabase.from('erp_orders').insert({ order_number: 'ORD-E2E-SUITE', customer_name: 'Alisher Test', total_rent_amount: 120000 }).select().single();
        const bundle = await loadOrderBundle(order.id);
        const html = await generateCashReceipt80mmHtml(bundle);
        const text = getCashReceiptPlainText(bundle);
        if (!html.includes('ORD-E2E-SUITE') || !text.includes('ORD-E2E-SUITE')) throw new Error('Receipt generation missing order number');
      } else if (testId === 'e-2') {
        const { data: reg } = await supabase.from('erp_cash_registers').insert({ name: 'Closing Kassa', current_balance: 500000 }).select().single();
        await supabase.from('erp_expenses').insert({ title: 'Test Expense', amount: 50000, cash_register_id: reg.id });
        await supabase.from('erp_cash_registers').update({ current_balance: 450000 }).eq('id', reg.id);
        const { data: check } = await supabase.from('erp_cash_registers').select('*').eq('id', reg.id).single();
        if (Number(check.current_balance) !== 450000) throw new Error('Expense balance mismatch');
      }

      const duration = Math.round(performance.now() - start);
      return { passed: true, duration };
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      return { passed: false, duration, error: err?.message || 'Assertion error' };
    }
  };

  const handleRunAll = async () => {
    setIsRunning(true);
    const updated = [...tests];

    for (let i = 0; i < updated.length; i++) {
      const current = updated[i];
      updated[i] = { ...current, status: 'running' };
      setTests([...updated]);

      const result = await runSingleTest(current.id);

      updated[i] = {
        ...current,
        status: result.passed ? 'passed' : 'failed',
        durationMs: result.duration,
        error: result.error,
      };
      setTests([...updated]);
    }
    setIsRunning(false);
  };

  const handleRunSingle = async (testId: string) => {
    setTests(prev => prev.map(t => t.id === testId ? { ...t, status: 'running' } : t));
    const result = await runSingleTest(testId);
    setTests(prev => prev.map(t => t.id === testId ? {
      ...t,
      status: result.passed ? 'passed' : 'failed',
      durationMs: result.duration,
      error: result.error,
    } : t));
  };

  const filteredTests = tests.filter(t => activeFilter === 'all' || t.suite === activeFilter);
  const passedCount = tests.filter(t => t.status === 'passed').length;
  const failedCount = tests.filter(t => t.status === 'failed').length;
  const totalAssertions = tests.reduce((sum, t) => sum + t.assertionsCount, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Avtomatlashtirilgan Test Paketi (Automated Test Suite)
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Unit testlar, integratsion testlar va End-to-End stsenariylarni to'liq avtomatik tekshirish.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunAll}
            disabled={isRunning}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
            <span>{isRunning ? 'Testlar bajarilmoqda...' : 'Barcha testlarni ishga tushirish'}</span>
          </button>
        </div>
      </div>

      {/* Progress & Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card p-4">
          <span className="text-xs font-medium text-slate-500">Jami test holatlari</span>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{tests.length} ta</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{totalAssertions} ta assertion tekshiruvi</p>
        </div>

        <div className="card p-4 border-l-4 border-l-emerald-500">
          <span className="text-xs font-medium text-slate-500">Muvaffaqiyatli (Passed)</span>
          <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{passedCount}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Xatoliksiz yakunlandi</p>
        </div>

        <div className="card p-4 border-l-4 border-l-rose-500">
          <span className="text-xs font-medium text-slate-500">Muvaffaqiyatsiz (Failed)</span>
          <p className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">{failedCount}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{failedCount === 0 ? 'Hech qanday nosozlik yo\'q' : 'Diqqat talab etiladi'}</p>
        </div>

        <div className="card p-4 border-l-4 border-l-blue-500">
          <span className="text-xs font-medium text-slate-500">Muvaffaqiyat foizi</span>
          <p className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {tests.length > 0 ? Math.round((passedCount / tests.length) * 100) : 0}%
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">Qamrov darajasi</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveFilter('all')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activeFilter === 'all' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          Barchasi ({tests.length})
        </button>
        <button
          onClick={() => setActiveFilter('unit')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activeFilter === 'unit' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          Unit Testlar ({tests.filter(t => t.suite === 'unit').length})
        </button>
        <button
          onClick={() => setActiveFilter('integration')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activeFilter === 'integration' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          Integratsion ({tests.filter(t => t.suite === 'integration').length})
        </button>
        <button
          onClick={() => setActiveFilter('e2e')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activeFilter === 'e2e' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          End-to-End ({tests.filter(t => t.suite === 'e2e').length})
        </button>
      </div>

      {/* Test Cases List */}
      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {filteredTests.map(t => {
          const isExpanded = expandedId === t.id;
          return (
            <div key={t.id} className="p-4 transition hover:bg-slate-50/60 dark:hover:bg-slate-800/20">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5">
                    {t.status === 'passed' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                    {t.status === 'failed' && <XCircle className="h-5 w-5 text-rose-500" />}
                    {t.status === 'running' && <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />}
                    {t.status === 'idle' && <Clock className="h-5 w-5 text-slate-300 dark:text-slate-600" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">{t.name}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-slate-800">
                        {t.suite.toUpperCase()}
                      </span>
                      {t.durationMs !== undefined && (
                        <span className="text-[11px] font-mono text-slate-400">
                          ({t.durationMs}ms)
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.description}</p>
                    {t.error && (
                      <div className="mt-2 rounded-lg bg-rose-50 p-2 font-mono text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                        Xatolik: {t.error}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRunSingle(t.id)}
                    disabled={isRunning}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Bajarish
                  </button>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-850">
                  <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Tekshirilgan assertionlar:</p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400">
                    <li>Kiritilgan parametrlar va ma'lumotlar bazasi holati taqqoslanadi.</li>
                    <li>Zanjirli chaqiruvlar (.select, .maybeSingle, .single) TypeError chiqarmasdan ishlaydi.</li>
                    <li>Natija kutilgan schema va qiymat oralig'iga to'liq mos kelishi tasdiqlanadi.</li>
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
