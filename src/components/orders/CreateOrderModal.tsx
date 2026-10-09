import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Printer, Truck, Store } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency } from '@/lib/format';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/States';
import { FieldLabel, InlineNotice, type Notice } from '@/components/inbound/InlineNotice';
import { CustomerPicker } from '@/components/orders/CustomerPicker';
import { EquipmentPicker } from '@/components/orders/EquipmentPicker';
import { ServiceLinesEditor, type ServiceLine } from '@/components/orders/ServiceLinesEditor';
import { loadOrderBundle, ordersErrorKey, rentLineTotal, rentDiscountPct } from '@/lib/orders';
import { printOrderReceipt } from '@/lib/receipt';
import { callTelegramBot } from '@/lib/telegram';
import type { CashRegister, Customer, ProductItem, ProductModel, ServicePartner } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (orderId: string) => void;
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs text-white dark:bg-slate-100 dark:text-slate-900">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function CreateOrderModal({ open, onClose, onCreated }: Props) {
  const { t } = useApp();
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ProductModel[]>([]);
  const [available, setAvailable] = useState<ProductItem[]>([]);
  const [partners, setPartners] = useState<ServicePartner[]>([]);
  const [registers, setRegisters] = useState<CashRegister[]>([]);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [days, setDays] = useState('1');
  const [delivery, setDelivery] = useState<'pickup' | 'delivery'>('pickup');
  const [address, setAddress] = useState('');
  const [services, setServices] = useState<ServiceLine[]>([]);
  const [notes, setNotes] = useState('');
  const [pay, setPay] = useState('');
  const [payType, setPayType] = useState('naqd');
  const [registerId, setRegisterId] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const loadRefs = useCallback(async () => {
    setLoading(true);
    const [m, i, p, r] = await Promise.all([
      supabase.from('erp_product_models').select('*').order('name'),
      supabase.from('erp_product_items').select('*').eq('status', 'omborda_bosh').order('serial_number'),
      supabase.from('erp_service_partners').select('*').order('company_name'),
      supabase.from('erp_cash_registers').select('*').eq('is_active', true).order('name'),
    ]);
    const err = m.error || i.error || p.error || r.error;
    if (err) setNotice({ kind: 'error', text: t(ordersErrorKey(err)) });
    setModels((m.data || []) as ProductModel[]);
    setAvailable((i.data || []) as ProductItem[]);
    setPartners((p.data || []) as ServicePartner[]);
    const regs = (r.data || []) as CashRegister[];
    setRegisters(regs);
    setRegisterId(prev => prev || regs[0]?.id || '');
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (!open) return;
    setCustomer(null); setItemIds([]); setDays('1'); setDelivery('pickup'); setAddress('');
    setServices([]); setNotes(''); setPay(''); setPayType('naqd'); setNotice(null);
    loadRefs();
  }, [open, loadRefs]);

  const nDays = Math.min(Math.max(Math.floor(Number(days) || 1), 1), 365);
  const modelById = useMemo(() => new Map(models.map(m => [m.id, m])), [models]);

  const totals = useMemo(() => {
    let gross = 0, rent = 0, deposit = 0;
    for (const id of itemIds) {
      const item = available.find(i => i.id === id);
      const m = item && modelById.get(item.model_id);
      if (!m) continue;
      gross += Number(m.daily_price) * nDays;
      rent += rentLineTotal(m, nDays);
      deposit += Number(m.deposit_amount);
    }
    const svc = services.reduce((s, l) => s + (Number(l.customer_price) || 0), 0);
    return { gross, rent, discount: gross - rent, deposit, svc, total: rent + svc };
  }, [itemIds, available, modelById, nDays, services]);

  const payNum = Math.min(Math.max(Number(pay) || 0, 0), totals.total);
  const hasContent = itemIds.length > 0 || services.length > 0;
  const servicesValid = services.every(s => s.category && Number(s.customer_price) >= 0);

  const submit = async (print: boolean) => {
    if (!customer) { setNotice({ kind: 'error', text: t('ordCustomerOrPhoneRequired') }); return; }
    if (!hasContent) { setNotice({ kind: 'error', text: t('ordEmpty') }); return; }
    setSaving(true);
    setNotice(null);
    try {
      // 1. Generate order number
      const orderNum = 'ORD-' + Math.floor(10000 + Math.random() * 90000).toString();

      // 2. Create the main order
      const { data: orderData, error: orderErr } = await supabase.from('erp_orders').insert({
        order_number: orderNum,
        customer_id: customer.id,
        customer_name: customer.full_name,
        customer_phone: customer.phone_primary,
        status: 'yangi',
        start_date: new Date().toISOString(),
        expected_return_date: new Date(Date.now() + nDays * 86400000).toISOString(),
        delivery_type: delivery,
        delivery_address: delivery === 'delivery' ? address.trim() : '',
        notes: notes.trim(),
        total_rent_amount: totals.rent + totals.svc,
        total_service_amount: totals.svc,
        total_deposit_amount: totals.deposit,
        discount_amount: totals.discount,
        paid_amount: payNum,
        debt_amount: totals.total - payNum
      }).select('id').single();

      if (orderErr) throw orderErr;
      const orderId = orderData.id;

      // 3. Insert items and update product status
      for (const id of itemIds) {
        const item = available.find(i => i.id === id);
        const m = item && modelById.get(item.model_id);
        if (!item || !m) continue;
        
        const disc = rentDiscountPct(m, nDays);
        const line = rentLineTotal(m, nDays);

        await supabase.from('erp_order_items').insert({
          order_id: orderId,
          product_item_id: item.id,
          model_id: item.model_id,
          model_name: m.name,
          serial_number: item.serial_number,
          rent_days: nDays,
          daily_price: m.daily_price,
          deposit_amount: m.deposit_amount,
          discount_pct: disc,
          line_total: line
        });

        await supabase.from('erp_product_items').update({
          status: 'ijarada',
          current_order_id: orderId,
          updated_at: new Date().toISOString()
        }).eq('id', item.id);
      }

      // 4. Insert services
      for (let i = 0; i < services.length; i++) {
        const s = services[i];
        const sPrice = Number(s.customer_price) || 0;
        const sCost = Number(s.partner_cost) || 0;
        await supabase.from('erp_service_orders').insert({
          order_id: orderId,
          order_number: `${orderNum}-S${i + 1}`,
          customer_id: customer.id,
          customer_name: customer.full_name,
          customer_phone: customer.phone_primary,
          assigned_partner_id: s.partner_id || null,
          service_category: s.category,
          service_details: s.details.trim(),
          order_status: 'yangi',
          customer_total_price: sPrice,
          partner_cost: sCost,
          net_profit: sPrice - sCost,
          address: (s.address || address).trim(),
          scheduled_time: s.scheduled_time ? s.scheduled_time.replace('T', ' ') : null,
        });

        if (s.partner_id) {
          await supabase.from('erp_service_partners').update({
            is_available: false, status: 'band'
          }).eq('id', s.partner_id);
        }
      }

      // 5. Payments
      if (payNum > 0 && registerId) {
        await supabase.from('erp_order_payments').insert({
          order_id: orderId,
          amount: payNum,
          payment_type: payType,
          cash_register_id: registerId,
          date: new Date().toISOString()
        });
        
        // Update register balance
        const reg = registers.find(r => r.id === registerId);
        if (reg) {
          await supabase.from('erp_cash_registers').update({
            current_balance: Number(reg.current_balance || 0) + payNum
          }).eq('id', registerId);
        }
      }

      callTelegramBot('notify_order', { order_id: orderId }).catch(() => {});
      if (print) {
        try {
          await printOrderReceipt(await loadOrderBundle(orderId), t);
        } catch {
          /* order is saved; receipt can be reprinted from the order card */
        }
      }
      onCreated(orderId);
    } catch (err: any) {
      console.error('Order creation error:', err);
      const key = ordersErrorKey(err);
      const msg = err?.message || String(err);
      setNotice({ kind: 'error', text: `${t(key)} (${msg})` });
      if (key === 'errItemUnavailable') {
        setItemIds([]);
        loadRefs();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('ordNew')} size="xl">
      {loading ? <LoadingSpinner text={t('loading')} /> : (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0 space-y-7">
            <InlineNotice notice={notice} onClose={() => setNotice(null)} />
            <Section n={1} title={t('ordStepCustomer')}>
              <CustomerPicker selected={customer} onSelect={c => { setCustomer(c); if (c?.address && !address) setAddress(c.address); }} />
            </Section>

            <Section n={2} title={t('ordStepItems')}>
              <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                <div>
                  <FieldLabel>{t('rentDays')}</FieldLabel>
                  <input type="number" min="1" max="365" value={days} onChange={e => setDays(e.target.value)} className="input-field" />
                </div>
                <div>
                  <FieldLabel>{t('delivery')}</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {([['pickup', Store, t('pickup')], ['delivery', Truck, t('delivery')]] as const).map(([v, Icon, label]) => (
                      <button key={v} onClick={() => setDelivery(v)}
                        className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${delivery === v
                          ? 'border-blue-500 bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'}`}>
                        <Icon className="h-4 w-4" /> {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {delivery === 'delivery' && (
                <input value={address} onChange={e => setAddress(e.target.value)} className="input-field animate-fade-in" placeholder={t('deliveryAddress')} maxLength={300} />
              )}
              <EquipmentPicker models={models} available={available} selectedIds={itemIds} days={nDays}
                onAdd={i => setItemIds(ids => ids.includes(i.id) ? ids : [...ids, i.id])}
                onRemove={id => setItemIds(ids => ids.filter(x => x !== id))} />
            </Section>

            <Section n={3} title={t('ordStepServices')}>
              <ServiceLinesEditor lines={services} partners={partners} onChange={setServices} defaultAddress={address} />
            </Section>

            <div>
              <FieldLabel>{t('ordNotes')}</FieldLabel>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input-field" maxLength={1000} />
            </div>
          </div>

          <aside className="lg:sticky lg:top-0 lg:self-start">
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs text-white dark:bg-slate-100 dark:text-slate-900">4</span>
                {t('ordStepPayment')}
              </h3>
              <dl className="space-y-1.5 text-sm">
                <Row label={`${t('ordRentSubtotal')} (${itemIds.length})`} value={formatCurrency(totals.gross)} />
                {totals.discount > 0 && <Row label={t('ordDiscount')} value={`−${formatCurrency(totals.discount)}`} accent="text-emerald-600 dark:text-emerald-400" />}
                <Row label={`${t('ordServicesSubtotal')} (${services.length})`} value={formatCurrency(totals.svc)} />
                <div className="flex items-baseline justify-between border-t border-slate-200 pt-2 dark:border-slate-700">
                  <dt className="font-semibold text-slate-900 dark:text-slate-100">{t('ordGrandTotal')}</dt>
                  <dd className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(totals.total)}</dd>
                </div>
                {totals.deposit > 0 && <Row label={t('ordDeposit')} value={formatCurrency(totals.deposit)} accent="text-amber-600 dark:text-amber-400" />}
              </dl>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <FieldLabel>{t('ordPayNow')}</FieldLabel>
                  <button onClick={() => setPay(String(totals.total))} disabled={!totals.total} className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-40 dark:text-blue-400">{t('ordPayFull')}</button>
                </div>
                <input type="number" min="0" value={pay} onChange={e => setPay(e.target.value)} className="input-field" placeholder="0" />
              </div>
              {payNum > 0 && (
                <div className="grid grid-cols-2 gap-2 animate-fade-in">
                  <select value={payType} onChange={e => setPayType(e.target.value)} className="input-field" aria-label={t('paymentType')}>
                    <option value="naqd">{t('cash')}</option>
                    <option value="plastik">{t('card')}</option>
                    <option value="o'tkazma">{t('transfer')}</option>
                  </select>
                  <select value={registerId} onChange={e => setRegisterId(e.target.value)} className="input-field" aria-label={t('cashRegisters')}>
                    <option value="">—</option>
                    {registers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              )}
              <Row label={t('ordRemaining')} value={formatCurrency(totals.total - payNum)}
                accent={totals.total - payNum > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-emerald-600 font-semibold'} />

              <div className="space-y-2 pt-1">
                <button onClick={() => submit(true)} disabled={saving || !customer || !hasContent || !servicesValid} className="btn-primary w-full justify-center">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} {t('ordCreateAndPrint')}
                </button>
                <button onClick={() => submit(false)} disabled={saving || !customer || !hasContent || !servicesValid} className="btn-secondary w-full justify-center">
                  {t('ordCreate')}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`tabular-nums ${accent ?? 'text-slate-700 dark:text-slate-200'}`}>{value}</dd>
    </div>
  );
}
